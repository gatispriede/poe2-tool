import { PASSIVE_NODES, PassiveNode } from './passivesData';
import { PassiveStats } from '../damage/model';

export function aggregatePassiveStats(selectedIds: string[]): PassiveStats {
  return aggregatePassiveStatsFromNodes(PASSIVE_NODES, selectedIds);
}

export function aggregatePassiveStatsFromNodes(nodes: PassiveNode[], selectedIds: string[]): PassiveStats {
  const totals: PassiveStats = {};
  for (const id of selectedIds) {
    const node = nodes.find(n => n.id === id);
    if (!node) continue;
    for (const [key, rawVal] of Object.entries(node.stats)) {
      const k = key as keyof PassiveStats;

      if (Array.isArray(rawVal)) {
        // Handle array properties (moreDamageMultipliersPct, moreCastSpeedMultipliersPct)
        if (!totals[k]) {
          (totals[k] as any) = [...rawVal];
        } else if (Array.isArray(totals[k])) {
          (totals[k] as any) = [...(totals[k] as any[]), ...rawVal];
        }
      } else if (typeof rawVal === 'number') {
        // Handle number properties - add them together
        const val = rawVal ?? 0;
        if (totals[k] === undefined) {
          (totals[k] as any) = val;
        } else if (typeof totals[k] === 'number') {
          (totals[k] as any) = (totals[k] as number) + val;
        }
      }
    }
  }
  return totals;
}

export function searchPassiveNodes(query: string, typeFilter: 'all' | 'small' | 'notable'): PassiveNode[] {
  const q = query.trim().toLowerCase();
  return PASSIVE_NODES.filter(n => (typeFilter === 'all' || n.type === typeFilter) && (q === '' || n.name.toLowerCase().includes(q)));
}
