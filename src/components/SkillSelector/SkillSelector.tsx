import React, { useState, useEffect } from 'react';

export interface SkillGem {
  id: string;
  name: string;
  description: string;
  moreDamageMultipliersPct: number[];
  moreAttackSpeedMultipliersPct: number[];
  type: string;
  element?: string | null; // Optional element property for elemental skills
  gemType?: string; // Attack, Spell, Minion, Buff, etc.
  tags?: string[]; // Skill tags like 'slam', 'strike', 'projectile', etc.
  tagString?: string; // Human readable tags
  weaponRequirements?: string | null; // Required weapon type
  requirements?: {
    str: number;
    dex: number;
    int: number;
  };
  tier?: number; // Skill tier/level requirement
  source?: string; // Source of skill data (e.g., 'PathOfBuilding-PoE2')
}

interface SkillSelectorProps {
  onSkillChange: (skill: SkillGem | null) => void;
  selectedSkillId?: string;
}

const SkillSelector: React.FC<SkillSelectorProps> = ({ onSkillChange, selectedSkillId }) => {
  const [skills, setSkills] = useState<SkillGem[]>([]);
  const [selectedSkill, setSelectedSkill] = useState<SkillGem | null>(null);

  useEffect(() => {
    // Load skills from all sources: regular skills, elemental skills, and PoB2 skills
    Promise.all([
      import('../../data/SkillGems.json').then(mod => (mod as any).default || (mod as any)).catch(() => []),
      import('../../data/ElementalSkillGems.json').then(mod => (mod as any).default || (mod as any)).catch(() => []),
      import('../../data/PoBSkills.json').then(mod => (mod as any).default || (mod as any)).catch(() => [])
    ]).then(([regularSkills, elementalSkills, pobSkills]) => {
      // PoB skills take priority, then elemental, then regular
      const allSkills = [...pobSkills, ...elementalSkills, ...regularSkills];
      // Remove duplicates by ID, keeping the first occurrence (PoB skills have priority)
      const uniqueSkills = allSkills.filter((skill, index, self) =>
        index === self.findIndex(s => s.id === skill.id)
      );
      setSkills(uniqueSkills);

      // Set initial selection if provided
      if (selectedSkillId) {
        const initial = uniqueSkills.find((s: SkillGem) => s.id === selectedSkillId);
        if (initial) {
          setSelectedSkill(initial);
          onSkillChange(initial);
        }
      }
    }).catch(() => {
      console.warn('Could not load skill gems data');
      setSkills([]);
    });
  }, [selectedSkillId, onSkillChange]);

  const handleSkillChange = (event: React.ChangeEvent<HTMLSelectElement>) => {
    const skillId = event.target.value;

    if (skillId === '') {
      setSelectedSkill(null);
      onSkillChange(null);
      return;
    }

    const skill = skills.find(s => s.id === skillId);
    if (skill) {
      setSelectedSkill(skill);
      onSkillChange(skill);
    }
  };

  const getSkillsByType = (type: string) => {
    return skills.filter(skill => (skill.gemType || skill.type) === type);
  };

  // Use gemType if available for grouping
  const skillTypes = Array.from(new Set(skills.map(skill => skill.gemType || skill.type))).sort();

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      <h3 style={{ margin: 0, fontSize: '1rem' }}>Skill Selection</h3>

      <label style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
        <span>Choose Skill:</span>
        <select
          value={selectedSkill?.id || ''}
          onChange={handleSkillChange}
          style={{ padding: '4px', background: '#222', color: '#fff', border: '1px solid #444', borderRadius: 4 }}
        >
          <option value="">-- No Skill Selected --</option>
          {skillTypes.map(type => (
            <optgroup key={type} label={`${type} Skills`}>
              {getSkillsByType(type).map(skill => (
                <option key={skill.id} value={skill.id}>
                  {skill.name}
                </option>
              ))}
            </optgroup>
          ))}
        </select>
      </label>

      {selectedSkill && (
        <div style={{
          background: '#1a1a1a',
          padding: '8px',
          borderRadius: 4,
          border: '1px solid #333'
        }}>
          <div style={{ marginBottom: 8, display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
            <strong style={{ color: '#c58602' }}>{selectedSkill.name}</strong>
            <span style={{
              fontSize: '0.7rem',
              color: '#888',
              background: '#333',
              padding: '2px 6px',
              borderRadius: 3
            }}>
              {selectedSkill.gemType || selectedSkill.type}
            </span>
            {selectedSkill.element && (
              <span style={{
                fontSize: '0.7rem',
                color: getElementColor(selectedSkill.element),
                background: '#222',
                padding: '2px 6px',
                borderRadius: 3,
                border: `1px solid ${getElementColor(selectedSkill.element)}33`
              }}>
                {selectedSkill.element}
              </span>
            )}
            {selectedSkill.source === 'PathOfBuilding-PoE2' && (
              <span style={{
                fontSize: '0.6rem',
                color: '#4CAF50',
                background: '#1a3020',
                padding: '2px 6px',
                borderRadius: 3
              }}>
                PoB2
              </span>
            )}
          </div>

          <div style={{ fontSize: '0.8rem', color: '#ccc', marginBottom: 8 }}>
            {selectedSkill.description}
          </div>

          {selectedSkill.weaponRequirements && (
            <div style={{ fontSize: '0.7rem', color: '#FF9800', marginBottom: 8 }}>
              Requires: {selectedSkill.weaponRequirements}
            </div>
          )}

          {selectedSkill.tagString && (
            <div style={{ fontSize: '0.7rem', color: '#888', marginBottom: 8 }}>
              Tags: {selectedSkill.tagString}
            </div>
          )}

          <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
            {selectedSkill.moreDamageMultipliersPct.length > 0 && (
              <div style={{ fontSize: '0.7rem' }}>
                <span style={{ color: '#4CAF50' }}>More Damage: </span>
                <span>{selectedSkill.moreDamageMultipliersPct.join(', ')}%</span>
              </div>
            )}
            {selectedSkill.moreAttackSpeedMultipliersPct.length > 0 && (
              <div style={{ fontSize: '0.7rem' }}>
                <span style={{ color: '#2196F3' }}>More Attack Speed: </span>
                <span>{selectedSkill.moreAttackSpeedMultipliersPct.join(', ')}%</span>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

// Helper function to get element color
function getElementColor(element: string): string {
  switch (element.toLowerCase()) {
    case 'fire': return '#FF6B35';
    case 'cold': return '#4FC3F7';
    case 'lightning': return '#FFD54F';
    case 'mixed': return '#AB47BC';
    case 'physical': return '#FFFFFF';
    case 'chaos': return '#8E44AD';
    default: return '#888';
  }
}

export default SkillSelector;
