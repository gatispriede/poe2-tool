import { PassiveNode, PassiveNodeType } from './passivesData';
import { PassiveStats } from '../damage/model';

export interface RawPassiveNode {
  id: string;
  name: string;
  stats: string[]; // textual lines from wiki or export
  type?: PassiveNodeType; // optional explicit type
}

// Regex patterns for supported stats
const patterns: { key: keyof PassiveStats; regex: RegExp }[] = [
  { key: 'increasedPhysicalDamagePct', regex: /(\d+)%\s+increased\s+Physical\s+Damage/i },
  { key: 'increasedAttackSpeedPct', regex: /(\d+)%\s+increased\s+Attack\s+Speed/i },
  { key: 'increasedCritChancePct', regex: /(\d+)%\s+increased\s+Critical\s+Strike\s+Chance/i },
  { key: 'increasedCritMultiplierPct', regex: /\+(\d+)%\s+to\s+Critical\s+Strike\s+Multiplier/i },
  // Future expansions (not in PassiveStats yet): elemental, generic damage, etc.
  // { key: 'increasedElementalDamagePct', regex: /(\d+)%\s+increased\s+Elemental\s+Damage/i },
  // { key: 'increasedDamagePct', regex: /(\d+)%\s+increased\s+Damage(?! Over)/i },
];

export function parsePassiveNodes(raw: RawPassiveNode[]): PassiveNode[] {
  return raw.map(r => {
    const stats: Partial<PassiveStats> = {};
    for (const line of r.stats) {
      for (const p of patterns) {
        const m = line.match(p.regex);
        if (m) {
          const val = Number(m[1]);
          const key = p.key;
          // Handle number properties (arrays shouldn't come from parsing)
          if (stats[key] === undefined) {
            (stats[key] as any) = val;
          } else if (typeof stats[key] === 'number') {
            (stats[key] as any) = (stats[key] as number) + val;
          }
        }
      }
    }
    // Determine type: use provided or infer notable if any stat >= 20% or crit multi present
    const inferredType: PassiveNodeType = r.type || inferType(stats);
    return {
      id: r.id,
      name: r.name,
      type: inferredType,
      stats,
    };
  });
}

function inferType(stats: Partial<PassiveStats>): PassiveNodeType {
  if ((stats.increasedPhysicalDamagePct ?? 0) >= 20 || (stats.increasedAttackSpeedPct ?? 0) >= 10 || (stats.increasedCritChancePct ?? 0) >= 30 || (stats.increasedCritMultiplierPct ?? 0) > 0) {
    return 'notable';
  }
  return 'small';
}

export function mergePassiveNodeSets(existing: PassiveNode[], added: PassiveNode[]): PassiveNode[] {
  const map = new Map<string, PassiveNode>();
  for (const n of existing) map.set(n.id, n);
  for (const n of added) map.set(n.id, n); // overwrite duplicates
  return Array.from(map.values());
}
