// Walks a list of stat-line texts and aggregates them into global damage
// buckets that the composer can apply at the right step of the pipeline.
//
// The hard part is **applicability**: a stat like "30% increased Cold
// Damage" applies to Ice Shot (Cold-tagged) but not to a Fire Spell. We
// approximate PoB's exhaustive rules with a small predicate table — good
// enough to close the lion's share of the gap, deliberately conservative
// (we'd rather under-count than over-count and over-shoot poe.ninja).

import { ParsedBuild } from '../validation/types';
import { cleanModText } from '../validation/classifyStat';
import { PenetrationByType, emptyPenetration } from './enemyDefense';

import treeJson from '../data/generated/passive-tree.json';

interface TreeNode { id: number; stats: string[]; }

const treeNodesById: Record<number, TreeNode> = {};
for (const n of Object.values((treeJson as { nodes: Record<string, TreeNode> }).nodes)) {
  treeNodesById[n.id] = n;
}

/**
 * Result of aggregating relevant global modifiers from a stat-line source.
 * Each bucket is applied at a specific step of the damage pipeline.
 */
export interface GlobalMods {
  // Step 2.1 — added flat damage to attacks (from rings, gloves, quiver,
  // amulet anointments, jewels, etc.). Stored as average per type for now;
  // refining per-type scaling is queued.
  addedFlatToAttacksAvg: number;   // sum of all "Adds N to M <type> Damage to Attacks" averages
  // v20 — "Adds N to M <type> Damage to Spells" (ring/amulet/gear spell-added,
  // e.g. "Adds 1-2 to 3-4 Fire Damage to Spells"). Only counted for SPELL
  // skills, and only for damage types the skill deals. Was previously dropped.
  addedFlatToSpellsAvg: number;

  // Player-side, step 2.3 (additive bucket)
  increasedDamagePct: number;
  // Player-side, step 2.3 (multiplicative bucket) — kept as a list so the
  // caller can multiply them in. Two "30% more" → [30, 30] → 1.30*1.30.
  moreDamageList: number[];

  // Hit-rate side (multiplies attacks/sec for attack profile)
  increasedAttackSpeedPct: number;
  moreAttackSpeedList: number[];

  // Crit (player-side, step 2.4)
  increasedCritChancePct: number;
  addedCritMultiplierPct: number; // +N% to crit multiplier (additive on top of base 100%)

  // Step 2.2 — "Gain X% of Damage as Extra <type>". v5 simplification:
  // collapse all elements into one number that scales the per-hit value.
  // This over-counts when a type doesn't apply, but per-type tracking is
  // a bigger refactor. Tracked separately from `more` so it doesn't get
  // double-counted at compose time.
  extraDamagePct: number;

  // v10 — Multi-cast / cascade multipliers. Each cast event of the main
  // skill produces this many hits. Spell Cascade sets this to 3 (1 cascade
  // per side × 2 + the centre cast). Multiplies effective hits/sec, NOT
  // perHit damage, so per-hit damage bonuses don't double-apply.
  castMultiplier: number;

  // v12 — "more damage" multipliers that are CONDITIONAL on the target
  // carrying an ailment (freeze multiplier, "vs Shocked", etc.). Kept out of
  // moreDamageList because their reliability depends on the TARGET: a white
  // mob freezes instantly, a pinnacle boss may never freeze before it dies.
  // The composer applies each with a per-ailment, per-target-tier reliability
  // factor instead of assuming it's always active.
  ailmentConditionalMore: { ailment: AilmentKind; value: number }[];

  // v13 — Penetration + exposure, expanded per element. Both "Penetrates X%
  // <Element> Resistance" and "-X% to Enemy <Element> Resistance" lower the
  // enemy's effective resistance, so they fold into the same per-type number.
  // Applied by the composer's damage-effectiveness step, NOT as a "more"
  // multiplier — its value depends on the target's resistance.
  penetration: PenetrationByType;

