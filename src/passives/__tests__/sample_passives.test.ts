import fs from 'fs';
import path from 'path';

test('sample_passive_skills.json populated by extractor', () => {
  const file = path.resolve(__dirname, '../../passives/sample_passive_skills.json');
  const text = fs.readFileSync(file, 'utf8');
  const data = JSON.parse(text);
  expect(Array.isArray(data)).toBe(true);
  // After extraction should have at least one row with id, name, calculation
  expect(data.length).toBeGreaterThan(0);
  const first = data[0];
  expect(first).toHaveProperty('id');
  expect(first).toHaveProperty('name');
  expect(first).toHaveProperty('calculation');
  expect(first.calculation).toHaveProperty('physMultiplier');
});
