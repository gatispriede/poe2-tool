#!/usr/bin/env node
// Skill Lab CLI — the terminal face of the relationship engine.
//
//   npm run lab -- "Spark"                     what affects Spark, and with what
//   npm run lab -- "Spark" --bucket aoe        one bucket only
//   npm run lab -- "Spark" --class Witch       price tree nodes from one class
//   npm run lab -- "Spark" --synergy           skills to pair it with
//   npm run lab -- --list fire                 find skills by name/tag
//   npm run lab -- --coverage                  parser coverage report

const { root } = require('./ts-runtime');
const path = require('path');

const engine = require(path.join(root, 'src/engine/index.ts'));
const { loadDataset, loadManifest } = require(path.join(root, 'src/engine/dataset.node.ts'));

const C = {
  reset: '\x1b[0m', dim: '\x1b[2m', bold: '\x1b[1m',
  cyan: '\x1b[36m', green: '\x1b[32m', yellow: '\x1b[33m', red: '\x1b[31m', magenta: '\x1b[35m',
};
const paint = (color, text) => `${C[color]}${text}${C.reset}`;
const pct = (v) => `${v >= 0 ? '+' : ''}${(v * 100).toFixed(1)}%`;

function parseArgs(argv) {
  const args = { _: [], flags: {} };
  for (let i = 0; i < argv.length; i += 1) {
    const a = argv[i];
    if (a.startsWith('--')) {
      const key = a.slice(2);
      const next = argv[i + 1];
      if (next && !next.startsWith('--')) { args.flags[key] = next; i += 1; }
      else args.flags[key] = true;
    } else args._.push(a);
  }
  return args;
}

function findSkill(dataset, query) {
  const actives = dataset.skills.filter((s) => !s.isSupport);
  const lower = query.toLowerCase();
  return actives.find((s) => s.name.toLowerCase() === lower)
    || actives.find((s) => s.name.toLowerCase().startsWith(lower))
    || actives.find((s) => s.name.toLowerCase().includes(lower));
}

function listSkills(dataset, query) {
  const lower = (query || '').toLowerCase();
  const rows = dataset.skills
    .filter((s) => !s.isSupport)
    .map((s) => engine.buildSkillProfile(s))
    .filter((p) => !lower || p.name.toLowerCase().includes(lower) || [...p.tags].some((t) => t.includes(lower)))
    .sort((a, b) => a.name.localeCompare(b.name));
  for (const p of rows) {
    console.log(`${paint('cyan', p.name.padEnd(30))} ${paint('dim', [...p.tags].join(' '))}`);
  }
  console.log(paint('dim', `\n${rows.length} skills`));
}

function printSkillHeader(profile) {
  console.log(`\n${paint('bold', profile.name)}  ${paint('dim', [...profile.tags].join(' · '))}`);
  const bits = [];
  if (profile.castTime) bits.push(`cast ${profile.castTime}s`);
  if (profile.cooldown) bits.push(`cooldown ${profile.cooldown}s`);
  if (profile.areaRadius) bits.push(`radius ${profile.areaRadius}`);
  if (profile.projectiles) bits.push(`${profile.projectiles} projectiles`);
  if (profile.baseDamage.max) bits.push(`base hit ${profile.baseDamage.min}-${profile.baseDamage.max}`);
  if (profile.damageTypes.length) bits.push(`deals ${profile.damageTypes.join('/')}`);
  console.log(paint('dim', bits.join('  |  ')));
  if (profile.description) console.log(paint('dim', profile.description));
  console.log(paint('dim', `emits: ${[...profile.emits].join(', ') || '—'}`));
  console.log(paint('dim', `consumes: ${[...profile.consumes].join(', ') || '—'}`));
}

function printBucket(title, matches, limit) {
  if (!matches.length) return;
  console.log(`\n${paint('bold', title)}`);
  for (const m of matches.slice(0, limit)) {
    const gain = m.total.dps || m.total.aoe || m.total.rate || m.total.utility;
    const flag = m.strength === 'direct' ? paint('green', '●')
      : m.strength === 'conditional' ? paint('yellow', '◐') : paint('magenta', '○');
    const kind = paint('dim', m.source.kind.padEnd(10));
    console.log(`  ${flag} ${kind} ${m.source.name.slice(0, 34).padEnd(35)} ${paint('cyan', pct(gain).padStart(8))}  ${paint('dim', m.costLabel)}`);
    for (const line of m.source.raw.slice(0, 2)) {
      console.log(paint('dim', `      ${line.replace(/\{[^}]*\}/g, '').slice(0, 96)}`));
    }
    const reason = m.matches[0] && m.matches[0].applicability.reasons[0];
    if (reason && m.strength !== 'direct') console.log(paint('dim', `      ↳ ${reason}`));
  }
}

