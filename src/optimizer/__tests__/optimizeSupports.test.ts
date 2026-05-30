// Runs the support-gem optimizer against zeolet's Ice Shot setup and
// prints the top suggested swaps. This is a discovery test, not a
// regression test — there's no fixed "correct" output. It exists to:
//   (a) prove the optimizer runs end-to-end against real data
//   (b) surface the candidate swaps so we can sanity-check whether the
//       ranking is plausible (top suggestions should be supports
//       commonly used in real bow builds)

import fs from 'fs';
import path from 'path';
import { optimizeSupports } from '../optimizeSupports';
import { ParsedBuild } from '../../validation/types';

function load(name: string) {
  const p = path.resolve(__dirname, '../../../docs/baseline-builds/raw', `${name}-build.json`);
  return JSON.parse(fs.readFileSync(p, 'utf8')) as ParsedBuild;
}

describe('optimizeSupports v1', () => {
  it('zeolet Ice Shot: ranks support swaps', () => {
    const build = load('zeolet');
    const skillId = 'IceShotPlayer';
    const groupIndex = build.skillGroups.findIndex(g =>
      g.gems.some(x => x.skillId === skillId)
    );
    expect(groupIndex).toBeGreaterThanOrEqual(0);

    const t0 = Date.now();
    const res = optimizeSupports(build, groupIndex, skillId, {
      topK: 8,
      minDeltaPct: 0.5,
    });
    const elapsed = Date.now() - t0;

    /* eslint-disable no-console */
    console.log(`zeolet Ice Shot support optimization (${elapsed}ms, ${res.evaluated} candidates evaluated, ${res.rejected} family-clashed):`);
    console.log(`  baseline DPS: ${res.baseline.toFixed(0)}`);
    console.log(`  top improvements:`);
    for (const s of res.topImprovements) {
      const warn = s.warning ? `  ⚠ ${s.warning}` : '';
      console.log(`    slot ${s.slotIndex}: remove "${s.removed.name}" → "${s.added.name}"  ` +
        `Δ +${(s.delta).toFixed(0)}  (+${s.deltaPct.toFixed(1)}%)${warn}`);
    }
    console.log(`  top regressions (sanity check — these should look "bad"):`);
    for (const s of res.topRegressions) {
      console.log(`    slot ${s.slotIndex}: remove "${s.removed.name}" → "${s.added.name}"  ` +
        `Δ ${(s.delta).toFixed(0)}  (${s.deltaPct.toFixed(1)}%)`);
    }
    /* eslint-enable no-console */

    expect(res.baseline).toBeGreaterThan(0);
    expect(res.evaluated).toBeGreaterThan(0);
  });
});
