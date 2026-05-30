import React, { useState, useMemo } from 'react';
import { MOCK_PASSIVE_TREE } from '../../passives/mockPassiveTreeData';
import {
  PassiveTreeNode,
  optimizePassiveAllocation,
  aggregatePassiveNodes
} from '../../passives/passiveTreeOptimizer';

interface PassiveTreeOptimizerProps {
  skillElement: 'fire' | 'cold' | 'lightning' | 'chaos' | 'physical' | 'elemental' | 'generic';
  baseDamage: number;
  baseCastSpeed: number;
  baseCritChance: number;
  maxPoints?: number;
  onStatsChange?: (stats: any) => void;
}

const PassiveTreeOptimizerComponent: React.FC<PassiveTreeOptimizerProps> = ({
  skillElement,
  baseDamage,
  baseCastSpeed,
  baseCritChance,
  maxPoints = 120,
  onStatsChange
}) => {
  const [customMaxPoints, setCustomMaxPoints] = useState(maxPoints);
  const [showDetails, setShowDetails] = useState(false);
  const [manuallySelected, setManuallySelected] = useState<Set<string>>(new Set());
  const [optimizationMode, setOptimizationMode] = useState<'auto' | 'manual'>('auto');
  const [damageTypeFilter, setDamageTypeFilter] = useState<string>('all');

  // Filter nodes by damage type
  const filteredTreeNodes = useMemo(() => {
    if (damageTypeFilter === 'all') {
      return MOCK_PASSIVE_TREE;
    }
    return MOCK_PASSIVE_TREE.filter(node =>
      node.damageTypes && node.damageTypes.includes(damageTypeFilter as any)
    );
  }, [damageTypeFilter]);

  // Optimize passive allocation
  const optimizedNodes = useMemo(() => {
    if (optimizationMode === 'auto') {
      return optimizePassiveAllocation(
        filteredTreeNodes,
        customMaxPoints,
        skillElement,
        baseDamage,
        baseCastSpeed,
        baseCritChance
      );
    } else {
      // Manual mode: use manually selected nodes from filtered list
      return filteredTreeNodes.filter(node => manuallySelected.has(node.id));
    }
  }, [filteredTreeNodes, skillElement, baseDamage, baseCastSpeed, baseCritChance, customMaxPoints, optimizationMode, manuallySelected]);

  // Aggregate stats from optimized nodes
  const aggregatedStats = useMemo(() => {
    return aggregatePassiveNodes(optimizedNodes);
  }, [optimizedNodes]);

  // Notify parent component of stats change
  React.useEffect(() => {
    if (onStatsChange) {
      onStatsChange(aggregatedStats);
    }
  }, [aggregatedStats, onStatsChange]);

  // Group nodes by type for display
  const nodesByType = useMemo(() => {
    const groups: Record<string, PassiveTreeNode[]> = {
      keystone: [],
      notable: [],
      small: []
    };

    optimizedNodes.forEach(node => {
      groups[node.type].push(node);
    });

    return groups;
  }, [optimizedNodes]);

  // Calculate total stat values
  const statSummary = useMemo(() => {
    const summary: Record<string, number> = {};

    Object.entries(aggregatedStats).forEach(([key, value]) => {
      if (typeof value === 'number') {
        summary[key] = value;
      }
    });

    return summary;
  }, [aggregatedStats]);

  const toggleManualNode = (nodeId: string) => {
    const newSet = new Set(manuallySelected);
    if (newSet.has(nodeId)) {
      newSet.delete(nodeId);
    } else {
      if (newSet.size < customMaxPoints) {
        newSet.add(nodeId);
      }
    }
    setManuallySelected(newSet);
  };

  return (
    <div style={{
      background: '#1a1a1a',
      border: '1px solid #333',
      borderRadius: '4px',
      padding: '16px',
      marginTop: '16px'
    }}>
      <h2 style={{
        color: '#c58602',
        marginBottom: '16px',
        fontSize: '1.3rem',
        display: 'flex',
        alignItems: 'center',
        gap: '8px'
      }}>
        🌳 Passive Tree Optimizer
      </h2>

      {/* Controls */}
      <div style={{
        display: 'flex',
        gap: '16px',
        marginBottom: '16px',
        flexWrap: 'wrap',
        alignItems: 'center'
      }}>
        <div>
          <label style={{ color: '#888', marginRight: '8px' }}>Max Points:</label>
          <input
            type="number"
            min="1"
            max="200"
            value={customMaxPoints}
            onChange={(e) => setCustomMaxPoints(Math.max(1, Math.min(200, parseInt(e.target.value) || 120)))}
            style={{
              background: '#0d0d0d',
              border: '1px solid #333',
              color: '#fff',
              padding: '4px 8px',
              borderRadius: '4px',
              width: '80px'
            }}
          />
        </div>

        <div>
          <label style={{ color: '#888', marginRight: '8px' }}>Mode:</label>
          <select
            value={optimizationMode}
            onChange={(e) => setOptimizationMode(e.target.value as 'auto' | 'manual')}
            style={{
              background: '#0d0d0d',
              border: '1px solid #333',
              color: '#fff',
              padding: '4px 8px',
              borderRadius: '4px'
            }}
          >
            <option value="auto">Auto Optimize</option>
            <option value="manual">Manual Selection</option>
          </select>
        </div>

        <button
          onClick={() => setShowDetails(!showDetails)}
          style={{
            background: '#c58602',
            border: 'none',
            color: '#fff',
            padding: '6px 16px',
            borderRadius: '4px',
            cursor: 'pointer'
          }}
        >
          {showDetails ? 'Hide Details' : 'Show Details'}
        </button>

        {optimizationMode === 'manual' && (
          <button
            onClick={() => setManuallySelected(new Set())}
            style={{
              background: '#d32f2f',
              border: 'none',
              color: '#fff',
              padding: '6px 16px',
              borderRadius: '4px',
              cursor: 'pointer'
            }}
          >
            Clear Selection
          </button>
        )}
      </div>

      {/* Damage Type Filter */}
      <div style={{ marginBottom: '16px' }}>
        <label style={{ color: '#888', marginBottom: '8px', display: 'block', fontSize: '0.9rem' }}>
          Filter by Damage Type:
        </label>
        <div style={{
          display: 'flex',
          gap: '6px',
          flexWrap: 'wrap'
        }}>
          {[
            { value: 'all', label: 'All', color: '#666' },
            { value: 'spell', label: '✨ Spell', color: '#4fc3f7' },
            { value: 'physical', label: '⚔️ Physical', color: '#cccccc' },
            { value: 'fire', label: '🔥 Fire', color: '#ff6b6b' },
            { value: 'cold', label: '❄️ Cold', color: '#74c0fc' },
            { value: 'lightning', label: '⚡ Lightning', color: '#ffe066' },
            { value: 'chaos', label: '☠️ Chaos', color: '#d946ef' },
            { value: 'elemental', label: '🌟 Elemental', color: '#4fc3f7' },
            { value: 'critical', label: '💥 Critical', color: '#fbbf24' },
            { value: 'speed', label: '⚡ Speed', color: '#a78bfa' },
            { value: 'area', label: '🎯 Area', color: '#4fc3f7' },
            { value: 'projectile', label: '🏹 Projectile', color: '#4fc3f7' },
          ].map(filter => (
            <button
              key={filter.value}
              onClick={() => {
                setDamageTypeFilter(filter.value);
                if (optimizationMode === 'manual') {
                  setManuallySelected(new Set()); // Clear selection when changing filter
                }
              }}
              style={{
                padding: '6px 12px',
                background: damageTypeFilter === filter.value ? `${filter.color}33` : '#222',
                border: `1px solid ${damageTypeFilter === filter.value ? filter.color : '#444'}`,
                borderRadius: '4px',
                color: damageTypeFilter === filter.value ? filter.color : '#888',
                cursor: 'pointer',
                fontSize: '0.75rem',
                fontWeight: damageTypeFilter === filter.value ? 'bold' : 'normal',
                transition: 'all 0.2s'
              }}
            >
              {filter.label}
            </button>
          ))}
        </div>
        {damageTypeFilter !== 'all' && (
          <div style={{
            marginTop: '8px',
            fontSize: '0.75rem',
            color: '#888'
          }}>
            Showing {filteredTreeNodes.length} nodes with {damageTypeFilter} damage boost
          </div>
        )}
      </div>

      {/* Summary Stats */}
      <div style={{
        background: '#0d0d0d',
        padding: '12px',
        borderRadius: '4px',
        marginBottom: '16px'
      }}>
        <h3 style={{ color: '#c58602', marginBottom: '8px', fontSize: '1rem' }}>
          Allocated: {optimizedNodes.length} / {customMaxPoints} points
        </h3>

        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))',
          gap: '8px',
          fontSize: '0.9rem'
        }}>
          {statSummary.increasedSpellDamagePct && (
            <div style={{ color: '#fff' }}>
              ✨ Spell Damage: <strong style={{ color: '#4fc3f7' }}>+{statSummary.increasedSpellDamagePct}%</strong>
            </div>
          )}
          {statSummary.increasedElementalDamagePct && (
            <div style={{ color: '#fff' }}>
              🔥❄️⚡ Elemental Damage: <strong style={{ color: '#4fc3f7' }}>+{statSummary.increasedElementalDamagePct}%</strong>
            </div>
          )}
          {statSummary.increasedFireDamagePct && (
            <div style={{ color: '#fff' }}>
              🔥 Fire Damage: <strong style={{ color: '#ff6b6b' }}>+{statSummary.increasedFireDamagePct}%</strong>
            </div>
          )}
          {statSummary.increasedColdDamagePct && (
            <div style={{ color: '#fff' }}>
              ❄️ Cold Damage: <strong style={{ color: '#74c0fc' }}>+{statSummary.increasedColdDamagePct}%</strong>
            </div>
          )}
          {statSummary.increasedLightningDamagePct && (
            <div style={{ color: '#fff' }}>
              ⚡ Lightning Damage: <strong style={{ color: '#ffe066' }}>+{statSummary.increasedLightningDamagePct}%</strong>
            </div>
          )}
          {statSummary.increasedChaosDamagePct && (
            <div style={{ color: '#fff' }}>
              ☠️ Chaos Damage: <strong style={{ color: '#d946ef' }}>+{statSummary.increasedChaosDamagePct}%</strong>
            </div>
          )}
          {statSummary.increasedCastSpeedPct && (
            <div style={{ color: '#fff' }}>
              ⚡ Cast Speed: <strong style={{ color: '#a78bfa' }}>+{statSummary.increasedCastSpeedPct}%</strong>
            </div>
          )}
          {statSummary.increasedSpellCritChancePct && (
            <div style={{ color: '#fff' }}>
              🎯 Spell Crit Chance: <strong style={{ color: '#fbbf24' }}>+{statSummary.increasedSpellCritChancePct}%</strong>
            </div>
          )}
          {statSummary.increasedSpellCritMultiplierPct && (
            <div style={{ color: '#fff' }}>
              💥 Spell Crit Multi: <strong style={{ color: '#f87171' }}>+{statSummary.increasedSpellCritMultiplierPct}%</strong>
            </div>
          )}
          {statSummary.increasedAreaDamagePct && (
            <div style={{ color: '#fff' }}>
              🎯 Area Damage: <strong style={{ color: '#4fc3f7' }}>+{statSummary.increasedAreaDamagePct}%</strong>
            </div>
          )}
          {statSummary.increasedProjectileDamagePct && (
            <div style={{ color: '#fff' }}>
              🏹 Projectile Damage: <strong style={{ color: '#4fc3f7' }}>+{statSummary.increasedProjectileDamagePct}%</strong>
            </div>
          )}
        </div>
      </div>

      {/* Detailed Node List */}
      {showDetails && (
        <div style={{
          background: '#0d0d0d',
          padding: '12px',
          borderRadius: '4px',
          maxHeight: '600px',
          overflowY: 'auto'
        }}>
          {optimizationMode === 'manual' && (
            <div style={{ marginBottom: '16px' }}>
              <h3 style={{ color: '#c58602', marginBottom: '12px' }}>
                Available Nodes ({filteredTreeNodes.length})
              </h3>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                {filteredTreeNodes.map(node => (
                  <div
                    key={node.id}
                    onClick={() => toggleManualNode(node.id)}
                    style={{
                      padding: '8px',
                      background: manuallySelected.has(node.id) ? '#2a4a2a' : '#1a1a1a',
                      border: `1px solid ${manuallySelected.has(node.id) ? '#4caf50' : '#333'}`,
                      borderRadius: '4px',
                      cursor: 'pointer',
                      transition: 'all 0.2s'
                    }}
                  >
                    <div style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center'
                    }}>
                      <span style={{
                        color: node.type === 'keystone' ? '#ff6b6b' : node.type === 'notable' ? '#ffa500' : '#888',
                        fontWeight: node.type !== 'small' ? 'bold' : 'normal'
                      }}>
                        {manuallySelected.has(node.id) ? '✓ ' : ''}{node.name}
                      </span>
                      <span style={{
                        color: '#666',
                        fontSize: '0.85rem',
                        textTransform: 'capitalize'
                      }}>
                        {node.type}
                      </span>
                    </div>
                    <div style={{
                      color: '#aaa',
                      fontSize: '0.85rem',
                      marginTop: '4px',
                      whiteSpace: 'pre-line'
                    }}>
                      {node.description}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {optimizationMode === 'auto' && (
            <>
              {nodesByType.keystone.length > 0 && (
                <div style={{ marginBottom: '16px' }}>
                  <h3 style={{ color: '#ff6b6b', marginBottom: '8px' }}>Keystones ({nodesByType.keystone.length})</h3>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                    {nodesByType.keystone.map(node => (
                      <div key={node.id} style={{
                        padding: '8px',
                        background: '#1a1a1a',
                        border: '1px solid #ff6b6b',
                        borderRadius: '4px'
                      }}>
                        <div style={{ color: '#ff6b6b', fontWeight: 'bold' }}>{node.name}</div>
                        <div style={{ color: '#aaa', fontSize: '0.85rem', whiteSpace: 'pre-line' }}>
                          {node.description}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {nodesByType.notable.length > 0 && (
                <div style={{ marginBottom: '16px' }}>
                  <h3 style={{ color: '#ffa500', marginBottom: '8px' }}>Notables ({nodesByType.notable.length})</h3>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                    {nodesByType.notable.map(node => (
                      <div key={node.id} style={{
                        padding: '8px',
                        background: '#1a1a1a',
                        border: '1px solid #ffa500',
                        borderRadius: '4px'
                      }}>
                        <div style={{ color: '#ffa500', fontWeight: 'bold' }}>{node.name}</div>
                        <div style={{ color: '#aaa', fontSize: '0.85rem', whiteSpace: 'pre-line' }}>
                          {node.description}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {nodesByType.small.length > 0 && (
                <div>
                  <h3 style={{ color: '#888', marginBottom: '8px' }}>Small Passives ({nodesByType.small.length})</h3>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: '4px' }}>
                    {nodesByType.small.map(node => (
                      <div key={node.id} style={{
                        padding: '6px',
                        background: '#1a1a1a',
                        border: '1px solid #333',
                        borderRadius: '4px',
                        fontSize: '0.85rem'
                      }}>
                        <div style={{ color: '#888' }}>{node.name}</div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
};

export default PassiveTreeOptimizerComponent;

