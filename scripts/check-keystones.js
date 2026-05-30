#!/usr/bin/env node
// Counts keystones in generated trees. Run explore with EXPLORE_DUMP=<file>
// first to produce the input, e.g.:
//
//   EXPLORE_DUMP=tree-dump.json CLASS=witch TOP_N=1 LEVEL=90 npm run explore
//   EXPLORE_DUMP=tree-dump.json CLASS=huntress TOP_N=1 LEVEL=90 npm run explore
//   node scripts/check-keystones.js tree-dump.json

const fs = require('fs');
const path = require('path');

const dumpPath = process.argv[2] || 'tree-dump.json';
const treePath = path.join(__dirname, '..', 'src', 'data', 'generated', 'passive-tree.json');

const tree = JSON.parse(fs.readFileSync(treePath, 'utf8'));
const nodesById = {};
for (const n of Object.values(tree.nodes)) nodesById[n.id] = n;

const dump = JSON.parse(fs.readFileSync(dumpPath, 'utf8'));
for (const [className, info] of Object.entries(dump)) {
  const nodes = info.nodes || [];
  let keystones = 0;
  const keystoneNames = [];
  for (const id of nodes) {
    const n = nodesById[id];
    if (n && n.isKeystone) {
      keystones++;
      keystoneNames.push(n.name || `#${id}`);
    }
  }
  console.log(`${className} tree: ${keystones} keystones / ${nodes.length} nodes  (dps=${info.dps != null ? info.dps.toFixed(0) : 'n/a'})`);
  if (keystoneNames.length) console.log(`  -> ${keystoneNames.join(', ')}`);
}
