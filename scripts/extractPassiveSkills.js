// Extract passive skills from PoE2 wiki Passive Skills page into CSV.
// Usage: npm run extract:passives
// NOTE: If network access is blocked, script will fall back to sample data.

const fs = require('fs');
const path = require('path');
const fetch = require('node-fetch');
const cheerio = require('cheerio');

const URL = 'https://pathofexile2.wiki.fextralife.com/Passive+Skills';
const OUT = path.resolve(__dirname, '../src/passives/passive_skills.csv');

function csvEscape(val) {
  if (val == null) return '';
  const s = String(val);
  if (/[",\n]/.test(s)) return '"' + s.replace(/"/g, '""') + '"';
  return s;
}

async function fetchPage(url) {
  try {
    const res = await fetch(url);
    if (!res.ok) throw new Error('HTTP ' + res.status);
    return await res.text();
  } catch (e) {
    console.warn('Fetch failed:', e.message);
    return null;
  }
}

function parsePassiveTables(html) {
  if (!html) return [];
  const $ = cheerio.load(html);
  const rows = [];
  $('table').each((_, tbl) => {
    const $tbl = $(tbl);
    const headers = $tbl.find('thead th').map((i, el) => $(el).text().trim()).get();
    if (!headers.some(h => /name|passive/i.test(h))) return;
    $tbl.find('tbody tr').each((_, tr) => {
      const cols = $(tr).find('td').map((i, el) => $(el).text().trim()).get();
      if (cols.length === 0) return;
      const name = cols[0];
      if (!name) return;
      const effects = cols.slice(1).filter(Boolean).join(' | ');
      rows.push({ name, effects });
    });
  });
  return rows;
}

function buildCsv(rows) {
  const header = ['id', 'name', 'stat_lines'];
  let idCounter = 0;
  const lines = [header.join(',')];
  if (rows.length === 0) {
    // fallback sample rows
    lines.push(['0','Sample Physical Node','10% increased Physical Damage'].join(','));
    lines.push(['1','Sample Attack Speed Node','5% increased Attack Speed'].join(','));
    return lines.join('\n');
  }
  for (const r of rows) {
    const statLines = r.effects.split('|').map(s => s.trim()).filter(Boolean).join(' ; ');
    lines.push([csvEscape(String(idCounter++)), csvEscape(r.name), csvEscape(statLines)].join(','));
  }
  return lines.join('\n');
}

async function main() {
  console.log('Fetching Passive Skills page:', URL);
  const html = await fetchPage(URL);
  const rows = parsePassiveTables(html);
  if (rows.length === 0) {
    console.warn('No passive rows detected; writing sample placeholder CSV.');
  } else {
    console.log('Parsed passive rows:', rows.length);
  }
  const csv = buildCsv(rows);
  fs.mkdirSync(path.dirname(OUT), { recursive: true });
  fs.writeFileSync(OUT, csv, 'utf8');
  console.log('Wrote CSV:', OUT);
}

main().catch(err => {
  console.error('Extraction failed:', err);
  process.exit(1);
});
