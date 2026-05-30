import React, { useState, useEffect, useMemo } from 'react';
import { WeaponBase } from '../../../data/weapons';
import { Skill } from '../../../data/skills';
import { ItemMod } from '../../../data/mods';
import { fetchLuaFile, parseUniques } from '../../../data/pobParser';
import { PassiveNode, GeneratedItem } from '../../../hooks/useBuildState';

// Unique item interface
interface UniqueItem {
  id: string;
  name: string;
  baseType: string;
  slot: string;
  mods: string[];
  variant?: string;
  league?: string;
  source?: string;
  synergyScore: number;
  matchingTags: string[];
}

interface Step6UniquesProps {
  weapon: WeaponBase;
  skill: Skill;
  weaponMods: { prefixes: ItemMod[]; suffixes: ItemMod[] };
  passives: PassiveNode[];
  equipment: Record<string, GeneratedItem>;
  selectedUniques: UniqueItem[];
  onUniquesSelect: (uniques: UniqueItem[]) => void;
}

// Map file names to equipment slots
const UNIQUE_SLOT_MAP: Record<string, string> = {
  'amulet': 'amulet',
  'axe': 'weapon',
  'belt': 'belt',
  'body': 'body_armour',
  'boots': 'boots',
  'bow': 'weapon',
  'claw': 'weapon',
  'crossbow': 'weapon',
  'dagger': 'weapon',
  'flail': 'weapon',
  'gloves': 'gloves',
  'helmet': 'helmet',
  'jewel': 'jewel',
  'mace': 'weapon',
  'quiver': 'quiver',
  'ring': 'ring',
  'sceptre': 'weapon',
  'shield': 'shield',
  'spear': 'weapon',
  'staff': 'weapon',
  'sword': 'weapon',
  'wand': 'weapon',
};

// Slot categories for filtering
const SLOT_CATEGORIES = [
  { id: 'all', name: 'All Slots' },
  { id: 'weapon', name: 'Weapons' },
  { id: 'body_armour', name: 'Body Armour' },
  { id: 'helmet', name: 'Helmet' },
  { id: 'gloves', name: 'Gloves' },
  { id: 'boots', name: 'Boots' },
  { id: 'belt', name: 'Belt' },
  { id: 'amulet', name: 'Amulet' },
  { id: 'ring', name: 'Ring' },
];

// Parse a unique item text block
function parseUniqueItem(text: string, slot: string, fileSlot: string): UniqueItem | null {
  const lines = text.trim().split('\n').filter(l => l.trim());
  if (lines.length < 2) return null;

  const name = lines[0].trim();
  const baseType = lines[1].trim();

  // Extract mods (skip name, base type, variants, leagues, sources)
  const mods: string[] = [];
  let variant: string | undefined;
  let league: string | undefined;
  let source: string | undefined;

  for (let i = 2; i < lines.length; i++) {
    const line = lines[i].trim();

    if (line.startsWith('Variant:')) {
      variant = line.replace('Variant:', '').trim();
    } else if (line.startsWith('League:')) {
      league = line.replace('League:', '').trim();
    } else if (line.startsWith('Source:')) {
      source = line.replace('Source:', '').trim();
    } else if (line.startsWith('Implicits:')) {
      continue; // Skip implicit count
    } else if (!line.startsWith('{variant:')) {
      // Include non-variant lines as mods
      mods.push(line);
    } else if (line.includes('Current') || line.includes('variant:2}')) {
      // Include current variant mods
      const modText = line.replace(/\{variant:\d+\}/g, '').trim();
      if (modText) mods.push(modText);
    }
  }

  return {
    id: `${fileSlot}-${name.toLowerCase().replace(/\s+/g, '-')}`,
    name,
    baseType,
    slot,
    mods,
    variant,
    league,
    source,
    synergyScore: 0,
    matchingTags: [],
  };
}

