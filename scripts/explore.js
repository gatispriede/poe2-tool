#!/usr/bin/env node
// Cross-platform shim: sets EXPLORE=1 and forwards remaining argv to
// `react-scripts test` targeting the explorer file. Avoids a cross-env
// dependency.
//
// Pre-existing env vars (CLASS, TOP_N, ITEM_LEVEL) are inherited unchanged.

const { spawn } = require('child_process');
const path = require('path');

const env = { ...process.env, EXPLORE: '1', CI: 'true' };

const bin = path.join(
  __dirname,
  '..',
  'node_modules',
  '.bin',
  process.platform === 'win32' ? 'react-scripts.cmd' : 'react-scripts',
);

const args = [
  'test',
  '--testPathPattern=exploreBuilds',
  '--watchAll=false',
  '--verbose=false',
  ...process.argv.slice(2),
];

const child = spawn(bin, args, { env, stdio: 'inherit', shell: process.platform === 'win32' });
child.on('exit', (code) => process.exit(code ?? 1));
