import { loadDataset } from '../dataset.node';
import { buildTreeGraph, clusterOf, nodeList, pointCost } from '../treeGraph';
import { Dataset } from '../types';

const dataset: Dataset = loadDataset(process.cwd());
const graph = buildTreeGraph(dataset.tree);

describe('passive tree geometry', () => {
  it('symmetrises the one-way connection dump', () => {
    for (const node of nodeList(dataset.tree).slice(0, 200)) {
      for (const other of node.connections ?? []) {
        if (!graph.nodes.has(other)) continue;
        expect(graph.adjacency.get(other)).toContain(node.id);
      }
    }
  });

  it('prices a node in passive points from a class start', () => {
    const witchStart = graph.classStarts.get('Witch')!;
    expect(pointCost(graph, witchStart, 'Witch').points).toBe(0);
    const reachable = nodeList(dataset.tree)
      .filter((n) => !n.ascendancyName && graph.distances.get('Witch')!.has(n.id));
    expect(reachable.length).toBeGreaterThan(1000);
  });

  it('reaches nearly the whole tree from every class', () => {
    const total = nodeList(dataset.tree).filter((n) => !n.ascendancyName).length;
    for (const [cls, dist] of graph.distances) {
      expect({ cls, ratio: dist.size / total }).toMatchObject({ cls });
      expect(dist.size / total).toBeGreaterThan(0.95);
    }
  });

  it('does not let passive points walk into an ascendancy subtree', () => {
    const ascendancyNode = nodeList(dataset.tree).find((n) => n.ascendancyName && n.isNotable)!;
    expect(graph.distances.get('Witch')!.has(ascendancyNode.id)).toBe(false);
    expect(pointCost(graph, ascendancyNode.id).points).toBe(1);
  });

  it('groups a node with the cluster it is taken with', () => {
    const clustered = nodeList(dataset.tree).find((n) => n.group !== undefined && n.isNotable)!;
    expect(clusterOf(graph, clustered.id).length).toBeGreaterThan(0);
  });
});
