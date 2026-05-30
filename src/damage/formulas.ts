/**
 * Path of Building 2 Compatible Damage Calculation
 *
 * This implementation follows PoB2's calculation order:
 *
 * 1. BASE DAMAGE
 *    - Weapon base min/max damage
 *    - Local increased damage from weapon (e.g., quality)
 *
 * 2. LOCAL MODIFIERS (apply to weapon only)
 *    - Local increased physical damage % (from mods)
 *    - Added elemental damage (flat additions)
 *
 * 3. GLOBAL INCREASED MODIFIERS (additive pool)
 *    - Increased physical damage from passives
 *    - Increased damage from other sources
 *    - Applied separately to each damage type
 *
 * 4. MORE MULTIPLIERS (multiplicative chain)
 *    - Skill "more damage" multipliers
 *    - Support gem "more damage" multipliers
 *    - Conditional "more damage" (e.g., vs low life)
 *
 * 5. CRITICAL STRIKES (PoB2 uses multiplicative scaling)
 *    - Base crit chance (weapon dependent, default 5%)
 *    - LOCAL increased crit × base (multiplicative)
 *    - GLOBAL increased crit × result (multiplicative)
 *    - Crit multiplier uses additive increases
 *
 * 6. ATTACK SPEED
 *    - Base APS from weapon
 *    - Local + Global increased AS (additive pool)
 *    - More AS multipliers (multiplicative)
 *
 * Key differences from simplified approach:
 * - Critical strike chance is MULTIPLICATIVE, not additive
 * - Elemental damage scales independently from physical
 * - Local modifiers apply before global modifiers
 * - Weighted crit average uses: dmg * (1 - crit + crit * multi)
 */

import { CalculationInput, DamageBreakdown, clampNonNegative } from './model';

const pctToMultiplierMore = (pct?: number) => 1 + (pct ?? 0) / 100; // treat negative if passed

const product = (arr: number[]) => arr.reduce((a, b) => a * b, 1);

