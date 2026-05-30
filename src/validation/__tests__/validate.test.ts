// Validates the three baseline builds (RsFearless, Gaobin, zeolet) against
// the 5-layer validity model. These fixtures are top-tier poe.ninja builds
// — if any of them fails validation, EITHER our data is wrong OR our
// validator is too strict. Either way, fix it.

import path from 'path';
import fs from 'fs';
import { validateBuild } from '../validate';
import { ParsedBuild, ValidationError } from '../types';

function loadFixture(name: string) {
  const p = path.resolve(__dirname, '../../../docs/baseline-builds/raw', `${name}-build.json`);
  return JSON.parse(fs.readFileSync(p, 'utf8')) as ParsedBuild;
}

function summarise(errs: ValidationError[]) {
  const out: Record<string, number> = {};
  for (const e of errs) {
    const key = `L${e.layer}:${e.kind}`;
    out[key] = (out[key] || 0) + 1;
  }
  return out;
}

const FIXTURES = ['zeolet', 'gaobin', 'rsfearless'] as const;

describe('validateBuild against baseline fixtures', () => {
  for (const name of FIXTURES) {
    describe(name, () => {
      const build = loadFixture(name);
      const result = validateBuild(build);

      it('reports an error breakdown (informational)', () => {
        // Always-on informational log so test output stays useful when this
        // file is run as part of a wider suite.
        // eslint-disable-next-line no-console
        console.log(`[${name}] error summary:`, summarise(result.errors));
      });

      it('has no unknown skill IDs (placeholders are OK)', () => {
        // Placeholder gems (level=0, no skillId) are PoB-export quirks, not
        // a validator failure. A genuine unknown skillId means our skill
        // database is out of date relative to the build's PoB version.
        const real = result.errors.filter(e => e.layer === 2 && e.kind !== 'placeholder-gem');
        expect(real).toEqual([]);
      });

      it('has zero Layer-4 errors (tree allocation is fully reachable)', () => {
        const l4 = result.errors.filter(e => e.layer === 4);
        expect(l4).toEqual([]);
      });
    });
  }
});
