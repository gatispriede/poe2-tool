// Runs the marginal-value analyzer against the real Ice Shot calibration
// fixtures and PRINTS the per-lever ΔDPS + the balance verdict. This is the
// "which modifier next" readout that drives gear/tree choices.

import fs from 'fs';
import path from 'path';
import { analyzeSensitivity } from '../sensitivity';
import { ParsedBuild } from '../../validation/types';

function loadCalib(name: string): ParsedBuild {
  const p = path.resolve(__dirname, '../../data/baseline-builds/calibration', `${name}.json`);
  return JSON.parse(fs.readFileSync(p, 'utf8')) as ParsedBuild;
}

function groupOf(build: ParsedBuild, skillId: string): number {
  return build.skillGroups.findIndex((g) => g.gems.some((x) => x.skillId === skillId));
}

describe('sensitivity (marginal value of each modifier)', () => {
  for (const fixture of ['DLtydZs_Mos6', '4ZLffDTQxYAj']) {
    it(`${fixture}: ranks levers + prints balance verdict`, () => {
      const build = loadCalib(fixture);
      const skillId = 'IceShotPlayer';
      const gi = groupOf(build, skillId);
      expect(gi).toBeGreaterThanOrEqual(0);

      const res = analyzeSensitivity({ build, skillGroupIndex: gi, skillId, targetTier: 'boss' });

      // eslint-disable-next-line no-console
      console.log(`\n=== ${fixture} — Ice Shot @ boss ===`);
      // eslint-disable-next-line no-console
      console.log(`baseline DPS: ${res.baselineDps.toFixed(0)}`);
      // eslint-disable-next-line no-console
      console.log('lever ranking (one realistic modifier each):');
      for (const l of res.levers) {
        // eslint-disable-next-line no-console
        console.log(
          `  ${l.label.padEnd(24)} +${l.step}${l.stepUnit.padEnd(7)} → ` +
          `+${l.deltaPerStep.toFixed(0).padStart(8)} DPS  (+${(l.deltaPctPerStep * 100).toFixed(2)}%)`
        );
      }
      // eslint-disable-next-line no-console
      console.log('verdict:');
      for (const v of res.verdict) console.log('  • ' + v);

      expect(res.baselineDps).toBeGreaterThan(0);
      expect(res.levers.length).toBe(7);
    });
  }
});
