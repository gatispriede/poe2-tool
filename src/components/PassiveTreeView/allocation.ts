// Graph helpers for tree allocation — adapted from
// natwarth/poe2-skilltree (app/src/lib/allocation.ts).

type Adj = Map<string, string[]>;

/** BFS reach from `start` over edges whose neighbours satisfy `allowed`. */
export function reach(adj: Adj, start: string, allowed: (key: string) => boolean): Set<string> {
  const seen = new Set<string>([start]);
  const q = [start];
  for (let i = 0; i < q.length; i++) {
    for (const nb of adj.get(q[i]) ?? []) {
      if (!seen.has(nb) && allowed(nb)) {
        seen.add(nb);
        q.push(nb);
      }
    }
  }
  return seen;
}

/** Shortest path from any of `sources` to `target` through traversable nodes. */
export function pathFrom(
  adj: Adj,
  sources: Set<string>,
  target: string,
  canTraverse: (key: string) => boolean
): string[] | null {
  if (sources.has(target)) return [];
  const parent = new Map<string, string | null>();
  const q: string[] = [];
  sources.forEach((s) => {
    parent.set(s, null);
    q.push(s);
  });
  let head = 0;
  let found = false;
  while (head < q.length) {
    const cur = q[head++];
    if (cur === target) {
      found = true;
      break;
    }
    for (const nb of adj.get(cur) ?? []) {
      if (parent.has(nb)) continue;
      if (nb !== target && !canTraverse(nb)) continue;
      parent.set(nb, cur);
      q.push(nb);
    }
  }
  if (!found && !parent.has(target)) return null;
  const path: string[] = [];
  let cur: string | null = target;
  while (cur != null && !sources.has(cur)) {
    path.push(cur);
    cur = parent.get(cur) ?? null;
  }
  path.reverse();
  return path;
}
