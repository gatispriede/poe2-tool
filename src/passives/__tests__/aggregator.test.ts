import { aggregatePassiveStats } from '../aggregator';
import { PASSIVE_NODES } from '../passivesData';

test('aggregates selected passive node stats correctly', () => {
  const ids = PASSIVE_NODES.slice(0,3).map(n => n.id); // first three nodes
  const agg = aggregatePassiveStats(ids);
  expect(agg.increasedPhysicalDamagePct).toBe(22); // 10 + 12
  expect(agg.increasedAttackSpeedPct).toBe(5); // +5 from s_as_1
});

test('empty selection returns empty object', () => {
  const agg = aggregatePassiveStats([]);
  expect(Object.keys(agg).length).toBe(0);
});

test('aggregated stats influence damage calculation when merged', () => {
  // baseline without nodes
  // Here we indirectly test by importing formulas
  const { calculateDamage } = require('../../damage/formulas');
  const baseInput = {
    weapon: { name: 'Test Weapon', baseMin: 10, baseMax: 20, baseAPS: 1.5 },
    skill: { name: 'Test Skill', moreDamageMultipliersPct: [], moreAttackSpeedMultipliersPct: [] },
    passives: {},
  };
  const base = calculateDamage(baseInput);
  const withPassives = calculateDamage({ ...baseInput, passives: aggregatePassiveStats(['s_phys_1','s_as_1']) });
  expect(withPassives.averageHitNonCrit).toBeGreaterThan(base.averageHitNonCrit);
  expect(withPassives.effectiveAPS).toBeGreaterThan(base.effectiveAPS);
});

