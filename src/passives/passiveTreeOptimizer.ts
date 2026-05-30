// Passive Tree Optimizer for Spell Damage
// Analyzes passive nodes and finds optimal allocation for maximum spell DPS

import { PassiveStats } from '../damage/model';

export interface PassiveTreeNode {
  id: string;
  name: string;
  type: 'small' | 'notable' | 'keystone';
  stats: Partial<PassiveStats>;
  description: string;
  allocated?: boolean;
  // Damage type categories for filtering
  damageTypes?: ('spell' | 'attack' | 'physical' | 'fire' | 'cold' | 'lightning' | 'chaos' | 'elemental' | 'critical' | 'speed' | 'area' | 'projectile' | 'generic')[];
}

// Parse passive node effects from text description
export function parsePassiveEffect(description: string): Partial<PassiveStats> {
  const stats: Partial<PassiveStats> = {};

  const patterns = [
    // Spell damage
    { regex: /(\d+)%\s+increased\s+Spell\s+Damage/i, key: 'increasedSpellDamagePct' as keyof PassiveStats },
    { regex: /(\d+)%\s+increased\s+Elemental\s+Damage/i, key: 'increasedElementalDamagePct' as keyof PassiveStats },
    { regex: /(\d+)%\s+increased\s+Fire\s+Damage/i, key: 'increasedFireDamagePct' as keyof PassiveStats },
    { regex: /(\d+)%\s+increased\s+Cold\s+Damage/i, key: 'increasedColdDamagePct' as keyof PassiveStats },
    { regex: /(\d+)%\s+increased\s+Lightning\s+Damage/i, key: 'increasedLightningDamagePct' as keyof PassiveStats },
    { regex: /(\d+)%\s+increased\s+Chaos\s+Damage/i, key: 'increasedChaosDamagePct' as keyof PassiveStats },
    { regex: /(\d+)%\s+increased\s+Damage/i, key: 'increasedDamagePct' as keyof PassiveStats },

    // Cast speed
    { regex: /(\d+)%\s+increased\s+Cast\s+Speed/i, key: 'increasedCastSpeedPct' as keyof PassiveStats },

    // Critical strike
    { regex: /(\d+)%\s+increased\s+(Spell\s+)?Critical\s+Strike\s+Chance/i, key: 'increasedSpellCritChancePct' as keyof PassiveStats },
    { regex: /\+(\d+)%\s+to\s+(Spell\s+)?Critical\s+Strike\s+Multiplier/i, key: 'increasedSpellCritMultiplierPct' as keyof PassiveStats },

    // Area and projectile
    { regex: /(\d+)%\s+increased\s+Area\s+(of\s+Effect\s+)?Damage/i, key: 'increasedAreaDamagePct' as keyof PassiveStats },
    { regex: /(\d+)%\s+increased\s+Projectile\s+Damage/i, key: 'increasedProjectileDamagePct' as keyof PassiveStats },

    // Physical (for spells that convert or scale with it)
    { regex: /(\d+)%\s+increased\s+Physical\s+Damage/i, key: 'increasedPhysicalDamagePct' as keyof PassiveStats },
  ];

  for (const pattern of patterns) {
    const match = description.match(pattern.regex);
    if (match) {
      const value = parseInt(match[1], 10);
      if (stats[pattern.key] === undefined) {
        (stats[pattern.key] as any) = value;
      } else {
        (stats[pattern.key] as any) += value;
      }
    }
  }

  return stats;
}

// Calculate the DPS contribution of a passive node for a given skill
export function calculatePassiveNodeValue(
  node: PassiveTreeNode,
  currentStats: Partial<PassiveStats>,
  skillType: 'fire' | 'cold' | 'lightning' | 'chaos' | 'physical' | 'elemental' | 'generic',
  baseDamage: number,
  baseCastSpeed: number,
  baseCritChance: number
): number {
  // Calculate current DPS
  const currentDPS = calculateSpellDPS(currentStats, skillType, baseDamage, baseCastSpeed, baseCritChance);

  // Calculate DPS with this node added
  const statsWithNode = mergeStats(currentStats, node.stats);
  const newDPS = calculateSpellDPS(statsWithNode, skillType, baseDamage, baseCastSpeed, baseCritChance);

  // Return the difference (contribution)
  return newDPS - currentDPS;
}

// Merge two PassiveStats objects
function mergeStats(stats1: Partial<PassiveStats>, stats2: Partial<PassiveStats>): Partial<PassiveStats> {
  const merged: Partial<PassiveStats> = { ...stats1 };

  for (const [key, value] of Object.entries(stats2)) {
    const k = key as keyof PassiveStats;

    if (Array.isArray(value)) {
      // Handle array properties (moreDamageMultipliersPct, moreCastSpeedMultipliersPct)
      if (!merged[k]) {
        (merged[k] as any) = [...value];
      } else if (Array.isArray(merged[k])) {
        (merged[k] as any) = [...(merged[k] as any[]), ...value];
      }
    } else if (typeof value === 'number') {
      // Handle number properties - add them together
      if (merged[k] === undefined) {
        (merged[k] as any) = value;
      } else if (typeof merged[k] === 'number') {
        (merged[k] as any) = (merged[k] as number) + value;
      }
    }
  }

  return merged;
}

