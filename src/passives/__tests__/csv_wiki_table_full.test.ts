import fs from 'fs';
import path from 'path';

test('full wiki_table csv has headers and sample rows fallback', () => {
  const file = path.resolve(__dirname, '../../passives/passive_skills_wiki_table_full.csv');
  const lines = fs.readFileSync(file, 'utf8').trim().split(/\r?\n/);
  expect(lines[0]).toBe('id,name,stat_lines,source_headers');
  expect(lines.length).toBeGreaterThanOrEqual(3);
});