  // v14 — % of the hit's damage CONVERTED TO CHAOS (Voltaxic Rift,
  // Blackflame Covenant, etc.). Chaos has 0% resistance on bosses, so this
  // fraction sidesteps the ~50% boss elemental resistance. Applied in the
  // damage-effectiveness step as a chaos/dominant-type blend (capped at 100).
  convertedToChaosPct: number;
  // The SOURCE type of the chaos conversion ('all' = "of Damage", or a
  // specific element like 'lightning' for Voltaxic). The composer credits the
  // bypass only when this matches the hit's dominant type — so Voltaxic
  // (lightning→chaos) does nothing to a cold hit.
  chaosConversionSource: 'all' | 'fire' | 'cold' | 'lightning' | 'physical' | null;

  // v15 — Accuracy (attack hit chance). Only consumed when the Amazon
  // excess-hit→crit mechanic is active; otherwise the composer keeps its
  // 100%-hit assumption, so these don't affect normal builds.
  accuracyFlat: number;          // "+N to Accuracy Rating"
  accuracyIncreasedPct: number;  // "N% increased Accuracy Rating"
  // Amazon "Critical Strike": gain crit chance = this % of EXCESS hit chance.
  // 0 = mechanic absent (default — no accuracy/crit interaction).
  excessHitToCritPct: number;

  // v16 — the build can SHOCK even without dealing lightning, e.g. Voltaxic's
  // "Chaos Damage from Hits also Contributes to Shock Chance", or "your Cold
  // damage can Shock". Lets a non-lightning build still apply shock (the
  // boss-viable ailment). Lightning builds shock inherently (handled by type).
  shockFromAnyHit: boolean;

  // v19 — the build BREAKS enemy armour (Cut to the Bone, Warbringer, Sculpted
  // Suffering). Broken armour = less/no physical reduction on the enemy, so a
  // physical build lands near full. Modelled as a steady-state benefit for a
  // build built around it (armour stays broken between hits).
  breaksArmour: boolean;

  // v18 — "armour as damage": "+X% of Armour also applies to <type> Damage"
  // (Doryani's Prototype, Smith of Kitava, Heatproof/Chillproof/Shockproof/
  // Prism Guard). Summed per destination type; the composer multiplies by the
  // build's total Armour to get flat added damage of that type.
  armourAppliesPct: { fire: number; cold: number; lightning: number; chaos: number; elemental: number };
}

export type AilmentKind = 'freeze' | 'chill' | 'shock' | 'electrocute' | 'ignite' | 'poison' | 'bleed';

export function emptyMods(): GlobalMods {
  return {
    addedFlatToAttacksAvg: 0,
    addedFlatToSpellsAvg: 0,
    increasedDamagePct: 0,
    moreDamageList: [],
    increasedAttackSpeedPct: 0,
    moreAttackSpeedList: [],
    increasedCritChancePct: 0,
    addedCritMultiplierPct: 0,
    extraDamagePct: 0,
    castMultiplier: 1,
    ailmentConditionalMore: [],
    penetration: emptyPenetration(),
    convertedToChaosPct: 0,
    chaosConversionSource: null,
    accuracyFlat: 0,
    accuracyIncreasedPct: 0,
    excessHitToCritPct: 0,
    shockFromAnyHit: false,
    breaksArmour: false,
    armourAppliesPct: { fire: 0, cold: 0, lightning: 0, chaos: 0, elemental: 0 },
  };
}

/**
 * For a given skill, build the set of "damage-type tokens" whose mods are
 * eligible. e.g. Ice Shot (Attack, Projectile, Cold, Bow) → includes
 * "Cold", "Projectile", "Attack", "Bow", "Elemental" (Cold counts as
 * elemental), plus weapon-type "Physical" since the weapon does phys.
 */
function eligibleDamageTags(skill: { skillTypes: string[] }): Set<string> {
  const tags = new Set<string>(skill.skillTypes);
  // Cold/Fire/Lightning count as "Elemental".
  if (tags.has('Cold') || tags.has('Fire') || tags.has('Lightning')) tags.add('Elemental');
  // For attack skills the weapon does phys, so "increased Physical Damage"
  // also scales. (Will need refinement for non-phys-weapon builds.)
  if (tags.has('Attack')) tags.add('Physical');
  return tags;
}

