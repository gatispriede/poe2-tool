import fs from 'fs';
import path from 'path';

test('passive_skills.csv has expected headers', () => {
  const file = path.resolve(__dirname, '../../passives/passive_skills.csv');
  const text = fs.readFileSync(file, 'utf8');
  const [firstLine] = text.split(/\r?\n/);
  expect(firstLine).toBe('id,name,stat_lines');
});

test('sample rows exist', () => {
  const file = path.resolve(__dirname, '../../passives/passive_skills.csv');
  const lines = fs.readFileSync(file, 'utf8').trim().split(/\r?\n/).slice(1);
  expect(lines.length).toBeGreaterThanOrEqual(2);
});

