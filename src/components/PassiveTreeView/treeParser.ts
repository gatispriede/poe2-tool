// Parse our converted tree.json (natwarth shape) into the ParsedTree
// structure the renderer wants. Adapted from
// natwarth/poe2-skilltree (app/src/lib/treeData.ts).

import type { ParsedTree, RawNode, RawTreeData, TreeEdge, TreeNode, NodeKind } from './types';

const ARC_TOL = 0.14;

function classifyKind(n: RawNode): NodeKind {
  if (n.ascendancyId) {
    if (n.isAscendancyStart) return 'ascStart';
    if (n.isNotable || n.isKeystone) return 'ascNotable';
    return 'ascNormal';
  }
  if (n.isKeystone) return 'keystone';
  if (n.isNotable) return 'notable';
  if (n.isMastery) return 'mastery';
  if (n.isJewelSocket) return 'jewel';
  return 'small';
}

export function parseTree(raw: RawTreeData): ParsedTree {
  const nodes = new Map<string, TreeNode>();
  const nodeList: TreeNode[] = [];
  const classStart = new Map<number, TreeNode>();
  const ascStart = new Map<string, TreeNode>();

  for (const [key, n] of Object.entries(raw.nodes)) {
    if (typeof n.x !== 'number' || typeof n.y !== 'number') continue;
    const tn: TreeNode = {
      key,
      id: n.id,
      name: n.name ?? '',
      icon: n.icon,
      kind: classifyKind(n),
      ascendancyId: n.ascendancyId,
      classStartIndex: n.classStartIndex,
      stats: n.stats ?? [],
      flavourText: n.flavourText ?? [],
      orbit: n.orbit ?? 0,
      x: n.x,
      y: n.y,
      mcOption: !!n.isMultipleChoiceOption,
    };
    nodes.set(key, tn);
    nodeList.push(tn);

    if (n.classStartIndex) for (const ci of n.classStartIndex) classStart.set(ci, tn);
    if (n.isAscendancyStart && n.ascendancyId && !ascStart.has(n.ascendancyId)) {
      ascStart.set(n.ascendancyId, tn);
    }
  }

  const edges: TreeEdge[] = [];
  const seen = new Set<string>();

  // Prefer top-level edges (have arc geometry); fall back to per-node in/out
  // if a converter run dropped them.
  if (raw.edges && raw.edges.length) {
    for (const e of raw.edges) {
      const fromKey = String(e.from);
      const toKey = String(e.to);
      const a = nodes.get(fromKey);
      const b = nodes.get(toKey);
      if (!a || !b) continue;
      const sig = fromKey < toKey ? `${fromKey}-${toKey}` : `${toKey}-${fromKey}`;
      if (seen.has(sig)) continue;
      seen.add(sig);

      const edge: TreeEdge = { fromKey, toKey, fx: a.x, fy: a.y, tx: b.x, ty: b.y };
      if (
        a.kind === 'ascStart' ||
        b.kind === 'ascStart' ||
        a.kind === 'mastery' ||
        b.kind === 'mastery' ||
        a.ascendancyId !== b.ascendancyId
      ) {
        edge.hidden = true;
      }
      if (a.ascendancyId && a.ascendancyId === b.ascendancyId) edge.asc = a.ascendancyId;

      if (e.orbit && typeof e.orbitX === 'number' && typeof e.orbitY === 'number') {
        const cx = e.orbitX;
        const cy = e.orbitY;
        const r = Math.hypot(a.x - cx, a.y - cy);
        const r2 = Math.hypot(b.x - cx, b.y - cy);
        if (r > 1 && Math.abs(r2 - r) / r < ARC_TOL) {
          const a0 = Math.atan2(a.y - cy, a.x - cx);
          const a1 = Math.atan2(b.y - cy, b.x - cx);
          let d = a1 - a0;
          while (d > Math.PI) d -= 2 * Math.PI;
          while (d < -Math.PI) d += 2 * Math.PI;
          if (Math.abs(d) > 0.001) {
            edge.arc = { cx, cy, r, a0, a1: a0 + d, ccw: d < 0 };
          }
        }
      }
      edges.push(edge);
    }
  } else {
    // Fallback: walk per-node `out` arrays, dedupe.
    for (const [key, n] of Object.entries(raw.nodes)) {
      const a = nodes.get(key);
      if (!a) continue;
      for (const list of [n.out, n.in]) {
        if (!Array.isArray(list)) continue;
        for (const peerKey of list) {
          const b = nodes.get(String(peerKey));
          if (!b) continue;
          const sig = key < String(peerKey) ? `${key}-${peerKey}` : `${peerKey}-${key}`;
          if (seen.has(sig)) continue;
          seen.add(sig);
          const edge: TreeEdge = { fromKey: key, toKey: String(peerKey), fx: a.x, fy: a.y, tx: b.x, ty: b.y };
          if (
            a.kind === 'ascStart' ||
            b.kind === 'ascStart' ||
            a.kind === 'mastery' ||
            b.kind === 'mastery' ||
            a.ascendancyId !== b.ascendancyId
          ) {
            edge.hidden = true;
          }
          if (a.ascendancyId && a.ascendancyId === b.ascendancyId) edge.asc = a.ascendancyId;
          edges.push(edge);
        }
      }
    }
  }

  const adjacency = new Map<string, string[]>();
  const addAdj = (a: string, b: string) => {
    let l = adjacency.get(a);
    if (!l) adjacency.set(a, (l = []));
    l.push(b);
  };
  for (const e of edges) {
    addAdj(e.fromKey, e.toKey);
    addAdj(e.toKey, e.fromKey);
  }

  return {
    nodes,
    nodeList,
    edges,
    classes: raw.classes,
    bounds: { minX: raw.min_x, minY: raw.min_y, maxX: raw.max_x, maxY: raw.max_y },
    classStart,
    ascStart,
    adjacency,
  };
}

export async function loadParsedTree(url?: string): Promise<ParsedTree> {
  // Respect CRA's PUBLIC_URL (set to "localhost" via .env.local in this project)
  // so the dev server serves the file from its actual public path.
  const base = (process.env.PUBLIC_URL || '').replace(/\/$/, '');
  const u = url ?? `${base}/TreeData/tree.json`;
  const res = await fetch(u);
  if (!res.ok) throw new Error(`tree fetch ${res.status} (${u})`);
  const raw = (await res.json()) as RawTreeData;
  return parseTree(raw);
}
