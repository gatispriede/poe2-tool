import { calculateDamage } from '../formulas';
import { CalculationInput } from '../model';

test('happy path basic sword preset', () => {
  const input: CalculationInput = {
    weapon: { name: 'Bronze Sword', baseMin: 5, baseMax: 12, baseAPS: 1.4 },
    skill: { name: 'Cleave', moreDamageMultipliersPct: [20], moreAttackSpeedMultipliersPct: [] },
    passives: { baseCritChancePct: 5, baseCritMultiplierPct: 150 },
  };
  const out = calculateDamage(input);
  expect(out.averageBaseWeaponDamage).toBeCloseTo((5 + 12) / 2, 5);
  expect(out.effectiveCritChance).toBeCloseTo(0.05, 5);
  expect(out.dps).toBeGreaterThan(0);
});

test('zero stats should not produce NaN and crit chance clamp', () => {
  const input: CalculationInput = {
    weapon: { name: 'Stick', baseMin: 0, baseMax: 0, baseAPS: 1 },
    skill: { name: 'Default', moreDamageMultipliersPct: [], moreAttackSpeedMultipliersPct: [] },
    passives: { baseCritChancePct: 0, baseCritMultiplierPct: 150 },
  };
  const out = calculateDamage(input);
  expect(out.averageBaseWeaponDamage).toBe(0);
  expect(out.averageHitWithCrit).toBe(0);
  expect(out.effectiveCritChance).toBe(0);
  expect(out.dps).toBe(0);
});

test('crit scaling increases average hit correctly', () => {
  const base: CalculationInput = {
    weapon: { name: 'Dagger', baseMin: 10, baseMax: 10, baseAPS: 1 },
    skill: { name: 'Strike', moreDamageMultipliersPct: [], moreAttackSpeedMultipliersPct: [] },
    passives: { baseCritChancePct: 5, baseCritMultiplierPct: 150 },
  };
  const highCrit: CalculationInput = {
    weapon: base.weapon,
    skill: base.skill,
    passives: { baseCritChancePct: 5, increasedCritChancePct: 200, baseCritMultiplierPct: 150, increasedCritMultiplierPct: 50 },
  };
  const outBase = calculateDamage(base);
  const outHigh = calculateDamage(highCrit);
  expect(outHigh.averageHitWithCrit).toBeGreaterThan(outBase.averageHitWithCrit);
});

