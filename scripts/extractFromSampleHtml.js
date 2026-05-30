// Parse Sample.html for the passive-skills table and create structured JSON with basic damage-related calculations.
// Usage: npm run extract:sample-passives

const fs = require('fs');
const path = require('path');
const cheerio = require('cheerio');

const INPUT = path.resolve(__dirname, '../src/Sample.html');
const OUT = path.resolve(__dirname, '../src/passives/sample_passive_skills.json');

function parseEffect(effect) {
  const stats = {};
  const moreDamage = [];
  const incPhys = effect.match(/(\d+)%\s+increased\s+(Physical|Melee)?\s*Damage/i);
  if (incPhys) stats.increasedPhysicalDamagePct = Number(incPhys[1]);
  const incAS = effect.match(/(\d+)%\s+increased\s+Attack\s+Speed/i);
  if (incAS) stats.increasedAttackSpeedPct = Number(incAS[1]);
  const incCritChance = effect.match(/(\d+)%\s+increased\s+Critical( Strike| Hit)?\s+Chance/i);
  if (incCritChance) stats.increasedCritChancePct = Number(incCritChance[1]);
  const incCritMulti = effect.match(/(\d+)%\s+increased\s+Critical( Damage| Strike)?\s+Bonus|\+(\d+)%\s+to\s+Critical\s+Strike\s+Multiplier/i);
  if (incCritMulti) stats.increasedCritMultiplierPct = Number(incCritMulti[1] || incCritMulti[2]);
  const moreMatches = effect.match(/(\d+)%\s+more\s+([A-Za-z ]+)/g);
  if (moreMatches) {
    for (const m of moreMatches) {
      const mm = m.match(/(\d+)%\s+more/);
      if (mm) moreDamage.push(Number(mm[1]));
    }
  }
  return { stats, moreDamage };
}

function buildDamageCalc(parsed) {
  const inc = (parsed.stats.increasedPhysicalDamagePct || 0) / 100;
  const moreMul = parsed.moreDamage.reduce((acc, v) => acc * (1 + v / 100), 1);
  return { physMultiplier: (1 + inc) * moreMul };
}

function main() {
  if (!fs.existsSync(INPUT)) {
    console.error('Sample.html not found:', INPUT);
    process.exit(1);
  }
  const html = fs.readFileSync(INPUT, 'utf8');
  const $ = cheerio.load(html);
  const rows = [];
  $('.passive-skills table.wiki_table tbody tr').each((_, tr) => {
    const cols = $(tr).find('td');
    if (cols.length < 3) return;
    const name = $(cols[0]).text().trim().replace(/\s+/g,' ').replace(/\n/g,'');
    const type = $(cols[1]).text().trim();
    const effect = $(cols[2]).text().trim();
    if (!name || !effect) return;
    const parsed = parseEffect(effect);
    const calc = buildDamageCalc(parsed);
    rows.push({
      id: name.toLowerCase().replace(/[^a-z0-9]+/g,'-'),
      name,
      type,
      effect,
      stats: parsed.stats,
      moreDamage: parsed.moreDamage,
      calculation: calc
    });
  });
  fs.mkdirSync(path.dirname(OUT), { recursive: true });
  fs.writeFileSync(OUT, JSON.stringify(rows, null, 2), 'utf8');
  console.log('Extracted passive skill rows:', rows.length);
  console.log('Wrote JSON:', OUT);
}

main();
