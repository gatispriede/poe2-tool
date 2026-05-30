// Bone Cage build exploration. High-base physical Nova spell (6066-9099 base
// phys @ gem 40). Compose it on a real Witch caster chassis to see what its
// damage looks like, and how Spell Cascade (it's Cascadable) scales it.

import fs from 'fs';
import path from 'path';
import { composeDamage } from '../composeDamage';
import { ParsedBuild } from '../../validation/types';

function loadCalib(name: string): ParsedBuild {
  const p = path.resolve(__dirname, '../../data/baseline-builds/calibration', `${name}.json`);
  return JSON.parse(fs.readFileSync(p, 'utf8')) as ParsedBuild;
}

describe('Bone Cage build', () => {
  it('composes Bone Cage on a Witch caster chassis across tiers', () => {
    // Use the Blood Mage / Spark chassis (Witch, wand stat-stick) and swap the
    // active skill in its group to Bone Cage.
    const build = loadCalib('VzBZLqX4dVTy');
    const sparkGi = build.skillGroups.findIndex((g) => g.gems.some((x) => x.skillId === 'SparkPlayer'));
    const swapped: ParsedBuild = JSON.parse(JSON.stringify(build));
    const gem = swapped.skillGroups[sparkGi].gems.find((x) => x.skillId === 'SparkPlayer');
    if (gem) { gem.skillId = 'BoneCagePlayer'; gem.nameSpec = 'Bone Cage'; }

    // eslint-disable-next-line no-console
    console.log('\n=== Bone Cage (physical Nova spell) on Witch chassis ===');
    for (const tier of ['white', 'boss', 'pinnacle'] as const) {
      const out = composeDamage({ build: swapped, skillGroupIndex: sparkGi, skillId: 'BoneCagePlayer', targetTier: tier });
      // eslint-disable-next-line no-console
      console.log(
        `  ${tier.padEnd(8)} ${(out.dps / 1000).toFixed(0)}k  ` +
        `perHit=${(out.perHit / 1000).toFixed(0)}k casts/s=${out.hitsPerSecond.toFixed(2)} ` +
        `critX=${out.expectedCritMultiplier.toFixed(2)} eff×${out.enemy.effectivenessMul.toFixed(2)} (${out.enemy.dominantType})`
      );
    }
    const boss = composeDamage({ build: swapped, skillGroupIndex: sparkGi, skillId: 'BoneCagePlayer', targetTier: 'boss' });
    // eslint-disable-next-line no-console
    console.log(`  scaling: +${boss.global.increasedDamagePct.toFixed(0)}% inc  ×${boss.global.moreDamageFactor.toFixed(2)} more`);

    // Add Cut to the Bone (armour break on spell crit) via a tree node line
    // injected onto a jewel-style item, and re-measure boss/pinnacle.
    const withBreak: ParsedBuild = JSON.parse(JSON.stringify(swapped));
    const anyItem = withBreak.equipped['Amulet'] || withBreak.equipped['Ring 1'];
    if (anyItem) anyItem.explicits = [...anyItem.explicits, 'Break Armour on Critical Hit with Spells equal to 10% of Physical Damage dealt'];
    // eslint-disable-next-line no-console
    console.log('  --- with Cut to the Bone (armour break) ---');
    for (const tier of ['boss', 'pinnacle'] as const) {
      const out = composeDamage({ build: withBreak, skillGroupIndex: sparkGi, skillId: 'BoneCagePlayer', targetTier: tier });
      // eslint-disable-next-line no-console
      console.log(`  ${tier.padEnd(8)} ${(out.dps / 1000).toFixed(0)}k  eff×${out.enemy.effectivenessMul.toFixed(2)}`);
    }
    expect(boss.dps).toBeGreaterThan(0);
  });
});
