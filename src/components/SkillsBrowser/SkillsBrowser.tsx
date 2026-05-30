import React, { useState, useEffect, useMemo } from 'react';

interface BaseDamageData {
  baseMultiplier?: number;
  baseMultiplierLvl20?: number;
  critChance?: number;
  critChanceLvl20?: number;
  attackSpeedMultiplier?: number;
  attackSpeedMultiplierLvl20?: number;
  incrementalEffectiveness?: number;
  levels?: Array<{
    level: number;
    levelRequirement: number | null;
    baseMultiplier: number | null;
    critChance: number | null;
    attackSpeedMultiplier: number | null;
    manaCost: number | null;
  }>;
}

interface Skill {
  id: string;
  name: string;
  description: string;
  fullDescription?: string; // Detailed description from PoB2
  castTime?: number; // Cast time in seconds
  gemType: string;
  type: string;
  element: string | null;
  tags: string[];
  tagString: string;
  weaponRequirements: string | null;
  requirements: {
    str: number;
    dex: number;
    int: number;
  };
  tier: number;
  moreDamageMultipliersPct: number[];
  moreAttackSpeedMultipliersPct: number[];
  source?: string;
  baseDamageData?: BaseDamageData;
  estimatedBaseDamageLvl1?: number;
  estimatedBaseDamageLvl20?: number;
}

// Tooltip component for skill descriptions
interface TooltipProps {
  skill: Skill;
  position: { x: number; y: number };
}

