// Generate a valid rare weapon for a given skill.
//
// Constraints we enforce — failing any of these means the item cannot exist
// in PoE2:
//   - Base is from weapon-bases.json (no invented bases)
//   - Item level cap respected (mod.level <= itemLevel)
//   - Each mod is from item-mods.json (no invented mods)
//   - Each mod's weight > 0 against the base's tags
//   - Base's `no_X_spell_mods` exclude tags reject mods whose modTags include X
//   - No two mods share `group` (mutually-exclusive prefix/suffix slots)
//   - prefix count ≤ 3, suffix count ≤ 3 (rare cap)
//
// Selection strategy: among eligible mods, prefer the highest-tier (top
// `mod.level`) in each scaling category that the skill cares about. We
// rank candidate mods by an "expected DPS contribution" heuristic that
// uses the skill's tags to filter relevance.

import weaponBasesJson from '../data/generated/weapon-bases.json';
import itemModsJson from '../data/generated/item-mods.json';
import skillsJson from '../data/generated/skills.json';
import { ParsedItem } from '../validation/types';
import { ScalingBias } from './synthesizeTree';

interface WeaponBase {
  id: string;
  type: string;
  category: string;
  quality: number;
  socketLimit: number;
  implicit: string | null;
  tags: string[];
  excludeTags: string[];
  req: { level?: number };
  weapon: {
    PhysicalMin?: number; PhysicalMax?: number;
    CritChanceBase?: number; AttackRateBase?: number; Range?: number;
  } | null;
}

interface ItemMod {
  id: string;
  type: 'Prefix' | 'Suffix';
  affix: string;
  level: number;
  group: string;
  stats: { text: string; kind: string; ranges: [number, number][] }[];
  weightKey: string[];
  weightVal: number[];
  modTags: string[];
}

interface SkillRecord {
  id: string;
  name: string;
  skillTypes: string[];
  weaponTypes: string[];
}

const allBases: WeaponBase[] = weaponBasesJson as WeaponBase[];
// `ranges` widens to number[][] when imported as JSON; cast through unknown
// since we know the data shape via the Zod schema in sync-data/schemas.js.
const allMods:  ItemMod[]    = itemModsJson as unknown as ItemMod[];
const skillsById: Record<string, SkillRecord> = {};
for (const s of skillsJson as SkillRecord[]) skillsById[s.id] = s;

const DEFAULT_ITEM_LEVEL = 82;

// =====================================================================
// Eligibility — the rule from docs/validity-model.md Layer 1 in code.
// =====================================================================

export function modCanRollOnBase(mod: ItemMod, base: WeaponBase, itemLevel: number): boolean {
  if (mod.level > itemLevel) return false;

  // weightKey / weightVal: mod can roll if SOME index i has
  //   weightVal[i] > 0  AND  base.tags includes weightKey[i].
  let weightMatch = false;
  for (let i = 0; i < mod.weightKey.length; i++) {
    if ((mod.weightVal[i] ?? 0) > 0 && base.tags.includes(mod.weightKey[i])) {
      weightMatch = true;
      break;
    }
  }
  if (!weightMatch) return false;

  // Exclude tags: base.excludeTags contains `no_X_spell_mods` style entries;
  // if mod's modTags include the corresponding X, reject.
  for (const excl of base.excludeTags) {
    const m = excl.match(/^no_(.+)_spell_mods$/);
    if (!m) continue;
    if (mod.modTags.includes(m[1])) return false;
  }
  return true;
}

// =====================================================================
// Pick base — for a skill's required weapon type, return highest-tier base
// available to the player at the requested item level.
// =====================================================================

