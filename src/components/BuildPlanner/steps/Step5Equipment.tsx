import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { WeaponBase } from '../../../data/weapons';
import { Skill } from '../../../data/skills';
import { ItemMod, loadMods, getEquipmentMods, filterModsByType, getBestTierMod, MOD_CATEGORIES, canModCoexist } from '../../../data/mods';

// Equipment slot definitions
export const EQUIPMENT_SLOTS = [
  { id: 'helmet', name: 'Helmet', icon: '🪖' },
  { id: 'body_armour', name: 'Body Armour', icon: '🛡️' },
  { id: 'gloves', name: 'Gloves', icon: '🧤' },
  { id: 'boots', name: 'Boots', icon: '👢' },
  { id: 'belt', name: 'Belt', icon: '📿' },
  { id: 'amulet', name: 'Amulet', icon: '📿' },
  { id: 'ring1', name: 'Ring 1', icon: '💍' },
  { id: 'ring2', name: 'Ring 2', icon: '💍' },
] as const;

export interface GeneratedEquipment {
  slot: string;
  baseType: string;
  armorType?: string;
  prefixes: ItemMod[];
  suffixes: ItemMod[];
  totalStats: Record<string, number>;
}

interface Step5EquipmentProps {
  weapon: WeaponBase;
  skill: Skill;
  equipment: Record<string, GeneratedEquipment>;
  onEquipmentChange: (equipment: Record<string, GeneratedEquipment>) => void;
}

// Default base types for each slot - now with Int-based for casters
const getDefaultBaseTypes = (isSpell: boolean): Record<string, { name: string; armorType?: string }> => {
  const armorType = isSpell ? 'int_armour' : 'str_armour';
  return {
    helmet: { name: isSpell ? 'Hubris Circlet' : 'Elite Helmet', armorType },
    body_armour: { name: isSpell ? 'Vaal Regalia' : 'Full Plate', armorType },
    gloves: { name: isSpell ? 'Sorcerer Gloves' : 'Plate Gauntlets', armorType },
    boots: { name: isSpell ? 'Sorcerer Boots' : 'Plate Greaves', armorType },
    belt: { name: 'Heavy Belt' },
    amulet: { name: 'Gold Amulet' },
    ring1: { name: 'Gold Ring' },
    ring2: { name: 'Gold Ring' },
  };
};

// Max resistance cap in PoE2
const MAX_RESISTANCE = 75;

/**
 * Score a mod for equipment based on skill type and element
 */
