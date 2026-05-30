import fs from 'fs';
import path from 'path';

test('wiki_table json file exists and has sample nodes', () => {
  const file = path.resolve(__dirname, '../../passives/passive_skills_wiki_table.json');
  const text = fs.readFileSync(file, 'utf8');
  const data = JSON.parse(text);
  expect(Array.isArray(data)).toBe(true);
  expect(data.length).toBeGreaterThanOrEqual(2);
  expect(data[0]).toHaveProperty('id');
  expect(data[0]).toHaveProperty('name');
  expect(data[0]).toHaveProperty('stats');
});