// Calculate synergy score between a unique and the build
// Takes into account: weapon type, skill type/element/tags, passive stats, weapon mods, and equipment mods
function calculateSynergyScore(
  unique: UniqueItem,
  weapon: WeaponBase,
  skill: Skill,
  passives: PassiveNode[],
  weaponMods: { prefixes: ItemMod[]; suffixes: ItemMod[] },
  equipment: Record<string, GeneratedItem>
): { score: number; matchingTags: string[] } {
  let score = 0;
  const matchingTags: string[] = [];
  const modsText = unique.mods.join(' ').toLowerCase();

  const isSpell = skill.gemType === 'Spell';
  const isAttack = skill.gemType === 'Attack';
  const skillElement = skill.element?.toLowerCase() || '';

  // === SKILL TYPE SYNERGY (most important) ===

  // Spell builds - prioritize spell damage, cast speed, gem levels
  if (isSpell) {
    if (modsText.includes('spell damage')) {
      score += 20;
      matchingTags.push('Spell Damage');
    }
    if (modsText.includes('cast speed')) {
      score += 15;
      matchingTags.push('Cast Speed');
    }
    if (modsText.includes('level of') && (modsText.includes('spell') || modsText.includes('skill gem'))) {
      score += 25;
      matchingTags.push('Gem Levels');
    }
    if (modsText.includes('spell critical')) {
      score += 12;
      matchingTags.push('Spell Crit');
    }

    // Penalize attack-only stats for spell builds
    if (modsText.includes('attack speed') && !modsText.includes('cast speed')) {
      score -= 10;
    }
    if (modsText.includes('accuracy')) {
      score -= 8;
    }
    if (modsText.includes('melee damage') && !modsText.includes('spell')) {
      score -= 10;
    }
  }

  // Attack builds - prioritize attack speed, physical damage, accuracy
  if (isAttack) {
    if (modsText.includes('attack speed')) {
      score += 15;
      matchingTags.push('Attack Speed');
    }
    if (modsText.includes('physical damage') && !isSpell) {
      score += 15;
      matchingTags.push('Physical Damage');
    }
    if (modsText.includes('accuracy')) {
      score += 8;
      matchingTags.push('Accuracy');
    }
    if (modsText.includes('melee damage') && skill.tags.includes('melee')) {
      score += 12;
      matchingTags.push('Melee Damage');
    }
    if (modsText.includes('critical strike chance') || modsText.includes('critical strike multiplier')) {
      score += 10;
      matchingTags.push('Critical');
    }

    // Penalize spell-only stats for attack builds
    if (modsText.includes('spell damage') && !modsText.includes('physical')) {
      score -= 10;
    }
    if (modsText.includes('cast speed') && !modsText.includes('attack')) {
      score -= 8;
    }
  }

  // === ELEMENT SYNERGY ===
  if (skillElement) {
    // Direct element match
    if (modsText.includes(skillElement + ' damage') ||
        modsText.includes('to ' + skillElement) ||
        modsText.includes(skillElement + ' resistance penetration')) {
      score += 20;
      matchingTags.push(`${skill.element} Synergy`);
    }

    // Generic elemental damage for elemental skills
    if (['fire', 'cold', 'lightning'].includes(skillElement) && modsText.includes('elemental damage')) {
      score += 12;
      matchingTags.push('Elemental Damage');
    }

    // Physical spell synergy
    if (skillElement === 'physical' && isSpell) {
      if (modsText.includes('physical damage') && (modsText.includes('spell') || !modsText.includes('attack'))) {
        score += 18;
        matchingTags.push('Physical Spell');
      }
    }
  }

  // === SKILL TAG SYNERGY ===
  if (skill.tags.includes('melee') && modsText.includes('melee')) {
    score += 10;
    matchingTags.push('Melee');
  }
  if (skill.tags.includes('projectile') && modsText.includes('projectile')) {
    score += 10;
    matchingTags.push('Projectile');
  }
  if (skill.tags.includes('area') && (modsText.includes('area damage') || modsText.includes('area of effect'))) {
    score += 10;
    matchingTags.push('Area');
  }
  if (skill.tags.includes('duration') && modsText.includes('skill effect duration')) {
    score += 8;
    matchingTags.push('Duration');
  }
  if (skill.tags.includes('totem') && modsText.includes('totem')) {
    score += 15;
    matchingTags.push('Totem');
  }
  if (skill.tags.includes('minion') && modsText.includes('minion')) {
    score += 15;
    matchingTags.push('Minion');
  }

  // === WEAPON TYPE MATCH ===
  if (unique.slot === 'weapon') {
    const weaponCategory = weapon.type.toLowerCase();
    const weaponWord = weaponCategory.split(' ').pop() || '';
    if (unique.baseType.toLowerCase().includes(weaponWord)) {
      score += 25;
      matchingTags.push('Matching Weapon');
    }
  }

  // === PASSIVE SYNERGY ===
  // Check if unique amplifies stats we've invested in via passives
  const passiveStats = collectPassiveStats(passives);

  if (passiveStats.has('critical') && modsText.includes('critical')) {
    score += 8;
    if (!matchingTags.includes('Critical')) matchingTags.push('Crit Build');
  }
  if (passiveStats.has('life') && modsText.includes('maximum life')) {
    score += 5;
  }
  if (passiveStats.has('energy_shield') && modsText.includes('energy shield')) {
    score += 8;
    matchingTags.push('ES Build');
  }
  if (passiveStats.has('spell_damage') && modsText.includes('spell damage')) {
    score += 8;
  }
  if (passiveStats.has('attack_speed') && modsText.includes('attack speed')) {
    score += 5;
  }

  // === WEAPON MOD SYNERGY ===
  // Check if unique complements weapon mod focus
  const allWeaponMods = [...weaponMods.prefixes, ...weaponMods.suffixes];
  const weaponModText = allWeaponMods.map(m => m.statText?.toLowerCase() || '').join(' ');

  if (weaponModText.includes('critical') && modsText.includes('critical')) {
    score += 6;
  }
  if (weaponModText.includes('fire') && modsText.includes('fire')) {
    score += 8;
  }
  if (weaponModText.includes('cold') && modsText.includes('cold')) {
    score += 8;
  }
  if (weaponModText.includes('lightning') && modsText.includes('lightning')) {
    score += 8;
  }

  // === EQUIPMENT MOD SYNERGY ===
  // Check if unique fills gaps or amplifies equipment focus
  const equipmentModText = collectEquipmentModText(equipment);

  // If we've stacked a stat in equipment, uniques that add more are valuable
  if (equipmentModText.includes('spell damage') && modsText.includes('spell damage')) {
    score += 5;
  }
  if (equipmentModText.includes('attack speed') && modsText.includes('attack speed')) {
    score += 5;
  }

  // === DEFENSIVE STATS (secondary priority) ===
  if (modsText.includes('maximum life') || modsText.includes('to life')) {
    score += 5;
  }
  if (modsText.includes('resistance')) {
    score += 3;
  }

  // === UNIQUE MECHANICS (can be very powerful) ===
  if (modsText.includes('grants skill') || modsText.includes('trigger')) {
    score += 8;
    matchingTags.push('Special Mechanic');
  }
  if (modsText.includes('more damage')) {
    score += 12;
    matchingTags.push('More Damage');
  }
  if (modsText.includes('increased damage taken')) {
    score += 10;
    matchingTags.push('Enemy Debuff');
  }

  return { score, matchingTags };
}

