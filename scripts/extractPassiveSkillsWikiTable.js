// Extract passive skills specifically from tables with class 'wiki_table' on the PoE2 wiki Passive Skills page.
// Usage: npm run extract:passives:wiki
// Output: src/passives/passive_skills_wiki_table.csv

const fs = require('fs');
const path = require('path');
const fetch = require('node-fetch');
const cheerio = require('cheerio');

const URL = 'https://pathofexile2.wiki.fextralife.com/Passive+Skills';
const OUT = path.resolve(__dirname, '../src/passives/passive_skills_wiki_table.csv');

function esc(val) {
  if (val == null) return '';
  const s = String(val);
  if (/[",\n]/.test(s)) return '"' + s.replace(/"/g, '""') + '"';
  return s;
}

async function fetchHtml(url) {
  try {
    const res = await fetch(url);
    if (!res.ok) throw new Error('HTTP ' + res.status);
    return await res.text();
  } catch (e) {
    console.warn('Fetch failed:', e.message);
    return null;
  }
}

function parseWikiTable(html) {
  if (!html) return [];
  const $ = cheerio.load(html);
  const rows = [];
  $('table.wiki_table').each((_, tbl) => {
    const $tbl = $(tbl);
    const headers = $tbl.find('thead th').map((i, el) => $(el).text().trim()).get();
    $tbl.find('tbody tr').each((_, tr) => {
      const cols = $(tr).find('td').map((i, el) => $(el).text().trim()).get();
      if (cols.length === 0) return;
      const name = cols[0];
      if (!name) return;
      const effects = cols.slice(1).filter(Boolean).join(' | ');
      rows.push({ name, effects, headers });
    });
  });
  return rows;
}

function toCsv(rows) {
  const header = ['id','name','stat_lines'];
  let id = 0;
  const lines = [header.join(',')];
  if (rows.length === 0) {
    lines.push('0,Sample Physical Node,10% increased Physical Damage');
    lines.push('1,Sample Attack Speed Node,5% increased Attack Speed');
    return lines.join('\n');
  }
  for (const r of rows) {
    const statLines = r.effects.split('|').map(s => s.trim()).filter(Boolean).join(' ; ');
    lines.push([esc(String(id++)), esc(r.name), esc(statLines)].join(','));
  }
  return lines.join('\n');
}

async function main() {
  console.log('Fetching (wiki_table) Passive Skills page:', URL);
  const html = await fetchHtml(URL);
  const rows = parseWikiTable(html);
  if (rows.length === 0) {
    console.warn('No rows parsed from wiki_table; using sample placeholders.');
  } else {
    console.log('Parsed rows from wiki_table:', rows.length);
  }
  const csv = toCsv(rows);
  fs.mkdirSync(path.dirname(OUT), { recursive: true });
  fs.writeFileSync(OUT, csv, 'utf8');
  console.log('Wrote CSV:', OUT);
}

main().catch(err => {
  console.error('Extraction failed:', err);
  process.exit(1);
});
