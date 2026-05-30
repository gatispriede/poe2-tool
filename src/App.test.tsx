import React from 'react';
import { render, screen } from '@testing-library/react';
import App from './App';

test('renders damage calculator heading', () => {
  render(<App />);
  const heading = screen.getByText(/PoE2 Simplified Damage Calculator/i);
  expect(heading).toBeInTheDocument();
});
