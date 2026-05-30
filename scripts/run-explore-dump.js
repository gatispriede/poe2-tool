#!/usr/bin/env node
// Temporary helper: invokes scripts/explore.js with chosen env vars.
// Usage: node scripts/_run-explore-dump.js <className> <dumpFile>
const className = process.argv[2];
const dumpFile = process.argv[3] || 'tree-dump.json';
process.env.CLASS = className;
process.env.TOP_N = '1';
process.env.LEVEL = '90';
process.env.EXPLORE_DUMP = dumpFile;
require('./explore.js');
