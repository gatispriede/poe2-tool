// Passive tree geometry.
//
// A modifier on the tree is only as good as what it costs to reach, so the
// engine needs distances, not just node contents. Connections in the PoB dump
// are directed one way only, so the graph is symmetrised first, then BFS from
// each class start gives the cheapest number of points to allocate a node
// (including the node itself). Ascendancy nodes live on their own subgraphs
// and are priced in ascendancy points instead.

import { RawTree, RawTreeNode } from './types';

export interface TreeGraph {
  nodes: Map<number, RawTreeNode>;
  adjacency: Map<number, number[]>;
  /** class internalId → node id → points from that class's start. */
  distances: Map<string, Map<number, number>>;
  classStarts: Map<string, number>;
  ascendancyOf: Map<number, string>;
  groups: Map<number, number[]>;
}

export function nodeList(tree: RawTree): RawTreeNode[] {
  return Array.isArray(tree.nodes) ? tree.nodes : Object.values(tree.nodes);
}

export function buildTreeGraph(tree: RawTree): TreeGraph {
  const nodes = new Map<number, RawTreeNode>();
  const adjacency = new Map<number, number[]>();
  const ascendancyOf = new Map<number, string>();
  const groups = new Map<number, number[]>();

  for (const node of nodeList(tree)) {
    nodes.set(node.id, node);
    if (node.ascendancyName) ascendancyOf.set(node.id, node.ascendancyName);
    if (node.group !== undefined) {
      const bucket = groups.get(node.group) ?? [];
      bucket.push(node.id);
      groups.set(node.group, bucket);
    }
  }

  const link = (a: number, b: number) => {
    if (!nodes.has(a) || !nodes.has(b)) return;
    const list = adjacency.get(a) ?? [];
    if (!list.includes(b)) list.push(b);
    adjacency.set(a, list);
  };
  for (const node of nodes.values()) {
    for (const other of node.connections ?? []) {
      link(node.id, other);
      link(other, node.id);
    }
  }

  const classStarts = new Map<string, number>();
  const distances = new Map<string, Map<number, number>>();
  for (const cls of tree.classes ?? []) {
    classStarts.set(cls.internalId, cls.startNodeId);
    distances.set(cls.internalId, bfs(cls.startNodeId, adjacency, ascendancyOf));
  }

  return { nodes, adjacency, distances, classStarts, ascendancyOf, groups };
}

function bfs(
  start: number,
  adjacency: Map<number, number[]>,
  ascendancyOf: Map<number, string>,
): Map<number, number> {
  const dist = new Map<number, number>([[start, 0]]);
  const queue: number[] = [start];
  for (let head = 0; head < queue.length; head += 1) {
    const current = queue[head];
    const d = dist.get(current) ?? 0;
    for (const next of adjacency.get(current) ?? []) {
      // Ascendancy subtrees are not reachable by spending passive points.
      if (ascendancyOf.has(next)) continue;
      if (dist.has(next)) continue;
      dist.set(next, d + 1);
      queue.push(next);
    }
  }
  return dist;
}

/** Cheapest passive-point cost to allocate a node, across all classes or one. */
export function pointCost(
  graph: TreeGraph,
  nodeId: number,
  classId?: string,
): { points: number; className?: string } {
  if (graph.ascendancyOf.has(nodeId)) return { points: 1, className: graph.ascendancyOf.get(nodeId) };
  let best = Infinity;
  let bestClass: string | undefined;
  for (const [cls, dist] of graph.distances) {
    if (classId && cls !== classId) continue;
    const d = dist.get(nodeId);
    if (d !== undefined && d < best) { best = d; bestClass = cls; }
  }
  return { points: Number.isFinite(best) ? best : Infinity, className: bestClass };
}

/** Nodes in the same tree group — a cluster you usually take together. */
export function clusterOf(graph: TreeGraph, nodeId: number): RawTreeNode[] {
  const node = graph.nodes.get(nodeId);
  if (!node || node.group === undefined) return node ? [node] : [];
  return (graph.groups.get(node.group) ?? []).map((id) => graph.nodes.get(id)!).filter(Boolean);
}