const TYPE_KEYWORDS = ['Cold','Fire','Lightning','Chaos','Physical','Elemental','Attack','Spell','Projectile','Area','Melee','Bow','Damage Over Time'];

/**
 * Does "X% increased <something> Damage" apply to this skill?
 *
 *   "Damage" alone                → yes (generic)
 *   "Cold Damage" / "Fire Damage" → match skill's damage tags
 *   "Damage with Hits"            → yes (we compute hits)
 *   "Damage with Attacks"         → only Attack skills
 *   "Damage with Spells"          → only Spell skills
 *   "Damage Over Time"            → no for hit composition (separate bucket)
 *
 * Conditional clauses ("while X", "if X", "against X within Ym") are NOT
 * parsed deeply. For v2 we OPTIMISTICALLY assume buff conditions hold and
 * pessimistically reject distance/positional restrictions.
 */
function damageApplies(text: string, eligible: Set<string>, skillIsAttack: boolean, skillIsSpell: boolean): boolean {
  // Reject positional / distance conditions for now.
  if (/within\s+\d+m\b/i.test(text)) return false;

  // "Damage with <X> Skills" — e.g. "Damage with Bow Skills", "Damage with
  // Cold Skills". X must be a tag the skill has.
  const withSkills = text.match(/Damage with (\w+) Skills?\b/i);
  if (withSkills) {
    const tag = capitalize(withSkills[1]);
    return eligible.has(tag);
  }

  // Damage-with-Y branch
  if (/Damage with Attacks?\b/i.test(text)) return skillIsAttack;
  if (/Damage with Spells?\b/i.test(text)) return skillIsSpell;
  if (/Damage with Hits?\b/i.test(text)) return true;
  if (/Damage Over Time\b/i.test(text)) return false; // hit composition only

  // Locate the "Damage" anchor and look at the token(s) immediately before it.
  // e.g. "30% increased Cold Damage" → before-Damage = "Cold"
  //      "X% increased Damage" → before-Damage = "" (generic)
  // The negative lookahead skips two specific shapes that have their own
  // branches above ("Damage Over Time", "Damage with X"). "Damage while X"
  // is accepted because most "while" clauses are buff-conditional and
  // assumed active for the build (e.g. "while affected by Herald of Ice").
  const m = text.match(/((?:[A-Z][a-z]+\s+){0,3})Damage(?!\s+(?:Over|with))/);
  if (!m) return false;
  const before = m[1].trim();
  if (!before) return true; // "increased Damage" — generic

  // Each capitalised word in `before` must be in our eligible set or be a
  // qualifier we accept ("Spell" / "Attack" / etc. already covered above).
  const tokens = before.split(/\s+/);
  for (const t of tokens) {
    if (!TYPE_KEYWORDS.includes(t)) continue; // ignore noise words
    if (!eligible.has(t)) return false;
  }
  return true;
}

function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1).toLowerCase();
}

// Add a penetration/exposure value to the per-element bucket. "elemental"
// expands to fire+cold+lightning (the wording covers all three at once).
function addPenetration(out: GlobalMods, element: string, value: number): void {
  if (element === 'elemental') {
    out.penetration.fire += value;
    out.penetration.cold += value;
    out.penetration.lightning += value;
  } else if (element === 'fire' || element === 'cold' || element === 'lightning' || element === 'chaos') {
    out.penetration[element] += value;
  }
}

function critApplies(text: string, skillIsAttack: boolean, skillIsSpell: boolean): boolean {
  if (/Critical\s+Hit\s+Chance\s+for\s+Attacks?\b/i.test(text)) return skillIsAttack;
  if (/Critical\s+Hit\s+Chance\s+for\s+Spells?\b/i.test(text)) return skillIsSpell;
  if (/Critical/i.test(text)) return true;
  return false;
}

/**
 * Try to pull the leading numeric magnitude from a stat line. Returns null
 * if no number found, the average of a "(min-max)" range otherwise.
 */
