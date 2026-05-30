import { parsePassiveNodes } from '../parser';

test('parses physical and attack speed stats', () => {
  const raw = [
    { id: 'a', name: 'Test Small', stats: ['10% increased Physical Damage', '5% increased Attack Speed'] },
    { id: 'b', name: 'Test Notable', stats: ['25% increased Physical Damage', '+15% to Critical Strike Multiplier'] },
  ];
  const nodes = parsePassiveNodes(raw as any);
  const phys = nodes.find(n => n.id === 'a');
  expect(phys?.stats.increasedPhysicalDamagePct).toBe(10);
  expect(phys?.stats.increasedAttackSpeedPct).toBe(5);
  const notable = nodes.find(n => n.id === 'b');
  expect(notable?.type).toBe('notable');
  expect(notable?.stats.increasedCritMultiplierPct).toBe(15);
});

test('infers small node when stats below notable thresholds', () => {
  const raw = [{ id: 'c', name: 'Minor Node', stats: ['4% increased Attack Speed'] }];
  const [node] = parsePassiveNodes(raw as any);
  expect(node.type).toBe('small');
});

