import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { WeaponBase } from '../../../data/weapons';
import { Skill } from '../../../data/skills';
import { ItemMod } from '../../../data/mods';
import {
  PassiveTreeNode,
  PassiveTreeData,
  loadPassiveTree,
  getReachableNodes,
  canDeallocateNode,
  scorePassiveNode,
  aggregateNodeStats,
  findPathToNode,
  getPathCost,
} from '../../../data/passiveTree';
import PassiveTreeView from '../../PassiveTreeView/PassiveTreeView';

interface Step4PassivesProps {
  weapon: WeaponBase;
  skill: Skill;
  weaponMods: { prefixes: ItemMod[]; suffixes: ItemMod[] };
  passivePoints: number;
  selectedPassives: any[];
  onPassivePointsChange: (points: number) => void;
  onPassivesSelect: (passives: any[]) => void;
}

// Node type colors
const NODE_COLORS = {
  small: '#888',
  notable: '#FFD700',
  keystone: '#FF6B35',
  jewel: '#9B59B6',
  mastery: '#3498DB',
  classStart: '#2ECC71',
  ascendancyStart: '#E74C3C',
};

// Categories for filtering
const FILTER_CATEGORIES = [
  { id: 'all', name: 'All' },
  { id: 'relevant', name: 'Relevant' },
  { id: 'damage', name: 'Damage' },
  { id: 'speed', name: 'Speed' },
  { id: 'critical', name: 'Critical' },
  { id: 'elemental', name: 'Elemental' },
  { id: 'defense', name: 'Defense' },
];