// Helper: Collect stat categories invested in via passives
function collectPassiveStats(passives: PassiveNode[]): Set<string> {
  const stats = new Set<string>();

  for (const node of passives) {
    const statsText = Object.keys(node.stats || {}).join(' ').toLowerCase();

    if (statsText.includes('critical')) stats.add('critical');
    if (statsText.includes('life')) stats.add('life');
    if (statsText.includes('energy shield') || statsText.includes('es')) stats.add('energy_shield');
    if (statsText.includes('spell damage') || statsText.includes('spell_damage')) stats.add('spell_damage');
    if (statsText.includes('attack speed') || statsText.includes('attack_speed')) stats.add('attack_speed');
    if (statsText.includes('cast speed') || statsText.includes('cast_speed')) stats.add('cast_speed');
    if (statsText.includes('physical damage')) stats.add('physical');
    if (statsText.includes('fire damage')) stats.add('fire');
    if (statsText.includes('cold damage')) stats.add('cold');
    if (statsText.includes('lightning damage')) stats.add('lightning');
  }

  return stats;
}

// Helper: Collect all equipment mod text for synergy checking
function collectEquipmentModText(equipment: Record<string, GeneratedItem>): string {
  const texts: string[] = [];

  for (const item of Object.values(equipment)) {
    for (const mod of [...(item.prefixes || []), ...(item.suffixes || [])]) {
      if (mod.statText) {
        texts.push(mod.statText.toLowerCase());
      }
    }
  }

  return texts.join(' ');
}

