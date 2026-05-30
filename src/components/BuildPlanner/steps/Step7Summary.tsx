import React, { useMemo } from 'react';
import { WeaponBase } from '../../../data/weapons';
import { Skill } from '../../../data/skills';
import { ItemMod } from '../../../data/mods';
import { PassiveNode, GeneratedItem, UniqueItem } from '../../../hooks/useBuildState';

interface Step7SummaryProps {
  weapon: WeaponBase;
  skill: Skill;
  weaponMods: { prefixes: ItemMod[]; suffixes: ItemMod[] };
  passives: PassiveNode[];
  equipment: Record<string, GeneratedItem>;
  uniques: UniqueItem[];
}

// Calculate total stats from all build components
function calculateTotalStats(
  weapon: WeaponBase,
  skill: Skill,
  weaponMods: { prefixes: ItemMod[]; suffixes: ItemMod[] },
  passives: PassiveNode[],
  equipment: Record<string, GeneratedItem>,
  uniques: UniqueItem[]
) {
  const stats = {
    // Offensive
    physicalDamagePercent: 0,
    addedPhysicalMin: 0,
    addedPhysicalMax: 0,
    elementalDamagePercent: 0,
    spellDamagePercent: 0,
    attackSpeedPercent: 0,
    castSpeedPercent: 0,
    critChancePercent: 0,
    critMultiplierPercent: 0,
    fireDamagePercent: 0,
    coldDamagePercent: 0,
    lightningDamagePercent: 0,
    // Defensive
    maxLife: 0,
    maxLifePercent: 0,
    maxEnergyShield: 0,
    maxEnergyShieldPercent: 0,
    fireResistance: 0,
    coldResistance: 0,
    lightningResistance: 0,
    chaosResistance: 0,
    armour: 0,
    armourPercent: 0,
    evasion: 0,
    evasionPercent: 0,
  };

  const isSpell = skill.gemType === 'Spell';

  // --- WEAPON BASE STATS ---
  // Base weapon damage
  const baseWeaponDamage = (weapon.physicalMin + weapon.physicalMax) / 2;

  // --- WEAPON MODS ---
  const allWeaponMods = [...weaponMods.prefixes, ...weaponMods.suffixes];
  for (const mod of allWeaponMods) {
    const text = mod.statText?.toLowerCase() || '';
    const avgValue = (mod.statMin + mod.statMax) / 2;

    // Physical damage %
    if (text.includes('physical damage') && text.includes('%')) {
      stats.physicalDamagePercent += avgValue;
    }
    // Added physical damage
    else if (text.includes('adds') && text.includes('physical damage')) {
      // Parse min-max from statText like "Adds (10-15) to (20-25) Physical Damage"
      const match = text.match(/adds?\s*\(?\d+[-–]\d+\)?\s*to\s*\(?\d+[-–]\d+\)?/i);
      if (match) {
        // Rough estimation
        stats.addedPhysicalMin += avgValue * 0.4;
        stats.addedPhysicalMax += avgValue * 0.6;
      } else {
        stats.addedPhysicalMin += avgValue / 2;
        stats.addedPhysicalMax += avgValue;
      }
    }
    // Attack speed
    else if (text.includes('attack speed')) {
      stats.attackSpeedPercent += avgValue;
    }
    // Cast speed
    else if (text.includes('cast speed')) {
      stats.castSpeedPercent += avgValue;
    }
    // Critical chance
    else if (text.includes('critical strike chance')) {
      stats.critChancePercent += avgValue;
    }
    // Critical multiplier
    else if (text.includes('critical strike multiplier') || text.includes('critical damage')) {
      stats.critMultiplierPercent += avgValue;
    }
    // Spell damage
    else if (text.includes('spell damage')) {
      stats.spellDamagePercent += avgValue;
    }
    // Fire damage
    else if (text.includes('fire damage')) {
      stats.fireDamagePercent += avgValue;
    }
    // Cold damage
    else if (text.includes('cold damage')) {
      stats.coldDamagePercent += avgValue;
    }
    // Lightning damage
    else if (text.includes('lightning damage')) {
      stats.lightningDamagePercent += avgValue;
    }
  }

  // --- PASSIVE STATS ---
  for (const node of passives) {
    for (const [statKey, value] of Object.entries(node.stats || {})) {
      const key = statKey.toLowerCase();

      if (key.includes('physical_damage') || key.includes('physical damage')) {
        stats.physicalDamagePercent += value;
      }
      if (key.includes('spell_damage') || key.includes('spell damage')) {
        stats.spellDamagePercent += value;
      }
      if (key.includes('attack_speed') || key.includes('attack speed')) {
        stats.attackSpeedPercent += value;
      }
      if (key.includes('cast_speed') || key.includes('cast speed')) {
        stats.castSpeedPercent += value;
      }
      if (key.includes('critical_chance') || key.includes('critical strike chance')) {
        stats.critChancePercent += value;
      }
      if (key.includes('critical_multi') || key.includes('critical strike multiplier')) {
        stats.critMultiplierPercent += value;
      }
      if (key.includes('fire_damage') || key.includes('fire damage')) {
        stats.fireDamagePercent += value;
      }
      if (key.includes('cold_damage') || key.includes('cold damage')) {
        stats.coldDamagePercent += value;
      }
      if (key.includes('lightning_damage') || key.includes('lightning damage')) {
        stats.lightningDamagePercent += value;
      }
      if (key.includes('elemental_damage') || key.includes('elemental damage')) {
        stats.elementalDamagePercent += value;
      }
      if (key.includes('maximum_life') || key.includes('life')) {
        if (key.includes('%') || key.includes('percent')) {
          stats.maxLifePercent += value;
        } else {
          stats.maxLife += value;
        }
      }
      if (key.includes('energy_shield') || key.includes('energy shield')) {
        if (key.includes('%') || key.includes('percent')) {
          stats.maxEnergyShieldPercent += value;
        } else {
          stats.maxEnergyShield += value;
        }
      }
    }
  }

  // --- EQUIPMENT STATS ---
  for (const item of Object.values(equipment)) {
    const allMods = [...(item.prefixes || []), ...(item.suffixes || [])];
    for (const mod of allMods) {
      const text = mod.statText?.toLowerCase() || '';
      const avgValue = (mod.statMin + mod.statMax) / 2;

      // Spell damage
      if (text.includes('spell damage')) {
        stats.spellDamagePercent += avgValue;
      }
      // Cast speed
      else if (text.includes('cast speed')) {
        stats.castSpeedPercent += avgValue;
      }
      // Attack speed
      else if (text.includes('attack speed')) {
        stats.attackSpeedPercent += avgValue;
      }
      // Critical
      else if (text.includes('critical strike chance')) {
        stats.critChancePercent += avgValue;
      }
      else if (text.includes('critical strike multiplier')) {
        stats.critMultiplierPercent += avgValue;
      }
      // Life
      else if (text.includes('maximum life') || (text.includes('life') && !text.includes('leech'))) {
        if (text.includes('%')) {
          stats.maxLifePercent += avgValue;
        } else {
          stats.maxLife += avgValue;
        }
      }
      // Energy shield
      else if (text.includes('energy shield')) {
        if (text.includes('%')) {
          stats.maxEnergyShieldPercent += avgValue;
        } else {
          stats.maxEnergyShield += avgValue;
        }
      }
      // Resistances
      else if (text.includes('fire resistance')) {
        stats.fireResistance += avgValue;
      }
      else if (text.includes('cold resistance')) {
        stats.coldResistance += avgValue;
      }
      else if (text.includes('lightning resistance')) {
        stats.lightningResistance += avgValue;
      }
      else if (text.includes('chaos resistance')) {
        stats.chaosResistance += avgValue;
      }
      else if (text.includes('all elemental resistance') || text.includes('all resistances')) {
        stats.fireResistance += avgValue;
        stats.coldResistance += avgValue;
        stats.lightningResistance += avgValue;
      }
      // Armour
      else if (text.includes('armour')) {
        if (text.includes('%')) {
          stats.armourPercent += avgValue;
        } else {
          stats.armour += avgValue;
        }
      }
      // Evasion
      else if (text.includes('evasion')) {
        if (text.includes('%')) {
          stats.evasionPercent += avgValue;
        } else {
          stats.evasion += avgValue;
        }
      }
    }
  }

  // Cap resistances at 75%
  stats.fireResistance = Math.min(75, stats.fireResistance);
  stats.coldResistance = Math.min(75, stats.coldResistance);
  stats.lightningResistance = Math.min(75, stats.lightningResistance);
  stats.chaosResistance = Math.min(75, stats.chaosResistance);

  // Calculate effective damage
  let effectiveDamage = 0;

  if (isSpell) {
    // Base spell damage (from skill - using a placeholder base)
    const baseSpellDamage = 100; // Placeholder base spell damage
    const damageMultiplier = 1 + (stats.spellDamagePercent / 100) + (stats.elementalDamagePercent / 100);
    const speedMultiplier = 1 + (stats.castSpeedPercent / 100);
    const critMultiplier = 1 + ((stats.critChancePercent / 100) * (stats.critMultiplierPercent / 100));

    // Element-specific multiplier
    let elementMultiplier = 1;
    const element = skill.element?.toLowerCase();
    if (element === 'fire') elementMultiplier += stats.fireDamagePercent / 100;
    else if (element === 'cold') elementMultiplier += stats.coldDamagePercent / 100;
    else if (element === 'lightning') elementMultiplier += stats.lightningDamagePercent / 100;
    else if (element === 'physical') elementMultiplier += stats.physicalDamagePercent / 100;

    effectiveDamage = baseSpellDamage * damageMultiplier * elementMultiplier * speedMultiplier * critMultiplier;
  } else {
    // Attack damage from weapon
    const weaponDamage = baseWeaponDamage * (1 + stats.physicalDamagePercent / 100);
    const addedDamage = (stats.addedPhysicalMin + stats.addedPhysicalMax) / 2;
    const totalDamage = weaponDamage + addedDamage;

    const speedMultiplier = 1 + (stats.attackSpeedPercent / 100);
    const attacksPerSecond = weapon.attackRate * speedMultiplier;
    const critMultiplier = 1 + ((stats.critChancePercent / 100) * (stats.critMultiplierPercent / 100));

    effectiveDamage = totalDamage * attacksPerSecond * critMultiplier;
  }

  // Calculate effective life
  const baseLife = 50 + 12 * 90; // Level 90 base life estimate
  const effectiveLife = (baseLife + stats.maxLife) * (1 + stats.maxLifePercent / 100);

  // Calculate effective energy shield
  const effectiveES = stats.maxEnergyShield * (1 + stats.maxEnergyShieldPercent / 100);

  return {
    ...stats,
    effectiveDamage: Math.round(effectiveDamage),
    effectiveLife: Math.round(effectiveLife),
    effectiveES: Math.round(effectiveES),
    isSpell,
  };
}

