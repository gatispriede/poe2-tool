// Filter item Class -> every base type that exists in the synced game data.
//
// An item filter is first-match-wins, and a `Hide` block with no BaseType is a
// blanket rule: it swallows anything in its class, including bases that did not
// exist when the filter was written. Enumerating the bases we know about turns
// such a rule into an explicit blocklist, so genuinely new content falls
// through to whatever the filter does at the end.

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..', '..');
const GENERATED = path.join(ROOT, 'src', 'data', 'generated');

/** data `type` -> the Class name the filter language uses. */
const TYPE_TO_CLASS = {
  'One Hand Axe': 'One Hand Axes',
  'Two Hand Axe': 'Two Hand Axes',
  'One Hand Mace': 'One Hand Maces',
  'Two Hand Mace': 'Two Hand Maces',
  'One Hand Sword': 'One Hand Swords',
  'Two Hand Sword': 'Two Hand Swords',
  Bow: 'Bows',
  Crossbow: 'Crossbows',
  Claw: 'Claws',
  Dagger: 'Daggers',
  Flail: 'Flails',
  Spear: 'Spears',
  Sceptre: 'Sceptres',
  Staff: 'Staves',
  Wand: 'Wands',
  Quiver: 'Quivers',
  Focus: 'Foci',
  'Body Armour': 'Body Armours',
  Helmet: 'Helmets',
  Gloves: 'Gloves',
  Boots: 'Boots',
  Amulet: 'Amulets',
  Ring: 'Rings',
  Belt: 'Belts',
  Jewel: 'Jewels',
  Charm: 'Charms',
};

const readJson = (file) => JSON.parse(fs.readFileSync(path.join(GENERATED, file), 'utf8'));
const asArray = (data) => (Array.isArray(data) ? data : Object.values(data));

/** Quarterstaves are their own filter class; the data files them under Staff. */
function refineClass(base) {
  const tags = base.tags || [];
  if (base.type === 'Staff') {
    return tags.includes('warstaff') || /quarterstaff/i.test(base.id) ? 'Quarterstaves' : 'Staves';
  }
  if (base.type === 'Shield') return tags.includes('buckler') ? 'Bucklers' : 'Shields';
  if (base.type === 'Flask') {
    if (tags.includes('life_flask')) return 'Life Flasks';
    if (tags.includes('mana_flask')) return 'Mana Flasks';
    return 'Flasks';
  }
  return TYPE_TO_CLASS[base.type];
}

function buildIndex() {
  const bases = [...asArray(readJson('weapon-bases.json')), ...asArray(readJson('armour-bases.json'))];
  const byClass = new Map();
  for (const base of bases) {
    const cls = refineClass(base);
    if (!cls || !base.id) continue;
    if (!byClass.has(cls)) byClass.set(cls, new Set());
    byClass.get(cls).add(base.id);
  }
  return byClass;
}

let cached;
function classIndex() {
  if (!cached) cached = buildIndex();
  return cached;
}

/** Every base the data knows for these classes (all classes when none given). */
function basesForClasses(classes) {
  const index = classIndex();
  const wanted = classes && classes.length ? classes : [...index.keys()];
  const out = new Set();
  const missing = [];
  for (const cls of wanted) {
    const bases = index.get(cls);
    if (!bases) { missing.push(cls); continue; }
    for (const base of bases) out.add(base);
  }
  return { bases: [...out].sort(), missing };
}

function manifest() {
  const file = path.join(GENERATED, 'manifest.json');
  return fs.existsSync(file) ? JSON.parse(fs.readFileSync(file, 'utf8')) : {};
}

module.exports = { classIndex, basesForClasses, manifest, TYPE_TO_CLASS };
