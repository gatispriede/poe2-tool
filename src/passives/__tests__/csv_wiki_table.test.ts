import fs from 'fs';
import path from 'path';

test('wiki_table csv has headers and sample rows fallback', () => {
  const file = path.resolve(__dirname, '../../passives/passive_skills_wiki_table.csv');
  const text = fs.readFileSync(file, 'utf8').trim().split(/\r?\n/);
  expect(text[0]).toBe('id,name,stat_lines');
  expect(text.length).toBeGreaterThanOrEqual(3); // header + at least 2 samples
});

