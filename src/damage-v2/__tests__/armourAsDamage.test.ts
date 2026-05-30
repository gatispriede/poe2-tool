// Verifies the v18 "armour as damage" model: armour pool → flat hit damage,
// with the chaos portion (Smith of Kitava) bypassing boss resistance.

import fs from 'fs';
import path from 'path';
import { composeDamage } from '../composeDamage';
import { aggregateFromLines } from '../aggregateMods';
import { computeArmour } from '../maxArmour';
import { ParsedBuild } from '../../validation/types';

function loadCalib(name: string): ParsedBuild {
  const p = path.resolve(__dirname, '../../data/baseline-builds/calibration', `${name}.json`);
  return JSON.parse(fs.readFileSync(p, 'utf8')) as ParsedBuild;
}

describe('armour as damage (v18)', () => {
  it('parse: "% of Armour also applies to <type> Damage" by destination', () => {
    const mods = aggregateFromLines(
      [
        '+100% of Armour also applies to Lightning Damage', // Doryani's
        '+100% of Armour also applies to Chaos Damage',     // Smith: Dedication to Kitava
        '+30% of Armour also applies to Elemental Damage',  // Prism Guard
      ],
      { skillTypes: ['Attack', 'Physical'] },
    );
    expect(mods.armourAppliesPct.lightning).toBe(100);
    expect(mods.armourAppliesPct.chaos).toBe(100);
    expect(mods.armourAppliesPct.elemental).toBe(30);
  });

  it('armour pool → flat damage; chaos portion is unresisted on a pinnacle', () => {
    // Use a real build as chassis, inject heavy armour + armour→chaos, and an
    // attack skill. Compare boss DPS with vs without the armour→damage mods.
    const base = loadCalib('DLtydZs_Mos6');
    const skillId = 'IceShotPlayer';
    const gi = base.skillGroups.findIndex((g) => g.gems.some((x) => x.skillId === skillId));

    const armoured: ParsedBuild = JSON.parse(JSON.stringify(base));
    const body = armoured.equipped['Body Armour'];
    if (body) {
      // Big flat armour + the Smith armour→chaos mechanic on the body.
      body.explicits = [
        ...body.explicits,
        '+8000 to Armour',
        '+100% of Armour also applies to Chaos Damage',
      ];
    }

    const armour = computeArmour(armoured).total;
    const before = composeDamage({ build: base, skillGroupIndex: gi, skillId, targetTier: 'pinnacle' });
    const after = composeDamage({ build: armoured, skillGroupIndex: gi, skillId, targetTier: 'pinnacle' });

    // eslint-disable-next-line no-console
    console.log(`\n=== armour as damage (pinnacle) ===`);
    // eslint-disable-next-line no-console
    console.log(`  total armour: ${armour.toFixed(0)}`);
    // eslint-disable-next-line no-console
    console.log(`  no armour→dmg : ${(before.dps / 1000).toFixed(0)}k`);
    // eslint-disable-next-line no-console
    console.log(`  +armour→chaos : ${(after.dps / 1000).toFixed(0)}k  (eff ×${after.enemy.effectivenessMul.toFixed(2)})`);

    expect(armour).toBeGreaterThan(8000);
    expect(after.dps).toBeGreaterThan(before.dps); // armour adds real damage
    // The added chaos is unresisted → effectiveness blends above the cold ×0.5.
    expect(after.enemy.effectivenessMul).toBeGreaterThan(before.enemy.effectivenessMul);
  });
});