const SkillTooltip: React.FC<TooltipProps> = ({ skill, position }) => {
  const getElementColor = (element: string | null): string => {
    if (!element) return '#888';
    switch (element.toLowerCase()) {
      case 'fire': return '#FF6B35';
      case 'cold': return '#4FC3F7';
      case 'lightning': return '#FFD54F';
      case 'chaos': return '#8E44AD';
      case 'physical': return '#FFFFFF';
      default: return '#888';
    }
  };

  return (
    <div
      style={{
        position: 'fixed',
        left: position.x + 15,
        top: position.y + 10,
        maxWidth: 400,
        background: 'linear-gradient(135deg, #1a1a2e 0%, #16213e 100%)',
        border: '1px solid #c58602',
        borderRadius: 8,
        padding: 16,
        zIndex: 10000,
        boxShadow: '0 8px 32px rgba(0, 0, 0, 0.5)',
        pointerEvents: 'none'
      }}
    >
      {/* Header */}
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'flex-start',
        marginBottom: 12,
        paddingBottom: 8,
        borderBottom: '1px solid #333'
      }}>
        <div>
          <div style={{ color: '#c58602', fontWeight: 'bold', fontSize: '1.1rem' }}>
            {skill.name}
          </div>
          <div style={{ display: 'flex', gap: 8, marginTop: 4 }}>
            <span style={{
              fontSize: '0.75rem',
              color: '#888',
              background: '#222',
              padding: '2px 6px',
              borderRadius: 3
            }}>
              {skill.gemType || skill.type}
            </span>
            {skill.element && (
              <span style={{
                fontSize: '0.75rem',
                color: getElementColor(skill.element),
                background: '#222',
                padding: '2px 6px',
                borderRadius: 3
              }}>
                {skill.element}
              </span>
            )}
          </div>
        </div>
        {skill.castTime && (
          <div style={{
            textAlign: 'right',
            fontSize: '0.8rem',
            color: '#888'
          }}>
            <div style={{ color: '#aaa' }}>Cast Time</div>
            <div style={{ color: '#fff' }}>{skill.castTime}s</div>
          </div>
        )}
      </div>

      {/* Full Description */}
      {skill.fullDescription ? (
        <div style={{
          fontSize: '0.85rem',
          color: '#ddd',
          lineHeight: 1.5,
          marginBottom: 12
        }}>
          {skill.fullDescription}
        </div>
      ) : (
        <div style={{
          fontSize: '0.85rem',
          color: '#888',
          fontStyle: 'italic',
          marginBottom: 12
        }}>
          {skill.description || 'No description available'}
        </div>
      )}

      {/* Tags */}
      {skill.tagString && (
        <div style={{
          fontSize: '0.75rem',
          color: '#666',
          marginBottom: 8
        }}>
          <span style={{ color: '#888' }}>Tags: </span>
          {skill.tagString}
        </div>
      )}

      {/* Stats Row */}
      <div style={{
        display: 'flex',
        gap: 16,
        flexWrap: 'wrap',
        paddingTop: 8,
        borderTop: '1px solid #333'
      }}>
        {skill.moreDamageMultipliersPct?.length > 0 && (
          <div style={{ fontSize: '0.8rem' }}>
            <span style={{ color: '#4CAF50' }}>More Damage: </span>
            <span style={{ color: '#fff' }}>+{skill.moreDamageMultipliersPct.join(', ')}%</span>
          </div>
        )}
        {skill.moreAttackSpeedMultipliersPct?.length > 0 && (
          <div style={{ fontSize: '0.8rem' }}>
            <span style={{ color: '#2196F3' }}>Attack Speed: </span>
            <span style={{ color: '#fff' }}>{skill.moreAttackSpeedMultipliersPct.join(', ')}%</span>
          </div>
        )}
      </div>

      {/* Base Damage Section */}
      {skill.baseDamageData && (skill.baseDamageData.baseMultiplier || skill.baseDamageData.critChance) && (
        <div style={{
          marginTop: 8,
          paddingTop: 8,
          borderTop: '1px solid #333'
        }}>
          <div style={{ fontSize: '0.75rem', color: '#c58602', marginBottom: 4, fontWeight: 'bold' }}>
            Base Damage Stats
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, fontSize: '0.75rem' }}>
            {skill.baseDamageData.baseMultiplier && (
              <div>
                <span style={{ color: '#888' }}>Dmg% (Lvl 1): </span>
                <span style={{ color: '#FF9800' }}>{(skill.baseDamageData.baseMultiplier * 100).toFixed(0)}%</span>
              </div>
            )}
            {skill.baseDamageData.baseMultiplierLvl20 && (
              <div>
                <span style={{ color: '#888' }}>Dmg% (Lvl 20): </span>
                <span style={{ color: '#FF9800', fontWeight: 'bold' }}>{(skill.baseDamageData.baseMultiplierLvl20 * 100).toFixed(0)}%</span>
              </div>
            )}
            {skill.baseDamageData.critChance && (
              <div>
                <span style={{ color: '#888' }}>Crit Chance: </span>
                <span style={{ color: '#E91E63' }}>{skill.baseDamageData.critChance}%</span>
              </div>
            )}
            {skill.baseDamageData.attackSpeedMultiplier && (
              <div>
                <span style={{ color: '#888' }}>Atk Speed: </span>
                <span style={{ color: skill.baseDamageData.attackSpeedMultiplier >= 0 ? '#4CAF50' : '#F44336' }}>
                  {skill.baseDamageData.attackSpeedMultiplier > 0 ? '+' : ''}{skill.baseDamageData.attackSpeedMultiplier}%
                </span>
              </div>
            )}
          </div>
          {skill.estimatedBaseDamageLvl20 && (
            <div style={{ marginTop: 6, fontSize: '0.7rem', color: '#666' }}>
              Est. damage with 100 base weapon: <span style={{ color: '#fff' }}>{skill.estimatedBaseDamageLvl20}</span>
            </div>
          )}
        </div>
      )}

      {/* Weapon Requirements */}
      {skill.weaponRequirements && (
        <div style={{
          marginTop: 8,
          fontSize: '0.75rem',
          color: '#FF9800'
        }}>
          Requires: {skill.weaponRequirements}
        </div>
      )}

      {/* Attribute Requirements */}
      {skill.requirements && (skill.requirements.str > 0 || skill.requirements.dex > 0 || skill.requirements.int > 0) && (
        <div style={{
          marginTop: 8,
          fontSize: '0.75rem',
          color: '#666'
        }}>
          Attributes:
          {skill.requirements.str > 0 && <span style={{ color: '#E74C3C', marginLeft: 8 }}>{skill.requirements.str} Str</span>}
          {skill.requirements.dex > 0 && <span style={{ color: '#2ECC71', marginLeft: 8 }}>{skill.requirements.dex} Dex</span>}
          {skill.requirements.int > 0 && <span style={{ color: '#3498DB', marginLeft: 8 }}>{skill.requirements.int} Int</span>}
        </div>
      )}
    </div>
  );
};

