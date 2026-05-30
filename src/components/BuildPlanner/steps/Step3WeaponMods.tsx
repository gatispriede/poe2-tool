import React, { useState, useEffect, useMemo } from 'react';
import { WeaponBase } from '../../../data/weapons';
import { Skill } from '../../../data/skills';
import { ItemMod, loadMods, canModCoexist } from '../../../data/mods';
import {
  getOptimalWeaponMods,
  getAvailableModOptions,
  calculateWeaponDpsWithMods,
  formatModStatText,
  OptimizedMods,
} from '../../../services/modOptimizer';

interface Step3WeaponModsProps {
  weapon: WeaponBase;
  skill: Skill;
  selectedMods: { prefixes: ItemMod[]; suffixes: ItemMod[] };
  onModsSelect: (mods: { prefixes: ItemMod[]; suffixes: ItemMod[] }) => void;
}

const Step3WeaponMods: React.FC<Step3WeaponModsProps> = ({
  weapon,
  skill,
  selectedMods,
  onModsSelect,
}) => {
  const [allMods, setAllMods] = useState<ItemMod[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [mode, setMode] = useState<'auto' | 'manual'>('auto');
  const [itemLevel, setItemLevel] = useState(83);

  // Load mods on mount
  useEffect(() => {
    async function loadData() {
      try {
        setLoading(true);
        const mods = await loadMods();
        setAllMods(mods);
      } catch (err) {
        console.error('Failed to load mods:', err);
        setError('Failed to load modifier data. Make sure the PoB files are accessible.');
      } finally {
        setLoading(false);
      }
    }
    loadData();
  }, []);

  // Auto-generate optimal mods
  const optimizedMods = useMemo(() => {
    if (allMods.length === 0) return null;
    return getOptimalWeaponMods(allMods, weapon, skill, itemLevel);
  }, [allMods, weapon, skill, itemLevel]);

  // Get all available options for manual selection
  const availableOptions = useMemo(() => {
    if (allMods.length === 0) return { prefixes: [], suffixes: [] };
    return getAvailableModOptions(allMods, weapon.type, itemLevel);
  }, [allMods, weapon.type, itemLevel]);

  // Apply optimized mods when in auto mode and data is loaded
  useEffect(() => {
    if (mode === 'auto' && optimizedMods && selectedMods.prefixes.length === 0) {
      onModsSelect({
        prefixes: optimizedMods.prefixes,
        suffixes: optimizedMods.suffixes,
      });
    }
  }, [mode, optimizedMods, selectedMods.prefixes.length, onModsSelect]);

  // Calculate DPS with current mods
  const dpsCalc = useMemo(() => {
    const allSelected = [...selectedMods.prefixes, ...selectedMods.suffixes];
    return calculateWeaponDpsWithMods(weapon, allSelected);
  }, [weapon, selectedMods]);

  const handlePrefixToggle = (mod: ItemMod) => {
    const isSelected = selectedMods.prefixes.some(p => p.id === mod.id);

    if (isSelected) {
      onModsSelect({
        ...selectedMods,
        prefixes: selectedMods.prefixes.filter(p => p.id !== mod.id),
      });
    } else if (selectedMods.prefixes.length < 3) {
      // Check for mutual exclusion conflicts (same group, elemental gem exclusions, etc.)
      const allCurrentMods = [...selectedMods.prefixes, ...selectedMods.suffixes];
      if (canModCoexist(mod, allCurrentMods)) {
        onModsSelect({
          ...selectedMods,
          prefixes: [...selectedMods.prefixes, mod],
        });
      }
    }
  };

  const handleSuffixToggle = (mod: ItemMod) => {
    const isSelected = selectedMods.suffixes.some(s => s.id === mod.id);

    if (isSelected) {
      onModsSelect({
        ...selectedMods,
        suffixes: selectedMods.suffixes.filter(s => s.id !== mod.id),
      });
    } else if (selectedMods.suffixes.length < 3) {
      // Check for mutual exclusion conflicts (same group, elemental gem exclusions, etc.)
      const allCurrentMods = [...selectedMods.prefixes, ...selectedMods.suffixes];
      if (canModCoexist(mod, allCurrentMods)) {
        onModsSelect({
          ...selectedMods,
          suffixes: [...selectedMods.suffixes, mod],
        });
      }
    }
  };

  const handleApplyOptimal = () => {
    if (optimizedMods) {
      onModsSelect({
        prefixes: optimizedMods.prefixes,
        suffixes: optimizedMods.suffixes,
      });
    }
  };

  if (loading) {
    return (
      <div style={{ padding: 40, textAlign: 'center', color: '#888' }}>
        Loading modifiers...
      </div>
    );
  }

  if (error) {
    return (
      <div style={{ padding: 40, textAlign: 'center', color: '#e74c3c' }}>
        {error}
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', gap: 24, height: '100%' }}>
      {/* Left Panel - Mod Selection */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 400 }}>
        <h2 style={{ margin: '0 0 16px 0', color: '#c58602' }}>
          Step 3: Weapon Mods
        </h2>

        <div style={{ color: '#888', fontSize: '0.85rem', marginBottom: 16 }}>
          Generate optimal prefixes and suffixes for {weapon.name} with {skill.name}
        </div>

        {/* Mode Toggle */}
        <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
          <button
            onClick={() => setMode('auto')}
            style={{
              padding: '8px 16px',
              borderRadius: 4,
              border: mode === 'auto' ? '1px solid #c58602' : '1px solid #444',
              background: mode === 'auto' ? '#c5860222' : 'transparent',
              color: mode === 'auto' ? '#c58602' : '#888',
              cursor: 'pointer',
            }}
          >
            Auto-Optimize
          </button>
          <button
            onClick={() => setMode('manual')}
            style={{
              padding: '8px 16px',
              borderRadius: 4,
              border: mode === 'manual' ? '1px solid #c58602' : '1px solid #444',
              background: mode === 'manual' ? '#c5860222' : 'transparent',
              color: mode === 'manual' ? '#c58602' : '#888',
              cursor: 'pointer',
            }}
          >
            Manual Selection
          </button>
        </div>

        {/* Item Level Slider */}
        <div style={{ marginBottom: 16 }}>
          <label style={{ color: '#888', fontSize: '0.85rem' }}>
            Item Level: {itemLevel}
          </label>
          <input
            type="range"
            min={1}
            max={100}
            value={itemLevel}
            onChange={(e) => setItemLevel(parseInt(e.target.value))}
            style={{ width: '100%', marginTop: 4 }}
          />
        </div>

        {mode === 'auto' ? (
          <AutoModeContent
            optimizedMods={optimizedMods}
            onApply={handleApplyOptimal}
          />
        ) : (
          <ManualModeContent
            availableOptions={availableOptions}
            selectedMods={selectedMods}
            onPrefixToggle={handlePrefixToggle}
            onSuffixToggle={handleSuffixToggle}
          />
        )}
      </div>

      {/* Right Panel - Weapon Preview */}
      <div style={{
        width: 320,
        background: '#1a1a1a',
        border: '1px solid #333',
        borderRadius: 4,
        padding: 20,
      }}>
        <h3 style={{ margin: '0 0 16px 0', color: '#c58602' }}>
          Modified {weapon.name}
        </h3>

        {/* Base Stats */}
        <div style={{ marginBottom: 16 }}>
          <div style={{ fontSize: '0.75rem', color: '#666', marginBottom: 8 }}>Base Stats</div>
          <div style={{ color: '#888', fontSize: '0.85rem' }}>
            Physical: {weapon.physicalMin}-{weapon.physicalMax}
          </div>
          <div style={{ color: '#888', fontSize: '0.85rem' }}>
            Attack Speed: {weapon.attackRate.toFixed(2)}
          </div>
          <div style={{ color: '#888', fontSize: '0.85rem' }}>
            Crit Chance: {weapon.critChance.toFixed(1)}%
          </div>
        </div>

        {/* Selected Prefixes */}
        <div style={{ marginBottom: 16 }}>
          <div style={{ fontSize: '0.75rem', color: '#666', marginBottom: 8 }}>
            Prefixes ({selectedMods.prefixes.length}/3)
          </div>
          {selectedMods.prefixes.length === 0 ? (
            <div style={{ color: '#555', fontSize: '0.85rem', fontStyle: 'italic' }}>
              No prefixes selected
            </div>
          ) : (
            selectedMods.prefixes.map(mod => (
              <div key={mod.id} style={{ color: '#8888ff', fontSize: '0.85rem', marginBottom: 4 }}>
                {formatModStatText(mod)}
              </div>
            ))
          )}
        </div>

        {/* Selected Suffixes */}
        <div style={{ marginBottom: 16 }}>
          <div style={{ fontSize: '0.75rem', color: '#666', marginBottom: 8 }}>
            Suffixes ({selectedMods.suffixes.length}/3)
          </div>
          {selectedMods.suffixes.length === 0 ? (
            <div style={{ color: '#555', fontSize: '0.85rem', fontStyle: 'italic' }}>
              No suffixes selected
            </div>
          ) : (
            selectedMods.suffixes.map(mod => (
              <div key={mod.id} style={{ color: '#88ff88', fontSize: '0.85rem', marginBottom: 4 }}>
                {formatModStatText(mod)}
              </div>
            ))
          )}
        </div>

        {/* DPS Calculation */}
        <div style={{ borderTop: '1px solid #333', paddingTop: 16 }}>
          <div style={{ fontSize: '0.75rem', color: '#666', marginBottom: 8 }}>DPS Estimate</div>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
            <span style={{ color: '#888' }}>Base DPS:</span>
            <span style={{ color: '#aaa' }}>{dpsCalc.baseDps.toFixed(1)}</span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
            <span style={{ color: '#888' }}>Modified DPS:</span>
            <span style={{ color: '#2ECC71', fontWeight: 'bold' }}>{dpsCalc.modifiedDps.toFixed(1)}</span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <span style={{ color: '#888' }}>Increase:</span>
            <span style={{ color: dpsCalc.increase > 0 ? '#2ECC71' : '#888' }}>
              +{dpsCalc.increase.toFixed(1)}%
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};

// Auto-optimize mode content
const AutoModeContent: React.FC<{
  optimizedMods: OptimizedMods | null;
  onApply: () => void;
}> = ({ optimizedMods, onApply }) => {
  if (!optimizedMods) {
    return (
      <div style={{ color: '#888', padding: 20, textAlign: 'center' }}>
        Loading optimization...
      </div>
    );
  }

  return (
    <div style={{ flex: 1, overflowY: 'auto' }}>
      <div style={{
        background: '#1a1a1a',
        border: '1px solid #333',
        borderRadius: 4,
        padding: 16,
        marginBottom: 16,
      }}>
        <h4 style={{ margin: '0 0 12px 0', color: '#c58602' }}>
          Recommended Prefixes
        </h4>
        {optimizedMods.prefixes.map(mod => (
          <div key={mod.id} style={{
            padding: '8px 12px',
            background: '#222',
            borderRadius: 4,
            marginBottom: 8,
            borderLeft: '3px solid #8888ff',
          }}>
            <div style={{ color: '#8888ff', fontSize: '0.9rem' }}>
              {mod.affix}
            </div>
            <div style={{ color: '#fff', fontSize: '0.85rem' }}>
              {formatModStatText(mod)}
            </div>
            <div style={{ color: '#666', fontSize: '0.75rem' }}>
              Requires level {mod.level}
            </div>
          </div>
        ))}
      </div>

      <div style={{
        background: '#1a1a1a',
        border: '1px solid #333',
        borderRadius: 4,
        padding: 16,
        marginBottom: 16,
      }}>
        <h4 style={{ margin: '0 0 12px 0', color: '#c58602' }}>
          Recommended Suffixes
        </h4>
        {optimizedMods.suffixes.map(mod => (
          <div key={mod.id} style={{
            padding: '8px 12px',
            background: '#222',
            borderRadius: 4,
            marginBottom: 8,
            borderLeft: '3px solid #88ff88',
          }}>
            <div style={{ color: '#88ff88', fontSize: '0.9rem' }}>
              {mod.affix}
            </div>
            <div style={{ color: '#fff', fontSize: '0.85rem' }}>
              {formatModStatText(mod)}
            </div>
            <div style={{ color: '#666', fontSize: '0.75rem' }}>
              Requires level {mod.level}
            </div>
          </div>
        ))}
      </div>

      <button
        onClick={onApply}
        style={{
          width: '100%',
          padding: '12px 24px',
          background: '#c58602',
          border: 'none',
          borderRadius: 4,
          color: '#fff',
          fontSize: '1rem',
          cursor: 'pointer',
        }}
      >
        Apply Optimal Mods
      </button>
    </div>
  );
};

// Manual selection mode content
const ManualModeContent: React.FC<{
  availableOptions: { prefixes: ItemMod[]; suffixes: ItemMod[] };
  selectedMods: { prefixes: ItemMod[]; suffixes: ItemMod[] };
  onPrefixToggle: (mod: ItemMod) => void;
  onSuffixToggle: (mod: ItemMod) => void;
}> = ({ availableOptions, selectedMods, onPrefixToggle, onSuffixToggle }) => {
  const [filter, setFilter] = useState('');

  const filteredPrefixes = availableOptions.prefixes.filter(mod =>
    mod.affix.toLowerCase().includes(filter.toLowerCase()) ||
    mod.statText.toLowerCase().includes(filter.toLowerCase())
  );

  const filteredSuffixes = availableOptions.suffixes.filter(mod =>
    mod.affix.toLowerCase().includes(filter.toLowerCase()) ||
    mod.statText.toLowerCase().includes(filter.toLowerCase())
  );

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
      <input
        type="text"
        value={filter}
        onChange={(e) => setFilter(e.target.value)}
        placeholder="Filter mods..."
        style={{
          width: '100%',
          padding: '10px 12px',
          background: '#222',
          border: '1px solid #444',
          borderRadius: 4,
          color: '#fff',
          fontSize: '0.95rem',
          marginBottom: 16,
        }}
      />

      <div style={{ flex: 1, overflowY: 'auto', display: 'flex', gap: 16 }}>
        {/* Prefixes Column */}
        <div style={{ flex: 1 }}>
          <h4 style={{ margin: '0 0 8px 0', color: '#8888ff' }}>
            Prefixes ({selectedMods.prefixes.length}/3)
          </h4>
          <div style={{
            border: '1px solid #333',
            borderRadius: 4,
            background: '#1a1a1a',
            maxHeight: 400,
            overflowY: 'auto',
          }}>
            {filteredPrefixes.map(mod => {
              const isSelected = selectedMods.prefixes.some(p => p.id === mod.id);
              // Check for all mutual exclusion conflicts (same group, elemental gem exclusions, etc.)
              const allCurrentMods = [...selectedMods.prefixes, ...selectedMods.suffixes];
              const hasConflict = !isSelected && !canModCoexist(mod, allCurrentMods);

              return (
                <div
                  key={mod.id}
                  onClick={() => !hasConflict && onPrefixToggle(mod)}
                  style={{
                    padding: '10px 12px',
                    borderBottom: '1px solid #333',
                    cursor: hasConflict ? 'not-allowed' : 'pointer',
                    background: isSelected ? '#8888ff22' : 'transparent',
                    opacity: hasConflict ? 0.5 : 1,
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ color: isSelected ? '#8888ff' : '#aaa', fontSize: '0.85rem' }}>
                      {mod.affix}
                    </span>
                    {isSelected && <span style={{ color: '#8888ff' }}>✓</span>}
                  </div>
                  <div style={{ color: '#fff', fontSize: '0.8rem' }}>
                    {formatModStatText(mod)}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Suffixes Column */}
        <div style={{ flex: 1 }}>
          <h4 style={{ margin: '0 0 8px 0', color: '#88ff88' }}>
            Suffixes ({selectedMods.suffixes.length}/3)
          </h4>
          <div style={{
            border: '1px solid #333',
            borderRadius: 4,
            background: '#1a1a1a',
            maxHeight: 400,
            overflowY: 'auto',
          }}>
            {filteredSuffixes.map(mod => {
              const isSelected = selectedMods.suffixes.some(s => s.id === mod.id);
              // Check for all mutual exclusion conflicts (same group, elemental gem exclusions, etc.)
              const allCurrentMods = [...selectedMods.prefixes, ...selectedMods.suffixes];
              const hasConflict = !isSelected && !canModCoexist(mod, allCurrentMods);

              return (
                <div
                  key={mod.id}
                  onClick={() => !hasConflict && onSuffixToggle(mod)}
                  style={{
                    padding: '10px 12px',
                    borderBottom: '1px solid #333',
                    cursor: hasConflict ? 'not-allowed' : 'pointer',
                    background: isSelected ? '#88ff8822' : 'transparent',
                    opacity: hasConflict ? 0.5 : 1,
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ color: isSelected ? '#88ff88' : '#aaa', fontSize: '0.85rem' }}>
                      {mod.affix}
                    </span>
                    {isSelected && <span style={{ color: '#88ff88' }}>✓</span>}
                  </div>
                  <div style={{ color: '#fff', fontSize: '0.8rem' }}>
                    {formatModStatText(mod)}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
};

export default Step3WeaponMods;
