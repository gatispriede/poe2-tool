// Reads PathOfBuilding-PoE2/src/TreeData/<version>/tree.json and produces a
// pruned, typed passive tree suitable for Layer-4 validity checks.
//
// We keep: node id, name, stats text, edge list, flag bits, ascendancy
// binding, class-start markers. We drop: pixel positions, image asset paths,
// orbit/orbitIndex metadata, connection art hints — those are render-only.

const fs = require('fs');
const path = require('path');
const { PassiveTree } = require('./schemas');

// The latest tree version present in PathOfBuilding-PoE2/src/TreeData/.
// We pick the highest-numbered `N_M` directory automatically so a PoB pull
// gets the new tree for free.
function pickLatestTreeVersion(treeDir) {
  const versionRe = /^\d+_\d+$/;
  const versions = fs.readdirSync(treeDir).filter(d => versionRe.test(d));
  versions.sort((a, b) => {
    const [aM, am] = a.split('_').map(Number);
    const [bM, bm] = b.split('_').map(Number);
    return aM - bM || am - bm;
  });
  return versions[versions.length - 1];
}

// Lua 1-indexed arrays parse to objects with keys "1".."N". Convert those
// (and only those — node/group maps keyed by id must stay objects) back to
// JS arrays so the downstream pruning logic (written for tree.json) works.
function seqToArray(o) {
  if (Array.isArray(o)) return o;
  if (!o || typeof o !== 'object') return o;
  const keys = Object.keys(o);
  if (keys.length === 0) return [];
  if (!keys.every((k, i) => k === String(i + 1))) return o; // not a 1..N sequence
  return keys.map(k => o[k]);
}

// Normalize a tree.lua-parsed object into the same shape JSON.parse(tree.json)
// would produce, so extractTree's existing logic is source-agnostic.
function normalizeLuaTree(t) {
  const nodes = {};
  for (const [id, n] of Object.entries(t.nodes || {})) {
    if (!n || typeof n !== 'object') continue;
    nodes[id] = {
      ...n,
      stats: seqToArray(n.stats),
      connections: seqToArray(n.connections),
      classesStart: n.classesStart ? Object.values(n.classesStart) : undefined,
    };
  }
  const classes = seqToArray(t.classes).map(c => ({
    ...c,
    ascendancies: seqToArray(c.ascendancies),
  }));
  return { ...t, nodes, classes };
}

function extractTree(pobRoot) {
  const treeDir = path.join(pobRoot, 'src', 'TreeData');
  const treeVersion = pickLatestTreeVersion(treeDir);
  const jsonPath = path.join(treeDir, treeVersion, 'tree.json');
  const luaPath = path.join(treeDir, treeVersion, 'tree.lua');
  let raw;
  if (fs.existsSync(jsonPath)) {
    raw = JSON.parse(fs.readFileSync(jsonPath, 'utf8'));
  } else if (fs.existsSync(luaPath)) {
    // 0.5 ships the tree as tree.lua only. Parse it via luaparse and normalize.
    const { readLuaTables } = require('./parseLua');
    raw = normalizeLuaTree(readLuaTables(luaPath));
  } else {
    return { tree: null, errors: [{ reason: 'no tree.json or tree.lua' }], preserve: true, missingVersion: treeVersion };
  }

  // Build pruned node map.
  const nodes = {};
  // Map class-name → class-start node id.
  const classStartByName = {};
  for (const [idStr, n] of Object.entries(raw.nodes || {})) {
    if (!n || typeof n !== 'object') continue;
    const id = parseInt(idStr, 10);
    if (!Number.isFinite(id)) continue;

    const connections = Array.isArray(n.connections)
      ? n.connections.map(c => (typeof c === 'object' ? c.id : c)).filter(Number.isFinite)
      : [];

    const pruned = {
      id,
      name: typeof n.name === 'string' ? n.name : undefined,
      stats: Array.isArray(n.stats) ? n.stats.filter(s => typeof s === 'string') : [],
      connections,
    };
    // Positioning — required by Layer 5 for jewel-radius effect resolution.
    if (typeof n.group === 'number') pruned.group = n.group;
    if (typeof n.orbit === 'number') pruned.orbit = n.orbit;
    if (typeof n.orbitIndex === 'number') pruned.orbitIndex = n.orbitIndex;

    if (n.isNotable === true) pruned.isNotable = true;
    if (n.isKeystone === true) pruned.isKeystone = true;
    if (n.isMastery === true) pruned.isMastery = true;
    if (n.isJewelSocket === true) pruned.isJewelSocket = true;
    if (n.isAscendancyStart === true) pruned.isAscendancyStart = true;
    if (typeof n.ascendancyName === 'string') pruned.ascendancyName = n.ascendancyName;
    if (Array.isArray(n.classesStart) && n.classesStart.length) {
      pruned.classesStart = n.classesStart.filter(c => typeof c === 'string');
      for (const cls of pruned.classesStart) classStartByName[cls] = id;
    }
    nodes[String(id)] = pruned;
  }

  // Build class metadata with start-node lookup.
  // PoB stores PoE2 classes (Witch, Sorceress, …) but the class-start nodes
  // are tagged with the *legacy* PoE1 class names too (Shadow, Marauder, …).
  // Both names point at the same start node — we pick whichever matches.
  // `internalId` for PoB-Spec is the PoE2 class name with a numeric suffix
  // for ascendancy (e.g. Witch1=base, Witch2=Blood Mage). We reconstruct it
  // from the class name + ascendancy ordering.
  const classes = (raw.classes || []).map(c => {
    const startNodeId = classStartByName[c.name];
    // Ascendancy start nodes: filter the pruned nodes table.
    const ascStarts = {};
    for (const n of Object.values(nodes)) {
      if (n.isAscendancyStart && n.ascendancyName) {
        ascStarts[n.ascendancyName] = n.id;
      }
    }
    return {
      internalId: c.name,
      integerId: typeof c.integerId === 'number' ? c.integerId : -1,
      name: c.name,
      startNodeId: typeof startNodeId === 'number' ? startNodeId : -1,
      ascendancies: (c.ascendancies || []).map(a => ({
        id: a.id || a.name,
        internalId: a.internalId || a.id || a.name,
        name: a.name,
        startNodeId: ascStarts[a.name],
      })),
    };
  });

  // Groups — keep only x/y centre. Drop render hints.
  const groups = {};
  for (const [gid, g] of Object.entries(raw.groups || {})) {
    if (!g || typeof g !== 'object') continue;
    if (typeof g.x !== 'number' || typeof g.y !== 'number') continue;
    groups[gid] = { x: g.x, y: g.y };
  }

  // Constants — only what we need to project (orbit, orbitIndex) → (x, y).
  const rc = raw.constants || {};
  const constants = {
    skillsPerOrbit: Array.isArray(rc.skillsPerOrbit) ? rc.skillsPerOrbit : [],
    orbitRadii:     Array.isArray(rc.orbitRadii)     ? rc.orbitRadii     : [],
    orbitAnglesByOrbit: Array.isArray(rc.orbitAnglesByOrbit) ? rc.orbitAnglesByOrbit : [],
  };

  const tree = {
    treeVersion,
    classes,
    nodes,
    groups,
    constants,
    jewelSlots: Array.isArray(raw.jewelSlots) ? raw.jewelSlots.filter(Number.isFinite) : [],
  };

  const parsed = PassiveTree.safeParse(tree);
  if (!parsed.success) {
    return { tree: null, errors: parsed.error.issues.slice(0, 10) };
  }
  return { tree: parsed.data, errors: [] };
}

module.exports = { extractTree };
