import React from 'react';
import { render, screen } from '@testing-library/react';
import elementalSkills from '../ElementalSkillGems.json';

test('elemental skills JSON contains exactly 18 skills', () => {
  expect(elementalSkills).toHaveLength(18);
});

test('all elemental skills have required properties', () => {
  elementalSkills.forEach(skill => {
    expect(skill).toHaveProperty('id');
    expect(skill).toHaveProperty('name');
    expect(skill).toHaveProperty('description');
    expect(skill).toHaveProperty('moreDamageMultipliersPct');
    expect(skill).toHaveProperty('moreAttackSpeedMultipliersPct');
    expect(skill).toHaveProperty('type');
    expect(skill).toHaveProperty('element');
    expect(skill.type).toBe('Elemental');
    expect(Array.isArray(skill.moreDamageMultipliersPct)).toBe(true);
    expect(Array.isArray(skill.moreAttackSpeedMultipliersPct)).toBe(true);
  });
});

test('elemental skills have proper element distribution', () => {
  const elements = elementalSkills.reduce((acc, skill) => {
    acc[skill.element] = (acc[skill.element] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  // Should have Fire, Cold, Lightning skills
  expect(elements.Fire).toBeGreaterThan(0);
  expect(elements.Cold).toBeGreaterThan(0);
  expect(elements.Lightning).toBeGreaterThan(0);

  // Total should be 18
  const total = Object.values(elements).reduce((sum, count) => sum + count, 0);
  expect(total).toBe(18);
});

test('elemental skills have unique IDs', () => {
  const ids = elementalSkills.map(skill => skill.id);
  const uniqueIds = [...new Set(ids)];
  expect(uniqueIds).toHaveLength(ids.length);
});
