// composeDamage v1 — minimal attack-profile pipeline grounded in real data.
//
// Scope of this version (very intentionally small):
//   - One scenario: attack skill, single weapon, no triggers, no ailments.
//   - Reads: equipped weapon (rare with local mods), skill per-level table,
//     weapon base stats.
//   - Computes: average per-hit damage, attacks/sec, expected DPS including
//     base crit only.
//
// Explicitly NOT in v1 (each is a known gap; add as iterations land):
//   - Tree node stats (130 nodes' worth of % increased Damage etc.)
//   - Support gem effects (~3-5× multiplicative for a typical setup)
//   - Other equipped items' damage mods (gloves, body, amulet, jewels)
//   - "+N to Level of <X> Skills" gem-level shift (we use the raw gem level)
//   - "Gain X% as Extra <type>" / damage conversion
//   - Crit modifiers from gear/tree
//   - Conditional mods ("vs rare/unique", "during X", etc.)
//   - Penetration, mitigation, damage-taken modifiers (enemy side; not yet)
//
// The first run is expected to be far below the poe.ninja-reported DPS. The
// gap is informative — it tells us what each missing input is worth.

import weaponBasesJson from '../data/generated/weapon-bases.json';
import skillsJson from '../data/generated/skills.json';
import { classifyStat, cleanModText, StatKind } from '../validation/classifyStat';
import { ParsedBuild, ParsedItem } from '../validation/types';
import { aggregateTreeMods, aggregateNonWeaponItemMods, mergeMods, GlobalMods } from './aggregateMods';
import { aggregateSupportMods } from './applySupportMods';
import { applyMaxCharges } from './applyCharges';
import { aggregateActiveSkillBuffs } from './applyActiveSkillBuffs';
import { secondaryHitFraction, SECONDARY_HITS } from './secondaryHits';
import { EnemyProfile, ENEMY_PROFILES, damageEffectiveness, DamageType, TargetTier, excessHitPct, dominantDamageType } from './enemyDefense';
import { checkSkillWeapon } from './skillWeaponRules';
import { computeArmour } from './maxArmour';

interface WeaponBase {
  id: string;
  type: string;
  weapon: {
    PhysicalMin?: number; PhysicalMax?: number;
    LightningMin?: number; LightningMax?: number;
    ColdMin?: number; ColdMax?: number;
    FireMin?: number; FireMax?: number;
    ChaosMin?: number; ChaosMax?: number;
    CritChanceBase?: number; AttackRateBase?: number;
  } | null;
}

interface SkillLevel {
  level: number;
  baseMultiplier?: number;
  attackSpeedMultiplier?: number;
  manaCost?: number;
  cooldown?: number;     // seconds between uses
  storedUses?: number;   // charges available before the cooldown gates you
}

interface Skill {
  id: string; name: string; isSupport: boolean;
  skillTypes: string[];
  levels: SkillLevel[];
  weaponTypes: string[];
  castTime?: number;     // seconds per cast for spells (base, pre-cast-speed)
  constantStats?: [string, number][];
  perLevelStats?: { level: number; stats: Record<string, number> }[];
}

/** Default spell base crit chance when the skill data carries none. PoE2's
 *  generic spell base is 5%; per-skill overrides can be wired later. */
const SPELL_BASE_CRIT_CHANCE = 0.05;
/** Default base cast rate when a spell has no castTime in data. */
const SPELL_DEFAULT_CAST_TIME_S = 0.7;

const weaponBasesByName: Record<string, WeaponBase> = {};
for (const w of weaponBasesJson as WeaponBase[]) weaponBasesByName[w.id] = w;

const skillsById: Record<string, Skill> = {};
for (const s of skillsJson as Skill[]) skillsById[s.id] = s;

// Match a stat line's numeric range. We always use the AVERAGE for
// computation; min/max can be surfaced separately if a "min/max damage"
// view is added later.
function average(min: number, max: number): number { return (min + max) / 2; }

function rangeAverage(text: string): { min: number; max: number; avg: number } | null {
  // "Adds N to M <type> Damage" → both numbers; "X% increased Y" → one.
  const m = text.match(/(\d+(?:\.\d+)?)\s+to\s+(\d+(?:\.\d+)?)/);
  if (m) {
    const lo = parseFloat(m[1]); const hi = parseFloat(m[2]);
    return { min: lo, max: hi, avg: average(lo, hi) };
  }
  const m2 = text.match(/(-?\d+(?:\.\d+)?)/);
  if (m2) { const v = parseFloat(m2[1]); return { min: v, max: v, avg: v }; }
  return null;
}

// Sum of "X% increased <thing>" magnitudes from a list of stat lines,
// filtered by a predicate on the cleaned text. We sum signed values; a
// "% reduced" line is parsed as positive then negated by the caller if
// needed. For v1 we accept both increased and reduced into one bucket as
// long as the predicate selects them.
function sumPercent(lines: string[], predicate: (text: string) => boolean): number {
  let total = 0;
  for (const raw of lines) {
    const text = cleanModText(raw);
    if (!predicate(text)) continue;
    const r = rangeAverage(text);
    if (!r) continue;
    const negative = /%\s+reduced\b/.test(text) || /%\s+less\b/.test(text);
    total += negative ? -r.avg : r.avg;
  }
  return total;
}

// Average flat added from "Adds N to M <type> Damage" lines matching predicate.
function sumAddedFlat(lines: string[], predicate: (text: string) => boolean): number {
  let total = 0;
  for (const raw of lines) {
    const text = cleanModText(raw);
    if (!/^Adds\b/.test(text)) continue;
    if (!predicate(text)) continue;
    const r = rangeAverage(text);
    if (!r) continue;
    total += r.avg;
  }
  return total;
}

// Sum of +N or +N% from "+N to <stat>" addedFlat lines matching predicate.
function sumPlusTo(lines: string[], predicate: (text: string) => boolean): number {
  let total = 0;
  for (const raw of lines) {
    const text = cleanModText(raw);
    if (!/^[+-]?(?:\(?-?[\d.]+(?:-[\d.]+)?\)?)%?\s+to\b/.test(text)) continue;
    if (!predicate(text)) continue;
    const r = rangeAverage(text);
    if (r) total += r.avg;
  }
  return total;
}

