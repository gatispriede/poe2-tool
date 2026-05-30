import React from 'react';
import { render, screen } from '@testing-library/react';
import WeaponModSelector from '../WeaponModSelector';

// Mock the JSON import
jest.mock('../../../data/WeaponMods.json', () => ({
  prefixes: [
    {
      id: 'test-prefix',
      name: 'Test Prefix',
      description: 'A test prefix',
      type: 'prefix',
      tier: 1,
      effects: {
        localIncreasedPhysicalDamagePct: { min: 100, max: 150 }
      },
      itemLevelReq: 50
    }
  ],
  suffixes: [
    {
      id: 'test-suffix',
      name: 'Test Suffix',
      description: 'A test suffix',
      type: 'suffix',
      tier: 1,
      effects: {
        localIncreasedAttackSpeedPct: { min: 10, max: 15 }
      },
      itemLevelReq: 30
    }
  ]
}));

test('renders weapon mod selector with default state', () => {
  const mockOnModsChange = jest.fn();

  render(<WeaponModSelector onModsChange={mockOnModsChange} />);

  expect(screen.getByText('Weapon Modifiers')).toBeInTheDocument();
  expect(screen.getByText('Prefixes (0/3)')).toBeInTheDocument();
  expect(screen.getByText('Suffixes (0/3)')).toBeInTheDocument();
});

test('weapon mod selector component renders without crashing', () => {
  const mockOnModsChange = jest.fn();

  render(<WeaponModSelector onModsChange={mockOnModsChange} weaponItemLevel={60} />);

  // Just verify it renders without errors
  expect(screen.getByText('Weapon Modifiers')).toBeInTheDocument();
});
