import React from 'react';
import { render, screen } from '@testing-library/react';
import WeaponSelector from '../WeaponSelector';

// Mock the JSON import
jest.mock('../../../data/Wands.json', () => [
  {
    id: 'test-wand',
    name: 'Test Wand',
    baseMin: 10,
    baseMax: 20,
    baseAPS: 1.3,
    localIncreasedDamagePct: 15,
    weaponType: 'Wand',
    itemLevel: 10,
    description: 'A test wand'
  }
]);

test('renders weapon selector with default state', () => {
  const mockOnWeaponChange = jest.fn();

  render(<WeaponSelector onWeaponChange={mockOnWeaponChange} />);

  expect(screen.getByText('Weapon Selection')).toBeInTheDocument();
  expect(screen.getByText('Filter by Type:')).toBeInTheDocument();
  expect(screen.getByText('Choose Weapon:')).toBeInTheDocument();
  expect(screen.getByDisplayValue('-- No Weapon Selected --')).toBeInTheDocument();
});

test('weapon selector component renders without crashing', () => {
  const mockOnWeaponChange = jest.fn();

  render(<WeaponSelector onWeaponChange={mockOnWeaponChange} />);

  // Just verify it renders without errors
  expect(screen.getByText('Weapon Selection')).toBeInTheDocument();
});
