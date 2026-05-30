// Runs composeDamage v1 against zeolet's Ice Shot and PRINTS the result.
// We do not yet assert a target DPS — v1 deliberately omits most inputs;
// the test exists to (a) prove the pipeline runs end-to-end and (b) make
// the v1-vs-real gap explicit and trackable.

import fs from 'fs';
import path from 'path';
import { composeDamage } from '../composeDamage';
import { ParsedBuild } from '../../validation/types';

function load(name: string) {
  const p = path.resolve(__dirname, '../../../docs/baseline-builds/raw', `${name}-build.json`);
  return JSON.parse(fs.readFileSync(p, 'utf8')) as ParsedBuild;
}

describe('composeDamage v1', () => {
  it('zeolet Ice Shot: produces a number; logs gap to reported 17M', () => {
    const build = load('zeolet');
    // Locate the Ice Shot socket group (it's the one with IceShotPlayer as
    // the active skill).
    const skillId = 'IceShotPlayer';
    const groupIndex = build.skillGroups.findIndex(g =>
      g.gems.some(x => x.skillId === skillId)
    );
    expect(groupIndex).toBeGreaterThanOrEqual(0);

    const out = composeDamage({ build, skillGroupIndex: groupIndex, skillId });

    const reportedDPS = 17_000_000;
    const ratio = reportedDPS / out.dps;

    // eslint-disable-next-line no-console
    console.log('zeolet Ice Shot v1 breakdown:');
    // eslint-disable-next-line no-console
    console.log('  weapon          :', out.weapon);
    // eslint-disable-next-line no-console
    console.log('  effective level :', out.effectiveGemLevel, ' (baseMultiplier', out.skill.baseMultiplier, ')');
    // eslint-disable-next-line no-console
    console.log('  weapon avg dmg  :', out.weaponAvgDamage.toFixed(1));
    // eslint-disable-next-line no-console
    console.log('  global mods     :', {
      'addedFlat': out.global.addedFlatToAttacksAvg.toFixed(0),
      'extraDmg%': out.global.extraDamagePct.toFixed(0) + '%',
      'incDmg%':   out.global.increasedDamagePct.toFixed(0) + '%',
      'moreDmg×':  out.global.moreDamageFactor.toFixed(3),
      'incASpd%':  out.global.increasedAttackSpeedPct.toFixed(0) + '%',
      'incCrit%':  out.global.increasedCritChancePct.toFixed(0) + '%',
      'critMul+':  out.global.addedCritMultiplierPct.toFixed(0) + '%',
    });
    // eslint-disable-next-line no-console
    console.log('  per hit         :', out.perHit.toFixed(1));
    // eslint-disable-next-line no-console
    console.log('  hits/sec        :', out.hitsPerSecond.toFixed(3));
    // eslint-disable-next-line no-console
    console.log('  crit multiplier :', out.expectedCritMultiplier.toFixed(3));
    // eslint-disable-next-line no-console
    console.log('  v2 DPS          :', out.dps.toFixed(0));
    // eslint-disable-next-line no-console
    console.log('  reported DPS    :', reportedDPS);
    // eslint-disable-next-line no-console
    console.log('  gap (x)         :', ratio.toFixed(1));
    // eslint-disable-next-line no-console
    console.log('  notes           :', out.notes);

    // Sanity: at least non-zero. The full assertion comes when iterations
    // add the missing layers.
    expect(out.dps).toBeGreaterThan(0);
  });
});