function magnitudeOf(text: string): number | null {
  const range = text.match(/\((-?\d+(?:\.\d+)?)-(-?\d+(?:\.\d+)?)\)/);
  if (range) return (parseFloat(range[1]) + parseFloat(range[2])) / 2;
  // First standalone number
  const m = text.match(/-?\d+(?:\.\d+)?/);
  return m ? parseFloat(m[0]) : null;
}

/**
 * Aggregate one stat-line text into the running totals. Mutates `out`.
 */
function applyStat(text: string, out: GlobalMods, eligible: Set<string>, skill: { skillTypes: string[] }): void {
  const cleaned = cleanModText(text);
  if (!cleaned) return;

  const skillIsAttack = skill.skillTypes.includes('Attack');
  const skillIsSpell  = skill.skillTypes.includes('Spell');

  // Negative sign for "% reduced"/"% less"
  const isReduced = /%\s+reduced\b/i.test(cleaned) || /%\s+less\b/i.test(cleaned);
  const isMore    = /%\s+(more|less)\b/i.test(cleaned);
  const isIncr    = /%\s+(increased|reduced)\b/i.test(cleaned);

  // --- Amazon excess-hit→crit + accuracy (BEFORE the generic crit handler,
  //     which would otherwise swallow "...Critical Hit Chance equal to N%...") ---
  {
    const amazon = cleaned.match(/Critical Hit Chance equal to (\d+(?:\.\d+)?)% of excess chance to Hit/i);
    if (amazon) {
      out.excessHitToCritPct = Math.max(out.excessHitToCritPct, parseFloat(amazon[1]));
      return;
    }
    const accFlat = cleaned.match(/^\+?(\d+(?:\.\d+)?)\s+to\s+Accuracy\s+Rating\b/i);
    if (accFlat) { out.accuracyFlat += parseFloat(accFlat[1]); return; }
    const accInc = cleaned.match(/(\d+(?:\.\d+)?)%\s+increased\s+Accuracy(?:\s+Rating)?\b/i);
    if (accInc) { out.accuracyIncreasedPct += parseFloat(accInc[1]); return; }
  }

  // --- Shock-from-non-lightning (Voltaxic, etc.) ---
  // "Chaos Damage from Hits also Contributes to Shock Chance" / "your <type>
  // Damage can Shock". Lets a non-lightning build still apply shock.
  if (/Damage\s+(?:from Hits\s+)?(?:also\s+)?Contributes? to Shock Chance/i.test(cleaned)
      || /\b(?:Cold|Fire|Chaos|Physical)\s+Damage can Shock\b/i.test(cleaned)
      || /\bdamage can Shock\b/i.test(cleaned)) {
    out.shockFromAnyHit = true;
    return;
  }

  // --- Armour break (Cut to the Bone, Warbringer, Sculpted Suffering) ---
  if (/Break(?:s)? Armour\b/i.test(cleaned)) {
    out.breaksArmour = true;
    return;
  }

  // --- "armour as damage": "+X% of Armour also applies to <type> Damage" ---
  {
    const arm = cleaned.match(/\+?(\d+(?:\.\d+)?)%\s+of\s+Armour\s+also\s+applies\s+to\s+(Elemental|Fire|Cold|Lightning|Chaos)\s+Damage/i);
    if (arm) {
      const pct = parseFloat(arm[1]);
      const dest = arm[2].toLowerCase() as 'elemental' | 'fire' | 'cold' | 'lightning' | 'chaos';
      out.armourAppliesPct[dest] += pct;
      return;
    }
  }

  // --- Attack speed (separate from damage) ---
  if (/Attack\s+Speed\b/i.test(cleaned) && skillIsAttack) {
    const mag = magnitudeOf(cleaned);
    if (mag != null) {
      const signed = isReduced ? -mag : mag;
      if (isMore) out.moreAttackSpeedList.push(signed);
      else if (isIncr) out.increasedAttackSpeedPct += signed;
    }
    return;
  }
  if (/Cast\s+Speed\b/i.test(cleaned) && skillIsSpell) {
    const mag = magnitudeOf(cleaned);
    if (mag != null) {
      const signed = isReduced ? -mag : mag;
      if (isMore) out.moreAttackSpeedList.push(signed);  // reuse the same hit-rate bucket
      else if (isIncr) out.increasedAttackSpeedPct += signed;
    }
    return;
  }

  // --- Crit ---
  if (/Critical/i.test(cleaned)) {
    const mag = magnitudeOf(cleaned);
    if (mag == null) return;
    const signed = isReduced ? -mag : mag;
    if (/Critical\s+Hit\s+Chance\b/i.test(cleaned)) {
      if (critApplies(cleaned, skillIsAttack, skillIsSpell)) {
        out.increasedCritChancePct += signed;
      }
      return;
    }
    if (/Critical\s+Damage\s+Bonus\b/i.test(cleaned) || /Critical\s+Strike\s+Multiplier\b/i.test(cleaned)) {
      out.addedCritMultiplierPct += signed;
      return;
    }
    // Other crit-keyword phrases we don't handle — skip.
    return;
  }

  // --- Penetration + exposure (lowers enemy resistance) ---
  // "Penetrates N% <Element> Resistance" / "Penetrates N% Elemental Resistance"
  // "Damage Penetrates N% <Element> Resistance"
  // "-N% to Enemy <Element> Resistance" (exposure)
  // All reduce effective resistance identically → same per-type bucket.
  {
    const pen = cleaned.match(/Penetrates?\s+(\d+(?:\.\d+)?)%\s+(Elemental|Fire|Cold|Lightning|Chaos)\s+Resistance/i);
    if (pen) {
      addPenetration(out, pen[2].toLowerCase(), parseFloat(pen[1]));
      return;
    }
    const expo = cleaned.match(/-(\d+(?:\.\d+)?)%\s+to\s+(?:Enemy\s+)?(Elemental|Fire|Cold|Lightning|Chaos)\s+Resistance/i);
    if (expo) {
      addPenetration(out, expo[2].toLowerCase(), parseFloat(expo[1]));
      return;
    }
  }

  // --- Conversion TO CHAOS (resistance bypass) ---
  // "100% of Lightning Damage Converted to Chaos Damage" (Voltaxic Rift)
  // "Convert 100% of Fire Damage to Chaos Damage" (Blackflame Covenant)
  // Chaos is unresisted on bosses, so this fraction skips the elemental tax.
  // We only credit conversion INTO chaos (the bypass); other conversions are
  // type-shuffles handled elsewhere / not resistance-relevant here.
  {
    // Capture the SOURCE type so the composer only credits the bypass when the
    // hit's dominant type matches (Voltaxic converts LIGHTNING — it does
    // nothing to a cold Ice Shot unless the cold is first made lightning).
    const conv = cleaned.match(/(\d+(?:\.\d+)?)%\s+of\s+(\w+)?\s*Damage\s+Converted\s+to\s+Chaos\s+Damage/i)
              || cleaned.match(/Convert\s+(\d+(?:\.\d+)?)%\s+of\s+(\w+)?\s*Damage\s+to\s+Chaos\s+Damage/i);
    if (conv) {
      out.convertedToChaosPct = Math.min(100, out.convertedToChaosPct + parseFloat(conv[1]));
      const src = (conv[2] || 'all').toLowerCase();
      // 'all'/'generic' (no source word, e.g. "of Damage Converted") applies
      // to any hit; a typed source only applies to that element.
      out.chaosConversionSource =
        src === 'fire' || src === 'cold' || src === 'lightning' || src === 'physical' ? src : 'all';
      return;
    }
  }

  // (Accuracy + Amazon excess-hit→crit are detected at the TOP of applyStat,
  //  before the generic crit handler — see below.)

  // --- "Gain X% of [<sourceType>] Damage as Extra [<destType>] Damage" ---
  // Shapes observed across baseline fixtures, bow runes, and unique items:
  //   "Gain 23% of Damage as Extra Cold Damage"                                   (single dest type)
  //   "Gain 5% of Damage as Extra Damage of all Elements"                          (×3 elements)
  //   "Attacks with this Weapon gain 100% of Physical damage as Extra damage of each Element"  (Doomfletch-style ×3)
  //   "Attacks with this Weapon gain 50% of Physical damage as Extra damage of each Element"
  // We tolerate an optional "Attacks with this Weapon" prefix, an optional
  // source-type qualifier ("of <Type> damage"), and accept either
  // "all Elements" or "each Element" for the all-elements form.
  const extraAll = cleaned.match(/gain\s+(\d+(?:\.\d+)?)%\s+of\s+(?:\w+\s+)?[Dd]amage\s+as\s+Extra\s+[Dd]amage\s+of\s+(?:all|each)\s+Elements?/i);
  if (extraAll) {
    out.extraDamagePct += parseFloat(extraAll[1]) * 3; // fire+cold+lightning
    return;
  }
  const extraType = cleaned.match(/gain\s+(\d+(?:\.\d+)?)%\s+of\s+(?:\w+\s+)?[Dd]amage\s+as\s+Extra\s+(\w+)\s+[Dd]amage/i);
  if (extraType) {
    const dmgType = capitalize(extraType[2]);
    const isElemental = ['Cold','Fire','Lightning'].includes(dmgType);
    if (eligible.has(dmgType) || isElemental) {
      out.extraDamagePct += parseFloat(extraType[1]);
    }
    return;
  }

  // --- "Adds N to M <type> Damage to Attacks" — added flat from gear ---
  // Only meaningful for attack profile (matches the weapon's flat damage step).
  const addedAttack = cleaned.match(/^Adds\s+(\d+(?:\.\d+)?)\s+to\s+(\d+(?:\.\d+)?)\s+(\w+)\s+[Dd]amage\s+to\s+Attacks?\b/);
  if (addedAttack && skillIsAttack) {
    const lo = parseFloat(addedAttack[1]);
    const hi = parseFloat(addedAttack[2]);
    const dmgType = capitalize(addedAttack[3]);
    // Only count if the damage type applies to the skill (e.g. on a Cold
    // attack we count Cold/Phys/Lightning all, but NOT Fire if the skill
    // can't deal Fire). For simplicity we accept any of the standard hit
    // damage types — the test predicate is more permissive than per-type
    // scaling but matches PoE's "all attack damage" intuition.
    const isElemental = ['Cold','Fire','Lightning'].includes(dmgType);
    const accepts = eligible.has(dmgType) || isElemental;
    if (accepts) {
      out.addedFlatToAttacksAvg += (lo + hi) / 2;
    }
    return;
  }

  // --- "Adds N to M <type> Damage to Spells" — ring/gear spell-added flat ---
  // Only for SPELL skills, and only types the skill deals (a physical spell
  // like Bone Cage takes "Physical Damage to Spells" but not "Fire to Spells").
  const addedSpell = cleaned.match(/^Adds\s+(\d+(?:\.\d+)?)\s+to\s+(\d+(?:\.\d+)?)\s+(\w+)\s+[Dd]amage\s+to\s+Spells?\b/);
  if (addedSpell && skillIsSpell) {
    const lo = parseFloat(addedSpell[1]);
    const hi = parseFloat(addedSpell[2]);
    const dmgType = capitalize(addedSpell[3]);
    if (eligible.has(dmgType)) {
      out.addedFlatToSpellsAvg += (lo + hi) / 2;
    }
    return;
  }

  // --- Damage scaling ---
  if (!/\bDamage\b/i.test(cleaned)) return;
  if (!damageApplies(cleaned, eligible, skillIsAttack, skillIsSpell)) return;

  const mag = magnitudeOf(cleaned);
  if (mag == null) return;
  const signed = isReduced ? -mag : mag;
  if (isMore)       out.moreDamageList.push(signed);
  else if (isIncr)  out.increasedDamagePct += signed;
}

