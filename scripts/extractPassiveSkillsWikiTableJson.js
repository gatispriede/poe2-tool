// Extract passive skills from tables with class 'wiki_table' into JSON.
// Usage: npm run extract:passives:wiki:json
// Output: src/passives/passive_skills_wiki_table.json

const fs = require('fs');
const path = require('path');
const fetch = require('node-fetch');
const cheerio = require('cheerio');

const URL = 'https://pathofexile2.wiki.fextralife.com/Passive+Skills';
const OUT = path.resolve(__dirname, '../src/passives/passive_skills_wiki_table.json');

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

function parse(html) {
  if (!html) return [];
  const $ = cheerio.load(html);
  const nodes = [];
  $('table.wiki_table').each((_, tbl) => {
    const $tbl = $(tbl);
    const headers = $tbl.find('thead th').map((i, el) => $(el).text().trim()).get();
    $tbl.find('tbody tr').each((_, tr) => {
      const cols = $(tr).find('td').map((i, el) => $(el).text().trim()).get();
      if (!cols.length) return;
      const name = cols[0];
      if (!name) return;
      const stats = cols.slice(1).filter(Boolean).map(s => s.replace(/\s+/g,' ').trim());
      nodes.push({ id: name.toLowerCase().replace(/[^a-z0-9]+/g,'-'), name, stats, sourceHeaders: headers });
    });
  });
  return nodes;
}

function fallbackSample() {
  return [
    { id: 'sample-physical-node', name: 'Sample Physical Node', stats: ['10% increased Physical Damage'], sourceHeaders: ['Name','Effect'] },
    { id: 'sample-attack-speed-node', name: 'Sample Attack Speed Node', stats: ['5% increased Attack Speed'], sourceHeaders: ['Name','Effect'] }
  ];
}

async function main() {
  console.log('Fetching wiki_table passive skills (JSON):', URL);
  const html = await fetchHtml(URL);
  let nodes = parse(html);
  if (!nodes.length) {
    console.warn('No nodes parsed; using sample placeholders.');
    nodes = fallbackSample();
  } else {
    console.log('Parsed nodes:', nodes.length);
  }
  fs.mkdirSync(path.dirname(OUT), { recursive: true });
  fs.writeFileSync(OUT, JSON.stringify(nodes, null, 2), 'utf8');
  console.log('Wrote JSON:', OUT);
}

main().catch(err => {
  console.error('JSON extraction failed:', err);
  process.exit(1);
});
