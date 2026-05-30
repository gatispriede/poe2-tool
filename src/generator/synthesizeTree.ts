// Build a synthetic-but-valid passive tree allocation for a class.
//
// Layer 4 demands every allocated node be reachable from the class start
// through other allocated nodes. We satisfy this by BFS from the class
// start node, preferring nodes whose stats look damage-relevant for the
// chosen skill profile. The result is guaranteed reachable, but it's
// **NOT** an optimal allocation — a real Steiner-tree pathfinder would
// produce stronger trees. This stand-in lets the generator support any
// class without requiring a hand-crafted fixture per class.

import treeJson from '../data/generated/passive-tree.json';

interface TreeNode {
  id: number;
  name?: string;
  stats: string[];
  connections: number[];
  isNotable?: boolean;
  isKeystone?: boolean;
  isMastery?: boolean;
  isJewelSocket?: boolean;
  isAscendancyStart?: boolean;
  ascendancyName?: string;
  classesStart?: string[];
}

interface TreeClass {
  internalId: string;
  name: string;
  startNodeId: number;
  ascendancies: { id: string; internalId: string; name: string; startNodeId?: number }[];
}

const tree = treeJson as unknown as {
  nodes: Record<string, TreeNode>;
  classes: TreeClass[];
};

const treeNodesById: Record<number, TreeNode> = {};
for (const n of Object.values(tree.nodes)) treeNodesById[n.id] = n;

// Undirected adjacency — same convention as validator.
const adj: Map<number, Set<number>> = (() => {
  const m = new Map<number, Set<number>>();
  for (const n of Object.values(treeNodesById)) {
    if (!m.has(n.id)) m.set(n.id, new Set());
    for (const c of n.connections) {
      if (!m.has(c)) m.set(c, new Set());
      m.get(n.id)!.add(c);
      m.get(c)!.add(n.id);
    }
  }
  return m;
})();

function classStartFor(className: string): number | null {
  for (const c of tree.classes) if (c.name === className) return c.startNodeId;
  return null;
}

function ascendancyStartFor(ascendancyName: string): number | null {
  for (const n of Object.values(treeNodesById)) {
    if (n.isAscendancyStart && n.ascendancyName === ascendancyName) return n.id;
  }
  return null;
}

/**
 * Scaling bias — the build's COMMITTED archetype. A generic "grab all damage"
 * allocation never crosses the threshold where crit (chance × multi) or
 * ailment stacking starts to pay off, so those builds can't be discovered. By
 * synthesising one tree per bias and letting the composer pick the winner
 * (evaluator-optimizer), a committed crit or ailment tree can beat the
 * balanced one — that's how a new archetype surfaces.
 */
export type ScalingBias = 'balanced' | 'crit' | 'ailment' | 'armour';

type ScoreProfile = { skillTypes: Set<string>; bias?: ScalingBias };

/**
 * Score a node for relevance to a damage profile. Higher = more relevant.
 * Notables are heavily favoured; matching damage-type keywords bump score.
 * `profile.bias` lets the allocator COMMIT to crit / ailment clusters.
 */
