// Domain models for simplified PoE2 damage calculation (physical hit only)
// This is intentionally simplified and not authoritative.

export const clampNonNegative = (v: number) => (isNaN(v) || v < 0 ? 0 : v);

export type Weapon = {
  name: string;
  baseMin: number; // base minimum physical damage
  baseMax: number; // base maximum physical damage
  baseAPS: number; // attacks per second
  localIncreasedDamagePct?: number; // local increased damage (applies only to weapon base)
};

export type WeaponModEffects = {
  localIncreasedPhysicalDamagePct?: number;
  localIncreasedAttackSpeedPct?: number;
  localIncreasedCriticalStrikeChancePct?: number;
  localIncreasedCriticalStrikeMultiplierPct?: number;
  localIncreasedAccuracyRatingPct?: number;
  addedFireDamageMin?: number;
  addedFireDamageMax?: number;
  addedColdDamageMin?: number;
  addedColdDamageMax?: number;
  addedLightningDamageMin?: number;
  addedLightningDamageMax?: number;
  criticalStrikePenetrationPct?: number;
  moreDamageVsLowLifePct?: number;
  chanceToGainOnslaughtOnKillPct?: number;
  chanceToBleedOnCritPct?: number;
};

export type Skill = {
  name: string;
  moreDamageMultipliersPct?: number[]; // e.g. [30, 40] => 30% more then 40% more
  moreAttackSpeedMultipliersPct?: number[]; // attack speed "more" modifiers
};

export type PassiveStats = {
  increasedPhysicalDamagePct?: number; // additive with other increased
  increasedAttackSpeedPct?: number; // additive attack speed
  increasedCritChancePct?: number; // additive to base crit chance
  baseCritChancePct?: number; // base crit chance (default 5 if omitted)
  baseCritMultiplierPct?: number; // base crit multi (default 150 if omitted)
  increasedCritMultiplierPct?: number; // additive increase to crit multi
  // Spell-specific stats
  increasedSpellDamagePct?: number; // increased spell damage
  increasedElementalDamagePct?: number; // increased elemental damage
  increasedFireDamagePct?: number; // increased fire damage
  increasedColdDamagePct?: number; // increased cold damage
  increasedLightningDamagePct?: number; // increased lightning damage
  increasedChaosDamagePct?: number; // increased chaos damage
  increasedCastSpeedPct?: number; // increased cast speed
  increasedSpellCritChancePct?: number; // increased spell critical strike chance
  increasedSpellCritMultiplierPct?: number; // increased spell critical strike multiplier
  addedSpellDamage?: number; // flat added spell damage
  increasedAreaDamagePct?: number; // increased area damage
  increasedProjectileDamagePct?: number; // increased projectile damage
  increasedDamagePct?: number; // generic increased damage
  moreDamageMultipliersPct?: number[]; // more damage multipliers
  moreCastSpeedMultipliersPct?: number[]; // more cast speed multipliers
};

export type CalculationInput = {
  weapon: Weapon;
  skill: Skill;
  passives: PassiveStats;
  weaponMods?: WeaponModEffects; // Combined effects from selected weapon mods
  overrides?: {
    globalMoreDamagePct?: number[]; // list of global more damage modifiers
  };
};

export type DamageBreakdown = {
  averageBaseWeaponDamage: number;
  averagePreCritNonMore: number;
  averageHitNonCrit: number; // after increased + more, pre-crit weighting
  effectiveCritChance: number; // 0..1
  effectiveCritMultiplier: number; // e.g. 1.5
  averageHitWithCrit: number; // weighted average
  effectiveAPS: number;
  dps: number;
};