// Calculate spell DPS from passive stats
function calculateSpellDPS(
  stats: Partial<PassiveStats>,
  skillType: 'fire' | 'cold' | 'lightning' | 'chaos' | 'physical' | 'elemental' | 'generic',
  baseDamage: number,
  baseCastSpeed: number,
  baseCritChance: number
): number {
  // Calculate total increased damage
  let increasedDamage = 0;

  // Generic damage
  increasedDamage += stats.increasedDamagePct || 0;
  increasedDamage += stats.increasedSpellDamagePct || 0;

  // Element-specific
  if (skillType === 'fire') {
    increasedDamage += stats.increasedFireDamagePct || 0;
    increasedDamage += stats.increasedElementalDamagePct || 0;
  } else if (skillType === 'cold') {
    increasedDamage += stats.increasedColdDamagePct || 0;
    increasedDamage += stats.increasedElementalDamagePct || 0;
  } else if (skillType === 'lightning') {
    increasedDamage += stats.increasedLightningDamagePct || 0;
    increasedDamage += stats.increasedElementalDamagePct || 0;
  } else if (skillType === 'chaos') {
    increasedDamage += stats.increasedChaosDamagePct || 0;
  } else if (skillType === 'physical') {
    increasedDamage += stats.increasedPhysicalDamagePct || 0;
  } else if (skillType === 'elemental') {
    increasedDamage += stats.increasedElementalDamagePct || 0;
  }

  // Area and projectile (assuming they apply - could be filtered by skill tags)
  increasedDamage += stats.increasedAreaDamagePct || 0;
  increasedDamage += stats.increasedProjectileDamagePct || 0;

  // Calculate damage multiplier
  const damageMultiplier = 1 + increasedDamage / 100;

  // Apply more multipliers
  let moreMultiplier = 1;
  if (stats.moreDamageMultipliersPct) {
    for (const more of stats.moreDamageMultipliersPct) {
      moreMultiplier *= (1 + more / 100);
    }
  }

  // Calculate final damage per hit
  const damagePerHit = baseDamage * damageMultiplier * moreMultiplier + (stats.addedSpellDamage || 0);

  // Calculate cast speed
  const increasedCastSpeed = stats.increasedCastSpeedPct || 0;
  let castSpeed = baseCastSpeed * (1 + increasedCastSpeed / 100);

  // Apply more cast speed multipliers
  if (stats.moreCastSpeedMultipliersPct) {
    for (const more of stats.moreCastSpeedMultipliersPct) {
      castSpeed *= (1 + more / 100);
    }
  }

  // Calculate critical strike multiplier
  const increasedCritChance = (stats.increasedCritChancePct || 0) + (stats.increasedSpellCritChancePct || 0);
  const finalCritChance = Math.min(100, baseCritChance + increasedCritChance);

  const baseCritMultiplier = 1.5 + ((stats.increasedCritMultiplierPct || 0) + (stats.increasedSpellCritMultiplierPct || 0)) / 100;
  const effectiveCritMultiplier = 1 + (finalCritChance / 100) * (baseCritMultiplier - 1);

  // Final DPS
  return damagePerHit * castSpeed * effectiveCritMultiplier;
}

// Optimize passive allocation using greedy algorithm
export function optimizePassiveAllocation(
  availableNodes: PassiveTreeNode[],
  maxPoints: number,
  skillType: 'fire' | 'cold' | 'lightning' | 'chaos' | 'physical' | 'elemental' | 'generic',
  baseDamage: number,
  baseCastSpeed: number,
  baseCritChance: number
): PassiveTreeNode[] {
  const allocated: PassiveTreeNode[] = [];
  const currentStats: Partial<PassiveStats> = {};

  // Greedy algorithm: repeatedly pick the node with highest DPS contribution
  for (let i = 0; i < maxPoints && allocated.length < availableNodes.length; i++) {
    let bestNode: PassiveTreeNode | null = null;
    let bestValue = 0;

    for (const node of availableNodes) {
      // Skip already allocated nodes
      if (allocated.includes(node)) continue;

      const value = calculatePassiveNodeValue(
        node,
        currentStats,
        skillType,
        baseDamage,
        baseCastSpeed,
        baseCritChance
      );

      if (value > bestValue) {
        bestValue = value;
        bestNode = node;
      }
    }

    if (bestNode && bestValue > 0) {
      allocated.push(bestNode);
      // Update current stats
      for (const [key, value] of Object.entries(bestNode.stats)) {
        if (typeof value === 'number') {
          const k = key as keyof PassiveStats;
          if (currentStats[k] === undefined) {
            (currentStats[k] as any) = value;
          } else {
            (currentStats[k] as any) += value;
          }
        }
      }
    } else {
      // No more beneficial nodes
      break;
    }
  }

  return allocated;
}

// Aggregate stats from multiple nodes
export function aggregatePassiveNodes(nodes: PassiveTreeNode[]): Partial<PassiveStats> {
  const stats: Partial<PassiveStats> = {};

  for (const node of nodes) {
    for (const [key, value] of Object.entries(node.stats)) {
      const k = key as keyof PassiveStats;

      if (Array.isArray(value)) {
        // Handle array properties (moreDamageMultipliersPct, moreCastSpeedMultipliersPct)
        if (!stats[k]) {
          (stats[k] as any) = [...value];
        } else if (Array.isArray(stats[k])) {
          (stats[k] as any) = [...(stats[k] as any[]), ...value];
        }
      } else if (typeof value === 'number') {
        // Handle number properties - add them together
        if (stats[k] === undefined) {
          (stats[k] as any) = value;
        } else if (typeof stats[k] === 'number') {
          (stats[k] as any) = (stats[k] as number) + value;
        }
      }
    }
  }

  return stats;
}

