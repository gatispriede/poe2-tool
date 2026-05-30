import React, { useState, useEffect, useMemo } from 'react';
import { WeaponBase, WeaponCategory, loadWeapons, getWeaponCategories, getWeaponDPS, getAverageDamage } from '../../../data/weapons';

interface Step1WeaponProps {
  selectedWeapon: WeaponBase | null;
  onWeaponSelect: (weapon: WeaponBase | null) => void;
}

const Step1Weapon: React.FC<Step1WeaponProps> = ({ selectedWeapon, onWeaponSelect }) => {
  const [weapons, setWeapons] = useState<WeaponBase[]>([]);
  const [categories, setCategories] = useState<WeaponCategory[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');

  // Load weapons on mount
  useEffect(() => {
    async function loadData() {
      try {
        setLoading(true);
        const [loadedWeapons, loadedCategories] = await Promise.all([
          loadWeapons(),
          getWeaponCategories(),
        ]);
        setWeapons(loadedWeapons);
        setCategories(loadedCategories);

        // Set initial category if weapon is already selected
        if (selectedWeapon) {
          setSelectedCategory(selectedWeapon.category);
        }
      } catch (err) {
        console.error('Failed to load weapons:', err);
        setError('Failed to load weapon data. Make sure the PoB files are accessible.');
      } finally {
        setLoading(false);
      }
    }
    loadData();
  }, [selectedWeapon]);

  // Filter weapons by category and search
  const filteredWeapons = useMemo(() => {
    let result = weapons;

    if (selectedCategory) {
      result = result.filter(w => w.category === selectedCategory);
    }

    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      result = result.filter(w =>
        w.name.toLowerCase().includes(term) ||
        w.type.toLowerCase().includes(term)
      );
    }

    // Sort by DPS descending
    return result.sort((a, b) => getWeaponDPS(b) - getWeaponDPS(a));
  }, [weapons, selectedCategory, searchTerm]);

  if (loading) {
    return (
      <div style={{ padding: 40, textAlign: 'center', color: '#888' }}>
        Loading weapons...
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
      {/* Left Panel - Category & List */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 300 }}>
        <h2 style={{ margin: '0 0 16px 0', color: '#c58602' }}>
          Step 1: Select Weapon
        </h2>

        {/* Category Selection */}
        <div style={{ marginBottom: 16 }}>
          <label style={{ display: 'block', marginBottom: 8, color: '#888', fontSize: '0.85rem' }}>
            Weapon Category
          </label>
          <select
            value={selectedCategory}
            onChange={(e) => setSelectedCategory(e.target.value)}
            style={{
              width: '100%',
              padding: '10px 12px',
              background: '#222',
              border: '1px solid #444',
              borderRadius: 4,
              color: '#fff',
              fontSize: '0.95rem',
            }}
          >
            <option value="">All Categories ({weapons.length})</option>
            {categories.map(cat => (
              <option key={cat.id} value={cat.id}>
                {cat.name} ({weapons.filter(w => w.category === cat.id).length})
              </option>
            ))}
          </select>
        </div>

        {/* Search */}
        <div style={{ marginBottom: 16 }}>
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Search weapons..."
            style={{
              width: '100%',
              padding: '10px 12px',
              background: '#222',
              border: '1px solid #444',
              borderRadius: 4,
              color: '#fff',
              fontSize: '0.95rem',
            }}
          />
        </div>

        {/* Weapon List */}
        <div style={{
          flex: 1,
          overflowY: 'auto',
          border: '1px solid #333',
          borderRadius: 4,
          background: '#1a1a1a',
        }}>
          {filteredWeapons.length === 0 ? (
            <div style={{ padding: 24, textAlign: 'center', color: '#666' }}>
              No weapons found
            </div>
          ) : (
            filteredWeapons.map(weapon => (
              <div
                key={weapon.id}
                onClick={() => onWeaponSelect(weapon)}
                style={{
                  padding: '12px 16px',
                  borderBottom: '1px solid #333',
                  cursor: 'pointer',
                  background: selectedWeapon?.id === weapon.id ? '#2a2a2a' : 'transparent',
                  borderLeft: selectedWeapon?.id === weapon.id ? '3px solid #c58602' : '3px solid transparent',
                  transition: 'all 0.15s',
                }}
                onMouseEnter={(e) => {
                  if (selectedWeapon?.id !== weapon.id) {
                    e.currentTarget.style.background = '#222';
                  }
                }}
                onMouseLeave={(e) => {
                  if (selectedWeapon?.id !== weapon.id) {
                    e.currentTarget.style.background = 'transparent';
                  }
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{
                    color: selectedWeapon?.id === weapon.id ? '#c58602' : '#fff',
                    fontWeight: selectedWeapon?.id === weapon.id ? 'bold' : 'normal',
                  }}>
                    {weapon.name}
                  </span>
                  <span style={{ color: '#4CAF50', fontSize: '0.85rem', fontWeight: 'bold' }}>
                    {getWeaponDPS(weapon).toFixed(1)} DPS
                  </span>
                </div>
                <div style={{ fontSize: '0.75rem', color: '#888', marginTop: 4 }}>
                  {weapon.type} • {weapon.physicalMin}-{weapon.physicalMax} dmg • {weapon.attackRate} APS
                  {weapon.requirements.level ? ` • Lvl ${weapon.requirements.level}` : ''}
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Right Panel - Weapon Preview */}
      <div style={{
        width: 320,
        background: '#1a1a1a',
        border: '1px solid #333',
        borderRadius: 4,
        padding: 20,
      }}>
        {selectedWeapon ? (
          <>
            <h3 style={{ margin: '0 0 8px 0', color: '#c58602' }}>
              {selectedWeapon.name}
            </h3>
            <div style={{ color: '#888', fontSize: '0.85rem', marginBottom: 16 }}>
              {selectedWeapon.type}
            </div>

            {/* Stats */}
            <div style={{ display: 'grid', gap: 12, marginBottom: 20 }}>
              <StatRow label="Physical Damage" value={`${selectedWeapon.physicalMin}-${selectedWeapon.physicalMax}`} />
              {selectedWeapon.fireMin && selectedWeapon.fireMax && (
                <StatRow label="Fire Damage" value={`${selectedWeapon.fireMin}-${selectedWeapon.fireMax}`} color="#FF6B35" />
              )}
              {selectedWeapon.coldMin && selectedWeapon.coldMax && (
                <StatRow label="Cold Damage" value={`${selectedWeapon.coldMin}-${selectedWeapon.coldMax}`} color="#4FC3F7" />
              )}
              {selectedWeapon.lightningMin && selectedWeapon.lightningMax && (
                <StatRow label="Lightning Damage" value={`${selectedWeapon.lightningMin}-${selectedWeapon.lightningMax}`} color="#FFD54F" />
              )}
              <StatRow label="Attack Speed" value={`${selectedWeapon.attackRate} APS`} />
              <StatRow label="Critical Chance" value={`${selectedWeapon.critChance}%`} />
              <StatRow label="Average Damage" value={getAverageDamage(selectedWeapon).toFixed(1)} />
              <StatRow label="DPS" value={getWeaponDPS(selectedWeapon).toFixed(1)} color="#4CAF50" bold />
            </div>

            {/* Implicit */}
            {selectedWeapon.implicit && (
              <div style={{
                padding: 12,
                background: '#1a3020',
                borderRadius: 4,
                color: '#4CAF50',
                fontSize: '0.85rem',
                marginBottom: 16,
              }}>
                {selectedWeapon.implicit}
              </div>
            )}

            {/* Requirements */}
            <div style={{ borderTop: '1px solid #333', paddingTop: 12 }}>
              <div style={{ fontSize: '0.75rem', color: '#666', marginBottom: 8 }}>Requirements</div>
              <div style={{ display: 'flex', gap: 16, fontSize: '0.85rem' }}>
                {selectedWeapon.requirements.level && (
                  <span style={{ color: '#888' }}>
                    Level <span style={{ color: '#fff' }}>{selectedWeapon.requirements.level}</span>
                  </span>
                )}
                {selectedWeapon.requirements.str && (
                  <span style={{ color: '#888' }}>
                    Str <span style={{ color: '#E74C3C' }}>{selectedWeapon.requirements.str}</span>
                  </span>
                )}
                {selectedWeapon.requirements.dex && (
                  <span style={{ color: '#888' }}>
                    Dex <span style={{ color: '#2ECC71' }}>{selectedWeapon.requirements.dex}</span>
                  </span>
                )}
                {selectedWeapon.requirements.int && (
                  <span style={{ color: '#888' }}>
                    Int <span style={{ color: '#3498DB' }}>{selectedWeapon.requirements.int}</span>
                  </span>
                )}
              </div>
            </div>
          </>
        ) : (
          <div style={{ textAlign: 'center', color: '#666', padding: 40 }}>
            <div style={{ fontSize: '2rem', marginBottom: 12 }}>⚔️</div>
            <div>Select a weapon from the list</div>
          </div>
        )}
      </div>
    </div>
  );
};

// Helper component for stat rows
const StatRow: React.FC<{ label: string; value: string; color?: string; bold?: boolean }> = ({
  label, value, color = '#fff', bold = false
}) => (
  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem' }}>
    <span style={{ color: '#888' }}>{label}</span>
    <span style={{ color, fontWeight: bold ? 'bold' : 'normal' }}>{value}</span>
  </div>
);

export default Step1Weapon;