// Sum +N from "+N to Level of <X> Skills" lines whose <X> applies to this
// skill. The wording variants we handle:
//   "+N to Level of all Skills"                → applies to every active skill
//   "+N to Level of all <Tag> Skills"          → applies if skill has Tag
//   "+N to Level of all <TagA> <TagB> Skills"  → applies if skill has BOTH tags
function sumSkillLevelBonus(lines: string[], skillTypes: Set<string>): number {
  let total = 0;
  for (const raw of lines) {
    const text = cleanModText(raw);
    // Two-stage match: numeric prefix + the "to Level of ... Skills" phrase.
    // The middle group is optional so "all Skills" (no tag) matches too.
    // Anchor at "+N to Level of" — works for both bare "+3 to Level of ..."
    // lines and prefixed "Bonded: +1 to Level of ..." rune-implicit lines.
    const m = text.match(/[+-]?\(?(-?\d+)(?:-\d+)?\)?\s+to\s+Level\s+of\s+(?:all\s+)?(.*?)\s*Skills\b/i);
    if (!m) continue;
    const target = m[2].trim().toLowerCase();
    if (checkSkillLevelTarget(target, skillTypes)) {
      total += parseInt(m[1], 10);
    }
  }
  return total;
}

function checkSkillLevelTarget(target: string, skillTypes: Set<string>): boolean {
  // Empty target ("all Skills") applies to every skill.
  if (target === '') return true;
  // Map known phrase tokens → tag names.
  const map: Record<string, string> = {
    attack: 'Attack', spell: 'Spell',
    projectile: 'Projectile', area: 'Area', melee: 'Melee',
    cold: 'Cold', fire: 'Fire', lightning: 'Lightning', chaos: 'Chaos', physical: 'Physical',
    minion: 'Minion', bow: 'Bow',
  };
  const tokens = target.split(/\s+/).filter(Boolean);
  // Need EVERY recognised token to be present in the skill's tags
  // (e.g. "Cold Spell" → both Cold AND Spell). If a token isn't in the map,
  // we err on the side of NOT applying — better than silently widening match.
  if (tokens.length === 0) return false;
  for (const t of tokens) {
    const tag = map[t];
    if (!tag) return false;
    if (!skillTypes.has(tag)) return false;
  }
  return true;
}

function clampSkillLevel(skill: Skill, requested: number): number {
  if (!skill.levels.length) return 1;
  const maxLv = skill.levels[skill.levels.length - 1].level;
  return Math.max(1, Math.min(requested, maxLv));
}

function levelAt(skill: Skill, level: number): SkillLevel | undefined {
  return skill.levels.find(l => l.level === level);
}

export interface ComposeInput {
  build: ParsedBuild;
  skillGroupIndex: number;  // which socket group contains the active skill
  skillId: string;          // the active skill's id within that group

  /** How the active skill is delivered. Default 'direct'. */
  triggerMode?: TriggerMode;

  /** Target tier the DPS is computed against. Default 'boss' — the meaningful
   *  benchmark. Governs how reliably ailments apply AND the enemy's default
   *  resistance profile: a white mob freezes on the first hit and resists
   *  nothing; a pinnacle boss barely freezes and resists ~75%. */
  targetTier?: TargetTier;

  /** Sensitivity hook. Applied to the aggregated global mods AFTER all normal
   *  aggregation (tree + gear + supports + buffs + charges), BEFORE per-hit
   *  math. Lets the sensitivity analyzer nudge a single bucket and re-run the
   *  REAL engine, so marginal-value numbers match exactly what the composer
   *  computes — never a duplicated formula. Numeric fields are ADDED; list
   *  fields (moreDamageList) are APPENDED. Leave unset for normal runs. */
  perturb?: ModPerturbation;

  /** Override the enemy defensive profile (resistances + phys reduction).
   *  Defaults to ENEMY_PROFILES[targetTier]. Set per-fight when known. */
  enemyProfile?: Partial<EnemyProfile>;

  /** Monk-style resistance inversion (+75% → -75%). When true, the enemy's
   *  resistance to the hit's dominant element is negated — penetration on
   *  gear/tree becomes redundant. */
  resistanceInverted?: boolean;
}

/** A delta applied to global mod buckets for marginal-value analysis. */
export interface ModPerturbation {
  addedFlatToAttacksAvg?: number;   // + flat added damage
  increasedDamagePct?: number;      // + to the additive increased bucket
  moreDamagePct?: number;           // a new multiplicative "more" entry
  increasedCritChancePct?: number;  // + to increased crit chance
  addedCritMultiplierPct?: number;  // + to crit multiplier bonus
  increasedAttackSpeedPct?: number; // + to increased attack/cast speed
  penetrationElementalPct?: number; // + elemental penetration (all three elements)
}

// Per-ailment reliability of being applied to a target tier. Freeze/chill have
// a hard buildup-vs-threshold gate that bosses almost always survive; shock,
// ignite and the DoT ailments apply to bosses (scaled magnitude). These factor
// each ailment-conditional MORE multiplier so we don't credit "more vs Frozen"
// against a boss you can't freeze.
const AILMENT_RELIABILITY: Record<string, Record<TargetTier, number>> = {
  freeze:      { pinnacle: 0.0, boss: 0.0, rare: 0.4, white: 1.0 },
  chill:       { pinnacle: 0.3, boss: 0.5, rare: 0.9, white: 1.0 }, // chill applies but is capped on bosses
  shock:       { pinnacle: 0.6, boss: 0.8, rare: 1.0, white: 1.0 },
  electrocute: { pinnacle: 0.4, boss: 0.6, rare: 0.9, white: 1.0 },
  ignite:      { pinnacle: 1.0, boss: 1.0, rare: 1.0, white: 1.0 }, // DoT — applies regardless of tier
  poison:      { pinnacle: 1.0, boss: 1.0, rare: 1.0, white: 1.0 },
  bleed:       { pinnacle: 1.0, boss: 1.0, rare: 1.0, white: 1.0 },
};