/**
 * Aggregate mods from a list of stat-line texts.
 */
export function aggregateFromLines(lines: string[], skill: { skillTypes: string[] }): GlobalMods {
  const out = emptyMods();
  const eligible = eligibleDamageTags(skill);
  for (const line of lines) applyStat(line, out, eligible, skill);
  return out;
}

/**
 * Aggregate all stat lines from every allocated tree node into one
 * GlobalMods bundle. This is the dominant chunk of "missing" damage in
 * composeDamage v1.
 */
export function aggregateTreeMods(build: ParsedBuild, skill: { skillTypes: string[] }): GlobalMods {
  const spec = build.trees[0];
  if (!spec) return emptyMods();
  const lines: string[] = [];
  for (const id of spec.nodes) {
    const node = treeNodesById[id];
    if (!node) continue;
    for (const s of node.stats) lines.push(s);
  }
  return aggregateFromLines(lines, skill);
}

/**
 * Aggregate global mods from every equipped item EXCEPT the active weapon
 * (its mods were already applied as locals in the weapon-damage step) and
 * flasks (their effects are timed/conditional and not always on).
 *
 * For attack profile we also skip Weapon 2 if it's a quiver — quiver mods
 * apply globally but we need a slot-type check to be confident; for now
 * include it conservatively and rely on the type filter in damageApplies
 * to discard non-matching damage types.
 */