function nodeScore(node: TreeNode, profile: ScoreProfile): number {
  if (!node) return 0;
  const bias = profile.bias ?? 'balanced';
  let s = 0;
  if (node.isNotable) s += 40;
  if (node.isKeystone) {
    // Keystones are the highest-impact node type in PoE2. Damage-keyword
    // regex below misses defensive/enabling keystones (Blood Magic, EB,
    // Resolute Technique, Chaos Inoculation) whose effect is qualitative,
    // so without this base bonus they never pass the Steiner threshold.
    s += 35;
    const text = `${node.name || ''} ${(node.stats || []).join(' ')}`.toLowerCase();
    if (/blood magic|chaos inoculation|eldritch battery|mind over matter/.test(text)) s += 20;     // spell-caster enablers
    if (/resolute technique|point blank|iron grip|iron reflexes/.test(text)) s += 15;             // attack enablers
    if (/critical|crit/.test(text)) s += bias === 'crit' ? 45 : 15;                                 // crit enablers
  }
  if (node.isMastery) s += 3;    // masteries only proc when allocated near other matching nodes
  if (node.isJewelSocket) s += 5; // template includes jewels — allocator can route through sockets

  for (const stat of (node.stats || [])) {
    const text = stat.toLowerCase();
    if (/increased.*damage/.test(text)) s += 8;
    if (/more.*damage/.test(text)) s += 12;
    // Crit: under 'crit' bias, crit nodes dominate so the allocator commits
    // to a crit cluster (chance AND multi together) instead of one stray node.
    // The balanced path stays EXACTLY +6 so it reproduces the original tree.
    if (/critical/.test(text)) {
      s += bias === 'crit' ? 24 : 6;
      // Crit damage bonus (the multiplier) is the partner the generator most
      // under-builds — extra weight under crit bias only.
      if (bias === 'crit' && /critical damage bonus|critical strike multiplier/.test(text)) s += 14;
    }
    // Ailment: boost ONLY under ailment bias; balanced adds 0 so the balanced
    // allocation is unchanged from the original (greedy is path-dependent — a
    // stray +1 cascades into a different tree).
    if (bias === 'ailment' && /(shock|freeze|ignite|chill|ailment|status)/.test(text)) {
      s += 18;
    }
    // Armour-as-damage: under 'armour' bias commit to the defence-as-offence
    // cluster — "% of Armour also applies to Damage" is the payoff node, armour
    // stacking feeds the pool. Only under this bias (balanced unchanged).
    if (bias === 'armour') {
      if (/of armour also applies to .* damage/.test(text)) s += 40; // the payoff
      else if (/increased armour|to armour\b/.test(text)) s += 16;   // pool stacking
    }
    if (/attack speed/.test(text) && profile.skillTypes.has('Attack')) s += 6;
    if (/cast speed/.test(text) && profile.skillTypes.has('Spell')) s += 6;
    if (/projectile/.test(text) && profile.skillTypes.has('Projectile')) s += 6;
    if (/melee/.test(text) && profile.skillTypes.has('Melee')) s += 6;
    if (/area/.test(text) && profile.skillTypes.has('Area')) s += 3;
    if (/cold/.test(text) && profile.skillTypes.has('Cold')) s += 5;
    if (/fire/.test(text) && profile.skillTypes.has('Fire')) s += 5;
    if (/lightning/.test(text) && profile.skillTypes.has('Lightning')) s += 5;
    if (/physical/.test(text)) s += 4; // most attacks scale phys
    if (/life regeneration|movement|evasion|armour|resistance/.test(text)) s -= 1;
  }
  return s;
}

export interface SynthesizedTree {
  classId: number;
  classInternalId: string;
  ascendancyInternalId: string | null;
  nodes: number[];
  treeVersion: string;
}

/**
 * Greedy BFS-expansion. From the class start, repeatedly add the
 * highest-scoring neighbour of the current allocated frontier. The
 * resulting set is guaranteed connected (Layer-4 valid) by construction.
 *
 * `targetSize` controls how many points to spend. ~130 matches the
 * baseline fixtures.
 */
/**
 * Multi-source BFS: compute the shortest distance from any node in `sources`
 * to every other node in the (filtered) graph. Returns Map<nodeId, {dist, prev}>.
 * `predicate(nodeId)` filters which nodes are traversable.
 */
function multiSourceBFS(
  sources: Iterable<number>,
  predicate: (nodeId: number) => boolean,
): Map<number, { dist: number; prev: number }> {
  const result = new Map<number, { dist: number; prev: number }>();
  const queue: number[] = [];
  for (const s of Array.from(sources)) {
    result.set(s, { dist: 0, prev: -1 });
    queue.push(s);
  }
  let head = 0;
  while (head < queue.length) {
    const cur = queue[head++];
    const curDist = result.get(cur)!.dist;
    const neighbours = adj.get(cur);
    if (!neighbours) continue;
    neighbours.forEach(n => {
      if (result.has(n)) return;
      if (!predicate(n)) return;
      result.set(n, { dist: curDist + 1, prev: cur });
      queue.push(n);
    });
  }
  return result;
}

/** Reconstruct the path from `target` back to the nearest source. */
function pathTo(
  target: number,
  distMap: Map<number, { dist: number; prev: number }>,
): number[] {
  const out: number[] = [];
  let cur: number = target;
  while (cur !== -1 && distMap.has(cur)) {
    out.push(cur);
    const entry = distMap.get(cur)!;
    if (entry.prev === -1) break;
    cur = entry.prev;
  }
  return out.reverse();
}

