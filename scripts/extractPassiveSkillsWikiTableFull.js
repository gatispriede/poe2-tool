// Enhanced extraction: target tables with class 'wiki_table' and produce detailed CSV.
// Usage: npm run extract:passives:wiki:full
// Output: src/passives/passive_skills_wiki_table_full.csv

const fs = require('fs');
const path = require('path');
const fetch = require('node-fetch');
const cheerio = require('cheerio');

const URL = 'https://pathofexile2.wiki.fextralife.com/Passive+Skills';
const OUT = path.resolve(__dirname, '../src/passives/passive_skills_wiki_table_full.csv');

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

function parseWikiTables(html) {
  if (!html) return [];
  const $ = cheerio.load(html);
  const entries = [];
  $('table.wiki_table').each((_, tbl) => {
    const $tbl = $(tbl);
    const headers = $tbl.find('thead th').map((i, el) => $(el).text().trim()).get();
    $tbl.find('tbody tr').each((_, tr) => {
      const cols = $(tr).find('td').map((i, el) => $(el).text().trim()).get();
      if (!cols.length) return;
      const name = cols[0];
      if (!name) return;
      const rawStats = cols.slice(1).filter(Boolean);
      entries.push({ name, rawStats, headers });
    });
  });
  return entries;
}

function buildCsv(rows) {
  const header = ['id','name','stat_lines','source_headers'];
  let id = 0;
  const lines = [header.join(',')];
  if (!rows.length) {
    lines.push('0,Sample Physical Node,10% increased Physical Damage,Name|Effect');
    lines.push('1,Sample Attack Speed Node,5% increased Attack Speed,Name|Effect');
    return lines.join('\n');
  }
  for (const r of rows) {
    const statLines = r.rawStats.map(s => s.replace(/\s+/g,' ').trim()).join(' ; ');
    const hdr = r.headers.join('|');
    lines.push([esc(String(id++)), esc(r.name), esc(statLines), esc(hdr)].join(','));
  }
  return lines.join('\n');
}

async function main() {
  console.log('Fetching wiki_table passive skills (full):', URL);
  const html = await fetchHtml(URL);
  const rows = parseWikiTables(html);
  if (!rows.length) console.warn('No rows parsed; writing sample placeholders.');
  else console.log('Parsed wiki_table passive rows:', rows.length);
  const csv = buildCsv(rows);
  fs.mkdirSync(path.dirname(OUT), { recursive: true });
  fs.writeFileSync(OUT, csv, 'utf8');
  console.log('Wrote CSV:', OUT);
}

main().catch(err => {
  console.error('Full wiki_table extraction failed:', err);
  process.exit(1);
});
