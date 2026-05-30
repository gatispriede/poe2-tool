import React, { useState, useEffect, useMemo } from 'react';

interface WeaponDamage {
  physical: { min: number; max: number };
  fire: { min: number; max: number };
  cold: { min: number; max: number };
  lightning: { min: number; max: number };
  chaos: { min: number; max: number };
}

interface WeaponDPS {
  physical: number;
  elemental: number;
  chaos: number;
  total: number;
}

interface Weapon {
  id: string;
  name: string;
  category: string;
  type: string;
  quality: number;
  socketLimit: number;
  implicit: string | null;
  tags: string[];
  damage: WeaponDamage;
  critChance: number;
  attackRate: number;
  range: number;
  requirements: {
    level: number;
    str: number;
    dex: number;
    int: number;
  };
  dps: WeaponDPS;
}

interface WeaponMod {
  id: string;
  type: 'Prefix' | 'Suffix';
  affix: string;
  level: number;
  group: string | null;
  stats: string[];
  category: string;
  applicableWeapons: string[];
}

interface WeaponModsData {
  prefixes: WeaponMod[];
  suffixes: WeaponMod[];
}

interface TooltipProps {
  weapon: Weapon;
  position: { x: number; y: number };
}

const WeaponTooltip: React.FC<TooltipProps> = ({ weapon, position }) => {
  const getDamageColor = (type: string): string => {
    switch (type) {
      case 'physical': return '#FFFFFF';
      case 'fire': return '#FF6B35';
      case 'cold': return '#4FC3F7';
      case 'lightning': return '#FFD54F';
      case 'chaos': return '#8E44AD';
      default: return '#888';
    }
  };

  const hasDamage = (dmg: { min: number; max: number }) => dmg.min > 0 || dmg.max > 0;

  return (
    <div
      style={{
        position: 'fixed',
        left: Math.min(position.x + 15, window.innerWidth - 380),
        top: Math.min(position.y + 10, window.innerHeight - 400),
        width: 350,
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
      <div style={{ marginBottom: 12, paddingBottom: 8, borderBottom: '1px solid #333' }}>
        <div style={{ color: '#c58602', fontWeight: 'bold', fontSize: '1.1rem' }}>
          {weapon.name}
        </div>
        <div style={{ color: '#888', fontSize: '0.8rem', marginTop: 4 }}>
          {weapon.type}
        </div>
      </div>

      {/* Damage Values */}
      <div style={{ marginBottom: 12 }}>
        {hasDamage(weapon.damage.physical) && (
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
            <span style={{ color: '#888' }}>Physical Damage:</span>
            <span style={{ color: getDamageColor('physical'), fontWeight: 'bold' }}>
              {weapon.damage.physical.min}-{weapon.damage.physical.max}
            </span>
          </div>
        )}
        {hasDamage(weapon.damage.fire) && (
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
            <span style={{ color: '#888' }}>Fire Damage:</span>
            <span style={{ color: getDamageColor('fire'), fontWeight: 'bold' }}>
              {weapon.damage.fire.min}-{weapon.damage.fire.max}
            </span>
          </div>
        )}
        {hasDamage(weapon.damage.cold) && (
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
            <span style={{ color: '#888' }}>Cold Damage:</span>
            <span style={{ color: getDamageColor('cold'), fontWeight: 'bold' }}>
              {weapon.damage.cold.min}-{weapon.damage.cold.max}
            </span>
          </div>
        )}
        {hasDamage(weapon.damage.lightning) && (
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
            <span style={{ color: '#888' }}>Lightning Damage:</span>
            <span style={{ color: getDamageColor('lightning'), fontWeight: 'bold' }}>
              {weapon.damage.lightning.min}-{weapon.damage.lightning.max}
            </span>
          </div>
        )}
        {hasDamage(weapon.damage.chaos) && (
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
            <span style={{ color: '#888' }}>Chaos Damage:</span>
            <span style={{ color: getDamageColor('chaos'), fontWeight: 'bold' }}>
              {weapon.damage.chaos.min}-{weapon.damage.chaos.max}
            </span>
          </div>
        )}
      </div>

      {/* Stats */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: '1fr 1fr',
        gap: 8,
        marginBottom: 12,
        paddingBottom: 12,
        borderBottom: '1px solid #333'
      }}>
        <div>
          <span style={{ color: '#888', fontSize: '0.8rem' }}>Critical Chance</span>
          <div style={{ color: '#E91E63', fontWeight: 'bold' }}>{weapon.critChance}%</div>
        </div>
        <div>
          <span style={{ color: '#888', fontSize: '0.8rem' }}>Attacks per Second</span>
          <div style={{ color: '#4CAF50', fontWeight: 'bold' }}>{weapon.attackRate}</div>
        </div>
        <div>
          <span style={{ color: '#888', fontSize: '0.8rem' }}>Range</span>
          <div style={{ color: '#fff' }}>{weapon.range}</div>
        </div>
        <div>
          <span style={{ color: '#888', fontSize: '0.8rem' }}>Sockets</span>
          <div style={{ color: '#fff' }}>{weapon.socketLimit}</div>
        </div>
      </div>

      {/* DPS Section */}
      <div style={{ marginBottom: 12, paddingBottom: 12, borderBottom: '1px solid #333' }}>
        <div style={{ fontSize: '0.75rem', color: '#c58602', marginBottom: 8, fontWeight: 'bold' }}>
          DPS (Damage Per Second)
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
          {weapon.dps.physical > 0 && (
            <div>
              <span style={{ color: '#888', fontSize: '0.75rem' }}>Physical: </span>
              <span style={{ color: '#fff', fontWeight: 'bold' }}>{weapon.dps.physical.toFixed(1)}</span>
            </div>
          )}
          {weapon.dps.elemental > 0 && (
            <div>
              <span style={{ color: '#888', fontSize: '0.75rem' }}>Elemental: </span>
              <span style={{ color: '#FF9800', fontWeight: 'bold' }}>{weapon.dps.elemental.toFixed(1)}</span>
            </div>
          )}
          {weapon.dps.chaos > 0 && (
            <div>
              <span style={{ color: '#888', fontSize: '0.75rem' }}>Chaos: </span>
              <span style={{ color: '#8E44AD', fontWeight: 'bold' }}>{weapon.dps.chaos.toFixed(1)}</span>
            </div>
          )}
          <div>
            <span style={{ color: '#888', fontSize: '0.75rem' }}>Total: </span>
            <span style={{ color: '#4CAF50', fontWeight: 'bold', fontSize: '1rem' }}>{weapon.dps.total.toFixed(1)}</span>
          </div>
        </div>
        {/* Effective DPS with Crit */}
        <div style={{ marginTop: 8, paddingTop: 8, borderTop: '1px solid #333' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <span style={{ color: '#888', fontSize: '0.75rem' }}>Crit DPS (100% crit): </span>
              <span style={{ color: '#FF9800', fontWeight: 'bold', fontSize: '1.1rem' }}>
                {(((weapon.damage.physical.min + weapon.damage.physical.max) / 2 +
                   (weapon.damage.fire.min + weapon.damage.fire.max) / 2 +
                   (weapon.damage.cold.min + weapon.damage.cold.max) / 2 +
                   (weapon.damage.lightning.min + weapon.damage.lightning.max) / 2 +
                   (weapon.damage.chaos.min + weapon.damage.chaos.max) / 2) * 1.5 * weapon.attackRate).toFixed(1)}
              </span>
            </div>
          </div>
          <div style={{ fontSize: '0.65rem', color: '#666', marginTop: 4 }}>
            Formula: Avg Damage × 1.5 (crit multi) × APS
          </div>
        </div>
      </div>

      {/* Implicit */}
      {weapon.implicit && (
        <div style={{
          marginBottom: 12,
          padding: 8,
          background: '#1a3020',
          borderRadius: 4,
          border: '1px solid #2d5a3d'
        }}>
          <span style={{ color: '#4CAF50', fontSize: '0.85rem' }}>{weapon.implicit}</span>
        </div>
      )}

      {/* Requirements */}
      {(weapon.requirements.level > 0 || weapon.requirements.str > 0 ||
        weapon.requirements.dex > 0 || weapon.requirements.int > 0) && (
        <div style={{ fontSize: '0.75rem' }}>
          <span style={{ color: '#666' }}>Requires </span>
          {weapon.requirements.level > 0 && (
            <span style={{ color: '#888' }}>Level {weapon.requirements.level}</span>
          )}
          {weapon.requirements.str > 0 && (
            <span style={{ color: '#E74C3C', marginLeft: 8 }}>{weapon.requirements.str} Str</span>
          )}
          {weapon.requirements.dex > 0 && (
            <span style={{ color: '#2ECC71', marginLeft: 8 }}>{weapon.requirements.dex} Dex</span>
          )}
          {weapon.requirements.int > 0 && (
            <span style={{ color: '#3498DB', marginLeft: 8 }}>{weapon.requirements.int} Int</span>
          )}
        </div>
      )}
    </div>
  );
};

type SortField = 'name' | 'type' | 'level' | 'dps' | 'attackRate' | 'critChance' | 'damage' | 'effectiveDps';
type SortDirection = 'asc' | 'desc';

// Calculate effective DPS with 100% crit chance
// Formula: Average Damage * (1 + CritMultiplier) * Attack Speed
// Default crit multiplier in PoE2 is 1.5x (50% more damage)
const calculateEffectiveDps = (weapon: Weapon): number => {
  const physAvg = (weapon.damage.physical.min + weapon.damage.physical.max) / 2;
  const fireAvg = (weapon.damage.fire.min + weapon.damage.fire.max) / 2;
  const coldAvg = (weapon.damage.cold.min + weapon.damage.cold.max) / 2;
  const lightAvg = (weapon.damage.lightning.min + weapon.damage.lightning.max) / 2;
  const chaosAvg = (weapon.damage.chaos.min + weapon.damage.chaos.max) / 2;
  const totalAvgDamage = physAvg + fireAvg + coldAvg + lightAvg + chaosAvg;

  // At 100% crit with base 150% crit multiplier
  const critMultiplier = 1.5;
  const effectiveDps = totalAvgDamage * critMultiplier * weapon.attackRate;

  return Math.round(effectiveDps * 100) / 100;
};


const WeaponsBrowser: React.FC = () => {
  const [weapons, setWeapons] = useState<Weapon[]>([]);
  const [weaponMods, setWeaponMods] = useState<WeaponModsData>({ prefixes: [], suffixes: [] });
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [selectedType, setSelectedType] = useState<string>('all');
  const [sortField, setSortField] = useState<SortField>('level');
  const [sortDirection, setSortDirection] = useState<SortDirection>('asc');
  const [viewMode, setViewMode] = useState<'table' | 'cards' | 'generator'>('table');

  // Mod Generator State
  const [selectedWeaponForMods, setSelectedWeaponForMods] = useState<Weapon | null>(null);
  const [selectedPrefixes, setSelectedPrefixes] = useState<WeaponMod[]>([]);
  const [selectedSuffixes, setSelectedSuffixes] = useState<WeaponMod[]>([]);

  // Tooltip state
  const [hoveredWeapon, setHoveredWeapon] = useState<Weapon | null>(null);
  const [tooltipPosition, setTooltipPosition] = useState({ x: 0, y: 0 });

  const handleMouseEnter = (weapon: Weapon, e: React.MouseEvent) => {
    setHoveredWeapon(weapon);
    setTooltipPosition({ x: e.clientX, y: e.clientY });
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (hoveredWeapon) {
      setTooltipPosition({ x: e.clientX, y: e.clientY });
    }
  };

  const handleMouseLeave = () => {
    setHoveredWeapon(null);
  };

  useEffect(() => {
    // Load weapons
    import('../../data/Weapons.json')
      .then(mod => {
        const data = (mod as any).default || mod;
        setWeapons(data);
      })
      .catch(err => {
        console.error('Failed to load weapons data:', err);
      });

    // Load weapon mods
    import('../../data/WeaponMods.json')
      .then(mod => {
        const data = (mod as any).default || mod;
        setWeaponMods(data);
      })
      .catch(err => {
        console.error('Failed to load weapon mods:', err);
      });
  }, []);

  // Extract unique categories and types
  const categories = useMemo(() => {
    const cats = new Set(weapons.map(w => w.category));
    return ['all', ...Array.from(cats).sort()];
  }, [weapons]);

  const types = useMemo(() => {
    const typeSet = new Set(weapons.map(w => w.type));
    return ['all', ...Array.from(typeSet).sort()];
  }, [weapons]);

  // Filter and sort weapons
  const filteredWeapons = useMemo(() => {
    let result = weapons.filter(weapon => {
      // Search filter
      if (searchQuery) {
        const query = searchQuery.toLowerCase();
        if (!weapon.name.toLowerCase().includes(query) &&
            !weapon.type.toLowerCase().includes(query) &&
            !(weapon.implicit || '').toLowerCase().includes(query)) {
          return false;
        }
      }

      // Category filter
      if (selectedCategory !== 'all' && weapon.category !== selectedCategory) {
        return false;
      }

      // Type filter
      if (selectedType !== 'all' && weapon.type !== selectedType) {
        return false;
      }

      return true;
    });

    // Sort - create a new sorted array
    const sorted = [...result].sort((a, b) => {
      let comparison = 0;
      switch (sortField) {
        case 'name':
          comparison = a.name.localeCompare(b.name);
          break;
        case 'type':
          comparison = a.type.localeCompare(b.type);
          break;
        case 'level':
          comparison = (a.requirements.level || 0) - (b.requirements.level || 0);
          break;
        case 'dps':
          comparison = (a.dps.total || 0) - (b.dps.total || 0);
          break;
        case 'attackRate':
          comparison = (a.attackRate || 0) - (b.attackRate || 0);
          break;
        case 'critChance':
          comparison = (a.critChance || 0) - (b.critChance || 0);
          break;
        case 'damage':
          // Calculate total average damage including all damage types
          const getTotalAvgDamage = (w: Weapon) => {
            const phys = (w.damage.physical.min + w.damage.physical.max) / 2;
            const fire = (w.damage.fire.min + w.damage.fire.max) / 2;
            const cold = (w.damage.cold.min + w.damage.cold.max) / 2;
            const light = (w.damage.lightning.min + w.damage.lightning.max) / 2;
            const chaos = (w.damage.chaos.min + w.damage.chaos.max) / 2;
            return phys + fire + cold + light + chaos;
          };
          comparison = getTotalAvgDamage(a) - getTotalAvgDamage(b);
          break;
        case 'effectiveDps':
          comparison = calculateEffectiveDps(a) - calculateEffectiveDps(b);
          break;
        default:
          comparison = 0;
      }
      return sortDirection === 'asc' ? comparison : -comparison;
    });

    return sorted;
  }, [weapons, searchQuery, selectedCategory, selectedType, sortField, sortDirection]);

  // Group weapons by type for card view
  const weaponsByType = useMemo(() => {
    const groups: Record<string, Weapon[]> = {};
    filteredWeapons.forEach(weapon => {
      if (!groups[weapon.type]) {
        groups[weapon.type] = [];
      }
      groups[weapon.type].push(weapon);
    });
    return groups;
  }, [filteredWeapons]);

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('asc');
    }
  };

  const getCategoryColor = (category: string): string => {
    switch (category) {
      case 'sword': return '#E74C3C';
      case 'axe': return '#E67E22';
      case 'mace': return '#8E44AD';
      case 'dagger': return '#2ECC71';
      case 'claw': return '#1ABC9C';
      case 'bow': return '#3498DB';
      case 'crossbow': return '#9B59B6';
      case 'staff': return '#34495E';
      case 'wand': return '#F39C12';
      case 'sceptre': return '#D35400';
      case 'spear': return '#16A085';
      case 'flail': return '#C0392B';
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
        PoE2 Weapons Browser
        <span style={{ fontSize: '0.6em', color: '#888', marginLeft: 16 }}>
          {filteredWeapons.length} of {weapons.length} weapons
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
            placeholder="Search weapons..."
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

        {/* Category Filter */}
        <div style={{ flex: '0 0 150px' }}>
          <label style={{ display: 'block', marginBottom: 4, fontSize: '0.8rem', color: '#888' }}>
            Category
          </label>
          <select
            value={selectedCategory}
            onChange={(e) => setSelectedCategory(e.target.value)}
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
            {categories.map(cat => (
              <option key={cat} value={cat}>
                {cat === 'all' ? 'All Categories' : cat.charAt(0).toUpperCase() + cat.slice(1)}
              </option>
            ))}
          </select>
        </div>

        {/* Type Filter */}
        <div style={{ flex: '0 0 200px' }}>
          <label style={{ display: 'block', marginBottom: 4, fontSize: '0.8rem', color: '#888' }}>
            Weapon Type
          </label>
          <select
            value={selectedType}
            onChange={(e) => setSelectedType(e.target.value)}
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
            {types.map(type => (
              <option key={type} value={type}>
                {type === 'all' ? 'All Types' : type}
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
                borderRadius: 0,
                color: '#fff',
                cursor: 'pointer',
                fontSize: '0.9rem'
              }}
            >
              Cards
            </button>
            <button
              onClick={() => setViewMode('generator')}
              style={{
                padding: '8px 16px',
                background: viewMode === 'generator' ? '#c58602' : '#333',
                border: 'none',
                borderRadius: '0 4px 4px 0',
                color: '#fff',
                cursor: 'pointer',
                fontSize: '0.9rem'
              }}
            >
              🔧 Mod Generator
            </button>
          </div>
        </div>
      </div>

      {/* Category Stats */}
      <div style={{
        display: 'flex',
        gap: 12,
        marginBottom: 20,
        flexWrap: 'wrap'
      }}>
        {categories.filter(c => c !== 'all').map(cat => {
          const count = weapons.filter(w => w.category === cat).length;
          return (
            <div
              key={cat}
              onClick={() => setSelectedCategory(selectedCategory === cat ? 'all' : cat)}
              style={{
                padding: '6px 12px',
                background: selectedCategory === cat ? getCategoryColor(cat) + '33' : '#1a1a1a',
                border: `1px solid ${getCategoryColor(cat)}`,
                borderRadius: 4,
                cursor: 'pointer',
                fontSize: '0.75rem'
              }}
            >
              <span style={{ color: getCategoryColor(cat), fontWeight: 'bold', textTransform: 'capitalize' }}>
                {cat}
              </span>
              <span style={{ color: '#888', marginLeft: 6 }}>{count}</span>
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
                  onClick={() => handleSort('type')}
                  style={{ padding: 12, textAlign: 'left', cursor: 'pointer', borderBottom: '1px solid #333' }}
                >
                  Type <SortIcon field="type" />
                </th>
                <th
                  onClick={() => handleSort('damage')}
                  style={{ padding: 12, textAlign: 'center', cursor: 'pointer', borderBottom: '1px solid #333' }}
                >
                  Damage <SortIcon field="damage" />
                </th>
                <th
                  onClick={() => handleSort('attackRate')}
                  style={{ padding: 12, textAlign: 'center', cursor: 'pointer', borderBottom: '1px solid #333' }}
                >
                  APS <SortIcon field="attackRate" />
                </th>
                <th
                  onClick={() => handleSort('critChance')}
                  style={{ padding: 12, textAlign: 'center', cursor: 'pointer', borderBottom: '1px solid #333' }}
                >
                  Crit% <SortIcon field="critChance" />
                </th>
                <th
                  onClick={() => handleSort('dps')}
                  style={{ padding: 12, textAlign: 'center', cursor: 'pointer', borderBottom: '1px solid #333' }}
                >
                  DPS <SortIcon field="dps" />
                </th>
                <th
                  onClick={() => handleSort('effectiveDps')}
                  style={{ padding: 12, textAlign: 'center', cursor: 'pointer', borderBottom: '1px solid #333' }}
                  title="Effective DPS at 100% crit (Avg Damage × 1.5 × Attack Speed)"
                >
                  Crit DPS <SortIcon field="effectiveDps" />
                </th>
                <th
                  onClick={() => handleSort('level')}
                  style={{ padding: 12, textAlign: 'center', cursor: 'pointer', borderBottom: '1px solid #333' }}
                >
                  Req. Lvl <SortIcon field="level" />
                </th>
                <th style={{ padding: 12, textAlign: 'left', borderBottom: '1px solid #333' }}>
                  Implicit
                </th>
              </tr>
            </thead>
            <tbody>
              {filteredWeapons.map((weapon, index) => (
                <tr
                  key={weapon.id}
                  style={{
                    background: index % 2 === 0 ? '#1a1a1a' : '#1e1e1e',
                    transition: 'background 0.2s',
                    cursor: 'pointer'
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.background = '#252525';
                    handleMouseEnter(weapon, e);
                  }}
                  onMouseMove={handleMouseMove}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.background = index % 2 === 0 ? '#1a1a1a' : '#1e1e1e';
                    handleMouseLeave();
                  }}
                >
                  <td style={{ padding: 12, borderBottom: '1px solid #333' }}>
                    <span style={{ color: '#c58602', fontWeight: 'bold' }}>{weapon.name}</span>
                  </td>
                  <td style={{ padding: 12, borderBottom: '1px solid #333' }}>
                    <span style={{
                      color: getCategoryColor(weapon.category),
                      background: getCategoryColor(weapon.category) + '22',
                      padding: '2px 8px',
                      borderRadius: 4,
                      fontSize: '0.8rem'
                    }}>
                      {weapon.type}
                    </span>
                  </td>
                  <td style={{ padding: 12, borderBottom: '1px solid #333', textAlign: 'center' }}>
                    <span style={{ color: '#fff' }}>
                      {weapon.damage.physical.min}-{weapon.damage.physical.max}
                    </span>
                    {(weapon.damage.fire.max > 0 || weapon.damage.cold.max > 0 ||
                      weapon.damage.lightning.max > 0 || weapon.damage.chaos.max > 0) && (
                      <span style={{ color: '#FF9800', fontSize: '0.75rem', display: 'block' }}>
                        +elemental
                      </span>
                    )}
                  </td>
                  <td style={{ padding: 12, borderBottom: '1px solid #333', textAlign: 'center', color: '#4CAF50' }}>
                    {weapon.attackRate}
                  </td>
                  <td style={{ padding: 12, borderBottom: '1px solid #333', textAlign: 'center', color: '#E91E63' }}>
                    {weapon.critChance}%
                  </td>
                  <td style={{ padding: 12, borderBottom: '1px solid #333', textAlign: 'center' }}>
                    <span style={{ color: '#4CAF50', fontWeight: 'bold' }}>
                      {weapon.dps.total.toFixed(1)}
                    </span>
                  </td>
                  <td style={{ padding: 12, borderBottom: '1px solid #333', textAlign: 'center' }}>
                    <span style={{ color: '#FF9800', fontWeight: 'bold' }}>
                      {calculateEffectiveDps(weapon).toFixed(1)}
                    </span>
                  </td>
                  <td style={{ padding: 12, borderBottom: '1px solid #333', textAlign: 'center', color: '#888' }}>
                    {weapon.requirements.level || '—'}
                  </td>
                  <td style={{ padding: 12, borderBottom: '1px solid #333', fontSize: '0.75rem', color: '#4CAF50', maxWidth: 250 }}>
                    {weapon.implicit || <span style={{ color: '#555' }}>—</span>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        /* Cards View - Grouped by Type */
        <div>
          {Object.entries(weaponsByType)
            .sort(([a], [b]) => a.localeCompare(b))
            .map(([type, typeWeapons]) => (
              <div key={type} style={{ marginBottom: 32 }}>
                <h2 style={{
                  fontSize: '1.2rem',
                  color: '#c58602',
                  marginBottom: 16,
                  paddingBottom: 8,
                  borderBottom: '1px solid #333'
                }}>
                  {type}
                  <span style={{ color: '#888', fontSize: '0.8rem', marginLeft: 12 }}>
                    ({typeWeapons.length} weapons)
                  </span>
                </h2>
                <div style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))',
                  gap: 16
                }}>
                  {typeWeapons.map(weapon => (
                    <div
                      key={weapon.id}
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
                        handleMouseEnter(weapon, e);
                      }}
                      onMouseMove={handleMouseMove}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.transform = 'translateY(0)';
                        e.currentTarget.style.borderColor = '#333';
                        handleMouseLeave();
                      }}
                    >
                      <div style={{ marginBottom: 8 }}>
                        <span style={{ color: '#c58602', fontWeight: 'bold', fontSize: '1rem' }}>
                          {weapon.name}
                        </span>
                      </div>

                      <div style={{ display: 'flex', gap: 12, marginBottom: 12, flexWrap: 'wrap' }}>
                        <div>
                          <div style={{ fontSize: '0.7rem', color: '#888' }}>Damage</div>
                          <div style={{ color: '#fff', fontWeight: 'bold' }}>
                            {weapon.damage.physical.min}-{weapon.damage.physical.max}
                          </div>
                        </div>
                        <div>
                          <div style={{ fontSize: '0.7rem', color: '#888' }}>APS</div>
                          <div style={{ color: '#4CAF50', fontWeight: 'bold' }}>{weapon.attackRate}</div>
                        </div>
                        <div>
                          <div style={{ fontSize: '0.7rem', color: '#888' }}>Crit</div>
                          <div style={{ color: '#E91E63', fontWeight: 'bold' }}>{weapon.critChance}%</div>
                        </div>
                        <div>
                          <div style={{ fontSize: '0.7rem', color: '#888' }}>DPS</div>
                          <div style={{ color: '#4CAF50', fontWeight: 'bold' }}>{weapon.dps.total.toFixed(1)}</div>
                        </div>
                        <div>
                          <div style={{ fontSize: '0.7rem', color: '#888' }}>Crit DPS</div>
                          <div style={{ color: '#FF9800', fontWeight: 'bold' }}>{calculateEffectiveDps(weapon).toFixed(1)}</div>
                        </div>
                      </div>

                      {weapon.implicit && (
                        <div style={{
                          padding: 8,
                          background: '#1a3020',
                          borderRadius: 4,
                          border: '1px solid #2d5a3d',
                          fontSize: '0.75rem',
                          color: '#4CAF50',
                          marginBottom: 8
                        }}>
                          {weapon.implicit}
                        </div>
                      )}

                      {(weapon.requirements.level > 0 || weapon.requirements.str > 0 ||
                        weapon.requirements.dex > 0 || weapon.requirements.int > 0) && (
                        <div style={{ fontSize: '0.7rem', color: '#666' }}>
                          Requires:
                          {weapon.requirements.level > 0 && (
                            <span style={{ marginLeft: 4 }}>Lv.{weapon.requirements.level}</span>
                          )}
                          {weapon.requirements.str > 0 && (
                            <span style={{ color: '#E74C3C', marginLeft: 8 }}>{weapon.requirements.str} Str</span>
                          )}
                          {weapon.requirements.dex > 0 && (
                            <span style={{ color: '#2ECC71', marginLeft: 8 }}>{weapon.requirements.dex} Dex</span>
                          )}
                          {weapon.requirements.int > 0 && (
                            <span style={{ color: '#3498DB', marginLeft: 8 }}>{weapon.requirements.int} Int</span>
                          )}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            ))}
        </div>
      )}

      {/* Mod Generator View */}
      {viewMode === 'generator' && (
        <div style={{ display: 'flex', gap: 24, flexWrap: 'wrap' }}>
          {/* Left Panel - Weapon Selection */}
          <div style={{ flex: '1 1 300px', maxWidth: 400 }}>
            <div style={{
              background: '#1a1a1a',
              border: '1px solid #333',
              borderRadius: 8,
              padding: 16
            }}>
              <h3 style={{ margin: 0, marginBottom: 16, color: '#c58602' }}>Select Base Weapon</h3>
              <select
                value={selectedWeaponForMods?.id || ''}
                onChange={(e) => {
                  const weapon = weapons.find(w => w.id === e.target.value);
                  setSelectedWeaponForMods(weapon || null);
                  setSelectedPrefixes([]);
                  setSelectedSuffixes([]);
                }}
                style={{
                  width: '100%',
                  padding: '10px 12px',
                  background: '#222',
                  border: '1px solid #444',
                  borderRadius: 4,
                  color: '#fff',
                  fontSize: '0.9rem',
                  marginBottom: 16
                }}
              >
                <option value="">-- Select a weapon --</option>
                {weapons.map(w => (
                  <option key={w.id} value={w.id}>
                    {w.name} ({w.type})
                  </option>
                ))}
              </select>

              {selectedWeaponForMods && (
                <div style={{ padding: 12, background: '#222', borderRadius: 4 }}>
                  <div style={{ color: '#c58602', fontWeight: 'bold', marginBottom: 8 }}>
                    {selectedWeaponForMods.name}
                  </div>
                  <div style={{ fontSize: '0.85rem', color: '#888', marginBottom: 8 }}>
                    {selectedWeaponForMods.type}
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, fontSize: '0.8rem' }}>
                    <div>
                      <span style={{ color: '#888' }}>Damage: </span>
                      <span style={{ color: '#fff' }}>
                        {selectedWeaponForMods.damage.physical.min}-{selectedWeaponForMods.damage.physical.max}
                      </span>
                    </div>
                    <div>
                      <span style={{ color: '#888' }}>APS: </span>
                      <span style={{ color: '#4CAF50' }}>{selectedWeaponForMods.attackRate}</span>
                    </div>
                    <div>
                      <span style={{ color: '#888' }}>Crit: </span>
                      <span style={{ color: '#E91E63' }}>{selectedWeaponForMods.critChance}%</span>
                    </div>
                    <div>
                      <span style={{ color: '#888' }}>DPS: </span>
                      <span style={{ color: '#4CAF50' }}>{selectedWeaponForMods.dps.total.toFixed(1)}</span>
                    </div>
                  </div>
                  {selectedWeaponForMods.implicit && (
                    <div style={{ marginTop: 8, padding: 8, background: '#1a3020', borderRadius: 4, fontSize: '0.75rem', color: '#4CAF50' }}>
                      {selectedWeaponForMods.implicit}
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Middle Panel - Mod Selection */}
          <div style={{ flex: '2 1 500px' }}>
            <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap' }}>
              {/* Prefixes */}
              <div style={{ flex: '1 1 240px', background: '#1a1a1a', border: '1px solid #333', borderRadius: 8, padding: 16 }}>
                <h3 style={{ margin: 0, marginBottom: 8, color: '#E74C3C', fontSize: '1rem' }}>
                  Prefixes ({selectedPrefixes.length}/3)
                </h3>
                <div style={{ maxHeight: 400, overflowY: 'auto' }}>
                  {weaponMods.prefixes
                    .filter(mod => {
                      if (!selectedWeaponForMods) return true;
                      return mod.applicableWeapons.includes('All Weapons') ||
                        mod.applicableWeapons.some(w =>
                          selectedWeaponForMods.type.toLowerCase().includes(w.toLowerCase()) ||
                          selectedWeaponForMods.category.toLowerCase() === w.toLowerCase()
                        );
                    })
                    .map(mod => {
                      const isSelected = selectedPrefixes.some(p => p.id === mod.id);
                      const isDisabled = !isSelected && selectedPrefixes.length >= 3;
                      const hasSameGroup = selectedPrefixes.some(p => p.group && p.group === mod.group && p.id !== mod.id);

                      return (
                        <div
                          key={mod.id}
                          onClick={() => {
                            if (hasSameGroup) return;
                            if (isSelected) {
                              setSelectedPrefixes(selectedPrefixes.filter(p => p.id !== mod.id));
                            } else if (!isDisabled) {
                              setSelectedPrefixes([...selectedPrefixes, mod]);
                            }
                          }}
                          style={{
                            padding: '8px 10px',
                            marginBottom: 4,
                            background: isSelected ? '#3a2510' : hasSameGroup ? '#1a1a1a' : '#222',
                            border: `1px solid ${isSelected ? '#c58602' : hasSameGroup ? '#444' : '#333'}`,
                            borderRadius: 4,
                            cursor: isDisabled || hasSameGroup ? 'not-allowed' : 'pointer',
                            opacity: isDisabled || hasSameGroup ? 0.5 : 1,
                            transition: 'all 0.15s'
                          }}
                        >
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <span style={{ color: '#c58602', fontSize: '0.8rem', fontWeight: 'bold' }}>
                              {mod.affix}
                            </span>
                            <span style={{ color: '#666', fontSize: '0.7rem' }}>Lvl {mod.level}</span>
                          </div>
                          <div style={{ fontSize: '0.75rem', color: '#4CAF50', marginTop: 2 }}>
                            {mod.stats.join(', ')}
                          </div>
                        </div>
                      );
                    })}
                </div>
              </div>

              {/* Suffixes */}
              <div style={{ flex: '1 1 240px', background: '#1a1a1a', border: '1px solid #333', borderRadius: 8, padding: 16 }}>
                <h3 style={{ margin: 0, marginBottom: 8, color: '#3498DB', fontSize: '1rem' }}>
                  Suffixes ({selectedSuffixes.length}/3)
                </h3>
                <div style={{ maxHeight: 400, overflowY: 'auto' }}>
                  {weaponMods.suffixes
                    .filter(mod => {
                      if (!selectedWeaponForMods) return true;
                      return mod.applicableWeapons.includes('All Weapons') ||
                        mod.applicableWeapons.some(w =>
                          selectedWeaponForMods.type.toLowerCase().includes(w.toLowerCase()) ||
                          selectedWeaponForMods.category.toLowerCase() === w.toLowerCase()
                        );
                    })
                    .map(mod => {
                      const isSelected = selectedSuffixes.some(s => s.id === mod.id);
                      const isDisabled = !isSelected && selectedSuffixes.length >= 3;
                      const hasSameGroup = selectedSuffixes.some(s => s.group && s.group === mod.group && s.id !== mod.id);

                      return (
                        <div
                          key={mod.id}
                          onClick={() => {
                            if (hasSameGroup) return;
                            if (isSelected) {
                              setSelectedSuffixes(selectedSuffixes.filter(s => s.id !== mod.id));
                            } else if (!isDisabled) {
                              setSelectedSuffixes([...selectedSuffixes, mod]);
                            }
                          }}
                          style={{
                            padding: '8px 10px',
                            marginBottom: 4,
                            background: isSelected ? '#102a3a' : hasSameGroup ? '#1a1a1a' : '#222',
                            border: `1px solid ${isSelected ? '#3498DB' : hasSameGroup ? '#444' : '#333'}`,
                            borderRadius: 4,
                            cursor: isDisabled || hasSameGroup ? 'not-allowed' : 'pointer',
                            opacity: isDisabled || hasSameGroup ? 0.5 : 1,
                            transition: 'all 0.15s'
                          }}
                        >
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <span style={{ color: '#3498DB', fontSize: '0.8rem', fontWeight: 'bold' }}>
                              {mod.affix}
                            </span>
                            <span style={{ color: '#666', fontSize: '0.7rem' }}>Lvl {mod.level}</span>
                          </div>
                          <div style={{ fontSize: '0.75rem', color: '#4CAF50', marginTop: 2 }}>
                            {mod.stats.join(', ')}
                          </div>
                        </div>
                      );
                    })}
                </div>
              </div>
            </div>
          </div>

          {/* Right Panel - Generated Item Preview */}
          <div style={{ flex: '1 1 300px', maxWidth: 400 }}>
            <div style={{
              background: 'linear-gradient(135deg, #1a1a2e 0%, #16213e 100%)',
              border: '2px solid #c58602',
              borderRadius: 8,
              padding: 20
            }}>
              <h3 style={{ margin: 0, marginBottom: 16, color: '#c58602', textAlign: 'center' }}>
                Generated Weapon
              </h3>

              {!selectedWeaponForMods ? (
                <div style={{ textAlign: 'center', color: '#666', padding: 32 }}>
                  Select a base weapon to begin
                </div>
              ) : (
                <div>
                  {/* Item Name */}
                  <div style={{ textAlign: 'center', marginBottom: 16 }}>
                    <div style={{
                      color: selectedPrefixes.length > 0 || selectedSuffixes.length > 0 ? '#FFFF77' : '#c58602',
                      fontWeight: 'bold',
                      fontSize: '1.1rem'
                    }}>
                      {selectedPrefixes[0]?.affix?.split(' ')[0] || ''} {selectedWeaponForMods.name} {selectedSuffixes[0]?.affix || ''}
                    </div>
                    <div style={{ color: '#888', fontSize: '0.8rem' }}>{selectedWeaponForMods.type}</div>
                  </div>

                  {/* Base Stats */}
                  <div style={{ marginBottom: 12, paddingBottom: 12, borderBottom: '1px solid #333' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                      <span style={{ color: '#888' }}>Physical Damage:</span>
                      <span style={{ color: '#fff' }}>
                        {selectedWeaponForMods.damage.physical.min}-{selectedWeaponForMods.damage.physical.max}
                      </span>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                      <span style={{ color: '#888' }}>Critical Chance:</span>
                      <span style={{ color: '#fff' }}>{selectedWeaponForMods.critChance}%</span>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <span style={{ color: '#888' }}>Attacks per Second:</span>
                      <span style={{ color: '#fff' }}>{selectedWeaponForMods.attackRate}</span>
                    </div>
                  </div>

                  {/* Implicit */}
                  {selectedWeaponForMods.implicit && (
                    <div style={{
                      padding: 8,
                      background: '#1a3020',
                      borderRadius: 4,
                      marginBottom: 12,
                      fontSize: '0.85rem',
                      color: '#4CAF50'
                    }}>
                      {selectedWeaponForMods.implicit}
                    </div>
                  )}

                  {/* Selected Mods */}
                  {(selectedPrefixes.length > 0 || selectedSuffixes.length > 0) && (
                    <div style={{ borderTop: '1px solid #333', paddingTop: 12 }}>
                      {selectedPrefixes.map(mod => (
                        <div key={mod.id} style={{ marginBottom: 6 }}>
                          {mod.stats.map((stat, i) => (
                            <div key={i} style={{ color: '#8888FF', fontSize: '0.85rem' }}>{stat}</div>
                          ))}
                        </div>
                      ))}
                      {selectedSuffixes.map(mod => (
                        <div key={mod.id} style={{ marginBottom: 6 }}>
                          {mod.stats.map((stat, i) => (
                            <div key={i} style={{ color: '#8888FF', fontSize: '0.85rem' }}>{stat}</div>
                          ))}
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Clear Button */}
                  {(selectedPrefixes.length > 0 || selectedSuffixes.length > 0) && (
                    <button
                      onClick={() => {
                        setSelectedPrefixes([]);
                        setSelectedSuffixes([]);
                      }}
                      style={{
                        width: '100%',
                        padding: '8px 16px',
                        marginTop: 16,
                        background: '#333',
                        border: '1px solid #555',
                        borderRadius: 4,
                        color: '#fff',
                        cursor: 'pointer'
                      }}
                    >
                      Clear All Mods
                    </button>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {filteredWeapons.length === 0 && viewMode !== 'generator' && (
        <div style={{
          textAlign: 'center',
          padding: 48,
          color: '#666',
          background: '#1a1a1a',
          borderRadius: 8
        }}>
          <div style={{ fontSize: '2rem', marginBottom: 8 }}>⚔️</div>
          <div>No weapons found matching your filters</div>
        </div>
      )}

      {/* Weapon Tooltip */}
      {hoveredWeapon && (
        <WeaponTooltip weapon={hoveredWeapon} position={tooltipPosition} />
      )}
    </div>
  );
};

export default WeaponsBrowser;

