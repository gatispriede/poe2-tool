// Verifies ascendancy node stats are credited end-to-end: allocating Smith of
// Kitava's "Dedication to Kitava" (node 64962, "Body Armour grants +100% of
// Armour also applies to Chaos Damage") into a build's tree spec should feed
// the armour→chaos mechanic, exactly as if the mod were on gear. This confirms
// the composer already "wires" ascendancy effects (they flow through
// aggregateTreeMods like any tree node) — the remaining work is generator
// ALLOCATION of the right ascendancy nodes, not composer plumbing.

import fs from 'fs';
import path from 'path';
import { aggregateTreeMods } from '../aggregateMods';
import { ParsedBuild } from '../../validation/types';

function loadCalib(name: string): ParsedBuild {
  const p = path.resolve(__dirname, '../../data/baseline-builds/calibration', `${name}.json`);
  return JSON.parse(fs.readFileSync(p, 'utf8')) as ParsedBuild;
}

const SMITH_DEDICATION = 64962; // Body Armour grants +100% of Armour applies to Chaos
const SMITH_FLOWING_METAL = 13772; // +50% of Armour applies to Elemental

describe('ascendancy node effects are credited (composer side of #16)', () => {
  it('Smith of Kitava armour→chaos/elemental nodes feed armourAppliesPct', () => {
    const build = loadCalib('DLtydZs_Mos6');
    // Inject the two Smith nodes into the tree spec.
    const withSmith: ParsedBuild = JSON.parse(JSON.stringify(build));
    withSmith.trees[0].nodes = [...withSmith.trees[0].nodes, SMITH_DEDICATION, SMITH_FLOWING_METAL];

    const before = aggregateTreeMods(build, { skillTypes: ['Attack', 'Cold'] });
    const after = aggregateTreeMods(withSmith, { skillTypes: ['Attack', 'Cold'] });

    // eslint-disable-next-line no-console
    console.log(
      `\n=== ascendancy crediting ===\n` +
      `  before: chaos=${before.armourAppliesPct.chaos}% elemental=${before.armourAppliesPct.elemental}%\n` +
      `  after : chaos=${after.armourAppliesPct.chaos}% elemental=${after.armourAppliesPct.elemental}%`
    );

    expect(after.armourAppliesPct.chaos).toBe(100);      // Dedication to Kitava
    expect(after.armourAppliesPct.elemental).toBe(50);   // Flowing Metal
    expect(before.armourAppliesPct.chaos).toBe(0);       // not allocated → not credited
  });
});