function scoreEquipmentMod(mod: ItemMod, skill: Skill, currentResistances: Record<string, number>): number {
  const isSpell = skill.gemType === 'Spell';
  const skillElement = skill.element?.toLowerCase() || null;
  const statText = mod.statText.toLowerCase();
  const group = mod.group;

  let score = 0;

  // === DAMAGE MODS (highest priority for builds) ===

  // Spell damage mods for spell builds
  if (isSpell) {
    if (group.includes('SpellDamage') || statText.includes('spell damage')) {
      score += 25;
    }
    if (group.includes('CastSpeed') || statText.includes('cast speed')) {
      score += 20;
    }
    if (group.includes('SpellCritical') || statText.includes('spell critical')) {
      score += 18;
    }
    // Gem levels - extremely valuable
    if (statText.includes('level of') && statText.includes('spell')) {
      score += 30;
    }
  } else {
    // Attack damage mods for attack builds
    if (statText.includes('attack speed')) {
      score += 20;
    }
    if (statText.includes('physical damage') && !statText.includes('reflect')) {
      score += 22;
    }
    if (statText.includes('melee damage')) {
      score += 18;
    }
    if (statText.includes('weapon damage')) {
      score += 18;
    }
  }

  // Critical strike mods (global, for both)
  if (statText.includes('critical strike chance') && !statText.includes('spell') && !statText.includes('attack')) {
    score += 15;
  }
  if (statText.includes('critical strike multiplier') || statText.includes('critical damage')) {
    score += 15;
  }

  // Element-specific damage bonuses
  if (skillElement) {
    if (statText.includes(`${skillElement} damage`)) {
      score += 20;
    }
    // Elemental damage bonuses for elemental spells
    if (skillElement !== 'physical' && skillElement !== 'chaos' && statText.includes('elemental damage')) {
      score += 15;
    }
  }

  // Area damage for AoE skills
  if (skill.tags.includes('area') && statText.includes('area')) {
    score += 10;
  }

  // Projectile damage for projectile skills
  if (skill.tags.includes('projectile') && statText.includes('projectile')) {
    score += 10;
  }

  // === DEFENSIVE MODS ===

  // Life is always valuable
  if (group === MOD_CATEGORIES.LIFE || statText.includes('maximum life')) {
    score += 12;
  }

  // Energy Shield for Int builds
  if (isSpell && statText.includes('energy shield')) {
    score += 10;
  }

  // === RESISTANCE MODS - Only valuable up to 75% cap ===
  const resistanceValue = (mod.statMin + mod.statMax) / 2;

  if (group === MOD_CATEGORIES.FIRE_RESISTANCE || statText.includes('fire resistance')) {
    const currentFire = currentResistances['fire'] || 0;
    if (currentFire < MAX_RESISTANCE) {
      // Only score based on how much we need
      const needed = MAX_RESISTANCE - currentFire;
      score += Math.min(needed, resistanceValue) * 0.3;
    }
    // No score if already capped
  }
  if (group === MOD_CATEGORIES.COLD_RESISTANCE || statText.includes('cold resistance')) {
    const currentCold = currentResistances['cold'] || 0;
    if (currentCold < MAX_RESISTANCE) {
      const needed = MAX_RESISTANCE - currentCold;
      score += Math.min(needed, resistanceValue) * 0.3;
    }
  }
  if (group === MOD_CATEGORIES.LIGHTNING_RESISTANCE || statText.includes('lightning resistance')) {
    const currentLightning = currentResistances['lightning'] || 0;
    if (currentLightning < MAX_RESISTANCE) {
      const needed = MAX_RESISTANCE - currentLightning;
      score += Math.min(needed, resistanceValue) * 0.3;
    }
  }
  if (group === MOD_CATEGORIES.ALL_RESISTANCES || statText.includes('all elemental resistance')) {
    // All res counts toward all three
    const avgNeeded = ((MAX_RESISTANCE - (currentResistances['fire'] || 0)) +
                       (MAX_RESISTANCE - (currentResistances['cold'] || 0)) +
                       (MAX_RESISTANCE - (currentResistances['lightning'] || 0))) / 3;
    if (avgNeeded > 0) {
      score += Math.min(avgNeeded, resistanceValue) * 0.5;
    }
  }

  // === ATTRIBUTES ===
  if (statText.includes('intelligence') || statText.includes('to int')) {
    score += isSpell ? 5 : 2;
  }
  if (statText.includes('strength') || statText.includes('to str')) {
    score += isSpell ? 2 : 5;
  }
  if (statText.includes('dexterity') || statText.includes('to dex')) {
    score += 3;
  }
  if (statText.includes('all attributes')) {
    score += 6;
  }

  // === UTILITY ===
  if (statText.includes('movement speed')) {
    score += 8;
  }

  // Bonus for higher tier mods
  score += mod.level * 0.05;

  return score;
}