/**
 * 'direct'        — player casts/uses the skill themselves. Hits/sec is
 *                   driven by weapon APS or spell cast speed.
 * 'cast_on_crit'  — skill is triggered by Cast on Critical. The trigger
 *                   source is assumed to be Spark (PoE2's go-to fast spell
 *                   for CoC setups). Trigger rate is computed as
 *                     min(spark_casts/sec × projectile_count × crit_chance,
 *                         cooldown_cap)
 *                   using Spark's actual cast time and the build's cast
 *                   speed + crit modifiers. For well-tuned builds the
 *                   cooldown cap binds; for under-built setups the formula
 *                   reflects the lower achievable rate.
 */
export type TriggerMode = 'direct' | 'cast_on_crit';
/** PoE2 CoC cooldown ≈ 150ms → ~6.67 triggers/sec absolute ceiling. */
const CAST_ON_CRIT_COOLDOWN_CAP_PER_SEC = 6.67;
/**
 * Every Cast-on-Critical-style trigger socket carries an intrinsic
 * `trigger_meta_gem_damage_+%_final = -20` penalty (see
 * `SupportMetaCastOnCritPlayer.constantStats` in our skills database).
 * It applies to every spell triggered via CoC. Failing to apply it
 * over-states triggered DPS by ~25%. Surfaced by the v9.5 damage-chain
 * exploration; see docs/exploration-damage-chains.md.
 */
const CAST_ON_CRIT_DAMAGE_PENALTY_PCT = -20;
/** Spark base cast time at all levels — from `skills.json` (SparkPlayer.castTime). */
const SPARK_BASE_CAST_TIME_S = 0.7;
/** Spark base projectile count at gem level 21 (well within reach for endgame). */
const SPARK_PROJECTILES_PER_CAST_AT_21 = 9;

export interface ComposeBreakdown {
  weapon: { name: string; base: string; baseMin: number; baseMax: number };
  effectiveGemLevel: number;
  skill: { id: string; name: string; baseMultiplier: number; attackSpeedMul: number };
  weaponAvgDamage: number;
  hitsPerSecond: number;
  perHit: number;
  expectedCritMultiplier: number;
  dps: number;            // headline = REALISTIC: ramped, post enemy-resistance
  rawDps: number;         // pre-resistance (PoB-comparable; PoB's headline ignores enemy res)
  firstHitDps: number;    // opener vs a fresh target — no ailments/slows on it yet
  rampedDps: number;      // once your on-target conditionals land (= dps)
  // v13 — enemy-defence layer the DPS was computed against.
  enemy: {
    tier: string;
    dominantType: DamageType;
    effectiveResPct: number;   // after inversion + penetration, for dominant type
    effectivenessMul: number;  // fraction of the raw hit that lands
  };
  // Aggregated global multipliers and how they were applied. Useful for
  // debugging which bucket the damage came from.
  global: {
    addedFlatToAttacksAvg: number;
    increasedDamagePct: number;
    moreDamageFactor: number;        // product of (1 + more/100)
    increasedAttackSpeedPct: number;
    moreAttackSpeedFactor: number;
    increasedCritChancePct: number;
    addedCritMultiplierPct: number;
    extraDamagePct: number;
  };
  notes: string[];   // human-readable notes about what's not yet modelled
}

