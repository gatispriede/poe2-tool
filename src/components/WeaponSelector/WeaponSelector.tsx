import React, { useState, useEffect } from 'react';

export interface Weapon {
  id: string;
  name: string;
  baseMin: number;
  baseMax: number;
  baseAPS: number;
  localIncreasedDamagePct?: number;
  weaponType: string;
  itemLevel?: number;
  description?: string;
}

interface WeaponSelectorProps {
  onWeaponChange: (weapon: Weapon | null) => void;
  selectedWeaponId?: string;
}

const WeaponSelector: React.FC<WeaponSelectorProps> = ({ onWeaponChange, selectedWeaponId }) => {
  const [weapons, setWeapons] = useState<Weapon[]>([]);
  const [selectedWeapon, setSelectedWeapon] = useState<Weapon | null>(null);
  const [selectedType, setSelectedType] = useState<string>('All');

  useEffect(() => {
    // Load weapon data from multiple sources
    Promise.all([
      import('../../data/Wands.json').then(mod => (mod as any).default || (mod as any)).catch(() => []),
      import('../../data/Quarterstaffs.json').then(mod => (mod as any).default || (mod as any)).catch(() => [])
    ]).then(([wands, quarterstaffs]) => {
      // Add basic melee weapons for comparison
      const basicWeapons = [
        {
          id: 'bronze-sword',
          name: 'Bronze Sword',
          baseMin: 5,
          baseMax: 12,
          baseAPS: 1.4,
          localIncreasedDamagePct: 0,
          weaponType: 'Sword',
          itemLevel: 1,
          description: 'A basic bronze sword for new warriors'
        },
        {
          id: 'iron-dagger',
          name: 'Iron Dagger',
          baseMin: 3,
          baseMax: 10,
          baseAPS: 1.9,
          localIncreasedDamagePct: 0,
          weaponType: 'Dagger',
          itemLevel: 1,
          description: 'A swift iron dagger for quick strikes'
        },
        {
          id: 'crude-bow',
          name: 'Crude Bow',
          baseMin: 4,
          baseMax: 14,
          baseAPS: 1.2,
          localIncreasedDamagePct: 0,
          weaponType: 'Bow',
          itemLevel: 1,
          description: 'A simple bow for ranged combat'
        }
      ];

      const allWeapons = [...basicWeapons, ...wands, ...quarterstaffs];
      setWeapons(allWeapons);

      // Set initial selection if provided
      if (selectedWeaponId) {
        const initial = allWeapons.find((w: Weapon) => w.id === selectedWeaponId);
        if (initial) {
          setSelectedWeapon(initial);
          onWeaponChange(initial);
        }
      }
    }).catch(() => {
      console.warn('Could not load weapon data');
      setWeapons([]);
    });
  }, [selectedWeaponId, onWeaponChange]);

  const handleWeaponChange = (event: React.ChangeEvent<HTMLSelectElement>) => {
    const weaponId = event.target.value;

    if (weaponId === '') {
      setSelectedWeapon(null);
      onWeaponChange(null);
      return;
    }

    const weapon = weapons.find(w => w.id === weaponId);
    if (weapon) {
      setSelectedWeapon(weapon);
      onWeaponChange(weapon);
    }
  };

  const handleTypeFilter = (event: React.ChangeEvent<HTMLSelectElement>) => {
    setSelectedType(event.target.value);
  };

  const getWeaponsByType = (type: string) => {
    if (type === 'All') return weapons;
    return weapons.filter(weapon => weapon.weaponType === type);
  };

  const weaponTypes = ['All', ...Array.from(new Set(weapons.map(weapon => weapon.weaponType)))].sort();
  const filteredWeapons = getWeaponsByType(selectedType);

  const getWeaponTypeColor = (type: string): string => {
    switch (type.toLowerCase()) {
      case 'wand': return '#9C27B0';
      case 'sceptre': return '#673AB7';
      case 'sword': return '#F44336';
      case 'dagger': return '#FF9800';
      case 'bow': return '#4CAF50';
      case 'quarterstaff': return '#8B4513';
      default: return '#888';
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      <h3 style={{ margin: 0, fontSize: '1rem' }}>Weapon Selection</h3>

      <label style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
        <span>Filter by Type:</span>
        <select
          value={selectedType}
          onChange={handleTypeFilter}
          style={{ padding: '4px', background: '#222', color: '#fff', border: '1px solid #444', borderRadius: 4 }}
        >
          {weaponTypes.map(type => (
            <option key={type} value={type}>{type}</option>
          ))}
        </select>
      </label>

      <label style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
        <span>Choose Weapon:</span>
        <select
          value={selectedWeapon?.id || ''}
          onChange={handleWeaponChange}
          style={{ padding: '4px', background: '#222', color: '#fff', border: '1px solid #444', borderRadius: 4 }}
        >
          <option value="">-- No Weapon Selected --</option>
          {filteredWeapons.map(weapon => (
            <option key={weapon.id} value={weapon.id}>
              {weapon.name} ({weapon.baseMin}-{weapon.baseMax} dmg, {weapon.baseAPS} APS)
            </option>
          ))}
        </select>
      </label>

      {selectedWeapon && (
        <div style={{
          background: '#1a1a1a',
          padding: '8px',
          borderRadius: 4,
          border: '1px solid #333'
        }}>
          <div style={{ marginBottom: 8, display: 'flex', alignItems: 'center', gap: 8 }}>
            <strong style={{ color: '#c58602' }}>{selectedWeapon.name}</strong>
            <span style={{
              fontSize: '0.7rem',
              color: getWeaponTypeColor(selectedWeapon.weaponType),
              background: '#222',
              padding: '2px 6px',
              borderRadius: 3,
              border: `1px solid ${getWeaponTypeColor(selectedWeapon.weaponType)}33`
            }}>
              {selectedWeapon.weaponType}
            </span>
            {selectedWeapon.itemLevel && (
              <span style={{
                fontSize: '0.7rem',
                color: '#888',
                background: '#333',
                padding: '2px 6px',
                borderRadius: 3
              }}>
                Lvl {selectedWeapon.itemLevel}
              </span>
            )}
          </div>

          {selectedWeapon.description && (
            <div style={{ fontSize: '0.8rem', color: '#ccc', marginBottom: 8 }}>
              {selectedWeapon.description}
            </div>
          )}

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, fontSize: '0.8rem' }}>
            <div>
              <span style={{ color: '#FF5722' }}>Damage: </span>
              <span>{selectedWeapon.baseMin}-{selectedWeapon.baseMax}</span>
            </div>
            <div>
              <span style={{ color: '#2196F3' }}>APS: </span>
              <span>{selectedWeapon.baseAPS}</span>
            </div>
            {selectedWeapon.localIncreasedDamagePct !== undefined && selectedWeapon.localIncreasedDamagePct > 0 && (
              <div style={{ gridColumn: '1 / -1' }}>
                <span style={{ color: '#4CAF50' }}>Local Inc Damage: </span>
                <span>{selectedWeapon.localIncreasedDamagePct}%</span>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default WeaponSelector;