const Step5Equipment: React.FC<Step5EquipmentProps> = ({
  weapon,
  skill,
  equipment,
  onEquipmentChange,
}) => {
  const [allMods, setAllMods] = useState<ItemMod[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedSlot, setSelectedSlot] = useState<string>('helmet');
  const [itemLevel, setItemLevel] = useState(83);

  const isSpell = skill.gemType === 'Spell';
  const defaultBaseTypes = useMemo(() => getDefaultBaseTypes(isSpell), [isSpell]);

  // Load mods on mount
  useEffect(() => {
    async function loadData() {
      try {
        setLoading(true);
        const mods = await loadMods();
        setAllMods(mods);
      } catch (err) {
        console.error('Failed to load mods:', err);
        setError('Failed to load modifier data.');
      } finally {
        setLoading(false);
      }
    }
    loadData();
  }, []);

  // Generate optimal mods for a slot based on skill type and current resistances
  const generateSlotMods = useCallback((
    slot: string,
    armorType: string | undefined,
    currentResistances: Record<string, number>
  ): { prefixes: ItemMod[]; suffixes: ItemMod[] } => {
    const slotKey = slot.replace(/\d+$/, ''); // Remove number suffix for rings

    const availableMods = getEquipmentMods(allMods, slotKey, armorType, itemLevel);
    const prefixes = filterModsByType(availableMods, 'Prefix');
    const suffixes = filterModsByType(availableMods, 'Suffix');

    // Score all prefixes
    const scoredPrefixes = prefixes.map(mod => ({
      mod,
      score: scoreEquipmentMod(mod, skill, currentResistances),
    })).sort((a, b) => b.score - a.score);

    // Score all suffixes
    const scoredSuffixes = suffixes.map(mod => ({
      mod,
      score: scoreEquipmentMod(mod, skill, currentResistances),
    })).sort((a, b) => b.score - a.score);

    // Select best 3 prefixes (respecting group constraints)
    const selectedPrefixes: ItemMod[] = [];
    for (const scored of scoredPrefixes) {
      if (selectedPrefixes.length >= 3) break;
      if (!canModCoexist(scored.mod, selectedPrefixes)) continue;
      selectedPrefixes.push(scored.mod);
    }

    // Select best 3 suffixes (respecting group constraints)
    const selectedSuffixes: ItemMod[] = [];
    const allSelected = [...selectedPrefixes];
    for (const scored of scoredSuffixes) {
      if (selectedSuffixes.length >= 3) break;
      if (!canModCoexist(scored.mod, [...allSelected, ...selectedSuffixes])) continue;
      selectedSuffixes.push(scored.mod);
    }

    return { prefixes: selectedPrefixes, suffixes: selectedSuffixes };
  }, [allMods, itemLevel, skill]);

  // Extract resistance from mods
  const extractResistanceFromMods = (mods: ItemMod[]): Record<string, number> => {
    const resistances: Record<string, number> = { fire: 0, cold: 0, lightning: 0 };

    for (const mod of mods) {
      const statText = mod.statText.toLowerCase();
      const avgValue = (mod.statMin + mod.statMax) / 2;

      if (mod.group === MOD_CATEGORIES.FIRE_RESISTANCE || statText.includes('fire resistance')) {
        resistances.fire += avgValue;
      }
      if (mod.group === MOD_CATEGORIES.COLD_RESISTANCE || statText.includes('cold resistance')) {
        resistances.cold += avgValue;
      }
      if (mod.group === MOD_CATEGORIES.LIGHTNING_RESISTANCE || statText.includes('lightning resistance')) {
        resistances.lightning += avgValue;
      }
      if (mod.group === MOD_CATEGORIES.ALL_RESISTANCES || statText.includes('all elemental resistance')) {
        resistances.fire += avgValue;
        resistances.cold += avgValue;
        resistances.lightning += avgValue;
      }
    }

    return resistances;
  };

  // Generate all equipment on button click
  const handleGenerateAll = () => {
    const newEquipment: Record<string, GeneratedEquipment> = {};
    let currentResistances: Record<string, number> = { fire: 0, cold: 0, lightning: 0 };

    // Generate equipment for each slot, tracking resistances as we go
    for (const slot of EQUIPMENT_SLOTS) {
      const base = defaultBaseTypes[slot.id] || { name: 'Unknown' };
      const mods = generateSlotMods(slot.id, base.armorType, currentResistances);
      const allSlotMods = [...mods.prefixes, ...mods.suffixes];

      newEquipment[slot.id] = {
        slot: slot.id,
        baseType: base.name,
        armorType: base.armorType,
        prefixes: mods.prefixes,
        suffixes: mods.suffixes,
        totalStats: calculateTotalStats(allSlotMods),
      };

      // Update current resistances for next slot's scoring
      const slotResistances = extractResistanceFromMods(allSlotMods);
      currentResistances.fire = Math.min(MAX_RESISTANCE, currentResistances.fire + slotResistances.fire);
      currentResistances.cold = Math.min(MAX_RESISTANCE, currentResistances.cold + slotResistances.cold);
      currentResistances.lightning = Math.min(MAX_RESISTANCE, currentResistances.lightning + slotResistances.lightning);
    }

    onEquipmentChange(newEquipment);
  };

  // Calculate total stats from mods
  const calculateTotalStats = (mods: ItemMod[]): Record<string, number> => {
    const stats: Record<string, number> = {};

    for (const mod of mods) {
      const avgValue = (mod.statMin + mod.statMax) / 2;
      const key = mod.group.replace(/\d+$/, '');
      stats[key] = (stats[key] || 0) + avgValue;
    }

    return stats;
  };

  // Calculate total stats across all equipment
  const totalEquipmentStats = useMemo(() => {
    const totals: Record<string, number> = {};

    for (const item of Object.values(equipment)) {
      for (const [key, value] of Object.entries(item.totalStats)) {
        totals[key] = (totals[key] || 0) + value;
      }
    }

    return totals;
  }, [equipment]);

  const selectedItem = equipment[selectedSlot];

  if (loading) {
    return (
      <div style={{ padding: 40, textAlign: 'center', color: '#888' }}>
        Loading equipment data...
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
      {/* Left Panel - Equipment Slots */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 400 }}>
        <h2 style={{ margin: '0 0 16px 0', color: '#c58602' }}>
          Step 5: Equipment
        </h2>

        <div style={{ color: '#888', fontSize: '0.85rem', marginBottom: 16 }}>
          Generate rare equipment with optimal modifiers for your build
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

        {/* Generate All Button */}
        <button
          onClick={handleGenerateAll}
          style={{
            padding: '12px 24px',
            background: '#c58602',
            border: 'none',
            borderRadius: 4,
            color: '#fff',
            fontSize: '1rem',
            cursor: 'pointer',
            marginBottom: 16,
          }}
        >
          Generate All Equipment
        </button>

        {/* Equipment Slot Grid */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(4, 1fr)',
          gap: 12,
          marginBottom: 16,
        }}>
          {EQUIPMENT_SLOTS.map(slot => {
            const item = equipment[slot.id];
            const hasItem = item && (item.prefixes.length > 0 || item.suffixes.length > 0);

            return (
              <div
                key={slot.id}
                onClick={() => setSelectedSlot(slot.id)}
                style={{
                  padding: 12,
                  background: selectedSlot === slot.id ? '#2a2a2a' : '#1a1a1a',
                  border: `1px solid ${selectedSlot === slot.id ? '#c58602' : hasItem ? '#444' : '#333'}`,
                  borderRadius: 4,
                  cursor: 'pointer',
                  textAlign: 'center',
                }}
              >
                <div style={{ fontSize: '1.5rem', marginBottom: 4 }}>{slot.icon}</div>
                <div style={{
                  color: hasItem ? '#c58602' : '#888',
                  fontSize: '0.75rem',
                }}>
                  {slot.name}
                </div>
                {hasItem && (
                  <div style={{ color: '#2ECC71', fontSize: '0.65rem', marginTop: 4 }}>
                    {item.prefixes.length}P / {item.suffixes.length}S
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* Selected Slot Details */}
        {selectedItem && (
          <div style={{
            flex: 1,
            background: '#1a1a1a',
            border: '1px solid #333',
            borderRadius: 4,
            padding: 16,
            overflowY: 'auto',
          }}>
            <h4 style={{ margin: '0 0 12px 0', color: '#c58602' }}>
              {selectedItem.baseType}
            </h4>

            {/* Prefixes */}
            <div style={{ marginBottom: 16 }}>
              <div style={{ fontSize: '0.75rem', color: '#666', marginBottom: 8 }}>
                Prefixes ({selectedItem.prefixes.length}/3)
              </div>
              {selectedItem.prefixes.map(mod => (
                <div key={mod.id} style={{
                  padding: '6px 10px',
                  background: '#222',
                  borderRadius: 4,
                  marginBottom: 4,
                  borderLeft: '2px solid #8888ff',
                }}>
                  <div style={{ color: '#8888ff', fontSize: '0.8rem' }}>{mod.affix}</div>
                  <div style={{ color: '#fff', fontSize: '0.75rem' }}>{mod.statText}</div>
                </div>
              ))}
            </div>

            {/* Suffixes */}
            <div>
              <div style={{ fontSize: '0.75rem', color: '#666', marginBottom: 8 }}>
                Suffixes ({selectedItem.suffixes.length}/3)
              </div>
              {selectedItem.suffixes.map(mod => (
                <div key={mod.id} style={{
                  padding: '6px 10px',
                  background: '#222',
                  borderRadius: 4,
                  marginBottom: 4,
                  borderLeft: '2px solid #88ff88',
                }}>
                  <div style={{ color: '#88ff88', fontSize: '0.8rem' }}>{mod.affix}</div>
                  <div style={{ color: '#fff', fontSize: '0.75rem' }}>{mod.statText}</div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Right Panel - Total Stats */}
      <div style={{
        width: 320,
        background: '#1a1a1a',
        border: '1px solid #333',
        borderRadius: 4,
        padding: 20,
      }}>
        <h3 style={{ margin: '0 0 16px 0', color: '#c58602' }}>
          Equipment Summary
        </h3>

        <div style={{ marginBottom: 16 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
            <span style={{ color: '#888' }}>Slots Filled:</span>
            <span style={{ color: '#fff' }}>
              {Object.keys(equipment).length} / {EQUIPMENT_SLOTS.length}
            </span>
          </div>
          <div style={{
            height: 8,
            background: '#333',
            borderRadius: 4,
            overflow: 'hidden',
          }}>
            <div style={{
              height: '100%',
              width: `${(Object.keys(equipment).length / EQUIPMENT_SLOTS.length) * 100}%`,
              background: '#c58602',
              transition: 'width 0.2s',
            }} />
          </div>
        </div>

        {/* Total Stats */}
        <div style={{ borderTop: '1px solid #333', paddingTop: 16 }}>
          <div style={{ fontSize: '0.75rem', color: '#666', marginBottom: 12 }}>
            Total Stats from Equipment
          </div>

          {Object.keys(totalEquipmentStats).length === 0 ? (
            <div style={{ color: '#555', fontSize: '0.85rem', fontStyle: 'italic' }}>
              Generate equipment to see stats
            </div>
          ) : (
            <div style={{ maxHeight: 300, overflowY: 'auto' }}>
              {/* Life */}
              {totalEquipmentStats['IncreasedLife'] && (
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                  <span style={{ color: '#E74C3C', fontSize: '0.85rem' }}>Maximum Life:</span>
                  <span style={{ color: '#fff', fontSize: '0.85rem' }}>
                    +{Math.round(totalEquipmentStats['IncreasedLife'])}
                  </span>
                </div>
              )}

              {/* Resistances */}
              {totalEquipmentStats['FireResistance'] && (
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                  <span style={{ color: '#FF6B35', fontSize: '0.85rem' }}>Fire Resistance:</span>
                  <span style={{ color: '#fff', fontSize: '0.85rem' }}>
                    +{Math.round(totalEquipmentStats['FireResistance'])}%
                  </span>
                </div>
              )}
              {totalEquipmentStats['ColdResistance'] && (
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                  <span style={{ color: '#4FC3F7', fontSize: '0.85rem' }}>Cold Resistance:</span>
                  <span style={{ color: '#fff', fontSize: '0.85rem' }}>
                    +{Math.round(totalEquipmentStats['ColdResistance'])}%
                  </span>
                </div>
              )}
              {totalEquipmentStats['LightningResistance'] && (
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                  <span style={{ color: '#FFD54F', fontSize: '0.85rem' }}>Lightning Resistance:</span>
                  <span style={{ color: '#fff', fontSize: '0.85rem' }}>
                    +{Math.round(totalEquipmentStats['LightningResistance'])}%
                  </span>
                </div>
              )}

              {/* Attributes */}
              {totalEquipmentStats['Strength'] && (
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                  <span style={{ color: '#E74C3C', fontSize: '0.85rem' }}>Strength:</span>
                  <span style={{ color: '#fff', fontSize: '0.85rem' }}>
                    +{Math.round(totalEquipmentStats['Strength'])}
                  </span>
                </div>
              )}
              {totalEquipmentStats['Dexterity'] && (
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                  <span style={{ color: '#2ECC71', fontSize: '0.85rem' }}>Dexterity:</span>
                  <span style={{ color: '#fff', fontSize: '0.85rem' }}>
                    +{Math.round(totalEquipmentStats['Dexterity'])}
                  </span>
                </div>
              )}
              {totalEquipmentStats['Intelligence'] && (
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                  <span style={{ color: '#3498DB', fontSize: '0.85rem' }}>Intelligence:</span>
                  <span style={{ color: '#fff', fontSize: '0.85rem' }}>
                    +{Math.round(totalEquipmentStats['Intelligence'])}
                  </span>
                </div>
              )}

              {/* Other notable stats */}
              {Object.entries(totalEquipmentStats)
                .filter(([key]) => !['IncreasedLife', 'FireResistance', 'ColdResistance', 'LightningResistance', 'Strength', 'Dexterity', 'Intelligence'].includes(key))
                .map(([key, value]) => (
                  <div key={key} style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                    <span style={{ color: '#888', fontSize: '0.8rem' }}>
                      {key.replace(/([A-Z])/g, ' $1').trim()}:
                    </span>
                    <span style={{ color: '#aaa', fontSize: '0.8rem' }}>
                      +{Math.round(value)}
                    </span>
                  </div>
                ))
              }
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default Step5Equipment;
