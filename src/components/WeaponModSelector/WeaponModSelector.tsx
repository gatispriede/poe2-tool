import React, { useState, useEffect } from 'react';

export interface WeaponMod {
  id: string;
  name: string;
  description: string;
  type: 'prefix' | 'suffix';
  tier: number;
  effects: Record<string, { min: number; max: number }>;
  itemLevelReq: number;
}

export interface WeaponModsData {
  prefixes: WeaponMod[];
  suffixes: WeaponMod[];
}

export interface SelectedMod {
  mod: WeaponMod;
  rolledValues: Record<string, number>; // The actual rolled values within the range
}

interface WeaponModSelectorProps {
  onModsChange: (prefixes: SelectedMod[], suffixes: SelectedMod[]) => void;
  weaponItemLevel?: number; // Filter mods by weapon item level
}

const WeaponModSelector: React.FC<WeaponModSelectorProps> = ({ onModsChange, weaponItemLevel = 100 }) => {
  const [modsData, setModsData] = useState<WeaponModsData>({ prefixes: [], suffixes: [] });
  const [selectedPrefixes, setSelectedPrefixes] = useState<SelectedMod[]>([]);
  const [selectedSuffixes, setSelectedSuffixes] = useState<SelectedMod[]>([]);

  useEffect(() => {
    // Load weapon mods data from multiple sources
    Promise.all([
      import('../../data/WeaponMods.json').then(mod => (mod as any).default || (mod as any)).catch(() => ({ prefixes: [], suffixes: [] })),
      import('../../data/QuarterstaffMods.json').then(mod => (mod as any).default || (mod as any)).catch(() => ({ prefixes: [], suffixes: [] }))
    ]).then(([weaponMods, quarterstaffMods]) => {
      // Merge all mods together
      const allPrefixes = [...weaponMods.prefixes, ...quarterstaffMods.prefixes];
      const allSuffixes = [...weaponMods.suffixes, ...quarterstaffMods.suffixes];

      // Remove duplicates by id
      const uniquePrefixes = allPrefixes.filter((mod, index, self) =>
        index === self.findIndex(m => m.id === mod.id)
      );
      const uniqueSuffixes = allSuffixes.filter((mod, index, self) =>
        index === self.findIndex(m => m.id === mod.id)
      );

      setModsData({
        prefixes: uniquePrefixes,
        suffixes: uniqueSuffixes
      });
    }).catch(() => {
      console.warn('Could not load weapon mods data');
      setModsData({ prefixes: [], suffixes: [] });
    });
  }, []);

  useEffect(() => {
    onModsChange(selectedPrefixes, selectedSuffixes);
  }, [selectedPrefixes, selectedSuffixes, onModsChange]);

  const rollModValues = (mod: WeaponMod): Record<string, number> => {
    const rolledValues: Record<string, number> = {};
    Object.entries(mod.effects).forEach(([effect, range]) => {
      // Roll a random value within the range (or use average for consistent testing)
      const value = Math.floor((range.min + range.max) / 2); // Using average for consistency
      rolledValues[effect] = value;
    });
    return rolledValues;
  };

  const getAvailableMods = (type: 'prefix' | 'suffix') => {
    const mods = type === 'prefix' ? modsData.prefixes : modsData.suffixes;
    const selected = type === 'prefix' ? selectedPrefixes : selectedSuffixes;
    
    return mods.filter(mod => 
      mod.itemLevelReq <= weaponItemLevel && 
      !selected.some(selected => selected.mod.id === mod.id)
    );
  };

  const addMod = (type: 'prefix' | 'suffix', modId: string) => {
    const mods = type === 'prefix' ? modsData.prefixes : modsData.suffixes;
    const selected = type === 'prefix' ? selectedPrefixes : selectedSuffixes;
    const setSelected = type === 'prefix' ? setSelectedPrefixes : setSelectedSuffixes;
    const maxMods = 3;

    if (selected.length >= maxMods) return;

    const mod = mods.find(m => m.id === modId);
    if (!mod) return;

    const newSelectedMod: SelectedMod = {
      mod,
      rolledValues: rollModValues(mod)
    };

    setSelected(prev => [...prev, newSelectedMod]);
  };

  const removeMod = (type: 'prefix' | 'suffix', index: number) => {
    const setSelected = type === 'prefix' ? setSelectedPrefixes : setSelectedSuffixes;
    setSelected(prev => prev.filter((_, i) => i !== index));
  };

  const rerollMod = (type: 'prefix' | 'suffix', index: number) => {
    const selected = type === 'prefix' ? selectedPrefixes : selectedSuffixes;
    const setSelected = type === 'prefix' ? setSelectedPrefixes : setSelectedSuffixes;
    
    const modToReroll = selected[index];
    if (!modToReroll) return;

    const rerolledMod: SelectedMod = {
      ...modToReroll,
      rolledValues: rollModValues(modToReroll.mod)
    };

    setSelected(prev => prev.map((mod, i) => i === index ? rerolledMod : mod));
  };

  const getModTypeColor = (type: 'prefix' | 'suffix'): string => {
    return type === 'prefix' ? '#4CAF50' : '#2196F3';
  };

  const formatEffectValue = (effect: string, value: number): string => {
    if (effect.includes('Pct')) {
      return `${value}%`;
    }
    return value.toString();
  };

  const renderModSection = (type: 'prefix' | 'suffix') => {
    const selected = type === 'prefix' ? selectedPrefixes : selectedSuffixes;
    const available = getAvailableMods(type);
    const canAddMore = selected.length < 3;

    return (
      <div style={{ marginBottom: '1rem' }}>
        <h4 style={{ 
          margin: '0 0 8px 0', 
          color: getModTypeColor(type),
          textTransform: 'capitalize'
        }}>
          {type}es ({selected.length}/3)
        </h4>

        {/* Selected Mods */}
        {selected.map((selectedMod, index) => (
          <div key={index} style={{
            background: '#1a1a1a',
            padding: '8px',
            marginBottom: '4px',
            borderRadius: 4,
            border: `1px solid ${getModTypeColor(type)}33`
          }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
              <strong style={{ color: getModTypeColor(type), fontSize: '0.8rem' }}>
                {selectedMod.mod.name}
              </strong>
              <div style={{ display: 'flex', gap: 4 }}>
                <button 
                  onClick={() => rerollMod(type, index)}
                  style={{ 
                    padding: '2px 6px', 
                    fontSize: '0.7rem',
                    background: '#333',
                    border: 'none',
                    color: '#fff',
                    borderRadius: 3,
                    cursor: 'pointer'
                  }}
                >
                  Reroll
                </button>
                <button 
                  onClick={() => removeMod(type, index)}
                  style={{ 
                    padding: '2px 6px', 
                    fontSize: '0.7rem',
                    background: '#f44336',
                    border: 'none',
                    color: '#fff',
                    borderRadius: 3,
                    cursor: 'pointer'
                  }}
                >
                  ✕
                </button>
              </div>
            </div>
            <div style={{ fontSize: '0.7rem', color: '#ccc', marginBottom: 4 }}>
              {selectedMod.mod.description}
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
              {Object.entries(selectedMod.rolledValues).map(([effect, value]) => (
                <span key={effect} style={{
                  fontSize: '0.6rem',
                  background: '#2a2a2a',
                  padding: '2px 4px',
                  borderRadius: 3,
                  color: '#4CAF50'
                }}>
                  {effect.replace(/([A-Z])/g, ' $1').toLowerCase()}: {formatEffectValue(effect, value)}
                </span>
              ))}
            </div>
          </div>
        ))}

        {/* Add New Mod */}
        {canAddMore && available.length > 0 && (
          <select
            onChange={(e) => {
              if (e.target.value) {
                addMod(type, e.target.value);
                e.target.value = '';
              }
            }}
            style={{
              width: '100%',
              padding: '4px',
              background: '#222',
              color: '#fff',
              border: '1px solid #444',
              borderRadius: 4,
              fontSize: '0.8rem'
            }}
          >
            <option value="">-- Add {type} --</option>
            {available.map(mod => (
              <option key={mod.id} value={mod.id}>
                {mod.name} (T{mod.tier}, Lvl {mod.itemLevelReq})
              </option>
            ))}
          </select>
        )}

        {!canAddMore && (
          <div style={{ fontSize: '0.7rem', color: '#888', fontStyle: 'italic' }}>
            Maximum {type}es reached (3/3)
          </div>
        )}
      </div>
    );
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      <h3 style={{ margin: 0, fontSize: '1rem' }}>Weapon Modifiers</h3>
      <div style={{ fontSize: '0.8rem', color: '#aaa', marginBottom: 8 }}>
        Add up to 3 prefixes and 3 suffixes to your weapon. Item level {weaponItemLevel} required.
      </div>
      
      {renderModSection('prefix')}
      {renderModSection('suffix')}

      {(selectedPrefixes.length > 0 || selectedSuffixes.length > 0) && (
        <button
          onClick={() => {
            setSelectedPrefixes([]);
            setSelectedSuffixes([]);
          }}
          style={{
            padding: '6px 12px',
            background: '#f44336',
            border: 'none',
            color: '#fff',
            borderRadius: 4,
            cursor: 'pointer',
            fontSize: '0.8rem'
          }}
        >
          Clear All Mods
        </button>
      )}
    </div>
  );
};

export default WeaponModSelector;
