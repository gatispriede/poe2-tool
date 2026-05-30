import React from 'react';
import { render, screen } from '@testing-library/react';
import weaponMods from '../WeaponMods.json';

test('weapon mods JSON contains prefixes and suffixes', () => {
  expect(weaponMods).toHaveProperty('prefixes');
  expect(weaponMods).toHaveProperty('suffixes');
  expect(Array.isArray(weaponMods.prefixes)).toBe(true);
  expect(Array.isArray(weaponMods.suffixes)).toBe(true);
});

test('all weapon mods have required properties', () => {
  [...weaponMods.prefixes, ...weaponMods.suffixes].forEach(mod => {
    expect(mod).toHaveProperty('id');
    expect(mod).toHaveProperty('name');
    expect(mod).toHaveProperty('description');
    expect(mod).toHaveProperty('type');
    expect(mod).toHaveProperty('tier');
    expect(mod).toHaveProperty('effects');
    expect(mod).toHaveProperty('itemLevelReq');
    expect(['prefix', 'suffix']).toContain(mod.type);
    expect(typeof mod.tier).toBe('number');
    expect(typeof mod.itemLevelReq).toBe('number');
    expect(typeof mod.effects).toBe('object');
  });
});

test('weapon mod effects have valid ranges', () => {
  [...weaponMods.prefixes, ...weaponMods.suffixes].forEach(mod => {
    Object.values(mod.effects).forEach(effect => {
      expect(effect).toHaveProperty('min');
      expect(effect).toHaveProperty('max');
      expect(typeof effect.min).toBe('number');
      expect(typeof effect.max).toBe('number');
      expect(effect.max).toBeGreaterThanOrEqual(effect.min);
    });
  });
});

test('weapon mods have unique IDs', () => {
  const allMods = [...weaponMods.prefixes, ...weaponMods.suffixes];
  const ids = allMods.map(mod => mod.id);
  const uniqueIds = [...new Set(ids)];
  expect(uniqueIds).toHaveLength(ids.length);
});

test('weapon mods have reasonable tier distribution', () => {
  const prefixTiers = weaponMods.prefixes.map(mod => mod.tier);
  const suffixTiers = weaponMods.suffixes.map(mod => mod.tier);

  // Should have multiple tiers
  expect(new Set(prefixTiers).size).toBeGreaterThan(1);
  expect(new Set(suffixTiers).size).toBeGreaterThan(1);

  // Tiers should be reasonable (1-5)
  expect(Math.max(...prefixTiers)).toBeLessThanOrEqual(5);
  expect(Math.max(...suffixTiers)).toBeLessThanOrEqual(5);
  expect(Math.min(...prefixTiers)).toBeGreaterThanOrEqual(1);
  expect(Math.min(...suffixTiers)).toBeGreaterThanOrEqual(1);
});
