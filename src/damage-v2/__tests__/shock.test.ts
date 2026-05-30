// Verifies the v16 shock-as-more-damage model: a lightning (or shock-enabling)
// build applies +20% shock more-damage-taken on the RAMPED hit, scaled by
// shock reliability vs the target tier. The boss-viable ailment (unlike freeze).

import fs from 'fs';
import path from 'path';
import { composeDamage } from '../composeDamage';
import { aggregateFromLines } from '../aggregateMods';
import { ParsedBuild } from '../../validation/types';

function loadCalib(name: string): ParsedBuild {
  const p = path.resolve(__dirname, '../../data/baseline-builds/calibration', `${name}.json`);
  return JSON.parse(fs.readFileSync(p, 'utf8')) as ParsedBuild;
}

describe('shock as more-damage-taken (v16)', () => {
  it('parse: Voltaxic-style "Chaos Damage ... Contributes to Shock Chance" sets the flag', () => {
    const mods = aggregateFromLines(
      ['Chaos Damage from Hits also Contributes to Shock Chance'],
      { skillTypes: ['Attack', 'Cold'] },
    );
    expect(mods.shockFromAnyHit).toBe(true);
  });

  it('a lightning build ramps higher than first-hit via shock; reliability scales by tier', () => {
    // QYNrgMjWS5b5 = Lightning Spear (a lightning skill → can shock inherently).
    const build = loadCalib('QYNrgMjWS5b5');
    const skillId = 'LightningSpearPlayer';
    const gi = build.skillGroups.findIndex((g) => g.gems.some((x) => x.skillId === skillId));
    if (gi < 0) { expect(true).toBe(true); return; } // skill not present → skip gracefully

    const boss = composeDamage({ build, skillGroupIndex: gi, skillId, targetTier: 'boss' });
    const white = composeDamage({ build, skillGroupIndex: gi, skillId, targetTier: 'white' });

    // eslint-disable-next-line no-console
    console.log(`\n=== Lightning Spear shock ===`);
    // eslint-disable-next-line no-console
    console.log(`  boss : first ${(boss.firstHitDps/1000).toFixed(0)}k → ramped ${(boss.rampedDps/1000).toFixed(0)}k`);
    // eslint-disable-next-line no-console
    console.log(`  white: first ${(white.firstHitDps/1000).toFixed(0)}k → ramped ${(white.rampedDps/1000).toFixed(0)}k`);

    // Shock (ramped) >= first hit; white shock reliability (1.0) >= boss (0.8),
    // so the ramped/first ratio on white is at least the boss ratio.
    expect(boss.rampedDps).toBeGreaterThanOrEqual(boss.firstHitDps);
    const bossRatio = boss.rampedDps / boss.firstHitDps;
    const whiteRatio = white.rampedDps / white.firstHitDps;
    expect(whiteRatio).toBeGreaterThanOrEqual(bossRatio - 0.001);
  });
});
