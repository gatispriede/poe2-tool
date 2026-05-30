import { parseEffectText, aggregateTablePassiveRows } from '../effectParser';
import { TABLE_PASSIVES } from '../../data/DataTableData';

test('parseEffectText extracts increased and more modifiers', () => {
  const parsed = parseEffectText('40% more Damage; 15% increased Melee Damage with Hits at Close Range; 12% increased Attack Speed');
  expect(parsed.moreDamage).toContain(40);
  expect(parsed.stats.increasedPhysicalDamagePct).toBe(15); // treat melee as physical for now
  expect(parsed.stats.increasedAttackSpeedPct).toBe(12);
});

test('aggregateTablePassiveRows aggregates stats', () => {
  const ids = ['in-your-face','attack-speed-if-hit'];
  const agg = aggregateTablePassiveRows(TABLE_PASSIVES as any, ids);
  expect(agg.stats.increasedPhysicalDamagePct).toBeGreaterThan(0);
  expect(agg.stats.increasedAttackSpeedPct).toBeGreaterThan(0);
});