function isMainTreeNode(id: number): boolean {
  const n = treeNodesById[id];
  if (!n) return false;
  if (n.ascendancyName) return false;
  return true;
}

/**
 * Strategy A — pure-greedy from class start. Adjacent-best each step.
 * Strong when the class start sits in a damage-dense area (e.g. Warrior).
 */
function allocateGreedy(
  startId: number,
  targetSize: number,
  profileSet: { skillTypes: Set<string> },
): Set<number> {
  const allocated = new Set<number>([startId]);
  while (allocated.size < targetSize) {
    let bestId: number | null = null;
    let bestScore = -Infinity;
    Array.from(allocated).forEach(allocatedId => {
      const neighbours = adj.get(allocatedId);
      if (!neighbours) return;
      neighbours.forEach(n => {
        if (allocated.has(n) || !isMainTreeNode(n)) return;
        const s = nodeScore(treeNodesById[n], profileSet);
        if (s > bestScore) { bestScore = s; bestId = n; }
      });
    });
    if (bestId == null) break;
    allocated.add(bestId);
  }
  return allocated;
}

/**
 * Strategy B — Steiner-style: at each step, find the unallocated NOTABLE
 * with the best (score / distance) ratio, then allocate the whole path
 * to it. Strong when high-value notables cluster a few hops away.
 */
function allocateSteiner(
  startId: number,
  targetSize: number,
  profileSet: { skillTypes: Set<string> },
): Set<number> {
  const allocated = new Set<number>([startId]);

  const notables: { id: number; score: number }[] = [];
  for (const node of Object.values(treeNodesById)) {
    if (!isMainTreeNode(node.id)) continue;
    if (!node.isNotable && !node.isKeystone) continue;
    const s = nodeScore(node, profileSet);
    // Threshold lowered from 30 → 20 so the keystone base bonus (35) passes
    // even when no archetype-aware bonus or damage-keyword bonus applies.
    if (s > 20) notables.push({ id: node.id, score: s });
  }
  notables.sort((a, b) => b.score - a.score);

  let safetyCounter = 0;
  while (allocated.size < targetSize && safetyCounter < 50) {
    safetyCounter++;
    const dists = multiSourceBFS(allocated, n => isMainTreeNode(n) && !allocated.has(n));
    let bestNotable: number | null = null;
    let bestRatio = -Infinity;
    for (const { id, score } of notables) {
      if (allocated.has(id)) continue;
      const d = dists.get(id);
      if (!d) continue;
      const ratio = score / Math.max(1, d.dist);
      if (ratio > bestRatio) { bestRatio = ratio; bestNotable = id; }
    }
    if (bestNotable == null) break;
    const path = pathTo(bestNotable, dists);
    for (const id of path) {
      if (allocated.size >= targetSize) break;
      allocated.add(id);
    }
  }

  // Tail-filler: greedy on remaining adjacent nodes.
  while (allocated.size < targetSize) {
    let bestId: number | null = null;
    let bestScore = -Infinity;
    Array.from(allocated).forEach(allocatedId => {
      const neighbours = adj.get(allocatedId);
      if (!neighbours) return;
      neighbours.forEach(n => {
        if (allocated.has(n) || !isMainTreeNode(n)) return;
        const s = nodeScore(treeNodesById[n], profileSet);
        if (s > bestScore) { bestScore = s; bestId = n; }
      });
    });
    if (bestId == null) break;
    allocated.add(bestId);
  }
  return allocated;
}

export type TreeStrategy = 'greedy' | 'steiner';

/** Connect `target` into `allocated` via shortest path. Stops if a path is
 *  not found. Returns the new size. Used to bolt on cornerstone keystones
 *  (Eldritch Battery for Archmage builds, etc.) after the main allocation. */
