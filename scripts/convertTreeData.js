#!/usr/bin/env node
/*
 * Convert natwarth/poe2-skilltree data.json (GGG OAuth API shape) into the
 * PoB-PoE2 tree.json shape consumed by src/data/passiveTree.ts.
 *
 * Source:  https://raw.githubusercontent.com/natwarth/poe2-skilltree/main/data.json
 * Target:  public/TreeData/tree.json
 *
 * Differences handled:
 *   - node.out + node.in (string[])           -> node.connections [{id:number, orbit:number}]
 *   - node.ascendancyId ("Ranger3")           -> node.ascendancyName ("Pathfinder")
 *
 * Pass --download to refetch from upstream into natwarth-data.json next to repo root.
 */

const fs = require('fs');
const path = require('path');
const https = require('https');

const REPO_ROOT = path.resolve(__dirname, '..');
const SRC_URL = 'https://raw.githubusercontent.com/natwarth/poe2-skilltree/main/data.json';
const SRC_LOCAL = path.join(REPO_ROOT, 'natwarth-data.json');
const OUT_PATH = path.join(REPO_ROOT, 'public', 'TreeData', 'tree.json');
const BACKUP_PATH = path.join(REPO_ROOT, 'public', 'TreeData', 'tree.0_4.json.bak');

function download(url, outPath) {
  return new Promise((resolve, reject) => {
    const file = fs.createWriteStream(outPath);
    https.get(url, (res) => {
      if (res.statusCode !== 200) {
        reject(new Error(`HTTP ${res.statusCode} for ${url}`));
        return;
      }
      res.pipe(file);
      file.on('finish', () => file.close(() => resolve()));
    }).on('error', reject);
  });
}

function buildAscendancyNameMap(classes) {
  const map = {};
  for (const c of classes || []) {
    for (const a of c.ascendancies || []) {
      const key = a.id || a.internalId;
      if (key && a.name) map[key] = a.name;
    }
  }
  return map;
}

function convert(src) {
  const ascNameById = buildAscendancyNameMap(src.classes);
  const nodes = {};

  for (const [id, n] of Object.entries(src.nodes || {})) {
    // Merge out + in into a deduped connection list; preserve orbit if known.
    const connIds = new Set();
    for (const list of [n.out, n.in]) {
      if (Array.isArray(list)) {
        for (const cid of list) connIds.add(Number(cid));
      }
    }
    const connections = [...connIds].map((cid) => {
      const peer = src.nodes[cid];
      return { id: cid, orbit: peer ? peer.orbit : 0 };
    });

    // Keep `in`, `out`, `edges` on each node — the visual renderer needs
    // them. `connections` is the legacy shape for our list-based parser.
    const out = {
      ...n,
      connections,
    };

    if (n.ascendancyId) {
      const name = ascNameById[n.ascendancyId];
      if (name) out.ascendancyName = name;
    }

    nodes[id] = out;
  }

  // Patch ascendancies on classes with internalId so downstream code can
  // round-trip between display name and id.
  const classes = (src.classes || []).map((c) => ({
    ...c,
    ascendancies: (c.ascendancies || []).map((a) => ({
      ...a,
      internalId: a.id || a.internalId,
    })),
  }));

  return {
    tree: src.tree,
    classes,
    groups: src.groups,
    nodes,
    edges: src.edges,
    jewelSlots: src.jewelSlots,
    skillOverrides: src.skillOverrides,
    min_x: src.min_x,
    min_y: src.min_y,
    max_x: src.max_x,
    max_y: src.max_y,
  };
}

async function main() {
  const args = process.argv.slice(2);
  if (args.includes('--download') || !fs.existsSync(SRC_LOCAL)) {
    console.log(`Downloading ${SRC_URL}`);
    await download(SRC_URL, SRC_LOCAL);
  }

  const raw = JSON.parse(fs.readFileSync(SRC_LOCAL, 'utf8'));
  console.log(`Loaded source: ${Object.keys(raw.nodes).length} nodes, ${raw.classes.length} classes`);

  if (fs.existsSync(OUT_PATH) && !fs.existsSync(BACKUP_PATH)) {
    fs.copyFileSync(OUT_PATH, BACKUP_PATH);
    console.log(`Backed up existing tree.json -> ${path.relative(REPO_ROOT, BACKUP_PATH)}`);
  }

  const converted = convert(raw);
  fs.writeFileSync(OUT_PATH, JSON.stringify(converted));
  const stats = fs.statSync(OUT_PATH);
  console.log(`Wrote ${path.relative(REPO_ROOT, OUT_PATH)} (${(stats.size / 1024 / 1024).toFixed(2)} MiB)`);
  console.log(`Output: ${Object.keys(converted.nodes).length} nodes, tree="${converted.tree}"`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
