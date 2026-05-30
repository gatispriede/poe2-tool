// Enemy resistance + penetration — the type-aware "how much of the hit
// actually lands" layer. This is the single biggest boss-DPS correction:
// the composer used to assume 0% enemy resistance, which over-states
// elemental boss DPS by 2-4×.
//
// The core truth (player's framing):
//   - CHAOS has no resistance on most enemies → full force.
//   - ELEMENTAL (fire/cold/lightning) is resisted, heavily on bosses. A
//     2,000,000 hit into 75% resistance lands only 500,000. A 1,000,000 hit
//     with 50% penetration (→ 25% effective res) lands 750,000 — the smaller
//     headline wins.
//   - PENETRATION and EXPOSURE (-% enemy resistance) both lower effective
//     resistance and can push it negative (→ >100% effectiveness).
//   - Some builds INVERT resistance (Monk ascendancy: +75% → -75%), which
//     turns a resisted hit into an amplified one and makes penetration on
//     gear/tree redundant.
//
// v1 scope: we apply the effectiveness of the hit's DOMINANT damage type to
// the whole hit. Per-type splitting (so gain-as-extra of a second element is
// resisted separately) is a queued refinement — flagged in the result.

export type DamageType = 'physical' | 'fire' | 'cold' | 'lightning' | 'chaos';

export interface EnemyProfile {
  label: string;
  // Resistance % per element / chaos (physical is mitigated via physReduction).
  fire: number;
  cold: number;
  lightning: number;
  chaos: number;
  // Physical damage reduction as a fraction (0..1), a stand-in for armour.
  physReduction: number;
  // Evasion rating — used only for the accuracy→hit-chance calc (Amazon
  // excess-hit-to-crit). PoB pinnacle ground truth: 1175.
  evasion: number;
}

export type TargetTier = 'white' | 'rare' | 'boss' | 'pinnacle';

// PoE2 0.5 profiles, anchored to PoB's default enemy stats (ground truth).
// PoB's "Guardian/Pinnacle Boss" at level 82 has Fire/Cold/Lightning
// Resistance = 50%, Chaos = 0%, Armour 8063, Evasion 1175, and the cap
// "Enemy Max Resistance is always 75%" (75% is the CAP, not the value — a
// common mistake). So elemental boss res is 50%, not 75%. Lower tiers scale
// down. physReduction approximates armour mitigation (PoB showed phys eff
// ×0.765 ≈ 24% on a real pinnacle hit). These are TUNABLE; override per-call
// via ComposeInput.enemyProfile when you know the exact fight.
export const ENEMY_PROFILES: Record<TargetTier, EnemyProfile> = {
  white:    { label: 'white mob',     fire: 0,  cold: 0,  lightning: 0,  chaos: 0, physReduction: 0.00, evasion: 100 },
  rare:     { label: 'rare',          fire: 25, cold: 25, lightning: 25, chaos: 0, physReduction: 0.10, evasion: 450 },
  boss:     { label: 'map boss',      fire: 40, cold: 40, lightning: 40, chaos: 0, physReduction: 0.15, evasion: 800 },
  // Ground truth: PoB default pinnacle (lvl 82) = 50% elemental / 0% chaos, evasion 1175.
  pinnacle: { label: 'pinnacle boss', fire: 50, cold: 50, lightning: 50, chaos: 0, physReduction: 0.24, evasion: 1175 },
};

/**
 * Chance to hit (PoE's standard accuracy formula), returned UNCAPPED as a
 * percentage so the Amazon "Chance to Hit can exceed 100%" mechanic has an
 * excess to work with. Standard formula:
 *   hit = accuracy / (accuracy + (evasion / 4) ^ 0.8)
 * which asymptotes to 1.0, so on its own never exceeds 100%. PoE2's Amazon
 * node removes the practical ceiling by rewarding accuracy stacked FAR beyond
 * the ~95%-hit threshold. We model "excess" as accuracy beyond what reaches
 * 95% hit, expressed as a percentage — a transparent, calibratable proxy
 * (flag it in notes; tune against a real Amazon accuracy-crit build).
 */
export function hitChancePct(accuracy: number, evasion: number): number {
  const k = Math.pow(Math.max(0, evasion) / 4, 0.8);
  const base = accuracy / (accuracy + k); // 0..1, asymptotic
  return base * 100;
}

/**
 * Excess-hit percentage for the Amazon mechanic: how much accuracy exceeds the
 * amount needed for 95% hit, as a % of that threshold. e.g. 2× the 95%-accuracy
 * → ~100% excess. Returns 0 when below the threshold.
 */
export function excessHitPct(accuracy: number, evasion: number): number {
  const k = Math.pow(Math.max(0, evasion) / 4, 0.8);
  // accuracy needed for 95% hit: 0.95 = a/(a+k) → a = 19k.
  const accFor95 = 19 * k;
  if (accFor95 <= 0) return 0;
  return Math.max(0, (accuracy / accFor95 - 1) * 100);
}

