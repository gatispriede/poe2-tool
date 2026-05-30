// Verifies the chaos-conversion resistance bypass (#37, discovered mechanic):
// converting an elemental hit to chaos sidesteps the boss elemental resistance.
// Unit-level via damageEffectiveness + a build-level check that a Voltaxic-style
// "100% of Lightning Damage Converted to Chaos Damage" mod is parsed and lifts
// boss DPS.

import fs from 'fs';
import path from 'path';
import { damageEffectiveness, ENEMY_PROFILES, emptyPenetration } from '../enemyDefense';
import { aggregateFromLines } from '../aggregateMods';

describe('chaos-conversion resistance bypass', () => {
  it('unit: lightning hit vs pinnacle improves as conversion-to-chaos rises', () => {
    const pinnacle = ENEMY_PROFILES.pinnacle; // 50% elemental, 0% chaos
    const lightningSkill = ['Spell', 'Lightning'];
    const e0 = damageEffectiveness(lightningSkill, pinnacle, emptyPenetration(), false, 0);
    const e50 = damageEffectiveness(lightningSkill, pinnacle, emptyPenetration(), false, 50);
    const e100 = damageEffectiveness(lightningSkill, pinnacle, emptyPenetration(), false, 100);

    // eslint-disable-next-line no-console
    console.log(`\n=== chaos bypass (lightning vs 50%-res pinnacle) ===`);
    // eslint-disable-next-line no-console
    console.log(`  0%   conv → ×${e0.multiplier.toFixed(2)}  (${e0.note})`);
    // eslint-disable-next-line no-console
    console.log(`  50%  conv → ×${e50.multiplier.toFixed(2)}`);
    // eslint-disable-next-line no-console
    console.log(`  100% conv → ×${e100.multiplier.toFixed(2)}`);

    expect(e0.multiplier).toBeCloseTo(0.5, 2);   // 50% lightning res
    expect(e100.multiplier).toBeCloseTo(1.0, 2); // fully chaos → no res
    expect(e50.multiplier).toBeGreaterThan(e0.multiplier);
    expect(e50.multiplier).toBeLessThan(e100.multiplier);
  });

  it('parse: Voltaxic-style conversion line is aggregated to 100%', () => {
    const mods = aggregateFromLines(
      ['100% of Lightning Damage Converted to Chaos Damage'],
      { skillTypes: ['Spell', 'Lightning'] },
    );
    expect(mods.convertedToChaosPct).toBe(100);
  });

  it('parse: Blackflame-style "Convert X% of Fire Damage to Chaos" aggregated', () => {
    const mods = aggregateFromLines(
      ['Fire Spells Convert 100% of Fire Damage to Chaos Damage'],
      { skillTypes: ['Spell', 'Fire'] },
    );
    expect(mods.convertedToChaosPct).toBe(100);
  });
});
