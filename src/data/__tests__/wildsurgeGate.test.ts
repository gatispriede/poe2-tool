import { scorePassiveNode } from '../passiveTree';

const wildsurge = { id: '49363', name: 'Wildsurge Incantation', type: 'keystone', stats: ['Storm and Plant Spells:', 'deal 50% more damage', 'cost 50% less', 'have 75% less duration'] } as never;
const realSpellNode = { id: '1', name: 'Potent Incantation', type: 'notable', stats: ['30% increased Spell Damage'] } as never;
const physSpellNode = { id: '2', name: 'X', type: 'notable', stats: ['Physical Spells: 20% increased Physical Damage'] } as never;

describe('conditional-header gate (Wildsurge bug)', () => {
  it('Wildsurge scores 0 for a physical spell (Storm/Plant gate)', () => {
    expect(scorePassiveNode(wildsurge, 'physical', 'spell')).toBe(0);
  });
  it('a real spell-damage node still scores', () => {
    expect(scorePassiveNode(realSpellNode, 'physical', 'spell')).toBeGreaterThan(0);
  });
  it('a "Physical Spells:" gated node DOES apply to a physical spell', () => {
    expect(scorePassiveNode(physSpellNode, 'physical', 'spell')).toBeGreaterThan(0);
  });
});