function attachNodeViaShortestPath(
  startId: number,
  target: number,
  allocated: Set<number>,
): void {
  if (allocated.has(target)) return;
  // BFS from any allocated node toward target, restricted to main-tree nodes.
  const sources = new Set(allocated);
  if (sources.size === 0) sources.add(startId);
  const parent = new Map<number, number | null>();
  const queue: number[] = [];
  sources.forEach(s => { parent.set(s, null); queue.push(s); });
  let head = 0;
  let found = false;
  while (head < queue.length) {
    const cur = queue[head++];
    if (cur === target) { found = true; break; }
    const nbrs = adj.get(cur);
    if (!nbrs) continue;
    nbrs.forEach(n => {
      if (parent.has(n)) return;
      if (!isMainTreeNode(n)) return;
      parent.set(n, cur);
      queue.push(n);
    });
  }
  if (!found) return;
  let cur: number | null = target;
  while (cur != null && !sources.has(cur)) {
    allocated.add(cur);
    cur = parent.get(cur) ?? null;
  }
}

export function synthesizeTree(
  className: string,
  profile: { skillTypes: string[] },
  targetSize = 100,
  ascendancyName?: string,
  strategy: TreeStrategy = 'greedy',
  requiredNodeIds: number[] = [],
  bias: ScalingBias = 'balanced',
): SynthesizedTree | null {
  const startId = classStartFor(className);
  if (startId == null) return null;

  const profileSet: ScoreProfile = { skillTypes: new Set(profile.skillTypes), bias };

  // REALISM: a real character does NOT spend every passive point on offence.
  // ~45% of points go to life, resistances, defences, and travel — none of
  // which add hit damage. Calibrated against a real Lv-84 Ice Shot character
  // whose composed all-damage tree (523% increased, 110 nodes) over-stated
  // DPS ~2.5×. We allocate only DAMAGE_POINT_FRACTION of the budget to
  // damage-scoring nodes; the rest are implicitly survival/travel (0 hit
  // damage), so the tree's increased% reflects a playable build, not a
  // theoretical glass-cannon.
  const DAMAGE_POINT_FRACTION = 0.55;
  const damageBudget = Math.max(1, Math.round(targetSize * DAMAGE_POINT_FRACTION));

  // Strategy choice is left to the caller (the orchestrator can compose
  // both and pick the higher-DPS one). Defaults to greedy because that's
  // robust across classes; Steiner can outperform when notable clusters
  // are far from the class start.
  const allocated = strategy === 'steiner'
    ? allocateSteiner(startId, damageBudget, profileSet)
    : allocateGreedy(startId, damageBudget, profileSet);

  // Anchor any caller-specified must-include nodes by patching them onto the
  // tree via shortest path. Used for build-defining keystones (Eldritch
  // Battery on Archmage Witches, Mind Over Matter combos, etc.) that the
  // heuristic scorer may not pick on its own. The tree may end up slightly
  // larger than targetSize as a result — accepted since the keystones are
  // build-defining and the validator is reachability-based, not size-based.
  for (const req of requiredNodeIds) {
    attachNodeViaShortestPath(startId, req, allocated);
  }

  // Append the ascendancy start node + a small extension if an ascendancy
  // was named. Same BFS pattern, restricted to ascendancy.
  if (ascendancyName) {
    const ascStart = ascendancyStartFor(ascendancyName);
    if (ascStart != null) {
      const ascAllocated = new Set<number>([ascStart]);
      while (ascAllocated.size < 4) {
        let bestId: number | null = null;
        let bestScore = -Infinity;
        Array.from(ascAllocated).forEach(a => {
          const neighbours = adj.get(a);
          if (!neighbours) return;
          neighbours.forEach(n => {
            if (ascAllocated.has(n)) return;
            const node = treeNodesById[n];
            if (!node || node.ascendancyName !== ascendancyName) return;
            const s = nodeScore(node, profileSet);
            if (s > bestScore) { bestScore = s; bestId = n; }
          });
        });
        if (bestId == null) break;
        ascAllocated.add(bestId);
      }
      ascAllocated.forEach(n => allocated.add(n));
    }
  }

  // Find the class's integerId so we record the same shape as PoB exports.
  const cls = tree.classes.find(c => c.name === className);
  // Tree version sourced from the canonical export; the validator reads it.
  const treeVersion = (tree as unknown as { treeVersion: string }).treeVersion ?? '0_4';

  return {
    classId: -1, // PoB uses different IDs; not consumed by validator
    classInternalId: cls?.internalId ?? className,
    ascendancyInternalId: ascendancyName ?? null,
    nodes: Array.from(allocated),
    treeVersion,
  };
}