const Step7Summary: React.FC<Step7SummaryProps> = ({
  weapon,
  skill,
  weaponMods,
  passives,
  equipment,
  uniques,
}) => {
  const totalStats = useMemo(() =>
    calculateTotalStats(weapon, skill, weaponMods, passives, equipment, uniques),
    [weapon, skill, weaponMods, passives, equipment, uniques]
  );

  const StatBar: React.FC<{ label: string; value: number; max: number; color: string; suffix?: string }> = ({
    label, value, max, color, suffix = '%'
  }) => (
    <div style={{ marginBottom: 8 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 2 }}>
        <span style={{ color: '#888', fontSize: '0.8rem' }}>{label}</span>
        <span style={{ color, fontSize: '0.8rem', fontWeight: 'bold' }}>
          {value.toFixed(0)}{suffix}
        </span>
      </div>
      <div style={{
        height: 6,
        background: '#222',
        borderRadius: 3,
        overflow: 'hidden',
      }}>
        <div style={{
          width: `${Math.min(100, (value / max) * 100)}%`,
          height: '100%',
          background: color,
          borderRadius: 3,
        }} />
      </div>
    </div>
  );

  const ResistanceBar: React.FC<{ element: string; value: number; color: string }> = ({
    element, value, color
  }) => {
    const isCapped = value >= 75;
    return (
      <div style={{
        display: 'flex',
        alignItems: 'center',
        gap: 8,
        padding: '6px 10px',
        background: isCapped ? `${color}22` : '#1a1a1a',
        border: `1px solid ${isCapped ? color : '#333'}`,
        borderRadius: 4,
      }}>
        <span style={{ color, fontSize: '1rem' }}>
          {element === 'Fire' ? '🔥' : element === 'Cold' ? '❄️' : element === 'Lightning' ? '⚡' : '💀'}
        </span>
        <span style={{ color: '#888', fontSize: '0.8rem', flex: 1 }}>{element}</span>
        <span style={{
          color: isCapped ? '#2ECC71' : color,
          fontWeight: 'bold',
          fontSize: '0.9rem',
        }}>
          {value}%
          {isCapped && <span style={{ marginLeft: 4, fontSize: '0.7rem' }}>(MAX)</span>}
        </span>
      </div>
    );
  };

  return (
    <div style={{ display: 'flex', gap: 24, height: '100%' }}>
      {/* Left Panel - Damage Stats */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
        <h2 style={{ margin: '0 0 16px 0', color: '#c58602' }}>
          Build Summary
        </h2>

        <div style={{ color: '#888', fontSize: '0.85rem', marginBottom: 16 }}>
          {weapon.name} + {skill.name} ({totalStats.isSpell ? 'Spell' : 'Attack'} Build)
        </div>

        {/* Effective DPS */}
        <div style={{
          background: 'linear-gradient(135deg, #1a1a1a 0%, #2a2a2a 100%)',
          border: '2px solid #c58602',
          borderRadius: 8,
          padding: 20,
          marginBottom: 20,
          textAlign: 'center',
        }}>
          <div style={{ color: '#888', fontSize: '0.8rem', marginBottom: 4 }}>
            Estimated Effective DPS
          </div>
          <div style={{
            color: '#c58602',
            fontSize: '2.5rem',
            fontWeight: 'bold',
            textShadow: '0 0 20px rgba(197, 134, 2, 0.3)',
          }}>
            {totalStats.effectiveDamage.toLocaleString()}
          </div>
          <div style={{ color: '#666', fontSize: '0.75rem', marginTop: 4 }}>
            Based on all selected mods, passives, and equipment
          </div>
        </div>

        {/* Offensive Stats */}
        <div style={{
          background: '#1a1a1a',
          border: '1px solid #333',
          borderRadius: 4,
          padding: 16,
          marginBottom: 16,
        }}>
          <h3 style={{ margin: '0 0 12px 0', color: '#e74c3c', fontSize: '0.9rem' }}>
            Offensive Stats
          </h3>

          {totalStats.isSpell ? (
            <>
              <StatBar label="Spell Damage" value={totalStats.spellDamagePercent} max={300} color="#8888ff" />
              <StatBar label="Cast Speed" value={totalStats.castSpeedPercent} max={100} color="#88ff88" />
            </>
          ) : (
            <>
              <StatBar label="Physical Damage" value={totalStats.physicalDamagePercent} max={300} color="#e74c3c" />
              <StatBar label="Attack Speed" value={totalStats.attackSpeedPercent} max={100} color="#88ff88" />
            </>
          )}

          <StatBar label="Critical Chance" value={totalStats.critChancePercent} max={100} color="#f1c40f" />
          <StatBar label="Critical Multiplier" value={totalStats.critMultiplierPercent} max={200} color="#f39c12" />

          {totalStats.fireDamagePercent > 0 && (
            <StatBar label="Fire Damage" value={totalStats.fireDamagePercent} max={200} color="#e74c3c" />
          )}
          {totalStats.coldDamagePercent > 0 && (
            <StatBar label="Cold Damage" value={totalStats.coldDamagePercent} max={200} color="#3498db" />
          )}
          {totalStats.lightningDamagePercent > 0 && (
            <StatBar label="Lightning Damage" value={totalStats.lightningDamagePercent} max={200} color="#f1c40f" />
          )}
          {totalStats.elementalDamagePercent > 0 && (
            <StatBar label="Elemental Damage" value={totalStats.elementalDamagePercent} max={200} color="#9b59b6" />
          )}
        </div>
      </div>

      {/* Right Panel - Defensive Stats */}
      <div style={{ width: 340 }}>
        {/* Life/ES */}
        <div style={{
          background: '#1a1a1a',
          border: '1px solid #333',
          borderRadius: 4,
          padding: 16,
          marginBottom: 16,
        }}>
          <h3 style={{ margin: '0 0 12px 0', color: '#2ECC71', fontSize: '0.9rem' }}>
            Effective Health Pool
          </h3>

          <div style={{
            display: 'grid',
            gridTemplateColumns: '1fr 1fr',
            gap: 12,
          }}>
            <div style={{
              background: '#222',
              borderRadius: 4,
              padding: 12,
              textAlign: 'center',
            }}>
              <div style={{ color: '#e74c3c', fontSize: '1.5rem', fontWeight: 'bold' }}>
                {totalStats.effectiveLife.toLocaleString()}
              </div>
              <div style={{ color: '#888', fontSize: '0.75rem' }}>Life</div>
              <div style={{ color: '#555', fontSize: '0.65rem' }}>
                +{totalStats.maxLifePercent.toFixed(0)}% from gear
              </div>
            </div>

            <div style={{
              background: '#222',
              borderRadius: 4,
              padding: 12,
              textAlign: 'center',
            }}>
              <div style={{ color: '#3498db', fontSize: '1.5rem', fontWeight: 'bold' }}>
                {totalStats.effectiveES.toLocaleString()}
              </div>
              <div style={{ color: '#888', fontSize: '0.75rem' }}>Energy Shield</div>
              <div style={{ color: '#555', fontSize: '0.65rem' }}>
                +{totalStats.maxEnergyShieldPercent.toFixed(0)}% from gear
              </div>
            </div>
          </div>
        </div>

        {/* Resistances */}
        <div style={{
          background: '#1a1a1a',
          border: '1px solid #333',
          borderRadius: 4,
          padding: 16,
          marginBottom: 16,
        }}>
          <h3 style={{ margin: '0 0 12px 0', color: '#3498db', fontSize: '0.9rem' }}>
            Resistances (Max 75%)
          </h3>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <ResistanceBar element="Fire" value={totalStats.fireResistance} color="#e74c3c" />
            <ResistanceBar element="Cold" value={totalStats.coldResistance} color="#3498db" />
            <ResistanceBar element="Lightning" value={totalStats.lightningResistance} color="#f1c40f" />
            <ResistanceBar element="Chaos" value={totalStats.chaosResistance} color="#9b59b6" />
          </div>
        </div>

        {/* Build Breakdown */}
        <div style={{
          background: '#1a1a1a',
          border: '1px solid #333',
          borderRadius: 4,
          padding: 16,
        }}>
          <h3 style={{ margin: '0 0 12px 0', color: '#888', fontSize: '0.9rem' }}>
            Build Components
          </h3>

          <div style={{ fontSize: '0.8rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 0', borderBottom: '1px solid #333' }}>
              <span style={{ color: '#888' }}>Weapon</span>
              <span style={{ color: '#c58602' }}>{weapon.name}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 0', borderBottom: '1px solid #333' }}>
              <span style={{ color: '#888' }}>Skill</span>
              <span style={{ color: '#2ECC71' }}>{skill.name}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 0', borderBottom: '1px solid #333' }}>
              <span style={{ color: '#888' }}>Weapon Mods</span>
              <span style={{ color: '#8888ff' }}>
                {weaponMods.prefixes.length}P / {weaponMods.suffixes.length}S
              </span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 0', borderBottom: '1px solid #333' }}>
              <span style={{ color: '#888' }}>Passive Points</span>
              <span style={{ color: '#9b59b6' }}>{passives.length}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 0', borderBottom: '1px solid #333' }}>
              <span style={{ color: '#888' }}>Equipment Slots</span>
              <span style={{ color: '#3498db' }}>{Object.keys(equipment).length}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 0' }}>
              <span style={{ color: '#888' }}>Unique Items</span>
              <span style={{ color: '#AF6025' }}>{uniques.length}</span>
            </div>
          </div>
        </div>

        {/* Export Notice */}
        <div style={{
          marginTop: 16,
          padding: 12,
          background: '#2a2a2a',
          borderRadius: 4,
          textAlign: 'center',
        }}>
          <div style={{ color: '#c58602', fontSize: '0.9rem', fontWeight: 'bold', marginBottom: 4 }}>
            Build Complete!
          </div>
          <div style={{ color: '#666', fontSize: '0.75rem' }}>
            Use the step navigator above to refine your choices
          </div>
        </div>
      </div>
    </div>
  );
};

export default Step7Summary;
