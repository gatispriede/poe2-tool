import React from 'react';
import { render, screen } from '@testing-library/react';
import wandsData from '../Wands.json';

test('wands JSON contains at least 10 wands', () => {
  expect(wandsData.length).toBeGreaterThanOrEqual(10);
});

test('all wands have required properties', () => {
  wandsData.forEach(wand => {
    expect(wand).toHaveProperty('id');
    expect(wand).toHaveProperty('name');
    expect(wand).toHaveProperty('baseMin');
    expect(wand).toHaveProperty('baseMax');
    expect(wand).toHaveProperty('baseAPS');
    expect(wand).toHaveProperty('weaponType');
    expect(wand).toHaveProperty('itemLevel');
    expect(typeof wand.baseMin).toBe('number');
    expect(typeof wand.baseMax).toBe('number');
    expect(typeof wand.baseAPS).toBe('number');
    expect(wand.baseMin).toBeGreaterThan(0);
    expect(wand.baseMax).toBeGreaterThan(wand.baseMin);
    expect(wand.baseAPS).toBeGreaterThan(0);
  });
});

test('wands have proper weapon types', () => {
  const types = wandsData.map(wand => wand.weaponType);
  const uniqueTypes = [...new Set(types)];

  // Should have Wand and/or Sceptre types
  expect(uniqueTypes.some(type => type === 'Wand' || type === 'Sceptre')).toBe(true);
});

test('wands have unique IDs', () => {
  const ids = wandsData.map(wand => wand.id);
  const uniqueIds = [...new Set(ids)];
  expect(uniqueIds).toHaveLength(ids.length);
});

test('wands have progressive damage scaling', () => {
  // Sort by item level
  const sortedWands = [...wandsData].sort((a, b) => a.itemLevel - b.itemLevel);

  // Generally, higher level wands should have higher damage
  const lowLevelWand = sortedWands[0];
  const highLevelWand = sortedWands[sortedWands.length - 1];

  expect(highLevelWand.baseMax).toBeGreaterThan(lowLevelWand.baseMax);
});