export function aggregateNonWeaponItemMods(build: ParsedBuild, skill: { skillTypes: string[] }): GlobalMods {
  const lines: string[] = [];
  for (const [slot, item] of Object.entries(build.equipped)) {
    if (!item) continue;
    if (slot === 'Weapon 1') {
      const skillIsSpell = skill.skillTypes.includes('Spell') && !skill.skillTypes.includes('Attack');
      if (skillIsSpell) {
        // For a SPELL the weapon contributes NOTHING locally (base damage
        // comes from the gem). Every weapon line is therefore a global
        // stat-stick mod: +spell levels, % increased spell/elemental damage,
        // % increased cast speed, spell crit, gain-as-extra, added-to-spells.
        // Push them all — none can double-count a local weapon-damage step
        // that doesn't exist for spells.
        lines.push(...item.implicits, ...item.explicits, ...item.runes);
        continue;
      }
      // ATTACK profile: most weapon mods are LOCAL (already folded into the
      // weapon damage step). A small set is unambiguously GLOBAL even though
      // they sit on the weapon — those need to apply here too. We pluck only
      // those specific shapes to avoid double-counting local damage mods.
      // Include runes here too: a rune line on a weapon can carry a global
      // shape (e.g. "Gain X% of Physical as Extra Fire") that the local
      // weapon-damage step doesn't apply.
      for (const raw of [...item.implicits, ...item.explicits, ...item.runes]) {
        if (isUnambiguouslyGlobalWeaponLine(raw)) lines.push(raw);
      }
      continue;
    }
    if (slot.startsWith('Flask')) continue; // skip flasks for now
    if (slot.startsWith('Charm')) continue; // skip charms (active-effect)
    // Armour/jewellery runes/soulcores read like explicits — include them.
    lines.push(...item.implicits, ...item.explicits, ...item.runes);
  }
  return aggregateFromLines(lines, skill);
}