export function pickBaseForSkill(skillId: string, itemLevel = DEFAULT_ITEM_LEVEL): WeaponBase | null {
  const skill = skillsById[skillId];
  if (!skill) return null;

  // Skill's weaponTypes lists what it can be used with. If empty, the skill
  // is weapon-agnostic — we infer:
  //   - tag-implied weapon (e.g. tag 'Bow' → Bow weapon)
  //   - or, for spell skills, fall back to a default caster weapon pool.
  let want: Set<string>;
  if (skill.weaponTypes.length) {
    want = new Set(skill.weaponTypes);
  } else {
    const inferred = skill.skillTypes.find(t => ['Bow','Crossbow','Sword','Axe','Mace','Spear','Staff','Wand','Sceptre','Dagger','Claw','Flail'].includes(t));
    if (inferred) {
      want = new Set([inferred]);
    } else if (skill.skillTypes.includes('Spell')) {
      // Spell skills with no weapon requirement default to the caster pool.
      want = new Set(['Wand', 'Staff', 'Sceptre', 'Focus']);
    } else {
      want = new Set();
    }
  }
  if (want.size === 0) return null;

  // Caster weapon limitation: our weapon-bases.json has `weapon: null` for
  // Wand / Sceptre / Focus bases (extracted from PoB without weapon stats
  // because casters don't deal weapon-physical damage). Excluding warstaff
  // bases here for spell builds would leave the candidate pool empty.
  // Until caster bases are re-extracted with their crit / attribute / +Level
  // fields, spell builds keep using Quarterstaff/Staff bases — wrong
  // archetypally but the only bases with non-null `weapon` data.
  // Task #19 + a data extraction pass on caster weapons unblocks the proper
  // filter (commented above).
  const isSpellSkill = skill.skillTypes.includes('Spell') && !skill.skillTypes.includes('Attack');

  const candidates = allBases.filter(b =>
    want.has(b.type) &&
    b.weapon &&
    (b.req.level ?? 0) <= itemLevel
  );
  if (candidates.length === 0) return null;

  // Rank: for attack skills, higher base damage wins. For spells (or
  // weapon-agnostic skills with no clear phys-using profile), pick the
  // highest level requirement (correlates with stronger implicits +
  // higher-tier mod ceilings).
  candidates.sort((a, b) => {
    if (isSpellSkill) {
      return (b.req.level ?? 0) - (a.req.level ?? 0);
    }
    const damA = (a.weapon!.PhysicalMin ?? 0) + (a.weapon!.PhysicalMax ?? 0);
    const damB = (b.weapon!.PhysicalMin ?? 0) + (b.weapon!.PhysicalMax ?? 0);
    if (damB !== damA) return damB - damA;
    return (b.req.level ?? 0) - (a.req.level ?? 0);
  });
  return candidates[0];
}

// =====================================================================
// Pick mods — given a base + skill, choose up to 3 prefix and 3 suffix
// mods that maximize the skill's relevant scaling.
// =====================================================================

/**
 * Score a candidate mod for a given skill profile. Higher = more relevant
 * to the skill's damage. This is a heuristic — the composer is the real
 * arbiter (and runs after the build is assembled).
 *
 * Buckets we prioritise for ATTACK profile (current scope):
 *   - Local %inc Physical Damage (huge multiplier on weapon)
 *   - Local Added Physical
 *   - Local Attack Speed
 *   - Local +%Crit Chance
 *   - +N to Level of <skill tag>
 *   - Increased <type> Damage matching skill's element tag
 *   - Gain X% as Extra <type>
 */
