// Verifies the spell path: a caster weapon (wand, weapon:null) no longer
// throws, the spell base damage comes from the gem, and the weapon's
// stat-stick mods (+spell levels, cast speed, spell crit, gain-as-extra)
// flow in globally. Real fixture: VzBZLqX4dVTy (Blood Mage / Spark) — PoB
// Total DPS ~494k.

import fs from 'fs';
import path from 'path';
import { composeDamage } from '../composeDamage';
import { ParsedBuild } from '../../validation/types';

function loadCalib(name: string): ParsedBuild {
  const p = path.resolve(__dirname, '../../data/baseline-builds/calibration', `${name}.json`);
  return JSON.parse(fs.readFileSync(p, 'utf8')) as ParsedBuild;
}

describe('spell path (caster weapon stat-stick)', () => {
  it('VzBZLqX4dVTy Spark: computes a number off a wand (weapon:null)', () => {
    const build = loadCalib('VzBZLqX4dVTy');
    const skillId = 'SparkPlayer';
    const gi = build.skillGroups.findIndex((g) => g.gems.some((x) => x.skillId === skillId));
    expect(gi).toBeGreaterThanOrEqual(0);

    const out = composeDamage({ build, skillGroupIndex: gi, skillId, targetTier: 'boss' });

    // eslint-disable-next-line no-console
    console.log('\n=== VzBZLqX4dVTy — Spark @ boss (PoB ~494k) ===');
    // eslint-disable-next-line no-console
    console.log('  weapon         :', out.weapon.name, '(', out.weapon.base, ')');
    // eslint-disable-next-line no-console
    console.log('  eff gem level  :', out.effectiveGemLevel, ' baseMult', out.skill.baseMultiplier);
    // eslint-disable-next-line no-console
    console.log('  global mods    :', {
      incDmg: out.global.increasedDamagePct.toFixed(0) + '%',
      more: out.global.moreDamageFactor.toFixed(3) + '×',
      extra: out.global.extraDamagePct.toFixed(0) + '%',
      incCastSpd: out.global.increasedAttackSpeedPct.toFixed(0) + '%',
      incCrit: out.global.increasedCritChancePct.toFixed(0) + '%',
      critMul: out.global.addedCritMultiplierPct.toFixed(0) + '%',
    });
    // eslint-disable-next-line no-console
    console.log('  per hit        :', out.perHit.toFixed(1));
    // eslint-disable-next-line no-console
    console.log('  casts/sec      :', out.hitsPerSecond.toFixed(3));
    // eslint-disable-next-line no-console
    console.log('  crit mult      :', out.expectedCritMultiplier.toFixed(3));
    // eslint-disable-next-line no-console
    console.log('  DPS            :', out.dps.toFixed(0));

    expect(out.dps).toBeGreaterThan(0);
    expect(Number.isFinite(out.dps)).toBe(true);
  });
});