type SortField = 'name' | 'gemType' | 'element' | 'damage' | 'baseDamage' | 'tier' | 'weapon';
type SortDirection = 'asc' | 'desc';

const SkillsBrowser: React.FC = () => {
  const [skills, setSkills] = useState<Skill[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedGemType, setSelectedGemType] = useState<string>('all');
  const [selectedElement, setSelectedElement] = useState<string>('all');
  const [selectedWeapon, setSelectedWeapon] = useState<string>('all');
  const [sortField, setSortField] = useState<SortField>('name');
  const [sortDirection, setSortDirection] = useState<SortDirection>('asc');
  const [viewMode, setViewMode] = useState<'table' | 'cards'>('table');

  // Tooltip state
  const [hoveredSkill, setHoveredSkill] = useState<Skill | null>(null);
  const [tooltipPosition, setTooltipPosition] = useState({ x: 0, y: 0 });

  // Handle mouse enter for tooltip
  const handleMouseEnter = (skill: Skill, e: React.MouseEvent) => {
    setHoveredSkill(skill);
    setTooltipPosition({ x: e.clientX, y: e.clientY });
  };

  // Handle mouse move for tooltip
  const handleMouseMove = (e: React.MouseEvent) => {
    if (hoveredSkill) {
      // Keep tooltip within viewport
      const x = Math.min(e.clientX, window.innerWidth - 420);
      const y = Math.min(e.clientY, window.innerHeight - 300);
      setTooltipPosition({ x, y });
    }
  };

  // Handle mouse leave for tooltip
  const handleMouseLeave = () => {
    setHoveredSkill(null);
  };

  useEffect(() => {
    Promise.all([
      import('../../data/PoBSkills.json').then(mod => (mod as any).default || mod).catch(() => []),
      import('../../data/SkillGems.json').then(mod => (mod as any).default || mod).catch(() => []),
      import('../../data/ElementalSkillGems.json').then(mod => (mod as any).default || mod).catch(() => [])
    ]).then(([pobSkills, regularSkills, elementalSkills]) => {
      const allSkills = [...pobSkills, ...regularSkills, ...elementalSkills];
      // Remove duplicates by ID, PoB skills take priority
      const uniqueSkills = allSkills.filter((skill, index, self) =>
        index === self.findIndex(s => s.id === skill.id)
      );
      setSkills(uniqueSkills);
    });
  }, []);

  // Extract unique values for filters
  const gemTypes = useMemo(() => {
    const types = new Set(skills.map(s => s.gemType || s.type));
    return ['all', ...Array.from(types).sort()];
  }, [skills]);

  const elements = useMemo(() => {
    const elems = new Set(skills.map(s => s.element).filter(Boolean) as string[]);
    return ['all', ...Array.from(elems).sort()];
  }, [skills]);

  const weaponTypes = useMemo(() => {
    const weapons = new Set<string>();
    skills.forEach(s => {
      if (s.weaponRequirements) {
        // Split by comma or "or" to get individual weapon types
        const parts = s.weaponRequirements.split(/,|or/).map(p => p.trim());
        parts.forEach(p => weapons.add(p));
      }
    });
    return ['all', 'None', ...Array.from(weapons).sort()];
  }, [skills]);

  // Calculate average damage modifier for a skill
  const getAverageDamage = (skill: Skill): number => {
    const damageMultipliers = skill.moreDamageMultipliersPct || [];
    if (damageMultipliers.length === 0) return 0;
    return damageMultipliers.reduce((sum, val) => sum + val, 0) / damageMultipliers.length;
  };

  // Get base damage multiplier at level 20 (or level 1 if 20 not available)
  const getBaseDamageMultiplier = (skill: Skill): number => {
    if (skill.baseDamageData?.baseMultiplierLvl20) {
      return skill.baseDamageData.baseMultiplierLvl20;
    }
    if (skill.baseDamageData?.baseMultiplier) {
      return skill.baseDamageData.baseMultiplier;
    }
    return 0;
  };

  // Filter and sort skills
  const filteredSkills = useMemo(() => {
    let result = skills.filter(skill => {
      // Search filter
      if (searchQuery) {
        const query = searchQuery.toLowerCase();
        if (!skill.name.toLowerCase().includes(query) &&
            !skill.description.toLowerCase().includes(query) &&
            !(skill.tagString || '').toLowerCase().includes(query)) {
          return false;
        }
      }

      // Gem type filter
      if (selectedGemType !== 'all' && (skill.gemType || skill.type) !== selectedGemType) {
        return false;
      }

      // Element filter
      if (selectedElement !== 'all') {
        if (!skill.element || skill.element !== selectedElement) {
          return false;
        }
      }

      // Weapon filter
      if (selectedWeapon !== 'all') {
        if (selectedWeapon === 'None') {
          if (skill.weaponRequirements) return false;
        } else {
          if (!skill.weaponRequirements || !skill.weaponRequirements.includes(selectedWeapon)) {
            return false;
          }
        }
      }

      return true;
    });

    // Sort
    result.sort((a, b) => {
      let comparison = 0;
      switch (sortField) {
        case 'name':
          comparison = a.name.localeCompare(b.name);
          break;
        case 'gemType':
          comparison = (a.gemType || a.type).localeCompare(b.gemType || b.type);
          break;
        case 'element':
          comparison = (a.element || 'zzz').localeCompare(b.element || 'zzz');
          break;
        case 'damage':
          comparison = getAverageDamage(a) - getAverageDamage(b);
          break;
        case 'baseDamage':
          comparison = getBaseDamageMultiplier(a) - getBaseDamageMultiplier(b);
          break;
        case 'tier':
          comparison = (a.tier || 0) - (b.tier || 0);
          break;
        case 'weapon':
          comparison = (a.weaponRequirements || 'zzz').localeCompare(b.weaponRequirements || 'zzz');
          break;
      }
      return sortDirection === 'asc' ? comparison : -comparison;
    });

    return result;
  }, [skills, searchQuery, selectedGemType, selectedElement, selectedWeapon, sortField, sortDirection]);

  // Group skills by weapon type
  const skillsByWeapon = useMemo(() => {
    const groups: Record<string, Skill[]> = { 'No Weapon Requirement': [] };
    filteredSkills.forEach(skill => {
      if (!skill.weaponRequirements) {
        groups['No Weapon Requirement'].push(skill);
      } else {
        if (!groups[skill.weaponRequirements]) {
          groups[skill.weaponRequirements] = [];
        }
        groups[skill.weaponRequirements].push(skill);
      }
    });
    return groups;
  }, [filteredSkills]);

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('asc');
    }
  };

  const getElementColor = (element: string | null): string => {
    if (!element) return '#888';
    switch (element.toLowerCase()) {
      case 'fire': return '#FF6B35';
      case 'cold': return '#4FC3F7';
      case 'lightning': return '#FFD54F';
      case 'chaos': return '#8E44AD';
      case 'physical': return '#FFFFFF';
      default: return '#888';
    }
  };

  const getGemTypeColor = (gemType: string): string => {
    switch (gemType) {
      case 'Attack': return '#E74C3C';
      case 'Spell': return '#3498DB';
      case 'Buff': return '#2ECC71';
      case 'Minion': return '#9B59B6';
      case 'Warcry': return '#E67E22';
      case 'Mark': return '#1ABC9C';
      case 'Banner': return '#F39C12';
      case 'Totem': return '#8E44AD';
      case 'Shapeshift': return '#27AE60';
      default: return '#888';
    }
  };

  const SortIcon = ({ field }: { field: SortField }) => {
    if (sortField !== field) return <span style={{ opacity: 0.3 }}>⇅</span>;
    return sortDirection === 'asc' ? <span>↑</span> : <span>↓</span>;
  };

  return (
    <div style={{ padding: 20, background: '#121212', minHeight: '100vh', color: '#fff' }}>
      <h1 style={{ margin: 0, marginBottom: 20, color: '#c58602' }}>
        PoE2 Skills Browser
        <span style={{ fontSize: '0.6em', color: '#888', marginLeft: 16 }}>
          {filteredSkills.length} of {skills.length} skills
        </span>
      </h1>

      {/* Filters */}
      <div style={{
        display: 'flex',
        gap: 16,
        marginBottom: 20,
        flexWrap: 'wrap',
        background: '#1a1a1a',
        padding: 16,
        borderRadius: 8,
        border: '1px solid #333'
      }}>
        {/* Search */}
        <div style={{ flex: '1 1 250px' }}>
          <label style={{ display: 'block', marginBottom: 4, fontSize: '0.8rem', color: '#888' }}>
            Search
          </label>
          <input
            type="text"
            placeholder="Search skills..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            style={{
              width: '100%',
              padding: '8px 12px',
              background: '#222',
              border: '1px solid #444',
              borderRadius: 4,
              color: '#fff',
              fontSize: '0.9rem'
            }}
          />
        </div>

        {/* Gem Type Filter */}
        <div style={{ flex: '0 0 150px' }}>
          <label style={{ display: 'block', marginBottom: 4, fontSize: '0.8rem', color: '#888' }}>
            Gem Type
          </label>
          <select
            value={selectedGemType}
            onChange={(e) => setSelectedGemType(e.target.value)}
            style={{
              width: '100%',
              padding: '8px 12px',
              background: '#222',
              border: '1px solid #444',
              borderRadius: 4,
              color: '#fff',
              fontSize: '0.9rem'
            }}
          >
            {gemTypes.map(type => (
              <option key={type} value={type}>
                {type === 'all' ? 'All Types' : type}
              </option>
            ))}
          </select>
        </div>

        {/* Element Filter */}
        <div style={{ flex: '0 0 150px' }}>
          <label style={{ display: 'block', marginBottom: 4, fontSize: '0.8rem', color: '#888' }}>
            Element
          </label>
          <select
            value={selectedElement}
            onChange={(e) => setSelectedElement(e.target.value)}
            style={{
              width: '100%',
              padding: '8px 12px',
              background: '#222',
              border: '1px solid #444',
              borderRadius: 4,
              color: '#fff',
              fontSize: '0.9rem'
            }}
          >
            {elements.map(elem => (
              <option key={elem} value={elem}>
                {elem === 'all' ? 'All Elements' : elem}
              </option>
            ))}
          </select>
        </div>

        {/* Weapon Filter */}
        <div style={{ flex: '0 0 200px' }}>
          <label style={{ display: 'block', marginBottom: 4, fontSize: '0.8rem', color: '#888' }}>
            Weapon Requirement
          </label>
          <select
            value={selectedWeapon}
            onChange={(e) => setSelectedWeapon(e.target.value)}
            style={{
              width: '100%',
              padding: '8px 12px',
              background: '#222',
              border: '1px solid #444',
              borderRadius: 4,
              color: '#fff',
              fontSize: '0.9rem'
            }}
          >
            {weaponTypes.map(weapon => (
              <option key={weapon} value={weapon}>
                {weapon === 'all' ? 'All Weapons' : weapon}
              </option>
            ))}
          </select>
        </div>

        {/* View Mode Toggle */}
        <div style={{ flex: '0 0 auto', display: 'flex', alignItems: 'flex-end' }}>
          <div style={{ display: 'flex', gap: 4 }}>
            <button
              onClick={() => setViewMode('table')}
              style={{
                padding: '8px 16px',
                background: viewMode === 'table' ? '#c58602' : '#333',
                border: 'none',
                borderRadius: '4px 0 0 4px',
                color: '#fff',
                cursor: 'pointer',
                fontSize: '0.9rem'
              }}
            >
              Table
            </button>
            <button
              onClick={() => setViewMode('cards')}
              style={{
                padding: '8px 16px',
                background: viewMode === 'cards' ? '#c58602' : '#333',
                border: 'none',
                borderRadius: '0 4px 4px 0',
                color: '#fff',
                cursor: 'pointer',
                fontSize: '0.9rem'
              }}
            >
              Cards
            </button>
          </div>
        </div>
      </div>

      {/* Stats Summary */}
      <div style={{
        display: 'flex',
        gap: 16,
        marginBottom: 20,
        flexWrap: 'wrap'
      }}>
        {gemTypes.filter(t => t !== 'all').map(type => {
          const count = skills.filter(s => (s.gemType || s.type) === type).length;
          return (
            <div
              key={type}
              onClick={() => setSelectedGemType(selectedGemType === type ? 'all' : type)}
              style={{
                padding: '8px 16px',
                background: selectedGemType === type ? getGemTypeColor(type) + '33' : '#1a1a1a',
                border: `1px solid ${getGemTypeColor(type)}`,
                borderRadius: 4,
                cursor: 'pointer',
                fontSize: '0.8rem'
              }}
            >
              <span style={{ color: getGemTypeColor(type), fontWeight: 'bold' }}>{type}</span>
              <span style={{ color: '#888', marginLeft: 8 }}>{count}</span>
            </div>
          );
        })}
      </div>

      {viewMode === 'table' ? (
        /* Table View */
        <div style={{ overflowX: 'auto' }}>
          <table style={{
            width: '100%',
            borderCollapse: 'collapse',
            background: '#1a1a1a',
            borderRadius: 8,
            overflow: 'hidden'
          }}>
            <thead>
              <tr style={{ background: '#222' }}>
                <th
                  onClick={() => handleSort('name')}
                  style={{ padding: 12, textAlign: 'left', cursor: 'pointer', borderBottom: '1px solid #333' }}
                >
                  Name <SortIcon field="name" />
                </th>
                <th
                  onClick={() => handleSort('gemType')}
                  style={{ padding: 12, textAlign: 'left', cursor: 'pointer', borderBottom: '1px solid #333' }}
                >
                  Type <SortIcon field="gemType" />
                </th>
                <th
                  onClick={() => handleSort('element')}
                  style={{ padding: 12, textAlign: 'left', cursor: 'pointer', borderBottom: '1px solid #333' }}
                >
                  Element <SortIcon field="element" />
                </th>
                <th
                  onClick={() => handleSort('weapon')}
                  style={{ padding: 12, textAlign: 'left', cursor: 'pointer', borderBottom: '1px solid #333' }}
                >
                  Weapon <SortIcon field="weapon" />
                </th>
                <th
                  onClick={() => handleSort('damage')}
                  style={{ padding: 12, textAlign: 'center', cursor: 'pointer', borderBottom: '1px solid #333' }}
                >
                  More Damage <SortIcon field="damage" />
                </th>
                <th
                  onClick={() => handleSort('baseDamage')}
                  style={{ padding: 12, textAlign: 'center', cursor: 'pointer', borderBottom: '1px solid #333' }}
                >
                  Base Dmg% <SortIcon field="baseDamage" />
                </th>
                <th
                  onClick={() => handleSort('tier')}
                  style={{ padding: 12, textAlign: 'center', cursor: 'pointer', borderBottom: '1px solid #333' }}
                >
                  Tier <SortIcon field="tier" />
                </th>
                <th style={{ padding: 12, textAlign: 'left', borderBottom: '1px solid #333' }}>
                  Tags
                </th>
              </tr>
            </thead>
            <tbody>
              {filteredSkills.map((skill, index) => (
                <tr
                  key={skill.id}
                  style={{
                    background: index % 2 === 0 ? '#1a1a1a' : '#1e1e1e',
                    transition: 'background 0.2s',
                    cursor: 'pointer'
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.background = '#252525';
                    handleMouseEnter(skill, e);
                  }}
                  onMouseMove={handleMouseMove}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.background = index % 2 === 0 ? '#1a1a1a' : '#1e1e1e';
                    handleMouseLeave();
                  }}
                >
                  <td style={{ padding: 12, borderBottom: '1px solid #333' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <span style={{ color: '#c58602', fontWeight: 'bold' }}>{skill.name}</span>
                      {skill.source === 'PathOfBuilding-PoE2' && (
                        <span style={{
                          fontSize: '0.6rem',
                          color: '#4CAF50',
                          background: '#1a3020',
                          padding: '2px 4px',
                          borderRadius: 3
                        }}>
                          PoB2
                        </span>
                      )}
                    </div>
                  </td>
                  <td style={{ padding: 12, borderBottom: '1px solid #333' }}>
                    <span style={{
                      color: getGemTypeColor(skill.gemType || skill.type),
                      background: getGemTypeColor(skill.gemType || skill.type) + '22',
                      padding: '2px 8px',
                      borderRadius: 4,
                      fontSize: '0.8rem'
                    }}>
                      {skill.gemType || skill.type}
                    </span>
                  </td>
                  <td style={{ padding: 12, borderBottom: '1px solid #333' }}>
                    {skill.element ? (
                      <span style={{ color: getElementColor(skill.element) }}>
                        {skill.element}
                      </span>
                    ) : (
                      <span style={{ color: '#555' }}>—</span>
                    )}
                  </td>
                  <td style={{ padding: 12, borderBottom: '1px solid #333', fontSize: '0.8rem', color: '#FF9800' }}>
                    {skill.weaponRequirements || <span style={{ color: '#555' }}>Any</span>}
                  </td>
                  <td style={{ padding: 12, borderBottom: '1px solid #333', textAlign: 'center' }}>
                    {skill.moreDamageMultipliersPct?.length > 0 ? (
                      <span style={{ color: '#4CAF50' }}>
                        +{getAverageDamage(skill).toFixed(0)}%
                      </span>
                    ) : (
                      <span style={{ color: '#555' }}>—</span>
                    )}
                  </td>
                  <td style={{ padding: 12, borderBottom: '1px solid #333', textAlign: 'center' }}>
                    {skill.baseDamageData?.baseMultiplierLvl20 || skill.baseDamageData?.baseMultiplier ? (
                      <div style={{ fontSize: '0.8rem' }}>
                        <span style={{ color: '#FF9800', fontWeight: 'bold' }}>
                          {((skill.baseDamageData.baseMultiplierLvl20 || skill.baseDamageData.baseMultiplier || 0) * 100).toFixed(0)}%
                        </span>
                        {skill.baseDamageData.baseMultiplier && skill.baseDamageData.baseMultiplierLvl20 && (
                          <span style={{ color: '#666', fontSize: '0.65rem', display: 'block' }}>
                            ({(skill.baseDamageData.baseMultiplier * 100).toFixed(0)}% @ Lvl 1)
                          </span>
                        )}
                      </div>
                    ) : (
                      <span style={{ color: '#555' }}>—</span>
                    )}
                  </td>
                  <td style={{ padding: 12, borderBottom: '1px solid #333', textAlign: 'center', color: '#888' }}>
                    {skill.tier || '—'}
                  </td>
                  <td style={{ padding: 12, borderBottom: '1px solid #333', fontSize: '0.75rem', color: '#666', maxWidth: 300 }}>
                    {skill.tagString || skill.tags?.join(', ') || '—'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        /* Cards View - Grouped by Weapon */
        <div>
          {Object.entries(skillsByWeapon)
            .filter(([_, skills]) => skills.length > 0)
            .sort(([a], [b]) => a.localeCompare(b))
            .map(([weaponType, weaponSkills]) => (
              <div key={weaponType} style={{ marginBottom: 32 }}>
                <h2 style={{
                  fontSize: '1.2rem',
                  color: '#FF9800',
                  marginBottom: 16,
                  paddingBottom: 8,
                  borderBottom: '1px solid #333'
                }}>
                  {weaponType}
                  <span style={{ color: '#888', fontSize: '0.8rem', marginLeft: 12 }}>
                    ({weaponSkills.length} skills)
                  </span>
                </h2>
                <div style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))',
                  gap: 16
                }}>
                  {weaponSkills.map(skill => (
                    <div
                      key={skill.id}
                      style={{
                        background: '#1a1a1a',
                        border: '1px solid #333',
                        borderRadius: 8,
                        padding: 16,
                        transition: 'transform 0.2s, border-color 0.2s',
                        cursor: 'pointer'
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.transform = 'translateY(-2px)';
                        e.currentTarget.style.borderColor = '#c58602';
                        handleMouseEnter(skill, e);
                      }}
                      onMouseMove={handleMouseMove}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.transform = 'translateY(0)';
                        e.currentTarget.style.borderColor = '#333';
                        handleMouseLeave();
                      }}
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 }}>
                        <div>
                          <span style={{ color: '#c58602', fontWeight: 'bold', fontSize: '1rem' }}>
                            {skill.name}
                          </span>
                          {skill.source === 'PathOfBuilding-PoE2' && (
                            <span style={{
                              fontSize: '0.6rem',
                              color: '#4CAF50',
                              background: '#1a3020',
                              padding: '2px 4px',
                              borderRadius: 3,
                              marginLeft: 8
                            }}>
                              PoB2
                            </span>
                          )}
                        </div>
                        <span style={{
                          color: getGemTypeColor(skill.gemType || skill.type),
                          background: getGemTypeColor(skill.gemType || skill.type) + '22',
                          padding: '2px 8px',
                          borderRadius: 4,
                          fontSize: '0.75rem'
                        }}>
                          {skill.gemType || skill.type}
                        </span>
                      </div>

                      <div style={{ display: 'flex', gap: 8, marginBottom: 8, flexWrap: 'wrap' }}>
                        {skill.element && (
                          <span style={{
                            color: getElementColor(skill.element),
                            background: '#222',
                            padding: '2px 6px',
                            borderRadius: 3,
                            fontSize: '0.7rem',
                            border: `1px solid ${getElementColor(skill.element)}33`
                          }}>
                            {skill.element}
                          </span>
                        )}
                        {skill.tier > 0 && (
                          <span style={{
                            color: '#888',
                            background: '#222',
                            padding: '2px 6px',
                            borderRadius: 3,
                            fontSize: '0.7rem'
                          }}>
                            Tier {skill.tier}
                          </span>
                        )}
                      </div>

                      <div style={{ fontSize: '0.8rem', color: '#888', marginBottom: 8 }}>
                        {skill.tagString || skill.description}
                      </div>

                      <div style={{ display: 'flex', gap: 16, fontSize: '0.75rem', flexWrap: 'wrap' }}>
                        {skill.moreDamageMultipliersPct?.length > 0 && (
                          <div>
                            <span style={{ color: '#4CAF50' }}>More Damage: </span>
                            <span>+{skill.moreDamageMultipliersPct.join(', ')}%</span>
                          </div>
                        )}
                        {skill.moreAttackSpeedMultipliersPct?.length > 0 && (
                          <div>
                            <span style={{ color: '#2196F3' }}>Attack Speed: </span>
                            <span>{skill.moreAttackSpeedMultipliersPct.join(', ')}%</span>
                          </div>
                        )}
                        {(skill.baseDamageData?.baseMultiplierLvl20 || skill.baseDamageData?.baseMultiplier) && (
                          <div>
                            <span style={{ color: '#FF9800' }}>Base Dmg: </span>
                            <span style={{ fontWeight: 'bold' }}>
                              {((skill.baseDamageData.baseMultiplierLvl20 || skill.baseDamageData.baseMultiplier || 0) * 100).toFixed(0)}%
                            </span>
                          </div>
                        )}
                        {skill.baseDamageData?.critChance && (
                          <div>
                            <span style={{ color: '#E91E63' }}>Crit: </span>
                            <span>{skill.baseDamageData.critChance}%</span>
                          </div>
                        )}
                      </div>

                      {skill.requirements && (skill.requirements.str > 0 || skill.requirements.dex > 0 || skill.requirements.int > 0) && (
                        <div style={{ marginTop: 8, fontSize: '0.7rem', color: '#666' }}>
                          Requires:
                          {skill.requirements.str > 0 && <span style={{ color: '#E74C3C', marginLeft: 8 }}>{skill.requirements.str} Str</span>}
                          {skill.requirements.dex > 0 && <span style={{ color: '#2ECC71', marginLeft: 8 }}>{skill.requirements.dex} Dex</span>}
                          {skill.requirements.int > 0 && <span style={{ color: '#3498DB', marginLeft: 8 }}>{skill.requirements.int} Int</span>}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            ))}
        </div>
      )}

      {filteredSkills.length === 0 && (
        <div style={{
          textAlign: 'center',
          padding: 48,
          color: '#666',
          background: '#1a1a1a',
          borderRadius: 8
        }}>
          <div style={{ fontSize: '2rem', marginBottom: 8 }}>🔍</div>
          <div>No skills found matching your filters</div>
        </div>
      )}

      {/* Skill Description Tooltip */}
      {hoveredSkill && (
        <SkillTooltip skill={hoveredSkill} position={tooltipPosition} />
      )}
    </div>
  );
};

export default SkillsBrowser;