function modScore(mod: ItemMod, skill: SkillRecord, bias: ScalingBias = 'balanced'): number {
  const text = (mod.stats[0]?.text ?? '').toLowerCase();
  const skillTags = new Set(skill.skillTypes);

  let s = 0;

  // Local weapon damage (massive)
  if (/increased physical damage/.test(text)) s += 100;
  if (/^adds .* physical damage/.test(text))  s += 80;
  if (/increased attack speed/.test(text))    s += 70;
  // Crit CHANCE — the binding constraint for crit builds; valued highly under
  // crit bias, moderately otherwise (a little crit helps any build).
  if (/critical hit chance/.test(text))       s += bias === 'crit' ? 90 : 45;
  // Crit MULTIPLIER ("critical damage bonus") — its value scales with crit
  // chance (a heuristic can't know the exact contribution; the sensitivity
  // analyzer is the right tool). Moderate by default (it still adds ~10% at
  // low crit), high under crit bias where the tree supplies the chance.
  if (/critical damage bonus/.test(text))      s += bias === 'crit' ? 85 : 30;
  if (/critical strike multiplier/.test(text)) s += bias === 'crit' ? 85 : 30;
  // Ailment chance/magnitude — valued under ailment bias.
  if (/(shock|ignite|freeze|chill|ailment)/.test(text)) s += bias === 'ailment' ? 45 : 2;
  // Armour-as-damage — under armour bias, the "% of armour applies to damage"
  // suffix and raw armour are the build; near-worthless to other builds.
  if (/of armour also applies to .* damage/.test(text)) s += bias === 'armour' ? 95 : 0;
  if (/increased armour|to armour\b/.test(text)) s += bias === 'armour' ? 40 : 0;

  // +to Level of skills the player can use
  const lvlMatch = text.match(/to level of (?:all )?(\w+) skills?/);
  if (lvlMatch) {
    const cap = lvlMatch[1].charAt(0).toUpperCase() + lvlMatch[1].slice(1);
    if (cap === 'All' || skillTags.has(cap)) s += 120; // gem level is huge
  }

  // Element-matched increased damage
  if (/increased cold damage/.test(text)    && skillTags.has('Cold'))      s += 40;
  if (/increased fire damage/.test(text)    && skillTags.has('Fire'))      s += 40;
  if (/increased lightning damage/.test(text) && skillTags.has('Lightning')) s += 40;
  if (/increased projectile damage/.test(text) && skillTags.has('Projectile')) s += 50;
  if (/increased attack damage/.test(text)  && skillTags.has('Attack'))    s += 50;

  // Gain as Extra
  if (/gain .* as extra/.test(text)) s += 35;

  // Added elemental damage
  if (/^adds .* (cold|fire|lightning) damage/.test(text)) s += 25;

  // Penalize utility/resistance/attribute when not the focus
  if (/^\+\(?\d/.test(text) && /resistance/.test(text)) s -= 5;
  if (/^\+\(?\d.*to (strength|dexterity|intelligence)/.test(text)) s -= 5;

  // Higher-level mod tiers are generally better; small bonus for tier.
  s += mod.level * 0.1;

  return s;
}

/**
 * Greedy: per type (prefix/suffix), per group, pick the highest-scoring
 * eligible mod. Then take the top N (3 each) by score.
 */
export function pickModsForSkill(
  base: WeaponBase,
  skillId: string,
  itemLevel = DEFAULT_ITEM_LEVEL,
  // Realism knob. 'realistic' (default) assumes a self-found / lightly-traded
  // rare: ~3 useful damage mods, the other slots being filler (no damage). The
  // tier is already capped by item level (e.g. ilvl 65 tops out at T3 phys).
  // 'perfect' fills all 6 slots with the best damage mods — a mirror-tier
  // fantasy item, kept for upper-bound analysis.
  gearQuality: 'realistic' | 'perfect' = 'realistic',
  bias: ScalingBias = 'balanced',
): ItemMod[] {
  const skill = skillsById[skillId];
  if (!skill) return [];

  const eligible = allMods.filter(m => modCanRollOnBase(m, base, itemLevel));

  // For each group, keep the highest-scoring mod (so we don't pick two
  // mutually-exclusive mods from the same group).
  const bestPerGroup = new Map<string, { mod: ItemMod; score: number }>();
  for (const mod of eligible) {
    const score = modScore(mod, skill, bias);
    if (score <= 0) continue; // skip irrelevant mods
    const cur = bestPerGroup.get(mod.group);
    if (!cur || score > cur.score) {
      bestPerGroup.set(mod.group, { mod, score });
    }
  }

  const ranked = Array.from(bestPerGroup.values()).sort((a, b) => b.score - a.score);

  // 'realistic': only ~3 of the 6 affix slots are useful damage mods on a
  // real self-found rare; the rest are filler we don't model. 'perfect':
  // fill all 6. Respect the structural 3-prefix / 3-suffix cap either way.
  const maxDamageMods = gearQuality === 'perfect' ? 6 : 3;
  const prefix: ItemMod[] = [];
  const suffix: ItemMod[] = [];
  const chosen: ItemMod[] = [];
  for (const { mod } of ranked) {
    if (chosen.length >= maxDamageMods) break;
    if (mod.type === 'Prefix' && prefix.length < 3) { prefix.push(mod); chosen.push(mod); }
    else if (mod.type === 'Suffix' && suffix.length < 3) { suffix.push(mod); chosen.push(mod); }
  }
  return [...prefix, ...suffix];
}

// =====================================================================
// Assemble — produce a ParsedItem the composer/validator can consume.
// =====================================================================

export function generateWeaponForSkill(
  skillId: string,
  itemLevel = DEFAULT_ITEM_LEVEL,
  gearQuality: 'realistic' | 'perfect' = 'realistic',
  bias: ScalingBias = 'balanced',
): { item: ParsedItem; base: WeaponBase; mods: ItemMod[] } | null {
  const base = pickBaseForSkill(skillId, itemLevel);
  if (!base) return null;
  const mods = pickModsForSkill(base, skillId, itemLevel, gearQuality, bias);

  // Render the chosen mods back into the explicit-line shape ParsedItem
  // uses. PoB convention: a multi-stat mod renders as multiple consecutive
  // text lines on the item (one per stat line), not one concatenated line.
  // We replace each "(min-max)" range with the midpoint so the composer's
  // text-pattern aggregators see a concrete number.
  const explicits = mods.flatMap(m => renderModLines(m));

  const item: ParsedItem = {
    id: `gen-${base.id.replace(/\s+/g, '_')}`,
    rarity: 'RARE',
    name: 'Generated Rare',
    base: base.id,
    itemLevel,
    quality: 20,
    sockets: 'S S',
    levelReq: base.req.level ?? null,
    runes: [],
    implicits: base.implicit ? [base.implicit] : [],
    explicits,
    rawLines: [`Rarity: RARE`, 'Generated Rare', base.id, ...explicits],
  };

  return { item, base, mods };
}

function renderModLines(mod: ItemMod): string[] {
  return mod.stats.map(s => {
    let t = s.text;
    for (const [lo, hi] of s.ranges) {
      const mid = Math.floor((lo + hi) / 2);
      t = t.replace(`(${lo}-${hi})`, String(mid));
    }
    return t;
  });
}