const Step6Uniques: React.FC<Step6UniquesProps> = ({
  weapon,
  skill,
  weaponMods,
  passives,
  equipment,
  selectedUniques,
  onUniquesSelect,
}) => {
  const [allUniques, setAllUniques] = useState<UniqueItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [slotFilter, setSlotFilter] = useState('all');
  const [searchTerm, setSearchTerm] = useState('');

  // Load unique items on mount
  useEffect(() => {
    async function loadUniques() {
      try {
        setLoading(true);
        const uniques: UniqueItem[] = [];

        // Load from each unique file
        const files = [
          'amulet', 'axe', 'belt', 'body', 'boots', 'bow', 'claw',
          'crossbow', 'dagger', 'flail', 'gloves', 'helmet', 'mace',
          'quiver', 'ring', 'sceptre', 'shield', 'spear', 'staff', 'sword', 'wand'
        ];

        for (const file of files) {
          try {
            const content = await fetchLuaFile(`Uniques/${file}.lua`);
            const parsed = parseUniques(content);
            const slot = UNIQUE_SLOT_MAP[file] || file;

            for (const text of parsed) {
              const unique = parseUniqueItem(text, slot, file);
              if (unique) {
                // Calculate synergy score using all build choices
                const { score, matchingTags } = calculateSynergyScore(
                  unique,
                  weapon,
                  skill,
                  passives,
                  weaponMods,
                  equipment
                );
                unique.synergyScore = score;
                unique.matchingTags = matchingTags;
                uniques.push(unique);
              }
            }
          } catch (e) {
            console.warn(`Failed to load uniques from ${file}:`, e);
          }
        }

        // Sort by synergy score
        uniques.sort((a, b) => b.synergyScore - a.synergyScore);

        setAllUniques(uniques);
      } catch (err) {
        console.error('Failed to load uniques:', err);
        setError('Failed to load unique items. Make sure PoB files are accessible.');
      } finally {
        setLoading(false);
      }
    }

    loadUniques();
  }, [weapon, skill, passives, weaponMods, equipment]);

  // Filter uniques
  const filteredUniques = useMemo(() => {
    let result = allUniques;

    if (slotFilter !== 'all') {
      result = result.filter(u => u.slot === slotFilter);
    }

    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      result = result.filter(u =>
        u.name.toLowerCase().includes(term) ||
        u.baseType.toLowerCase().includes(term) ||
        u.mods.some(m => m.toLowerCase().includes(term))
      );
    }

    return result;
  }, [allUniques, slotFilter, searchTerm]);

  // Top recommendations
  const topRecommendations = useMemo(() => {
    return allUniques.filter(u => u.synergyScore > 15).slice(0, 5);
  }, [allUniques]);

  const handleToggleUnique = (unique: UniqueItem) => {
    const isSelected = selectedUniques.some(u => u.id === unique.id);

    if (isSelected) {
      onUniquesSelect(selectedUniques.filter(u => u.id !== unique.id));
    } else {
      onUniquesSelect([...selectedUniques, unique]);
    }
  };

  if (loading) {
    return (
      <div style={{ padding: 40, textAlign: 'center', color: '#888' }}>
        Loading unique items...
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
      {/* Left Panel - Unique Selection */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 400 }}>
        <h2 style={{ margin: '0 0 16px 0', color: '#c58602' }}>
          Step 6: Unique Items
        </h2>

        <div style={{ color: '#888', fontSize: '0.85rem', marginBottom: 16 }}>
          Discover unique items that synergize with {skill.name} and {weapon.name}
        </div>

        {/* Top Recommendations */}
        {topRecommendations.length > 0 && (
          <div style={{
            background: '#1a1a1a',
            border: '1px solid #c58602',
            borderRadius: 4,
            padding: 16,
            marginBottom: 16,
          }}>
            <h4 style={{ margin: '0 0 12px 0', color: '#c58602' }}>
              Top Recommendations
            </h4>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              {topRecommendations.map(unique => (
                <div
                  key={unique.id}
                  onClick={() => handleToggleUnique(unique)}
                  style={{
                    padding: '8px 12px',
                    background: selectedUniques.some(u => u.id === unique.id) ? '#c5860233' : '#222',
                    border: `1px solid ${selectedUniques.some(u => u.id === unique.id) ? '#c58602' : '#444'}`,
                    borderRadius: 4,
                    cursor: 'pointer',
                  }}
                >
                  <div style={{ color: '#AF6025', fontSize: '0.85rem', fontWeight: 'bold' }}>
                    {unique.name}
                  </div>
                  <div style={{ color: '#666', fontSize: '0.7rem' }}>
                    {unique.baseType}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Slot Filter */}
        <div style={{ display: 'flex', gap: 8, marginBottom: 16, flexWrap: 'wrap' }}>
          {SLOT_CATEGORIES.map(cat => (
            <button
              key={cat.id}
              onClick={() => setSlotFilter(cat.id)}
              style={{
                padding: '6px 12px',
                borderRadius: 4,
                border: slotFilter === cat.id ? '1px solid #c58602' : '1px solid #444',
                background: slotFilter === cat.id ? '#c5860222' : 'transparent',
                color: slotFilter === cat.id ? '#c58602' : '#888',
                fontSize: '0.75rem',
                cursor: 'pointer',
              }}
            >
              {cat.name}
            </button>
          ))}
        </div>

        {/* Search */}
        <input
          type="text"
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          placeholder="Search uniques..."
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

        {/* Unique List */}
        <div style={{
          flex: 1,
          overflowY: 'auto',
          border: '1px solid #333',
          borderRadius: 4,
          background: '#1a1a1a',
        }}>
          {filteredUniques.length === 0 ? (
            <div style={{ padding: 24, textAlign: 'center', color: '#666' }}>
              No uniques found
            </div>
          ) : (
            filteredUniques.map(unique => {
              const isSelected = selectedUniques.some(u => u.id === unique.id);

              return (
                <div
                  key={unique.id}
                  onClick={() => handleToggleUnique(unique)}
                  style={{
                    padding: '12px 16px',
                    borderBottom: '1px solid #333',
                    cursor: 'pointer',
                    background: isSelected ? '#c5860222' : 'transparent',
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                    <div>
                      <div style={{ color: '#AF6025', fontSize: '0.95rem', fontWeight: 'bold' }}>
                        {unique.name}
                      </div>
                      <div style={{ color: '#666', fontSize: '0.8rem' }}>
                        {unique.baseType} • {unique.slot}
                      </div>
                    </div>
                    <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                      {unique.synergyScore > 0 && (
                        <span style={{
                          padding: '2px 8px',
                          borderRadius: 4,
                          background: unique.synergyScore > 15 ? '#2ECC7122' : '#88888822',
                          color: unique.synergyScore > 15 ? '#2ECC71' : '#888',
                          fontSize: '0.7rem',
                        }}>
                          +{unique.synergyScore}
                        </span>
                      )}
                      {isSelected && <span style={{ color: '#c58602' }}>✓</span>}
                    </div>
                  </div>

                  {/* Matching tags */}
                  {unique.matchingTags.length > 0 && (
                    <div style={{ display: 'flex', gap: 4, marginTop: 6, flexWrap: 'wrap' }}>
                      {unique.matchingTags.map(tag => (
                        <span key={tag} style={{
                          padding: '2px 6px',
                          borderRadius: 3,
                          background: '#333',
                          color: '#2ECC71',
                          fontSize: '0.65rem',
                        }}>
                          {tag}
                        </span>
                      ))}
                    </div>
                  )}

                  {/* First few mods preview */}
                  <div style={{ color: '#888', fontSize: '0.75rem', marginTop: 6 }}>
                    {unique.mods.slice(0, 2).join(' • ')}
                    {unique.mods.length > 2 && '...'}
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* Right Panel - Selected Uniques */}
      <div style={{
        width: 320,
        background: '#1a1a1a',
        border: '1px solid #333',
        borderRadius: 4,
        padding: 20,
      }}>
        <h3 style={{ margin: '0 0 16px 0', color: '#c58602' }}>
          Selected Uniques ({selectedUniques.length})
        </h3>

        {selectedUniques.length === 0 ? (
          <div style={{ color: '#555', fontSize: '0.85rem', fontStyle: 'italic', textAlign: 'center', padding: 20 }}>
            Click on uniques to add them to your build
          </div>
        ) : (
          <div style={{ maxHeight: 400, overflowY: 'auto' }}>
            {selectedUniques.map(unique => (
              <div key={unique.id} style={{
                background: '#222',
                border: '1px solid #444',
                borderRadius: 4,
                padding: 12,
                marginBottom: 12,
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <div style={{ color: '#AF6025', fontSize: '0.9rem', fontWeight: 'bold' }}>
                    {unique.name}
                  </div>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleToggleUnique(unique);
                    }}
                    style={{
                      background: 'transparent',
                      border: 'none',
                      color: '#888',
                      cursor: 'pointer',
                      fontSize: '0.8rem',
                    }}
                  >
                    ✕
                  </button>
                </div>
                <div style={{ color: '#666', fontSize: '0.75rem', marginBottom: 8 }}>
                  {unique.baseType} • {unique.slot}
                </div>

                {/* Mods */}
                <div style={{ fontSize: '0.75rem' }}>
                  {unique.mods.slice(0, 4).map((mod, idx) => (
                    <div key={idx} style={{ color: '#8888ff', marginBottom: 2 }}>
                      {mod}
                    </div>
                  ))}
                  {unique.mods.length > 4 && (
                    <div style={{ color: '#666', fontStyle: 'italic' }}>
                      ...and {unique.mods.length - 4} more mods
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Total Synergy */}
        <div style={{ marginTop: 16, padding: 12, background: '#222', borderRadius: 4 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <span style={{ color: '#888' }}>Total Synergy:</span>
            <span style={{ color: '#2ECC71', fontWeight: 'bold', fontSize: '1.1rem' }}>
              +{selectedUniques.reduce((sum, u) => sum + u.synergyScore, 0)}
            </span>
          </div>
        </div>

        {/* Finish Button */}
        <div style={{ marginTop: 16, padding: 16, background: '#2a2a2a', borderRadius: 4, textAlign: 'center' }}>
          <div style={{ color: '#c58602', fontSize: '1.1rem', fontWeight: 'bold', marginBottom: 8 }}>
            Build Complete!
          </div>
          <div style={{ color: '#888', fontSize: '0.85rem' }}>
            Your PoE2 build is ready. Use the summary to refine your choices.
          </div>
        </div>
      </div>
    </div>
  );
};

export default Step6Uniques;