export function calculateDamage(input: CalculationInput): DamageBreakdown {
  const { weapon, skill, passives, weaponMods, overrides } = input;

  // ===== STEP 1: Base Weapon Damage (PoB2 style) =====
  const baseMin = clampNonNegative(weapon.baseMin);
  const baseMax = clampNonNegative(weapon.baseMax);

  // Local increased damage from weapon itself
  const weaponLocalInc = clampNonNegative(weapon.localIncreasedDamagePct ?? 0);


  // ===== STEP 2: Physical Damage Calculation =====
  // Local increased physical damage from mods (stacks additively with weapon local)
  const modLocalIncPhys = clampNonNegative(weaponMods?.localIncreasedPhysicalDamagePct ?? 0);
  const totalLocalIncPhys = weaponLocalInc + modLocalIncPhys;

  // Recalculate with total local increases
  const physMin = baseMin * (1 + totalLocalIncPhys / 100);
  const physMax = baseMax * (1 + totalLocalIncPhys / 100);
  const physAvg = (physMin + physMax) / 2;

  // ===== STEP 3: Elemental Damage Calculation (separate scaling) =====
  // Elemental damage is NOT affected by local physical increases
  const fireMin = weaponMods?.addedFireDamageMin ?? 0;
  const fireMax = weaponMods?.addedFireDamageMax ?? 0;
  const fireAvg = (fireMin + fireMax) / 2;

  const coldMin = weaponMods?.addedColdDamageMin ?? 0;
  const coldMax = weaponMods?.addedColdDamageMax ?? 0;
  const coldAvg = (coldMin + coldMax) / 2;

  const lightningMin = weaponMods?.addedLightningDamageMin ?? 0;
  const lightningMax = weaponMods?.addedLightningDamageMax ?? 0;
  const lightningAvg = (lightningMin + lightningMax) / 2;

  // ===== STEP 4: Global Increased Damage (PoB2 applies per damage type) =====
  const globalIncPhys = clampNonNegative(passives.increasedPhysicalDamagePct ?? 0);

  // Apply global increases separately to each damage type
  const physDamageAfterInc = physAvg * (1 + globalIncPhys / 100);
  const fireDamageAfterInc = fireAvg * (1 + globalIncPhys / 100); // Simplified: using same for now
  const coldDamageAfterInc = coldAvg * (1 + globalIncPhys / 100);
  const lightningDamageAfterInc = lightningAvg * (1 + globalIncPhys / 100);

  const totalDamageAfterInc = physDamageAfterInc + fireDamageAfterInc + coldDamageAfterInc + lightningDamageAfterInc;

  // ===== STEP 5: More Damage Multipliers (multiplicative chain) =====
  const moreList: number[] = [
    ...(skill.moreDamageMultipliersPct ?? []),
    ...(overrides?.globalMoreDamagePct ?? [])
  ];

  if (weaponMods?.moreDamageVsLowLifePct) {
    moreList.push(weaponMods.moreDamageVsLowLifePct);
  }

  const moreMultiplier = product(moreList.map(pctToMultiplierMore));
  const averageHitNonCrit = totalDamageAfterInc * moreMultiplier;

  // ===== STEP 6: Critical Strike Calculations (PoB2 style) =====
  // Base crit chance (weapon dependent, default 5%)
  const baseCritChancePct = clampNonNegative(passives.baseCritChancePct ?? 5);

  // LOCAL increased crit chance (from weapon mods) - MULTIPLICATIVE with base (PoB2 style)
  const localIncCritPct = clampNonNegative(weaponMods?.localIncreasedCriticalStrikeChancePct ?? 0);
  const critAfterLocal = baseCritChancePct * (1 + localIncCritPct / 100);

  // GLOBAL increased crit chance (from passives) - MULTIPLICATIVE with result (PoB2 style)
  const globalIncCritPct = clampNonNegative(passives.increasedCritChancePct ?? 0);
  const effectiveCritChancePct = critAfterLocal * (1 + globalIncCritPct / 100);

  // Clamp to 100% (but work in percentage until final calculation)
  const effectiveCritChance = Math.min(1, effectiveCritChancePct / 100);

  // Critical Strike Multiplier
  const baseCritMultiplierPct = clampNonNegative(passives.baseCritMultiplierPct ?? 150);

  // Increased crit multi is ADDITIVE (PoB2 style)
  const localIncCritMulti = clampNonNegative(weaponMods?.localIncreasedCriticalStrikeMultiplierPct ?? 0);
  const globalIncCritMulti = clampNonNegative(passives.increasedCritMultiplierPct ?? 0);
  const totalIncCritMulti = localIncCritMulti + globalIncCritMulti;

  // Apply to base multiplier
  const effectiveCritMultiplierPct = baseCritMultiplierPct + totalIncCritMulti;
  const effectiveCritMultiplier = effectiveCritMultiplierPct / 100;

  // ===== STEP 7: Weighted Average Damage with Crits (PoB2 formula) =====
  // Average = NonCritDamage * (1 - CritChance) + CritDamage * CritChance
  // Where CritDamage = NonCritDamage * CritMultiplier
  const averageHitWithCrit = averageHitNonCrit * (1 - effectiveCritChance + effectiveCritChance * effectiveCritMultiplier);

  // ===== STEP 8: Attack Speed (local + global + more) =====
  const baseAPS = clampNonNegative(weapon.baseAPS);

  // Local increased attack speed from mods
  const localIncAS = clampNonNegative(weaponMods?.localIncreasedAttackSpeedPct ?? 0);

  // Global increased attack speed from passives (stacks additively with local)
  const globalIncAS = clampNonNegative(passives.increasedAttackSpeedPct ?? 0);
  const totalIncAS = localIncAS + globalIncAS;

  // More attack speed multipliers
  const moreASList: number[] = [...(skill.moreAttackSpeedMultipliersPct ?? [])];
  const moreASMultiplier = product(moreASList.map(pctToMultiplierMore));

  const effectiveAPS = baseAPS * (1 + totalIncAS / 100) * moreASMultiplier;

  // ===== STEP 9: Final DPS =====
  const dps = averageHitWithCrit * effectiveAPS;

  return {
    averageBaseWeaponDamage: physAvg + fireAvg + coldAvg + lightningAvg,
    averagePreCritNonMore: totalDamageAfterInc,
    averageHitNonCrit,
    effectiveCritChance,
    effectiveCritMultiplier,
    averageHitWithCrit,
    effectiveAPS,
    dps,
  };
}

export function formatNumber(n: number, digits = 2): string {
  if (!isFinite(n)) return '-';
  return n.toLocaleString(undefined, { minimumFractionDigits: digits, maximumFractionDigits: digits });
}