/**
 * Conservative whitelist of mod shapes that, when present on a weapon,
 * apply globally rather than locally. The "+N to Level of Skills" case is
 * already handled by sumSkillLevelBonus (gem-level shift), so this is
 * mostly for Gain-as-Extra and similar global damage layers.
 *
 * If we miss a shape here it gets dropped from the calc. If we wrongly
 * include a local shape it gets double-counted. Err toward the former.
 */
function isUnambiguouslyGlobalWeaponLine(text: string): boolean {
  const t = text;
  // Gain-as-Extra in all observed forms — tolerates optional source-type
  // qualifier and "Attacks with this Weapon" prefix.
  if (/gain\s+\d+(?:\.\d+)?%\s+of\s+(?:\w+\s+)?[Dd]amage\s+as\s+Extra\b/i.test(t)) return true;
  // "% increased X Damage against <enemy type>" — the conditional clause
  // is what makes it unambiguously global (local damage scaling never
  // takes a target-type qualifier). Catches bow implicit
  // "50% increased Attack Damage against Rare or Unique Enemies".
  if (/%\s+(?:increased|reduced)\s+[A-Za-z ]+Damage\s+against\b/i.test(t)) return true;
  // Damage CONVERSION (e.g. Voltaxic "100% of Lightning Damage Converted to
  // Chaos") is a global mechanic, not local weapon damage — it must reach the
  // aggregator (otherwise a conversion bow's whole point is dropped for attacks).
  if (/\d+(?:\.\d+)?%\s+of\s+\w+\s+[Dd]amage\s+Converted\s+to\b/i.test(t)) return true;
  return false;
}