const Step4Passives: React.FC<Step4PassivesProps> = ({
  weapon,
  skill,
  weaponMods,
  passivePoints,
  selectedPassives,
  onPassivePointsChange,
  onPassivesSelect,
}) => {
  const [treeData, setTreeData] = useState<PassiveTreeData | null>(null);
  const [loading, setLoading] = useState(true);
  const [allocatedIds, setAllocatedIds] = useState<Set<string>>(new Set());
  const [filterCategory, setFilterCategory] = useState('relevant');
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedClass, setSelectedClass] = useState<string>('Witch');
  const [showOnlyReachable, setShowOnlyReachable] = useState(true);

  // Load passive tree data
  useEffect(() => {
    async function loadData() {
      setLoading(true);
      try {
        const data = await loadPassiveTree();
        setTreeData(data);
      } catch (err) {
        console.error('Failed to load passive tree:', err);
      } finally {
        setLoading(false);
      }
    }
    loadData();
  }, []);

  // Get the start node for the selected class
  const startNodeId = useMemo(() => {
    if (!treeData) return 'start';
    const classData = treeData.classes.find(c => c.name === selectedClass);
    return classData?.startNodeId || 'start';
  }, [treeData, selectedClass]);

  // Get reachable nodes (nodes that can be selected based on current allocation)
  const reachableIds = useMemo(() => {
    if (!treeData) return new Set<string>();
    return getReachableNodes(treeData, allocatedIds, startNodeId);
  }, [treeData, allocatedIds, startNodeId]);

  // Score and sort all nodes
  const scoredNodes = useMemo(() => {
    if (!treeData) return [];

    const skillType = skill.gemType === 'Spell' ? 'spell' : 'attack';
    const skillElement = skill.element || null;

    const nodes: (PassiveTreeNode & { score: number; isAllocated: boolean; isReachable: boolean; pathCost: number })[] = [];

    const nodeEntries = Array.from(treeData.nodes.entries());
    for (let i = 0; i < nodeEntries.length; i++) {
      const [id, node] = nodeEntries[i];
      // Skip class start and ascendancy nodes for display
      if (node.type === 'classStart' || node.type === 'ascendancyStart') continue;
      if (!node.stats || node.stats.length === 0) continue;

      const score = scorePassiveNode(node, skillElement, skillType);
      const isAllocated = allocatedIds.has(id);
      const isReachable = reachableIds.has(id);
      // Calculate path cost - how many points needed to reach this node
      const pathCost = isAllocated ? 0 : (isReachable ? 1 : getPathCost(treeData, allocatedIds, id, startNodeId));

      nodes.push({
        ...node,
        score,
        isAllocated,
        isReachable,
        pathCost,
      });
    }

    // Sort by: allocated first, then by score (reachable nodes will naturally score well)
    return nodes.sort((a, b) => {
      if (a.isAllocated !== b.isAllocated) return a.isAllocated ? -1 : 1;
      // For non-allocated, sort by score/cost ratio (efficiency)
      if (!a.isAllocated && !b.isAllocated) {
        const aEfficiency = a.pathCost > 0 ? a.score / a.pathCost : a.score;
        const bEfficiency = b.pathCost > 0 ? b.score / b.pathCost : b.score;
        return bEfficiency - aEfficiency;
      }
      return b.score - a.score;
    });
  }, [treeData, allocatedIds, reachableIds, skill, startNodeId]);

  // Filter nodes based on category and search
  const filteredNodes = useMemo(() => {
    let result = scoredNodes;

    // Filter by reachability if enabled (but include nodes that have a valid path)
    if (showOnlyReachable) {
      result = result.filter(n => n.isReachable || n.isAllocated || n.pathCost > 0);
    }

    // Filter by category
    if (filterCategory !== 'all') {
      result = result.filter(node => {
        const statsText = node.stats.join(' ').toLowerCase();
        switch (filterCategory) {
          case 'relevant':
            // Only show nodes that have a positive score for this build
            return node.score > 0;
          case 'damage':
            return statsText.includes('damage');
          case 'speed':
            return statsText.includes('speed');
          case 'critical':
            return statsText.includes('critical');
          case 'elemental':
            return statsText.includes('fire') || statsText.includes('cold') ||
                   statsText.includes('lightning') || statsText.includes('elemental');
          case 'defense':
            return statsText.includes('life') || statsText.includes('armour') ||
                   statsText.includes('resistance') || statsText.includes('energy shield');
          default:
            return true;
        }
      });
    }

    // Filter by search term
    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      result = result.filter(n =>
        n.name.toLowerCase().includes(term) ||
        n.stats.some(s => s.toLowerCase().includes(term))
      );
    }

    return result;
  }, [scoredNodes, filterCategory, searchTerm, showOnlyReachable]);

  // Handle node selection/deselection
  const handleToggleNode = useCallback((node: PassiveTreeNode & { isReachable: boolean; pathCost: number }) => {
    if (!treeData) return;

    const isAllocated = allocatedIds.has(node.id);

    if (isAllocated) {
      // Try to deallocate
      if (canDeallocateNode(treeData, allocatedIds, node.id, startNodeId)) {
        const newAllocated = new Set(allocatedIds);
        newAllocated.delete(node.id);
        setAllocatedIds(newAllocated);

        // Update parent component
        const newPassives = Array.from(newAllocated)
          .map(id => treeData.nodes.get(id))
          .filter((n): n is PassiveTreeNode => n !== undefined && n.stats.length > 0);
        onPassivesSelect(newPassives);
      }
    } else {
      // Try to allocate - find path if not directly reachable
      const path = findPathToNode(treeData, allocatedIds, node.id, startNodeId);

      if (path && path.length > 0) {
        // Check if we have enough points for the entire path
        if (allocatedIds.size + path.length <= passivePoints) {
          const newAllocated = new Set(allocatedIds);
          // Add all nodes in the path
          for (const nodeId of path) {
            newAllocated.add(nodeId);
          }
          setAllocatedIds(newAllocated);

          // Update parent component
          const newPassives = Array.from(newAllocated)
            .map(id => treeData.nodes.get(id))
            .filter((n): n is PassiveTreeNode => n !== undefined && n.stats.length > 0);
          onPassivesSelect(newPassives);
        }
      } else if (node.isReachable && allocatedIds.size < passivePoints) {
        // Directly reachable node
        const newAllocated = new Set(allocatedIds);
        newAllocated.add(node.id);
        setAllocatedIds(newAllocated);

        // Update parent component
        const newPassives = Array.from(newAllocated)
          .map(id => treeData.nodes.get(id))
          .filter((n): n is PassiveTreeNode => n !== undefined && n.stats.length > 0);
        onPassivesSelect(newPassives);
      }
    }
  }, [treeData, allocatedIds, passivePoints, startNodeId, onPassivesSelect]);

  // Auto-optimize: use efficiency-based algorithm that considers path costs
  const handleAutoOptimize = useCallback(() => {
    if (!treeData) return;

    const skillType = skill.gemType === 'Spell' ? 'spell' : 'attack';
    const skillElement = skill.element || null;
    const newAllocated = new Set<string>();
    let remainingPoints = passivePoints;

    // Pre-score all nodes once
    const nodeScores = new Map<string, number>();
    const nodeEntries = Array.from(treeData.nodes.entries());
    for (let i = 0; i < nodeEntries.length; i++) {
      const [id, node] = nodeEntries[i];
      if (!node.stats || node.stats.length === 0) continue;
      if (node.type === 'classStart' || node.type === 'ascendancyStart') continue;
      const score = scorePassiveNode(node, skillElement, skillType);
      if (score > 0) {
        nodeScores.set(id, score);
      }
    }

    // Efficiency-based greedy algorithm
    // Consider ALL nodes with positive score, not just reachable ones
    // Calculate efficiency = score / pathCost for each target
    while (remainingPoints > 0) {
      let bestTarget: { nodeId: string; path: string[]; efficiency: number } | null = null;

      // Evaluate all unallocated scored nodes
      const scoreEntries = Array.from(nodeScores.entries());
      for (let i = 0; i < scoreEntries.length; i++) {
        const [nodeId, score] = scoreEntries[i];
        if (newAllocated.has(nodeId)) continue;

        // Find path to this node
        const path = findPathToNode(treeData, newAllocated, nodeId, startNodeId);
        if (!path || path.length === 0) continue;
        if (path.length > remainingPoints) continue;

        // Calculate efficiency: total score of path / cost
        // Include scores of intermediate nodes in the path
        let pathScore = 0;
        for (const pathNodeId of path) {
          pathScore += nodeScores.get(pathNodeId) || 0;
        }

        // Efficiency = total score gained / points spent
        const efficiency = pathScore / path.length;

        // Prefer higher efficiency, but also give bonus to shorter paths
        // to avoid getting stuck on long paths to mediocre nodes
        const adjustedEfficiency = efficiency * (1 + 0.1 / path.length);

        if (!bestTarget || adjustedEfficiency > bestTarget.efficiency) {
          bestTarget = { nodeId, path, efficiency: adjustedEfficiency };
        }
      }

      if (bestTarget && bestTarget.efficiency > 0) {
        // Allocate all nodes in the path
        for (const nodeId of bestTarget.path) {
          newAllocated.add(nodeId);
          remainingPoints--;
        }
      } else {
        // No more efficient paths available, try direct reachable nodes
        const reachable = getReachableNodes(treeData, newAllocated, startNodeId);
        let bestReachable: PassiveTreeNode | null = null;
        let bestScore = 0;

        const reachableArr = Array.from(reachable);
        for (let i = 0; i < reachableArr.length; i++) {
          const nodeId = reachableArr[i];
          if (newAllocated.has(nodeId)) continue;
          const score = nodeScores.get(nodeId) || 0;
          if (score > bestScore) {
            bestScore = score;
            const node = treeData.nodes.get(nodeId);
            if (node) bestReachable = node;
          }
        }

        if (bestReachable && bestScore > 0) {
          newAllocated.add(bestReachable.id);
          remainingPoints--;
        } else {
          break;
        }
      }
    }

    setAllocatedIds(newAllocated);

    // Update parent
    const newPassives = Array.from(newAllocated)
      .map(id => treeData.nodes.get(id))
      .filter((n): n is PassiveTreeNode => n !== undefined && n.stats.length > 0);
    onPassivesSelect(newPassives);
  }, [treeData, passivePoints, startNodeId, skill, onPassivesSelect]);

  // Clear all allocations
  const handleClearAll = useCallback(() => {
    setAllocatedIds(new Set());
    onPassivesSelect([]);
  }, [onPassivesSelect]);

  // Calculate aggregated stats
  const aggregatedStats = useMemo(() => {
    if (!treeData) return {};

    const allocatedNodes = Array.from(allocatedIds)
      .map(id => treeData.nodes.get(id))
      .filter((n): n is PassiveTreeNode => n !== undefined);

    return aggregateNodeStats(allocatedNodes);
  }, [treeData, allocatedIds]);

  // Calculate total score
  const totalScore = useMemo(() => {
    return scoredNodes
      .filter(n => n.isAllocated)
      .reduce((sum, n) => sum + n.score, 0);
  }, [scoredNodes]);

  if (loading) {
    return (
      <div style={{ padding: 40, textAlign: 'center', color: '#888' }}>
        Loading passive tree...
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', gap: 24, height: '100%' }}>
      {/* Left Panel - Passive Selection */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 450 }}>
        <h2 style={{ margin: '0 0 16px 0', color: '#c58602' }}>
          Step 4: Passive Skills
        </h2>

        <div style={{ color: '#888', fontSize: '0.85rem', marginBottom: 12 }}>
          Optimizing for <span style={{ color: skill.gemType === 'Spell' ? '#9B59B6' : '#E67E22', fontWeight: 'bold' }}>
            {skill.gemType === 'Spell' ? 'Spell' : 'Attack'}
          </span> build: {skill.name} {skill.element ? `(${skill.element})` : ''} with {weapon.name}.
          <br />
          <span style={{ color: '#c58602' }}>
            Passives must be connected. Use "Relevant" filter to show only {skill.gemType === 'Spell' ? 'spell' : 'attack'} passives.
          </span>
        </div>

        {/* Class Selection */}
        <div style={{ marginBottom: 12 }}>
          <label style={{ color: '#888', fontSize: '0.85rem', marginRight: 8 }}>Class:</label>
          <select
            value={selectedClass}
            onChange={(e) => {
              setSelectedClass(e.target.value);
              handleClearAll();
            }}
            style={{
              padding: '6px 12px',
              background: '#222',
              border: '1px solid #444',
              borderRadius: 4,
              color: '#fff',
            }}
          >
            {['Warrior', 'Witch', 'Ranger', 'Mercenary', 'Sorceress', 'Huntress', 'Monk', 'Druid'].map(name => (
              <option key={name} value={name}>{name}</option>
            ))}
          </select>
        </div>

        {/* Points Slider */}
        <div style={{ marginBottom: 16 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
            <label style={{ color: '#888', fontSize: '0.85rem' }}>
              Passive Points: {passivePoints}
            </label>
            <span style={{ color: allocatedIds.size >= passivePoints ? '#e74c3c' : '#2ECC71', fontSize: '0.85rem' }}>
              Using {allocatedIds.size} / {passivePoints}
            </span>
          </div>
          <input
            type="range"
            min={1}
            max={122}
            value={passivePoints}
            onChange={(e) => onPassivePointsChange(parseInt(e.target.value))}
            style={{ width: '100%' }}
          />
        </div>

        {/* Action Buttons */}
        <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
          <button
            onClick={handleAutoOptimize}
            style={{
              flex: 1,
              padding: '10px 16px',
              background: '#c58602',
              border: 'none',
              borderRadius: 4,
              color: '#fff',
              fontSize: '0.9rem',
              cursor: 'pointer',
            }}
          >
            Auto-Optimize
          </button>
          <button
            onClick={handleClearAll}
            style={{
              padding: '10px 16px',
              background: 'transparent',
              border: '1px solid #666',
              borderRadius: 4,
              color: '#888',
              fontSize: '0.9rem',
              cursor: 'pointer',
            }}
          >
            Clear All
          </button>
        </div>


        {/* Visual passive tree */}
        <div style={{
          flex: 1,
          minHeight: 480,
          border: '1px solid #333',
          borderRadius: 4,
          background: '#0a0a0e',
          overflow: 'hidden',
          position: 'relative',
        }}>
          <PassiveTreeView
            className={selectedClass}
            allocatedIds={allocatedIds}
            onAllocatedChange={(next) => {
              setAllocatedIds(next);
              if (!treeData) return;
              const newPassives = Array.from(next)
                .map(id => treeData.nodes.get(id))
                .filter((n): n is PassiveTreeNode => n !== undefined && n.stats.length > 0);
              onPassivesSelect(newPassives);
            }}
            pointsAvailable={passivePoints}
          />
        </div>
      </div>

      {/* Right Panel - Summary */}
      <div style={{
        width: 320,
        background: '#1a1a1a',
        border: '1px solid #333',
        borderRadius: 4,
        padding: 20,
        display: 'flex',
        flexDirection: 'column',
      }}>
        <h3 style={{ margin: '0 0 16px 0', color: '#c58602' }}>
          Passive Summary
        </h3>

        {/* Points Progress */}
        <div style={{ marginBottom: 16 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
            <span style={{ color: '#888' }}>Points Used:</span>
            <span style={{ color: '#fff' }}>{allocatedIds.size} / {passivePoints}</span>
          </div>
          <div style={{
            height: 8,
            background: '#333',
            borderRadius: 4,
            overflow: 'hidden',
          }}>
            <div style={{
              height: '100%',
              width: `${Math.min((allocatedIds.size / passivePoints) * 100, 100)}%`,
              background: allocatedIds.size >= passivePoints ? '#e74c3c' : '#c58602',
              transition: 'width 0.2s',
            }} />
          </div>
        </div>

        {/* Node Type Breakdown */}
        <div style={{ marginBottom: 16 }}>
          <div style={{ fontSize: '0.75rem', color: '#666', marginBottom: 8 }}>Node Types</div>
          <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
            {(['small', 'notable', 'keystone'] as const).map(type => {
              const count = scoredNodes.filter(n => n.isAllocated && n.type === type).length;
              return (
                <div key={type}>
                  <span style={{ color: NODE_COLORS[type], fontSize: '0.85rem', textTransform: 'capitalize' }}>
                    {type}:
                  </span>
                  <span style={{ color: '#aaa', marginLeft: 4 }}>{count}</span>
                </div>
              );
            })}
          </div>
        </div>

        {/* Aggregated Stats */}
        <div style={{ flex: 1, overflowY: 'auto' }}>
          <div style={{ fontSize: '0.75rem', color: '#666', marginBottom: 8 }}>Total Bonuses</div>
          {Object.entries(aggregatedStats).length === 0 ? (
            <div style={{ color: '#555', fontSize: '0.85rem', fontStyle: 'italic' }}>
              No passives allocated
            </div>
          ) : (
            Object.entries(aggregatedStats)
              .sort((a, b) => b[1] - a[1])
              .slice(0, 15)
              .map(([stat, value]) => (
                <div key={stat} style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  marginBottom: 4,
                  fontSize: '0.85rem',
                }}>
                  <span style={{ color: '#888' }}>{stat}:</span>
                  <span style={{ color: '#2ECC71' }}>+{value}%</span>
                </div>
              ))
          )}
          {Object.entries(aggregatedStats).length > 15 && (
            <div style={{ color: '#666', fontSize: '0.75rem', marginTop: 8 }}>
              ...and {Object.entries(aggregatedStats).length - 15} more bonuses
            </div>
          )}
        </div>

        {/* Total Score */}
        <div style={{ marginTop: 16, padding: 12, background: '#222', borderRadius: 4 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <span style={{ color: '#888' }}>Total DPS Score:</span>
            <span style={{ color: '#2ECC71', fontWeight: 'bold', fontSize: '1.1rem' }}>
              +{totalScore.toFixed(1)}
            </span>
          </div>
        </div>

        {/* Connection Info */}
        <div style={{ marginTop: 12, padding: 10, background: '#1c1c1c', borderRadius: 4, border: '1px solid #333' }}>
          <div style={{ fontSize: '0.75rem', color: '#666', marginBottom: 4 }}>How it works</div>
          <div style={{ fontSize: '0.75rem', color: '#888', lineHeight: 1.4 }}>
            Click any node to allocate it. If not directly connected, the shortest path will be auto-allocated.
            <br /><br />
            <span style={{ color: '#3498DB' }}>Blue "X pts"</span> = travel nodes needed to reach.
            <span style={{ color: '#e74c3c' }}> Red</span> = not enough points.
          </div>
        </div>
      </div>
    </div>
  );
};

export default Step4Passives;