export function composeDamage(input: ComposeInput): ComposeBreakdown {
  const { build, skillGroupIndex, skillId, triggerMode = 'direct', targetTier = 'boss' } = input;
  const notes: string[] = [];

  const skill = skillsById[skillId];
  if (!skill) throw new Error(`Unknown skill: ${skillId}`);
  if (skill.isSupport) throw new Error(`Skill ${skillId} is a support gem`);
  // Base-damage origin branches on skill family:
  //   ATTACK — weapon carries the physical base; skill takes a % of it.
  //   SPELL  — the gem carries the base; the weapon is a stat-stick that only
  //            augments (no local weapon-damage contribution).
  const isSpell = skill.skillTypes.includes('Spell') && !skill.skillTypes.includes('Attack');

  // Find the skill gem in the group to read its (base) gem level.
  const group = build.skillGroups[skillGroupIndex];
  const gem = group?.gems.find(g => g.skillId === skillId);
  const baseGemLevel = gem?.level ?? 1;

  // Resolve weapon. For attack skills, "Weapon 1" is canonical.
  const weaponItem: ParsedItem | undefined = build.equipped['Weapon 1'];
  if (!weaponItem || !weaponItem.base) throw new Error('No Weapon 1 equipped');
  const weaponBase = weaponBasesByName[weaponItem.base];
  if (!weaponBase) throw new Error(`Unknown weapon base "${weaponItem.base}"`);
  // VALIDITY GATE — the skill must legally be usable with this weapon. Bow
  // skills require a Bow; spells cannot be cast with a Bow/Crossbow. A build
  // that violates this can't exist in game, so we fail closed rather than
  // emit a fantasy DPS number. (Layer-1 validity: valid weapon → skill → …)
  const elig = checkSkillWeapon(skill, weaponBase.type);
  if (!elig.ok) {
    throw new Error(`Invalid weapon for skill: ${elig.reason}`);
  }
  // Caster weapons (wand/sceptre/caster-staff) legitimately have weapon:null —
  // they carry no base attack damage. That's fatal only for an ATTACK skill.
  if (!isSpell && !weaponBase.weapon) {
    throw new Error(`Weapon base "${weaponItem.base}" has no attack stats but ${skill.name} is an attack`);
  }

  // ------ Weapon-local calculation ------
  // All weapon-local lines (implicits + explicits + runes are all on the
  // weapon, so all are "local"). For v1 we treat *all* the weapon's lines
  // as potentially-local; the canonical mod database (item-mods.json) tells
  // us which `group` is local vs global but we don't yet wire that in.
  // Runes/soulcores are socketed into the weapon and their text reads like
  // additional explicits — feed them through the same regex pipeline.
  const weaponLines = [
    ...weaponItem.implicits,
    ...weaponItem.explicits,
    ...weaponItem.runes,
  ];

  // Weapon-local attack damage — only meaningful for ATTACK skills. For a
  // spell the weapon has no base (weaponBase.weapon is null) and contributes
  // nothing locally; its mods flow in globally via aggregateNonWeaponItemMods.
  const baseMin = weaponBase.weapon?.PhysicalMin ?? 0;
  const baseMax = weaponBase.weapon?.PhysicalMax ?? 0;
  let weaponMin = 0, weaponMax = 0, weaponAvg = 0;
  if (!isSpell && weaponBase.weapon) {
    // Local added phys (e.g. "Adds 39 to 66 Physical Damage")
    const localAddedPhysAvg = sumAddedFlat(weaponLines, t => /\bPhysical\b/.test(t));
    // Local % increased Physical Damage
    const localIncreasedPhys = sumPercent(weaponLines, t => /%\s+(?:increased|reduced)\s+Physical Damage/.test(t));
    // Quality % on weapons usually maps 1:1 to phys% (PoE convention).
    const quality = weaponItem.quality ?? 0;
    const localPhysMultiplier = 1 + (localIncreasedPhys + quality) / 100;

    weaponMin = (baseMin + localAddedPhysAvg) * localPhysMultiplier;
    weaponMax = (baseMax + localAddedPhysAvg) * localPhysMultiplier;

    // Weapon-local ELEMENTAL/chaos damage — base (e.g. Voltaxic's Fanatic Bow
    // chaos 28-64, a lightning quarterstaff's lightning) + local "Adds N to M
    // <Element> Damage" explicits (Voltaxic's "Adds 1 to 400 Lightning"). This
    // is part of the attack's hit but isn't phys, so it's added to the base
    // WITHOUT the phys multiplier; the global increased/more buckets scale it.
    const w = weaponBase.weapon;
    const baseEleAvg =
      ((w.LightningMin ?? 0) + (w.LightningMax ?? 0)
        + (w.ColdMin ?? 0) + (w.ColdMax ?? 0)
        + (w.FireMin ?? 0) + (w.FireMax ?? 0)
        + (w.ChaosMin ?? 0) + (w.ChaosMax ?? 0)) / 2;
    const localAddedEleAvg = sumAddedFlat(weaponLines, t => /\b(Lightning|Cold|Fire|Chaos)\b/.test(t));
    const eleAvg = baseEleAvg + localAddedEleAvg;
    weaponAvg = (weaponMin + weaponMax) / 2 + eleAvg;
    if (eleAvg > 0) {
      notes.push(`weapon-local elemental/chaos: +${eleAvg.toFixed(0)} avg added to the hit (base + "Adds N to M <Element>")`);
    }
  }

  // ------ Skill-level resolution ------
  const skillTypeSet = new Set(skill.skillTypes);
  // Aggregate "+N to Level of <...> Skills" from ALL equipped item lines
  // (this is a global effect, not local to the weapon).
  const allLines: string[] = [];
  for (const item of Object.values(build.equipped)) {
    if (!item) continue;
    allLines.push(...item.implicits, ...item.explicits, ...item.runes);
  }
  const levelBonus = sumSkillLevelBonus(allLines, skillTypeSet);
  const effectiveLevel = clampSkillLevel(skill, baseGemLevel + levelBonus);
  const lvl = levelAt(skill, effectiveLevel);
  if (!lvl) throw new Error(`No level data for ${skill.name} at level ${effectiveLevel}`);
  const baseMultiplier = lvl.baseMultiplier ?? 1;
  const attackSpeedMul = lvl.attackSpeedMultiplier ?? 0;  // % adjustment vs weapon APS

  // ------ Aggregate GLOBAL mods (v7: tree + gear + supports + charges + active-skill buffs) ------
  const treeMods = aggregateTreeMods(build, skill);
  const gearMods = aggregateNonWeaponItemMods(build, skill);
  const useSecondWeaponSet = build.build.useSecondWeaponSet === true;
  const supportResult = aggregateSupportMods(build, skillGroupIndex, { useSecondWeaponSet });
  const activeBuffsResult = aggregateActiveSkillBuffs(build, skill.id);
  let globalMods = mergeMods(
    mergeMods(treeMods, gearMods),
    mergeMods(supportResult.mods, activeBuffsResult.mods),
  );
  // v6: assume max stacks of each charge type. Sustained-DPS scenario.
  globalMods = applyMaxCharges(globalMods, skill);

  // Sensitivity perturbation — nudge ONE bucket so the analyzer can read the
  // marginal DPS of that modifier off the real engine. No-op when unset.
  if (input.perturb) {
    const p = input.perturb;
    globalMods = {
      ...globalMods,
      addedFlatToAttacksAvg: globalMods.addedFlatToAttacksAvg + (p.addedFlatToAttacksAvg ?? 0),
      increasedDamagePct: globalMods.increasedDamagePct + (p.increasedDamagePct ?? 0),
      moreDamageList: p.moreDamagePct ? [...globalMods.moreDamageList, p.moreDamagePct] : globalMods.moreDamageList,
      increasedCritChancePct: globalMods.increasedCritChancePct + (p.increasedCritChancePct ?? 0),
      addedCritMultiplierPct: globalMods.addedCritMultiplierPct + (p.addedCritMultiplierPct ?? 0),
      increasedAttackSpeedPct: globalMods.increasedAttackSpeedPct + (p.increasedAttackSpeedPct ?? 0),
      penetration: p.penetrationElementalPct
        ? {
            fire: globalMods.penetration.fire + p.penetrationElementalPct,
            cold: globalMods.penetration.cold + p.penetrationElementalPct,
            lightning: globalMods.penetration.lightning + p.penetrationElementalPct,
            chaos: globalMods.penetration.chaos,
          }
        : globalMods.penetration,
    };
  }
  notes.push('v6: assumes max Power+Frenzy charges (3+3); Ascendancy charge mods not yet modelled');
  notes.push(`v12: ailment-conditional multipliers scaled by per-ailment reliability vs ${targetTier} target (freeze ~unreliable on bosses; shock/ignite apply)`);

  if (supportResult.appliedSupports.length) {
    notes.push(`supports applied: ${supportResult.appliedSupports.join(', ')}`);
  }
  if (supportResult.skippedKeys.length) {
    notes.push(`support stats skipped (${supportResult.skippedKeys.length}): ${supportResult.skippedKeys.slice(0, 3).join('; ')}${supportResult.skippedKeys.length > 3 ? ' …' : ''}`);
  }
  if (activeBuffsResult.appliedFrom.length) {
    notes.push(`active-skill buffs from: ${activeBuffsResult.appliedFrom.join(', ')}`);
  }
  if (activeBuffsResult.maxMana > 0) {
    notes.push(`computed max mana: ${activeBuffsResult.maxMana} (used for Archmage and mana-scaling buffs)`);
  }
  // v12: fold ailment-conditional MORE multipliers in, each scaled by how
  // reliably its ailment lands on this target tier. "more vs Frozen" is worth
  // v16: SHOCK as "more damage taken". A shocked enemy takes more damage —
  // the boss-VIABLE ailment (unlike freeze). A build can shock if it deals
  // lightning (dominant type) OR carries a "damage can Shock / contributes to
  // shock" mod (Voltaxic's chaos→shock). Base shock = +20% damage taken
  // (PoE2 minimum; scales with shock effect, not modelled yet). Routed through
  // the same ailment-conditional/reliability machinery as other ailments, so
  // it's scaled by shock reliability vs the target tier and applies to the
  // RAMPED hit only (shock must land first).
  const dominantIsLightning = skill.skillTypes.includes('Lightning');
  const canShock = dominantIsLightning || globalMods.shockFromAnyHit;
  const SHOCK_BASE_MORE = 20;
  if (canShock && !globalMods.ailmentConditionalMore.some(a => a.ailment === 'shock')) {
    globalMods.ailmentConditionalMore.push({ ailment: 'shock', value: SHOCK_BASE_MORE });
    notes.push(
      `v16: build can Shock (${dominantIsLightning ? 'lightning hit' : 'shock-from-any mod'}) ` +
      `→ +${SHOCK_BASE_MORE}% shock more-damage-taken (scaled by shock reliability vs ${targetTier})`
    );
  }

  // ~nothing against a boss you can't freeze, full value against white mobs.
  const ailmentMoreList: number[] = [];
  for (const { ailment, value } of globalMods.ailmentConditionalMore) {
    const reliability = AILMENT_RELIABILITY[ailment]?.[targetTier] ?? 1;
    const effective = value * reliability;
    if (effective !== 0) ailmentMoreList.push(effective);
    if (reliability < 1) {
      notes.push(
        `v12: ${ailment} multiplier +${value}% scaled to +${effective.toFixed(0)}% ` +
        `(${(reliability * 100).toFixed(0)}% ${ailment} reliability vs ${targetTier})`
      );
    }
  }
  // Two combat states:
  //   FIRST hit  — target is fresh, NOTHING applied: only unconditional more.
  //   RAMPED hit — your slow/poison/ailment is now ON the target, so the
  //                ailment-conditional multipliers kick in (each already
  //                scaled by how reliably that ailment lands on this tier).
  const moreFactorFirst  = globalMods.moreDamageList.reduce((acc, m) => acc * (1 + m / 100), 1);
  const moreFactorRamped = [...globalMods.moreDamageList, ...ailmentMoreList].reduce((acc, m) => acc * (1 + m / 100), 1);
  const moreDamageFactor = moreFactorRamped; // keep ramped as the headline `more`
  const moreAttackSpeedFactor = globalMods.moreAttackSpeedList.reduce((acc, m) => acc * (1 + m / 100), 1);

  // ------ Per-hit damage (Mobalytics steps 2.1 → 2.2 → 2.3) ------
  // 2.1 Flat — branches by skill profile:
  //   ATTACK skills scale from weapon's local damage (current behaviour).
  //   SPELL skills scale from the gem's own base damage table:
  //     spell_minimum_base_<type>_damage + spell_maximum_base_<type>_damage
  //     resolved at the effective gem level. Weapon damage is irrelevant.
  //   For now we treat skills that are tagged `Spell` as spells, else attacks.
  //   Hybrid skills (Attack + Spell) are unusual; default to attack.
  //   (`isSpell` is resolved at the top of the function.)

  let flatBase: number;
  if (isSpell) {
    const lvlStats = (skill.perLevelStats || []).find(s => s.level === effectiveLevel)
                  ?? (skill.perLevelStats || []).filter(s => s.level <= effectiveLevel).pop();
    let spellMin = 0, spellMax = 0;
    if (lvlStats) {
      for (const [k, v] of Object.entries(lvlStats.stats)) {
        if (/^spell_minimum_base_\w+_damage$/.test(k)) spellMin += v;
        if (/^spell_maximum_base_\w+_damage$/.test(k)) spellMax += v;
      }
    }
    const spellAvg = (spellMin + spellMax) / 2;
    // Spell skills receive added flat damage from "Adds N to M Damage to Spells"
    // shape mods (separate from "to Attacks"). For v9 we don't yet aggregate
    // those — same applies as a queued refinement.
    // Spells: gem base + "Adds N to M <type> Damage to Spells" (ring/gear).
    // The attack-flat bucket does NOT apply to spells.
    flatBase = spellAvg + globalMods.addedFlatToSpellsAvg;
    if (globalMods.addedFlatToSpellsAvg > 0) {
      notes.push(`v20: +${globalMods.addedFlatToSpellsAvg.toFixed(0)} flat added to spells (ring/gear "Adds … to Spells")`);
    }
    notes.push(`spell base damage at L${effectiveLevel}: ${spellMin}-${spellMax} (avg ${spellAvg.toFixed(0)})`);
  } else {
    flatBase = weaponAvg + globalMods.addedFlatToAttacksAvg;
  }

  // v18 — ARMOUR AS DAMAGE. "% of Armour also applies to <type> Damage" turns
  // the defensive armour pool into flat hit damage (Smith of Kitava, Doryani's
  // Prototype). Applies to attack and spell hits alike. The chaos portion
  // (Smith: Dedication to Kitava) is UNRESISTED — its fraction of the hit is
  // credited as a chaos bypass in the resistance step below.
  let armourChaosFraction = 0;
  const aap = globalMods.armourAppliesPct;
  const anyArmourDmg = aap.fire || aap.cold || aap.lightning || aap.chaos || aap.elemental;
  if (anyArmourDmg) {
    const armour = computeArmour(build).total;
    const armourChaos = armour * (aap.chaos / 100);
    // 'elemental' applies to each of fire/cold/lightning; as a flat add we
    // count it once (it lands as the build's elemental damage). Specific
    // fire/cold/lightning destinations add on top.
    const armourEle = armour * ((aap.elemental + aap.fire + aap.cold + aap.lightning) / 100);
    const armourDmgTotal = armourChaos + armourEle;
    flatBase += armourDmgTotal;
    if (flatBase > 0) armourChaosFraction = armourChaos / flatBase;
    notes.push(
      `v18: armour-as-damage — ${armour.toFixed(0)} armour → +${armourDmgTotal.toFixed(0)} flat ` +
      `(${armourChaos.toFixed(0)} chaos [unresisted], ${armourEle.toFixed(0)} elemental)`
    );
  }
  const skillBase = flatBase * baseMultiplier;
  // 2.2 Conversion + Gain-as-Extra: v5 simplification — apply extra-as as
  // an additive multiplier on the post-flat value. Proper per-type tracking
  // (e.g. extra-as-cold scales with "increased Cold Damage" but not "Fire")
  // is queued; this over-counts only when an extra is granted in a type
  // the build can't scale.
  const afterExtras = skillBase * (1 + globalMods.extraDamagePct / 100);
  // 2.3 Multipliers: increased (additive) then more (multiplicative).
  // For cast_on_crit mode, append the intrinsic CoC damage penalty.
  const incFactor = 1 + globalMods.increasedDamagePct / 100;
  const cocFactor = triggerMode === 'cast_on_crit' ? (1 + CAST_ON_CRIT_DAMAGE_PENALTY_PCT / 100) : 1;
  if (triggerMode === 'cast_on_crit') {
    notes.push(`cast_on_crit damage penalty applied: ${CAST_ON_CRIT_DAMAGE_PENALTY_PCT}% more (intrinsic to CoC support)`);
  }
  const perHitFirst  = afterExtras * incFactor * moreFactorFirst  * cocFactor;
  const perHitRamped = afterExtras * incFactor * moreFactorRamped * cocFactor;
  let perHit = perHitRamped; // headline perHit = ramped (sustained)

  // ------ Hit rate (attacks/sec for attacks, casts/sec for spells) ------
  // ATTACK: base rate = weapon AttackRateBase, scaled by local + global
  //   attack speed.
  // SPELL : base rate = 1 / castTime (the gem's), scaled by cast speed (which
  //   aggregateMods folds into the same increasedAttackSpeedPct bucket). The
  //   weapon has no APS and no "local attack speed" for a spell.
  const baseAPS = isSpell
    ? 1 / (skill.castTime || SPELL_DEFAULT_CAST_TIME_S)
    : (weaponBase.weapon?.AttackRateBase ?? 1);
  const localAttackSpeed = isSpell
    ? 0
    : sumPercent(weaponLines, t => /%\s+(?:increased|reduced)\s+Attack Speed/.test(t));
  // Skill's attackSpeedMultiplier has two semantics in PoB data:
  //   1. Flat % adjustment (e.g. Ice Shot = -10 → -10% APS).
  //   2. Fixed-rate override (e.g. Requiem = 300 → fires at exactly 3.0/sec
  //      regardless of weapon APS). PoB calls this skill_attack_speed_+%_final
  //      with a magnitude that only makes sense as "attacks per 100ms" /
  //      direct rate. Heuristic: values >= 100 cannot be a sane % adjustment
  //      (+100% APS would already be exceptional; values like 300/450/700
  //      seen on Requiem/Rapid Shot/Flame Breath etc. are rate overrides).
  //   Local attack speed is on the weapon (e.g. 19% increased Attack Speed).
  //   Global attack speed from tree applies additively to the local bucket.
  const ATTACK_SPEED_OVERRIDE_THRESHOLD = 100;
  let effectiveAPS: number;
  if (attackSpeedMul >= ATTACK_SPEED_OVERRIDE_THRESHOLD) {
    effectiveAPS = (attackSpeedMul / 100) * moreAttackSpeedFactor;
    notes.push(`skill overrides APS to ${(attackSpeedMul / 100).toFixed(2)}/sec (fixed rate; ignores weapon APS and local/global attack speed)`);
  } else {
    effectiveAPS = baseAPS
      * (1 + (localAttackSpeed + globalMods.increasedAttackSpeedPct) / 100)
      * (1 + attackSpeedMul / 100)
      * moreAttackSpeedFactor;
  }

  // total_attack_time_+_ms: PoB stores skill-imposed extra recovery (e.g.
  // Escape Shot adds 700ms per attack on top of the weapon's base time).
  // Convert APS → ms, add the extra, convert back.
  const constantStats = skill.constantStats || [];
  let totalAttackTimeExtraMs = 0;
  for (const [k, v] of constantStats) {
    if (k === 'total_attack_time_+_ms' && typeof v === 'number') totalAttackTimeExtraMs += v;
  }
  if (totalAttackTimeExtraMs > 0 && effectiveAPS > 0) {
    const baseMs = 1000 / effectiveAPS;
    const adjustedMs = baseMs + totalAttackTimeExtraMs;
    effectiveAPS = 1000 / adjustedMs;
    notes.push(`v8: skill imposes +${totalAttackTimeExtraMs}ms total_attack_time → effective APS ${effectiveAPS.toFixed(3)}`);
  }

  // Enemy defensive profile — resolved here (before crit) because the
  // Amazon accuracy→crit mechanic needs the enemy's evasion. Reused by the
  // v13 resistance step below.
  const enemyProfile: EnemyProfile = {
    ...ENEMY_PROFILES[targetTier],
    ...input.enemyProfile,
  };
  // v19: armour break (Cut to the Bone, Warbringer). A build built around
  // breaking armour keeps the enemy's armour broken, so physical reduction
  // drops toward 0. Steady-state: remove 80% of the phys reduction. Only
  // meaningful for physical hits (armour mitigates physical).
  const ARMOUR_BREAK_REMOVAL = 0.8;
  if (globalMods.breaksArmour && enemyProfile.physReduction > 0) {
    const reduced = enemyProfile.physReduction * (1 - ARMOUR_BREAK_REMOVAL);
    notes.push(`v19: breaks armour → enemy phys reduction ${(enemyProfile.physReduction * 100).toFixed(0)}% → ${(reduced * 100).toFixed(0)}%`);
    enemyProfile.physReduction = reduced;
  }

  // ------ Crit (base + global increased crit chance, plus crit-multi mods) ------
  // ATTACK: base crit comes from the WEAPON (CritChanceBase) + local weapon
  //   "% to Critical Hit Chance" rolls.
  // SPELL : base crit is the SPELL's own (weapon crit doesn't apply); there's
  //   no weapon-local crit. Global "% increased Critical Hit Chance" scales it.
  const baseCritChance = isSpell
    ? SPELL_BASE_CRIT_CHANCE
    : (weaponBase.weapon?.CritChanceBase ?? 5) / 100;
  const localCrit = isSpell
    ? 0
    : sumPlusTo(weaponLines, t => /%\s+to\s+Critical\s+Hit\s+Chance/i.test(t)) / 100;
  // Global "% increased Critical Hit Chance" scales (base + local) bucket.
  let critChance = Math.min(1, (baseCritChance + localCrit) * (1 + globalMods.increasedCritChancePct / 100));
  // Amazon "Critical Strike": accuracy stacked past the ~95%-hit threshold
  // converts to crit. Flag-gated (excessHitToCritPct > 0) so non-Amazon builds
  // keep the 100%-hit assumption untouched. PROVISIONAL model — calibrate the
  // excess formula against a real Amazon accuracy-crit build.
  if (globalMods.excessHitToCritPct > 0 && !isSpell) {
    const accuracy = globalMods.accuracyFlat * (1 + globalMods.accuracyIncreasedPct / 100);
    const excess = excessHitPct(accuracy, enemyProfile.evasion);
    const critFromAccuracy = (excess * globalMods.excessHitToCritPct / 100) / 100; // → fraction
    if (critFromAccuracy > 0) {
      critChance = Math.min(1, critChance + critFromAccuracy);
      notes.push(
        `v15: Amazon accuracy→crit — ${accuracy.toFixed(0)} accuracy vs ${enemyProfile.evasion} evasion ` +
        `→ ${excess.toFixed(0)}% excess hit × ${globalMods.excessHitToCritPct}% = +${(critFromAccuracy * 100).toFixed(1)}% crit ` +
        `(PROVISIONAL — excess formula needs fixture calibration)`
      );
    }
  }
  // PoE2 default crit multiplier: +100% bonus. addedCritMultiplierPct is
  // additive on top of that (e.g. +30 → total +130 → ×2.30 on crit).
  const critMul = 1 + 1.0 + globalMods.addedCritMultiplierPct / 100;
  const expectedCritMultiplier = 1 + critChance * (critMul - 1);

  // Hits/sec source depends on trigger mode. In direct mode it's the
  // skill's own cast/attack rate; in cast_on_crit mode it's the trigger
  // frequency, computed from the assumed Spark source skill's cast rate ×
  // projectile count × crit chance, capped at the CoC cooldown ceiling.
  let hitsPerSec = effectiveAPS;
  if (triggerMode === 'cast_on_crit') {
    // Spark's effective cast rate uses the build's cast-speed buckets
    // (which our composer already aggregates into the attack-speed list —
    // we unified attack & cast speed because the buckets are isomorphic).
    const sparkBaseCps = 1 / SPARK_BASE_CAST_TIME_S;
    const sparkCps = sparkBaseCps
      * (1 + globalMods.increasedAttackSpeedPct / 100)
      * moreAttackSpeedFactor;
    // Assume each projectile crit can trigger CoC (CoC fires per-hit). 9
    // projectiles per Spark cast at L21; use the build's crit chance.
    const projectiles = SPARK_PROJECTILES_PER_CAST_AT_21;
    const triggerableHitsPerSec = sparkCps * projectiles * critChance;
    hitsPerSec = Math.min(triggerableHitsPerSec, CAST_ON_CRIT_COOLDOWN_CAP_PER_SEC);
    notes.push(
      `triggerMode=cast_on_crit: spark ${sparkCps.toFixed(2)} casts/sec × ${projectiles} projectiles × ${(critChance*100).toFixed(0)}% crit ` +
      `= ${triggerableHitsPerSec.toFixed(2)} hits/sec; ` +
      (triggerableHitsPerSec >= CAST_ON_CRIT_COOLDOWN_CAP_PER_SEC ? 'capped at ' : 'under cap of ') +
      `${CAST_ON_CRIT_COOLDOWN_CAP_PER_SEC}/sec`
    );
  }

  // v10: cast multipliers (Spell Cascade, Unleash, etc.) — each cast event
  // produces this many discrete hits. Applies to both direct and CoC modes;
  // each CoC trigger still fires N cascades of the linked spell.
  if (globalMods.castMultiplier !== 1) {
    hitsPerSec *= globalMods.castMultiplier;
    notes.push(`v10: cast multiplier ×${globalMods.castMultiplier} from cascade-like supports — hits/sec scaled`);
  }

  // v11: cooldown gate. A skill with a cooldown can fire at most
  // storedUses / cooldown times per second when self-cast — no matter how
  // fast the weapon/cast rate is. This is what stops cooldown skills
  // (grenades, slams, movement attacks) from being mis-ranked as spammable
  // main skills. Trigger mode is exempt: the trigger source dictates the
  // rate, and the CoC cooldown cap already applied above.
  // Only gate by a REAL cooldown from the data. A skill's firing cadence is
  // otherwise set by its attack/cast rate (incl. skill-imposed extra attack
  // time like Escape Shot's +0.7s, applied above). Movement skills are NOT
  // special-cased: if a leap like Escape Shot does enough per-hit at its
  // natural cadence, it's a legitimate main skill — let the numbers decide.
  if (triggerMode === 'direct' && lvl.cooldown && lvl.cooldown > 0) {
    const cooldownRate = (lvl.storedUses ?? 1) / lvl.cooldown;
    if (cooldownRate < hitsPerSec) {
      notes.push(
        `v11: cooldown gate — ${skill.name} fires ${lvl.storedUses ?? 1}/${lvl.cooldown}s = ` +
        `${cooldownRate.toFixed(2)}/sec (capped from ${hitsPerSec.toFixed(2)}/sec)`
      );
      hitsPerSec = cooldownRate;
    }
  }

  // Secondary on-hit damage (Ice Shot shard cone, etc.) — a simultaneous
  // extra hit PoB folds into its headline DPS. Curated + calibrated; for
  // single-target it adds `fraction` × the primary hit.
  const secFraction = secondaryHitFraction(skill.id);
  const secondaryFactor = 1 + secFraction;
  if (secFraction > 0) {
    notes.push(`secondary hit: +${(secFraction * 100).toFixed(0)}% from ${SECONDARY_HITS[skill.id]?.note} (single-target; cone = clear-speed coverage)`);
  }

  // ------ v13: enemy resistance + penetration (type-aware) ------
  // How much of the hit actually lands. Chaos = full force; elemental is
  // resisted (heavily on bosses) unless penetrated or inverted (Monk). This
  // is the dominant boss-DPS correction — the old model assumed 0% res.
  // (enemyProfile resolved above the crit step for the accuracy→crit calc.)
  // Chaos conversion only bypasses resistance for the portion whose SOURCE
  // type matches the hit's dominant type. Voltaxic (lightning→chaos) does
  // nothing to a cold Ice Shot — unless the cold is first made lightning, which
  // our single-dominant-type model can't yet track (documented limitation).
  const dom = dominantDamageType(skill.skillTypes);
  const chaosSrc = globalMods.chaosConversionSource;
  const chaosApplies = chaosSrc === 'all' || chaosSrc === dom;
  // Base from explicit conversion (Voltaxic etc.) + the armour-as-chaos fraction
  // (Smith of Kitava). Both are unresisted chaos portions of the hit.
  const effectiveChaosPct = Math.min(100,
    (chaosApplies ? globalMods.convertedToChaosPct : 0) + armourChaosFraction * 100);
  if (globalMods.convertedToChaosPct > 0 && !chaosApplies) {
    notes.push(
      `v14: chaos conversion source (${chaosSrc}) ≠ hit type (${dom}) → bypass NOT credited ` +
      `(e.g. Voltaxic converts lightning; a cold hit needs a cold→lightning step first)`
    );
  }
  const eff = damageEffectiveness(
    skill.skillTypes,
    enemyProfile,
    globalMods.penetration,
    input.resistanceInverted === true,
    effectiveChaosPct,
  );
  const damageEffectivenessMul = eff.multiplier;
  notes.push(`v13: ${eff.note}`);

  const rawDps = perHit * hitsPerSec * expectedCritMultiplier * secondaryFactor;
  const dps = rawDps * damageEffectivenessMul;
  if (damageEffectivenessMul !== 1) {
    notes.push(`v13: raw ${rawDps.toFixed(0)} → ${dps.toFixed(0)} after ${eff.dominantType} effectiveness ×${damageEffectivenessMul.toFixed(2)} (raw = PoB-comparable, no enemy res)`);
  }
  // First-hit DPS: the opener against a fresh target before any of your
  // slows/ailments/debuffs land. Ramped (= `dps`) is once they're applied.
  const firstHitDps = perHitFirst * hitsPerSec * expectedCritMultiplier * secondaryFactor * damageEffectivenessMul;
  const rampedDps = dps;
  if (rampedDps > firstHitDps * 1.001) {
    notes.push(`first-hit ${(firstHitDps).toFixed(0)} → ramped ${(rampedDps).toFixed(0)} once on-target ailments apply (×${(rampedDps / firstHitDps).toFixed(2)})`);
  }

  // ------ Notes about what's NOT modelled yet ------
  notes.push('v5: skill-type conversion not yet (e.g. Ice Shot phys→cold)');
  notes.push('v5: ignores conditional mods (vs Rare/Unique, while Y, charges)');
  notes.push('v5: jewels in tree treated as global, radius effects ignored');
  notes.push('v5: charm & flask effects not modelled');
  notes.push('v13: resistance applied to the hit\'s DOMINANT element only; gain-as-extra of a second element not yet resisted separately');

  return {
    weapon: { name: weaponItem.name || '?', base: weaponItem.base, baseMin, baseMax },
    effectiveGemLevel: effectiveLevel,
    skill: { id: skill.id, name: skill.name, baseMultiplier, attackSpeedMul },
    weaponAvgDamage: weaponAvg,
    hitsPerSecond: hitsPerSec,
    perHit,
    expectedCritMultiplier,
    dps,
    rawDps,
    firstHitDps,
    rampedDps,
    enemy: {
      tier: targetTier,
      dominantType: eff.dominantType,
      effectiveResPct: eff.effectiveResPct,
      effectivenessMul: damageEffectivenessMul,
    },
    global: {
      addedFlatToAttacksAvg: globalMods.addedFlatToAttacksAvg,
      increasedDamagePct: globalMods.increasedDamagePct,
      moreDamageFactor,
      increasedAttackSpeedPct: globalMods.increasedAttackSpeedPct,
      moreAttackSpeedFactor,
      increasedCritChancePct: globalMods.increasedCritChancePct,
      addedCritMultiplierPct: globalMods.addedCritMultiplierPct,
      extraDamagePct: globalMods.extraDamagePct,
    },
    notes,
  };
}
