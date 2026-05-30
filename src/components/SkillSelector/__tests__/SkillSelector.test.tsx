import React from 'react';
import { render, screen } from '@testing-library/react';
import SkillSelector from '../SkillSelector';

// Mock the JSON import
jest.mock('../../../data/SkillGems.json', () => [
  {
    id: 'test-skill',
    name: 'Test Skill',
    description: 'A test skill',
    moreDamageMultipliersPct: [25],
    moreAttackSpeedMultipliersPct: [10],
    type: 'Attack'
  }
]);

test('renders skill selector with default state', () => {
  const mockOnSkillChange = jest.fn();

  render(<SkillSelector onSkillChange={mockOnSkillChange} />);

  expect(screen.getByText('Skill Selection')).toBeInTheDocument();
  expect(screen.getByText('Choose Skill:')).toBeInTheDocument();
  expect(screen.getByDisplayValue('-- No Skill Selected --')).toBeInTheDocument();
});

test('skill selector component renders without crashing', () => {
  const mockOnSkillChange = jest.fn();

  render(<SkillSelector onSkillChange={mockOnSkillChange} />);

  // Just verify it renders without errors
  expect(screen.getByText('Skill Selection')).toBeInTheDocument();
});
