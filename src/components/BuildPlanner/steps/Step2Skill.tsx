import React, { useState, useEffect, useMemo } from 'react';
import { WeaponBase } from '../../../data/weapons';
import { Skill, loadSkills } from '../../../data/skills';
import { getSkillsForWeapon, sortSkillsByRelevance, groupSkillsByElement } from '../../../services/weaponSkillMatcher';

interface Step2SkillProps {
  weapon: WeaponBase;
  selectedSkill: Skill | null;
  onSkillSelect: (skill: Skill | null) => void;
}

const ELEMENT_COLORS: Record<string, string> = {
  physical: '#FFFFFF',
  fire: '#FF6B35',
  cold: '#4FC3F7',
  lightning: '#FFD54F',
  chaos: '#8E44AD',
  other: '#888888',
};

const Step2Skill: React.FC<Step2SkillProps> = ({ weapon, selectedSkill, onSkillSelect }) => {
  const [allSkills, setAllSkills] = useState<Skill[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [elementFilter, setElementFilter] = useState<string>('');

  // Load skills on mount
  useEffect(() => {
    async function loadData() {
      try {
        setLoading(true);
        const skills = await loadSkills();
        setAllSkills(skills);
      } catch (err) {
        console.error('Failed to load skills:', err);
        setError('Failed to load skill data. Make sure the PoB files are accessible.');
      } finally {
        setLoading(false);
      }
    }
    loadData();
  }, []);

  // Get skills compatible with the selected weapon
  const compatibleSkills = useMemo(() => {
    if (!weapon || allSkills.length === 0) return [];
    const compatible = getSkillsForWeapon(weapon, allSkills);
    return sortSkillsByRelevance(compatible, weapon);
  }, [weapon, allSkills]);

  // Group by element for the filter
  const skillsByElement = useMemo(() => {
    return groupSkillsByElement(compatibleSkills);
  }, [compatibleSkills]);

  // Apply filters
  const filteredSkills = useMemo(() => {
    let result = compatibleSkills;

    if (elementFilter) {
      result = result.filter(s => (s.element || 'other') === elementFilter);
    }

    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      result = result.filter(s =>
        s.name.toLowerCase().includes(term) ||
        s.tagString.toLowerCase().includes(term)
      );
    }

    return result;
  }, [compatibleSkills, elementFilter, searchTerm]);

  if (loading) {
    return (
      <div style={{ padding: 40, textAlign: 'center', color: '#888' }}>
        Loading skills...
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
      {/* Left Panel - Skill List */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 300 }}>
        <h2 style={{ margin: '0 0 16px 0', color: '#c58602' }}>
          Step 2: Select Skill
        </h2>

        <div style={{ color: '#888', fontSize: '0.85rem', marginBottom: 16 }}>
          Showing {compatibleSkills.length} skills compatible with {weapon.name}
        </div>

        {/* Element Filter */}
        <div style={{ display: 'flex', gap: 8, marginBottom: 16, flexWrap: 'wrap' }}>
          <FilterButton
            active={elementFilter === ''}
            onClick={() => setElementFilter('')}
            label={`All (${compatibleSkills.length})`}
          />
          {Object.entries(skillsByElement).map(([element, skills]) => {
            if (skills.length === 0) return null;
            return (
              <FilterButton
                key={element}
                active={elementFilter === element}
                onClick={() => setElementFilter(element)}
                label={`${element.charAt(0).toUpperCase() + element.slice(1)} (${skills.length})`}
                color={ELEMENT_COLORS[element]}
              />
            );
          })}
        </div>

        {/* Search */}
        <div style={{ marginBottom: 16 }}>
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Search skills..."
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

        {/* Skill List */}
        <div style={{
          flex: 1,
          overflowY: 'auto',
          border: '1px solid #333',
          borderRadius: 4,
          background: '#1a1a1a',
        }}>
          {filteredSkills.length === 0 ? (
            <div style={{ padding: 24, textAlign: 'center', color: '#666' }}>
              No skills found
            </div>
          ) : (
            filteredSkills.map(skill => (
              <div
                key={skill.id}
                onClick={() => onSkillSelect(skill)}
                style={{
                  padding: '12px 16px',
                  borderBottom: '1px solid #333',
                  cursor: 'pointer',
                  background: selectedSkill?.id === skill.id ? '#2a2a2a' : 'transparent',
                  borderLeft: selectedSkill?.id === skill.id ? '3px solid #c58602' : '3px solid transparent',
                  transition: 'all 0.15s',
                }}
                onMouseEnter={(e) => {
                  if (selectedSkill?.id !== skill.id) {
                    e.currentTarget.style.background = '#222';
                  }
                }}
                onMouseLeave={(e) => {
                  if (selectedSkill?.id !== skill.id) {
                    e.currentTarget.style.background = 'transparent';
                  }
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{
                    color: selectedSkill?.id === skill.id ? '#c58602' : '#fff',
                    fontWeight: selectedSkill?.id === skill.id ? 'bold' : 'normal',
                  }}>
                    {skill.name}
                  </span>
                  {skill.element && (
                    <span style={{
                      padding: '2px 8px',
                      borderRadius: 4,
                      fontSize: '0.7rem',
                      fontWeight: 'bold',
                      background: `${ELEMENT_COLORS[skill.element]}22`,
                      color: ELEMENT_COLORS[skill.element],
                      textTransform: 'uppercase',
                    }}>
                      {skill.element}
                    </span>
                  )}
                </div>
                <div style={{ fontSize: '0.75rem', color: '#888', marginTop: 4 }}>
                  {skill.tagString || skill.tags.join(', ')}
                </div>
                {skill.weaponRequirements.length > 0 && (
                  <div style={{ fontSize: '0.7rem', color: '#666', marginTop: 4 }}>
                    Requires: {skill.weaponRequirements.join(' or ')}
                  </div>
                )}
              </div>
            ))
          )}
        </div>
      </div>

      {/* Right Panel - Skill Preview */}
      <div style={{
        width: 320,
        background: '#1a1a1a',
        border: '1px solid #333',
        borderRadius: 4,
        padding: 20,
      }}>
        {selectedSkill ? (
          <>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 }}>
              <h3 style={{ margin: 0, color: '#c58602' }}>
                {selectedSkill.name}
              </h3>
              {selectedSkill.element && (
                <span style={{
                  padding: '4px 10px',
                  borderRadius: 4,
                  fontSize: '0.75rem',
                  fontWeight: 'bold',
                  background: `${ELEMENT_COLORS[selectedSkill.element]}22`,
                  color: ELEMENT_COLORS[selectedSkill.element],
                  textTransform: 'uppercase',
                }}>
                  {selectedSkill.element}
                </span>
              )}
            </div>

            <div style={{ color: '#888', fontSize: '0.85rem', marginBottom: 16 }}>
              {selectedSkill.gemType} Gem • Tier {selectedSkill.tier}
            </div>

            {/* Tags */}
            <div style={{ marginBottom: 16 }}>
              <div style={{ fontSize: '0.75rem', color: '#666', marginBottom: 8 }}>Tags</div>
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                {selectedSkill.tags.map(tag => (
                  <span
                    key={tag}
                    style={{
                      padding: '3px 8px',
                      borderRadius: 4,
                      fontSize: '0.7rem',
                      background: '#333',
                      color: '#aaa',
                    }}
                  >
                    {tag}
                  </span>
                ))}
              </div>
            </div>

            {/* Weapon Requirements */}
            {selectedSkill.weaponRequirements.length > 0 && (
              <div style={{ marginBottom: 16 }}>
                <div style={{ fontSize: '0.75rem', color: '#666', marginBottom: 8 }}>Weapon Requirements</div>
                <div style={{ fontSize: '0.85rem', color: '#3498DB' }}>
                  {selectedSkill.weaponRequirements.join(' or ')}
                </div>
              </div>
            )}

            {/* Attribute Requirements */}
            <div style={{ borderTop: '1px solid #333', paddingTop: 12 }}>
              <div style={{ fontSize: '0.75rem', color: '#666', marginBottom: 8 }}>Attribute Requirements</div>
              <div style={{ display: 'flex', gap: 16, fontSize: '0.85rem' }}>
                {selectedSkill.reqStr > 0 && (
                  <span style={{ color: '#888' }}>
                    Str <span style={{ color: '#E74C3C' }}>{selectedSkill.reqStr}</span>
                  </span>
                )}
                {selectedSkill.reqDex > 0 && (
                  <span style={{ color: '#888' }}>
                    Dex <span style={{ color: '#2ECC71' }}>{selectedSkill.reqDex}</span>
                  </span>
                )}
                {selectedSkill.reqInt > 0 && (
                  <span style={{ color: '#888' }}>
                    Int <span style={{ color: '#3498DB' }}>{selectedSkill.reqInt}</span>
                  </span>
                )}
                {selectedSkill.reqStr === 0 && selectedSkill.reqDex === 0 && selectedSkill.reqInt === 0 && (
                  <span style={{ color: '#666' }}>None</span>
                )}
              </div>
            </div>

            {/* Description */}
            {selectedSkill.description && (
              <div style={{ marginTop: 16, padding: 12, background: '#222', borderRadius: 4 }}>
                <div style={{ fontSize: '0.8rem', color: '#aaa', lineHeight: 1.5 }}>
                  {selectedSkill.description}
                </div>
              </div>
            )}
          </>
        ) : (
          <div style={{ textAlign: 'center', color: '#666', padding: 40 }}>
            <div style={{ fontSize: '2rem', marginBottom: 12 }}>💎</div>
            <div>Select a skill from the list</div>
          </div>
        )}
      </div>
    </div>
  );
};

// Helper component for filter buttons
const FilterButton: React.FC<{
  active: boolean;
  onClick: () => void;
  label: string;
  color?: string;
}> = ({ active, onClick, label, color = '#c58602' }) => (
  <button
    onClick={onClick}
    style={{
      padding: '6px 12px',
      borderRadius: 4,
      border: active ? `1px solid ${color}` : '1px solid #444',
      background: active ? `${color}22` : 'transparent',
      color: active ? color : '#888',
      fontSize: '0.75rem',
      cursor: 'pointer',
      transition: 'all 0.15s',
    }}
  >
    {label}
  </button>
);

export default Step2Skill;
