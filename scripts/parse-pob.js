// Parses a Path of Building 2 import code into a typed JSON build object.
// Input: PoB code (URL-safe base64 of zlib-deflated XML) saved as .txt
// Output: { build, tree, items, skills } JSON suitable for our damage calc.

const fs = require('fs');
const path = require('path');
const zlib = require('zlib');
const { XMLParser } = require('fast-xml-parser');

function decodePoB(code) {
  const std = code.trim().replace(/-/g, '+').replace(/_/g, '/');
  const xml = zlib.inflateSync(Buffer.from(std, 'base64')).toString('utf8');
  return xml;
}

function parseXML(xml) {
  // attributeNamePrefix '' so attrs are plain keys.
  // textNodeName '_text' so element text content is accessible alongside attrs.
  // isArray forces these to arrays even when there's only one (defensive).
  const arrays = new Set(['PlayerStat','Gem','Skill','SkillSet','Item','ItemSet','Slot','Spec','Socket','ConfigSet','Input']);
  const p = new XMLParser({
    ignoreAttributes: false,
    attributeNamePrefix: '',
    textNodeName: '_text',
    isArray: (name) => arrays.has(name),
    parseAttributeValue: false,
    trimValues: false,
  });
  return p.parse(xml);
}

function asNum(v, def) {
  if (v === undefined || v === null || v === '' || v === 'nil') return def;
  const n = Number(v);
  return Number.isFinite(n) ? n : def;
}

// Item bodies are free-text. Format observed:
//   Rarity: RARE
//   <Name line>
//   <Base type line>
//   Unique ID: ...
//   Item Level: 81
//   Quality: 21
//   Sockets: S S
//   Rune: ...
//   LevelReq: 78
//   Implicits: <N>
//   <N implicit mod lines>
//   <remaining lines = explicit mods>
function parseItemText(text) {
  const lines = text.split(/\r?\n/).map(l => l.replace(/^\s+/, ''));

  const out = {
    rarity: null,
    name: null,
    base: null,
    itemLevel: null,
    quality: null,
    sockets: null,
    levelReq: null,
    runes: [],
    implicits: [],
    explicits: [],
    rawLines: [],
  };

  let i = 0;
  // Skip leading blanks.
  while (i < lines.length && !lines[i]) i++;

  if (i < lines.length && lines[i].startsWith('Rarity:')) {
    out.rarity = lines[i].slice('Rarity:'.length).trim();
    i++;
  }
  if (i < lines.length && lines[i] && !lines[i].includes(':')) {
    out.name = lines[i].trim();
    i++;
  }
  if (i < lines.length && lines[i] && !lines[i].includes(':')) {
    out.base = lines[i].trim();
    i++;
  }

  // Key:value header lines.
  let implicitCount = 0;
  for (; i < lines.length; i++) {
    const l = lines[i];
    if (!l) continue;
    const m = l.match(/^([A-Za-z][A-Za-z ]+):\s*(.*)$/);
    if (!m) break;
    const k = m[1].trim();
    const v = m[2].trim();
    switch (k) {
      case 'Unique ID':       /* skip */ break;
      case 'Item Level':      out.itemLevel = asNum(v, null); break;
      case 'Quality':         out.quality   = asNum(v, null); break;
      case 'Sockets':         out.sockets   = v; break;
      case 'Rune':            out.runes.push(v); break;
      case 'LevelReq':        out.levelReq  = asNum(v, null); break;
      case 'Implicits':       implicitCount = asNum(v, 0); break;
      default:                /* ignore unknown header keys for now */
    }
  }

  // Remaining lines: first <implicitCount> are implicits, rest are explicits.
  const modLines = lines.slice(i).filter(l => l && l.trim() !== '');
  out.implicits = modLines.slice(0, implicitCount);
  out.explicits = modLines.slice(implicitCount);
  out.rawLines = lines.filter(l => l);
  return out;
}

