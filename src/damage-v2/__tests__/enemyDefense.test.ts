// Verifies the enemy resistance + penetration layer on a real Ice Shot
// (cold) build: DPS drops vs a resisted boss, penetration recovers it, and
// resistance inversion (Monk-style) amplifies it. Demonstrates the player's
// point that a smaller hit with penetration can out-land a bigger raw hit.

import fs from 'fs';
import path from 'path';
import { composeDamage } from '../composeDamage';
import { ParsedBuild } from '../../validation/types';

function loadCalib(name: string): ParsedBuild {
  const p = path.resolve(__dirname, '../../data/baseline-builds/calibration', `${name}.json`);
  return JSON.parse(fs.readFileSync(p, 'utf8')) as ParsedBuild;
}

describe('enemy resistance + penetration', () => {
  const build = loadCalib('DLtydZs_Mos6');
  const skillId = 'IceShotPlayer';
  const gi = build.skillGroups.findIndex((g) => g.gems.some((x) => x.skillId === skillId));
  const base = { build, skillGroupIndex: gi, skillId } as const;

  it('cold hit: raw (PoB-comparable) > boss > pinnacle; pen and inversion recover', () => {
    const white = composeDamage({ ...base, targetTier: 'white' });
    const boss = composeDamage({ ...base, targetTier: 'boss' });
    const pinnacle = composeDamage({ ...base, targetTier: 'pinnacle' });
    const pinnaclePen = composeDamage({ ...base, targetTier: 'pinnacle', enemyProfile: { cold: 75 }, perturb: { penetrationElementalPct: 50 } });
    const pinnacleInverted = composeDamage({ ...base, targetTier: 'pinnacle', resistanceInverted: true });

    // eslint-disable-next-line no-console
    console.log('\n=== DLtydZs_Mos6 Ice Shot (cold) — resistance layer ===');
    const row = (label: string, o: any) =>
      // eslint-disable-next-line no-console
      console.log(
        `  ${label.padEnd(22)} dps=${o.dps.toFixed(0).padStart(9)}  raw=${o.rawDps.toFixed(0).padStart(9)}  ` +
        `effRes=${o.enemy.effectiveResPct.toFixed(0).padStart(4)}%  ×${o.enemy.effectivenessMul.toFixed(2)}  [${o.enemy.dominantType}]`
      );
    row('white (0% res)', white);
    row('boss (40% res)', boss);
    row('pinnacle (50% res)', pinnacle);
    row('pinnacle(75)+50% pen', pinnaclePen);
    row('pinnacle INVERTED', pinnacleInverted);

    expect(white.enemy.dominantType).toBe('cold');
    // Effectiveness multiplier falls as resistance rises.
    expect(white.enemy.effectivenessMul).toBeCloseTo(1.0, 2);
    expect(boss.enemy.effectivenessMul).toBeLessThan(white.enemy.effectivenessMul);
    expect(pinnacle.enemy.effectivenessMul).toBeLessThan(boss.enemy.effectivenessMul);
    // Boss/pinnacle drop the freeze multiplier (can't freeze), so their RAW is
    // at or below white's raw — resistance is an ADDITIONAL cut on top.
    expect(boss.rawDps).toBeLessThanOrEqual(white.rawDps + 1);
    // More resistance → less landed (after the same no-freeze raw).
    expect(pinnacle.dps).toBeLessThan(boss.dps);
    // Penetration recovers damage vs the same pinnacle res.
    expect(pinnaclePen.dps).toBeGreaterThan(pinnacle.dps);
    // Inversion (+75 → -75) amplifies beyond the raw hit.
    expect(pinnacleInverted.dps).toBeGreaterThan(white.dps);
  });
});
