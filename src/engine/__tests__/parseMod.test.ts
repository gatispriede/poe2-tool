import { bucketOf, effectUptime, parseModLine } from '../parseMod';

const one = (line: string) => parseModLine(line)[0];

describe('mod line grammar', () => {
  it('reads increased and reduced as one signed additive bucket', () => {
    expect(one('12% increased Attack Damage')).toMatchObject({ form: 'increased', value: 12, stat: 'damage', requires: ['attack'] });
    expect(one('10% reduced Skill Speed')).toMatchObject({ form: 'increased', value: -10, stat: 'skillSpeed' });
  });

  it('keeps more/less on their own multiplicative form', () => {
    expect(one('15% more Damage')).toMatchObject({ form: 'more', value: 15 });
    expect(one('20% less Damage')).toMatchObject({ form: 'more', value: -20 });
  });

  it('averages the ranges PoB stores on uniques and strips tag markup', () => {
    expect(one('{tags:defences}(25-50)% increased Armour')).toMatchObject({ value: 37.5, stat: 'armour' });
  });

  it('finds the stat when the magnitude sits mid-line', () => {
    expect(one('Minions deal 20% increased Damage')).toMatchObject({ stat: 'damage', target: 'minion', requires: ['minion'] });
  });

  it('separates qualifiers from the stat noun', () => {
    expect(one('25% increased Area of Effect for Attacks')).toMatchObject({ stat: 'areaOfEffect' });
    expect(one('25% increased Area of Effect for Attacks').requires).toEqual(expect.arrayContaining(['attack', 'area']));
    expect(one('18% increased Critical Hit Chance for Spells')).toMatchObject({ stat: 'critChance', requires: ['spell'] });
  });

  it('pulls damage types out of the stat phrase itself', () => {
    expect(one('Adds 5 to 12 Fire Damage to Attacks')).toMatchObject({ form: 'added', value: 5, valueMax: 12, damageTypes: ['fire'] });
    expect(one('25% increased Freeze Buildup').damageTypes).toEqual(['cold']);
    expect(one('15% increased chance to Shock').damageTypes).toEqual(['lightning']);
  });

  it('reads conversion and gain-as with both ends of the transfer', () => {
    expect(one('40% of Physical Damage Converted to Fire Damage')).toMatchObject({ form: 'conversion', from: 'physical', to: 'fire' });
    expect(one('Gain 20% of Physical Damage as Extra Cold Damage')).toMatchObject({ form: 'gainAs', to: 'cold' });
  });

  it('promotes weapon clauses to hard requirements and states to uptime', () => {
    expect(one('20% increased Damage with Bows').requires).toContain('bow');
    expect(effectUptime(one('20% increased Damage with Bows'))).toBe(1);
    expect(effectUptime(one('15% more Damage while Channelling'))).toBeLessThan(1);
  });

  it('separates enemy-facing ailment duration from ailments on you', () => {
    expect(bucketOf(one('20% increased Shock Duration'))).toBe('damage');
    expect(bucketOf(one('20% reduced Shock duration on you'))).toBe('utility');
  });

  it('files stats into the bucket the platform reports them under', () => {
    expect(bucketOf(one('10% increased Cast Speed'))).toBe('speed');
    expect(bucketOf(one('8% increased Area of Effect'))).toBe('aoe');
    expect(bucketOf(one('Damage Penetrates 12% Lightning Resistance'))).toBe('damage');
    expect(bucketOf(one('+30 to maximum Life'))).toBe('utility');
  });

  it('keeps a low confidence rather than inventing a stat it did not find', () => {
    expect(one('Remnants can be collected from 20% further away').parseConfidence).toBeLessThan(0.6);
  });
});