// Penetration / exposure, already expanded per element. Both penetration
// ("Penetrates X% Elemental Resistance") and exposure ("-X% to Enemy
// Resistance") reduce effective resistance identically, so they fold into
// the same per-type number.
export interface PenetrationByType {
  fire: number;
  cold: number;
  lightning: number;
  chaos: number;
}

export function emptyPenetration(): PenetrationByType {
  return { fire: 0, cold: 0, lightning: 0, chaos: 0 };
}

/**
 * The hit's dominant damage type, used to pick which resistance applies.
 * Conversion is already baked into the skill's tags in our data (Ice Shot
 * carries the Cold tag because it converts phys→cold), so tag order gives a
 * good single-type answer:
 *   Chaos > Cold/Fire/Lightning (whichever tag is present) > Physical.
 */
export function dominantDamageType(skillTypes: string[]): DamageType {
  const has = (t: string) => skillTypes.includes(t);
  if (has('Chaos')) return 'chaos';
  if (has('Cold')) return 'cold';
  if (has('Fire')) return 'fire';
  if (has('Lightning')) return 'lightning';
  return 'physical';
}

/** Effectiveness multiplier for one damage type against a profile. */
export function effectivenessForType(
  type: DamageType,
  profile: EnemyProfile,
  pen: PenetrationByType,
  invert: boolean,
): number {
  if (type === 'physical') {
    // Armour stand-in; penetration of armour not modelled yet.
    return 1 - profile.physReduction;
  }
  let res = profile[type];           // base resistance %
  if (invert) res = -res;            // Monk-style inversion: +75 → -75
  res = res - pen[type];             // penetration & exposure lower it (can go negative)
  return 1 - res / 100;              // negative res → >1 (amplified)
}

export interface EffectivenessResult {
  multiplier: number;
  dominantType: DamageType;
  effectiveResPct: number;   // after inversion + penetration (for the dominant type)
  note: string;
}

/**
 * Compute the damage-effectiveness multiplier for a hit. Applies the dominant
 * type's effectiveness to the whole hit, then BLENDS in chaos effectiveness
 * for the fraction of the hit converted to chaos.
 *
 * `chaosConvertedPct` (0..100): how much of the hit's dominant-type damage is
 * converted to chaos (Voltaxic Rift, Blackflame Covenant, etc.). Chaos has 0%
 * resistance on bosses, so converting an elemental hit to chaos sidesteps the
 * ~50% boss resistance tax — a smaller chaos hit out-lands a bigger resisted
 * elemental one. v1 assumes the conversion applies to the DOMINANT type (the
 * common case: you convert your main damage). Partial conversion blends.
 */
export function damageEffectiveness(
  skillTypes: string[],
  profile: EnemyProfile,
  pen: PenetrationByType,
  invert: boolean,
  chaosConvertedPct = 0,
): EffectivenessResult {
  const dominantType = dominantDamageType(skillTypes);
  const dominantEff = effectivenessForType(dominantType, profile, pen, invert);

  // Blend: the converted fraction is resisted as CHAOS, the rest as the
  // dominant type. If the hit is already chaos, conversion is a no-op.
  const chaosFrac = dominantType === 'chaos' ? 0 : Math.max(0, Math.min(100, chaosConvertedPct)) / 100;
  const chaosEff = effectivenessForType('chaos', profile, pen, invert);
  const multiplier = chaosFrac > 0
    ? (1 - chaosFrac) * dominantEff + chaosFrac * chaosEff
    : dominantEff;

  let effectiveResPct: number;
  if (dominantType === 'physical') {
    effectiveResPct = profile.physReduction * 100;
  } else {
    const base = invert ? -profile[dominantType] : profile[dominantType];
    effectiveResPct = base - pen[dominantType];
  }

  let note: string;
  if (chaosFrac > 0) {
    note =
      `${(chaosFrac * 100).toFixed(0)}% of ${dominantType} converted to chaos (0% res) ` +
      `→ blended ×${multiplier.toFixed(2)} on ${profile.label} ` +
      `(vs ×${dominantEff.toFixed(2)} un-converted) — resistance bypass`;
  } else if (dominantType === 'chaos') {
    note = `chaos: no resistance on ${profile.label} → full force (×${multiplier.toFixed(2)})`;
  } else if (dominantType === 'physical') {
    note = `physical: ${(profile.physReduction * 100).toFixed(0)}% reduction on ${profile.label} (×${multiplier.toFixed(2)})`;
  } else {
    note =
      `${dominantType}: ${profile[dominantType]}% res${invert ? ' INVERTED' : ''}` +
      `${pen[dominantType] ? ` − ${pen[dominantType]}% pen` : ''}` +
      ` = ${effectiveResPct.toFixed(0)}% effective on ${profile.label} (×${multiplier.toFixed(2)})`;
  }

  return { multiplier, dominantType, effectiveResPct, note };
}