function coverageReport(dataset) {
  const lines = new Set();
  for (const node of engine.nodeList(dataset.tree)) for (const s of node.stats || []) lines.add(s);
  for (const u of dataset.uniques) for (const s of [...(u.implicits || []), ...(u.explicits || [])]) lines.add(s);
  for (const m of dataset.itemMods) for (const s of m.stats || []) lines.add(s.text);

  const byStat = new Map();
  let unknown = 0;
  for (const line of lines) {
    for (const e of engine.parseModLine(line)) {
      if (e.stat === 'unknown') unknown += 1;
      byStat.set(e.stat, (byStat.get(e.stat) || 0) + 1);
    }
  }
  console.log(`\n${paint('bold', 'Parser coverage')}`);
  console.log(`  ${lines.size} distinct mod lines, ${unknown} unresolved (${((unknown / lines.size) * 100).toFixed(1)}%)`);
  const top = [...byStat.entries()].sort((a, b) => b[1] - a[1]).slice(0, 25);
  for (const [stat, count] of top) {
    console.log(`  ${paint('cyan', String(count).padStart(5))}  ${stat}`);
  }
  let supportKeys = 0; let supportParsed = 0;
  for (const s of dataset.skills.filter((x) => x.isSupport)) {
    for (const [k, v] of s.constantStats || []) {
      supportKeys += 1;
      if (engine.parseStatKey(k, v)) supportParsed += 1;
    }
  }
  console.log(`  support stat keys: ${supportParsed}/${supportKeys} understood`);
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  const dataset = loadDataset(root);

  if (args.flags.list !== undefined) return listSkills(dataset, args.flags.list === true ? '' : args.flags.list);
  if (args.flags.coverage) return coverageReport(dataset);

  const query = args._.join(' ');
  if (!query) {
    console.log('usage: npm run lab -- "<skill name>" [--bucket damage|aoe|speed|utility] [--class Witch] [--synergy] [--limit 12]');
    console.log('       npm run lab -- --list [filter]     npm run lab -- --coverage');
    return;
  }
  const raw = findSkill(dataset, query);
  if (!raw) { console.log(`no active skill matches "${query}"`); return; }

  const manifest = loadManifest(root);
  console.log(paint('dim', `data: PoB commit ${(manifest.sourceCommit || '?').slice(0, 8)} · generated ${manifest.generatedAt || '?'}`));

  const classId = typeof args.flags.class === 'string' ? args.flags.class : undefined;
  const sources = engine.buildSources(dataset, classId);
  const analysis = engine.analyzeSkill(raw, sources.all, {
    limitPerBucket: 0,
    skillContext: { delivery: 'self' },
  });

  printSkillHeader(analysis.skill);
  const limit = Number(args.flags.limit || 8);

  if (args.flags.synergy) {
    const partners = engine.profilesFor(dataset.skills);
    const { enablers, enabled } = engine.findSynergies(analysis.skill, partners, { limit: 14 });
    console.log(`\n${paint('bold', 'Skills that boost or enable this one')}`);
    for (const l of enablers) {
      console.log(`  ${paint('cyan', l.partner.name.padEnd(28))} ${paint('dim', l.rule.label.padEnd(20))} ${paint('dim', l.why)}`);
    }
    console.log(`\n${paint('bold', 'Skills this one boosts or enables')}`);
    for (const l of enabled) {
      console.log(`  ${paint('cyan', l.partner.name.padEnd(28))} ${paint('dim', l.rule.label.padEnd(20))} ${paint('dim', l.why)}`);
    }
    return;
  }

  const only = typeof args.flags.bucket === 'string' ? args.flags.bucket : undefined;
  const titles = {
    damage: 'Damage — what makes each hit bigger',
    aoe: 'Area & coverage — what makes each use hit more',
    speed: 'Application speed — what makes the damage land sooner',
    utility: 'Sustain & defence',
  };
  for (const bucket of ['damage', 'aoe', 'speed', 'utility']) {
    if (only && only !== bucket) continue;
    printBucket(`${titles[bucket]}  ${paint('dim', `(${analysis.counts[bucket]} sources)`)}`, analysis.buckets[bucket], limit);
  }
  console.log(paint('dim', `\n● direct  ◐ conditional  ○ needs a build decision   ·   gains are marginal against the baseline in scoring.ts`));
}

main();