function extractBuild(parsed) {
  const root = parsed.PathOfBuilding2 || parsed.PathOfBuilding;
  if (!root) throw new Error('Not a PathOfBuilding XML');

  const b = root.Build || {};

  // ---- Items ----
  const itemsRoot = root.Items || {};
  const itemEls = Array.isArray(itemsRoot.Item) ? itemsRoot.Item : (itemsRoot.Item ? [itemsRoot.Item] : []);
  const itemsById = {};
  for (const it of itemEls) {
    const id = it.id;
    const text = (it._text || '').toString();
    itemsById[id] = { id, ...parseItemText(text) };
  }

  // Slot mapping lives under ItemSet, not directly under Items. Use the
  // active item set if specified, else the first.
  const itemSets = Array.isArray(itemsRoot.ItemSet) ? itemsRoot.ItemSet : (itemsRoot.ItemSet ? [itemsRoot.ItemSet] : []);
  const activeSetId = itemsRoot.activeItemSet;
  const activeSet = itemSets.find(s => s.id === activeSetId) || itemSets[0] || {};
  const slotEls = Array.isArray(activeSet.Slot) ? activeSet.Slot : (activeSet.Slot ? [activeSet.Slot] : []);
  // When the build uses the swap weapon set, the "Weapon N Swap" slots are
  // the active weapons. Normalise so callers don't have to know about this.
  // Also surface it on the parsed build so downstream callers (e.g. support
  // gem effects keyed to "weapon set one/two") can branch correctly.
  const useSwap = itemsRoot.useSecondWeaponSet === 'true' || activeSet.useSecondWeaponSet === 'true';
  const useSecondWeaponSet = useSwap;
  const slots = {};
  for (const s of slotEls) {
    if (!s.itemId || s.itemId === '0') continue;
    let name = s.name;
    if (useSwap) {
      if (name === 'Weapon 1' || name === 'Weapon 2') continue; // primary set is inactive
      if (name === 'Weapon 1 Swap') name = 'Weapon 1';
      if (name === 'Weapon 2 Swap') name = 'Weapon 2';
    }
    slots[name] = s.itemId;
  }

  // Equipped items keyed by slot.
  const equipped = {};
  for (const [slotName, itemId] of Object.entries(slots)) {
    if (itemsById[itemId]) equipped[slotName] = itemsById[itemId];
  }

  // ---- Skills (gem socket groups) ----
  const skillsRoot = root.Skills || {};
  const skillSets = Array.isArray(skillsRoot.SkillSet) ? skillsRoot.SkillSet : (skillsRoot.SkillSet ? [skillsRoot.SkillSet] : []);
  const skillGroups = [];
  for (const set of skillSets) {
    const groups = Array.isArray(set.Skill) ? set.Skill : (set.Skill ? [set.Skill] : []);
    for (const g of groups) {
      const gems = Array.isArray(g.Gem) ? g.Gem : (g.Gem ? [g.Gem] : []);
      skillGroups.push({
        label: g.label || null,
        mainActiveSkill: asNum(g.mainActiveSkill, null),
        enabled: g.enabled !== 'false' && g.enabled !== false,
        gems: gems.map(gem => ({
          skillId: gem.skillId || null,
          nameSpec: gem.nameSpec || null,
          variantId: gem.variantId || null,
          gemId: gem.gemId || null,
          level: asNum(gem.level, null),
          quality: asNum(gem.quality, 0),
          enabled: gem.enabled !== 'false' && gem.enabled !== false,
        })),
      });
    }
  }

  // ---- Tree ----
  const treeRoot = root.Tree || {};
  const specs = Array.isArray(treeRoot.Spec) ? treeRoot.Spec : (treeRoot.Spec ? [treeRoot.Spec] : []);
  const trees = specs.map(s => ({
    classId: asNum(s.classId, null),
    classInternalId: s.classInternalId || null,
    ascendClassId: asNum(s.ascendClassId, null),
    ascendancyInternalId: s.ascendancyInternalId || null,
    treeVersion: s.treeVersion || null,
    nodes: (s.nodes || '').split(',').filter(Boolean).map(n => parseInt(n, 10)),
    masteryEffects: s.masteryEffects || '',
  }));

  return {
    build: {
      level: asNum(b.level, null),
      className: b.className || null,
      ascendClassName: b.ascendClassName || null,
      mainSocketGroup: asNum(b.mainSocketGroup, null),
      targetVersion: b.targetVersion || null,
      useSecondWeaponSet,
    },
    trees,
    skillGroups,
    equipped,
  };
}

function main() {
  const inputs = process.argv.slice(2);
  if (!inputs.length) {
    console.error('Usage: node scripts/parse-pob.js <pob-code-file> [...]');
    process.exit(1);
  }
  for (const input of inputs) {
    const code = fs.readFileSync(input, 'utf8');
    const xml = decodePoB(code);
    const parsed = parseXML(xml);
    const build = extractBuild(parsed);

    const out = input.replace(/-pob\.txt$/, '-build.json').replace(/\.txt$/, '-build.json');
    fs.writeFileSync(out, JSON.stringify(build, null, 2));

    const mainGrp = build.skillGroups[build.build.mainSocketGroup - 1];
    const mainGems = mainGrp ? mainGrp.gems.map(g => g.nameSpec).filter(Boolean).join(' + ') : '(unknown)';
    console.log(`${path.basename(input)}`);
    console.log(`  class:       ${build.build.className} / ${build.build.ascendClassName}  lvl ${build.build.level}`);
    console.log(`  items:       ${Object.keys(build.equipped).length} equipped (${Object.keys(build.equipped).join(', ')})`);
    console.log(`  skillgroups: ${build.skillGroups.length}`);
    console.log(`  main group:  #${build.build.mainSocketGroup}  →  ${mainGems}`);
    console.log(`  tree nodes:  ${build.trees[0]?.nodes.length}`);
    console.log(`  → ${path.relative(process.cwd(), out)}`);
  }
}

main();