/**
 * Merge two GlobalMods bundles. Used to combine tree mods + gear mods +
 * support mods + ... before the composer applies them.
 */
export function mergeMods(a: GlobalMods, b: GlobalMods): GlobalMods {
  return {
    addedFlatToAttacksAvg:   a.addedFlatToAttacksAvg + b.addedFlatToAttacksAvg,
    addedFlatToSpellsAvg:    a.addedFlatToSpellsAvg + b.addedFlatToSpellsAvg,
    increasedDamagePct:      a.increasedDamagePct + b.increasedDamagePct,
    moreDamageList:          [...a.moreDamageList, ...b.moreDamageList],
    increasedAttackSpeedPct: a.increasedAttackSpeedPct + b.increasedAttackSpeedPct,
    moreAttackSpeedList:     [...a.moreAttackSpeedList, ...b.moreAttackSpeedList],
    increasedCritChancePct:  a.increasedCritChancePct + b.increasedCritChancePct,
    addedCritMultiplierPct:  a.addedCritMultiplierPct + b.addedCritMultiplierPct,
    extraDamagePct:          a.extraDamagePct + b.extraDamagePct,
    // Cast multipliers compose multiplicatively — two cascade-like effects on
    // the same skill compound (3× from Spell Cascade × 2× from Unleash etc).
    castMultiplier:          a.castMultiplier * b.castMultiplier,
    ailmentConditionalMore:  [...a.ailmentConditionalMore, ...b.ailmentConditionalMore],
    penetration: {
      fire:      a.penetration.fire + b.penetration.fire,
      cold:      a.penetration.cold + b.penetration.cold,
      lightning: a.penetration.lightning + b.penetration.lightning,
      chaos:     a.penetration.chaos + b.penetration.chaos,
    },
    // Conversion-to-chaos sums, capped at 100% (can't convert more than the hit).
    convertedToChaosPct: Math.min(100, a.convertedToChaosPct + b.convertedToChaosPct),
    // Keep whichever source is set (a typed source wins over null; if both set
    // and differ, 'all' is the safe union).
    chaosConversionSource:
      a.chaosConversionSource && b.chaosConversionSource && a.chaosConversionSource !== b.chaosConversionSource
        ? 'all'
        : (a.chaosConversionSource ?? b.chaosConversionSource),
    accuracyFlat:          a.accuracyFlat + b.accuracyFlat,
    accuracyIncreasedPct:  a.accuracyIncreasedPct + b.accuracyIncreasedPct,
    // Flag: present if either source carries the Amazon mechanic (take the max).
    excessHitToCritPct:    Math.max(a.excessHitToCritPct, b.excessHitToCritPct),
    shockFromAnyHit:       a.shockFromAnyHit || b.shockFromAnyHit,
    breaksArmour:          a.breaksArmour || b.breaksArmour,
    armourAppliesPct: {
      fire:       a.armourAppliesPct.fire + b.armourAppliesPct.fire,
      cold:       a.armourAppliesPct.cold + b.armourAppliesPct.cold,
      lightning:  a.armourAppliesPct.lightning + b.armourAppliesPct.lightning,
      chaos:      a.armourAppliesPct.chaos + b.armourAppliesPct.chaos,
      elemental:  a.armourAppliesPct.elemental + b.armourAppliesPct.elemental,
    },
  };
}
