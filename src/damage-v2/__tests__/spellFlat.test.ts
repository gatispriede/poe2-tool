import { aggregateFromLines } from '../aggregateMods';
describe('ring flat-to-spells', () => {
  it('physical spell counts "Physical Damage to Spells", ignores Fire', () => {
    const m = aggregateFromLines(
      ['Adds 10 to 20 Physical Damage to Spells', 'Adds 5 to 9 Fire Damage to Spells'],
      { skillTypes: ['Spell', 'Physical', 'Nova'] },
    );
    expect(m.addedFlatToSpellsAvg).toBe(15); // (10+20)/2 physical only; fire excluded
  });
  it('attack flat does not leak to spell bucket', () => {
    const m = aggregateFromLines(['Adds 10 to 20 Physical Damage to Attacks'], { skillTypes: ['Spell','Physical'] });
    expect(m.addedFlatToSpellsAvg).toBe(0);
  });
});
