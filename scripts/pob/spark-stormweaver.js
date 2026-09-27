#!/usr/bin/env node
// Emit a Path of Building 2 import code for the engine-derived Spark
// Stormweaver build documented in docs/builds/spark-stormweaver-projectile.md.
//
// The tree is not hand-listed: it is BFS'd from the Sorceress start (and from
// the Stormweaver ascendancy start) through the same graph the Skill Lab uses,
// so the allocation is guaranteed contiguous and the node ids are real.
//
//   node scripts/pob/spark-stormweaver.js            # writes XML + code
//   node scripts/pob/spark-stormweaver.js --verify   # also round-trips the code

const fs = require('fs');
const path = require('path');
const zlib = require('zlib');

const ROOT = path.resolve(__dirname, '..', '..');
require(path.join(ROOT, 'scripts/lab/ts-runtime.js'));
const { buildTreeGraph } = require(path.join(ROOT, 'src/engine/treeGraph.ts'));
const { buildPob2Xml } = require(path.join(ROOT, 'src/components/Explorer/pob2Export.ts'));
const tree = require(path.join(ROOT, 'src/data/generated/passive-tree.json'));

const CLASS_NAME = 'Sorceress';
const ASCENDANCY = 'Stormweaver';
const CHARACTER_LEVEL = 92;

// Notables the Skill Lab ranked for Spark, cheapest-first. See the build doc
// for why each one is here.
const MAIN_TREE_TARGETS = [
  'Raw Power', 'Overexposure', 'Branching Bolts', 'Storm Surge', 'Overload',
  'Hastening Barrier', 'Breath of Lightning', 'Electric Amplification',
  'Split Shot', 'Exposed to the Storm',
];
const ASCENDANCY_TARGETS = [
  'Shaper of Storms', 'Strike Twice', 'Force of Will', 'Constant Gale',
];

/** Shortest-path tree from `start`, restricted to one side of the graph. */
function parentMap(graph, start, wantAscendancy) {
  const parent = new Map([[start, null]]);
  const queue = [start];
  for (let i = 0; i < queue.length; i += 1) {
    for (const next of graph.adjacency.get(queue[i]) || []) {
      const isAsc = graph.ascendancyOf.has(next);
      if (isAsc !== wantAscendancy) continue;
      if (parent.has(next)) continue;
      parent.set(next, queue[i]);
      queue.push(next);
    }
  }
  return parent;
}

function allocate(graph, start, targets, wantAscendancy) {
  const parent = parentMap(graph, start, wantAscendancy);
  const allocated = new Set();
  const resolved = [];
  const missing = [];
  for (const name of targets) {
    const node = [...graph.nodes.values()].find(
      (n) => n.name === name
        && (wantAscendancy ? n.ascendancyName === ASCENDANCY : !n.ascendancyName)
        && parent.has(n.id),
    );
    if (!node) { missing.push(name); continue; }
    let cursor = node.id;
    let added = 0;
    while (cursor !== null && cursor !== undefined) {
      if (!allocated.has(cursor)) { allocated.add(cursor); added += 1; }
      cursor = parent.get(cursor);
    }
    resolved.push({ name, id: node.id, added });
  }
  allocated.delete(start);
  return { allocated, resolved, missing };
}

const gem = (skillId, nameSpec, level, quality = 0) => ({
  skillId, nameSpec, level, quality, enabled: true, variantId: null, gemId: null,
});

const item = (slotBase) => ({
  id: '', rarity: 'RARE', runes: [], implicits: [], rawLines: [],
  itemLevel: 82, quality: 20, sockets: null, levelReq: 80, ...slotBase,
});

function main() {
  const graph = buildTreeGraph(tree);
  const cls = tree.classes.find((c) => c.name === CLASS_NAME);
  const asc = cls.ascendancies.find((a) => a.name === ASCENDANCY);

  const main = allocate(graph, cls.startNodeId, MAIN_TREE_TARGETS, false);
  const ascend = allocate(graph, asc.startNodeId, ASCENDANCY_TARGETS, true);

  console.log(`Passive tree — ${main.allocated.size} points from the ${CLASS_NAME} start`);
  for (const r of main.resolved) console.log(`  ${r.name.padEnd(24)} ${String(r.id).padStart(6)}  +${r.added}`);
  if (main.missing.length) console.log(`  unreachable: ${main.missing.join(', ')}`);

  console.log(`\nAscendancy — ${ascend.allocated.size} points from the ${ASCENDANCY} start`);
  for (const r of ascend.resolved) console.log(`  ${r.name.padEnd(24)} ${String(r.id).padStart(6)}  +${r.added}`);
  if (ascend.missing.length) console.log(`  unreachable: ${ascend.missing.join(', ')}`);

  const nodes = [...main.allocated, ...ascend.allocated];

  const build = {
    build: {
      level: CHARACTER_LEVEL,
      className: CLASS_NAME,
      ascendClassName: ASCENDANCY,
      mainSocketGroup: 1,
      targetVersion: '0_1',
    },
    trees: [{ nodes, treeVersion: tree.treeVersion, title: 'Spark Stormweaver' }],
    skillGroups: [
      {
        label: 'Spark (clear)',
        mainActiveSkill: 1,
        enabled: true,
        gems: [
          gem('SparkPlayer', 'Spark', 20, 20),
          gem('SupportMultishotPlayerTwo', 'Multishot II', 1),
          gem('SupportNovaProjectilesTwoPlayer', 'Nova Projectiles II', 1),
          gem('SupportChainPlayerThree', 'Chain III', 1),
          gem('SupportRapidCastingPlayerThree', 'Rapid Casting III', 1),
          gem('SupportProjectileAccelerationPlayerThree', 'Projectile Acceleration III', 1),
        ],
      },
      {
        label: 'Spark (single target swap)',
        mainActiveSkill: 1,
        enabled: false,
        gems: [
          gem('SparkPlayer', 'Spark', 20, 20),
          gem('SupportConsideredCastingPlayer', 'Considered Casting', 1),
          gem('SupportNovaProjectilesTwoPlayer', 'Nova Projectiles II', 1),
          gem('SupportChainPlayerThree', 'Chain III', 1),
          gem('SupportRapidCastingPlayerThree', 'Rapid Casting III', 1),
          gem('UnleashPlayer', 'Unleash', 1),
        ],
      },
    ],
    // Target gear, not owned gear: every mod below was verified present in
    // src/data/generated/item-mods.json, rolled at the top of its range.
    equipped: {
      'Weapon 1': item({
        name: 'Stormcall Wand', base: 'Siphoning Wand',
        explicits: [
          '+7 to Level of all Lightning Spell Skills',
          '238% increased Spell Damage',
          '52% increased Cast Speed',
          '+120 to maximum Mana',
        ],
      }),
      Amulet: item({
        name: 'Tempest Collar', base: 'Stellar Amulet',
        implicits: ['+15 to all Attributes'],
        explicits: [
          '+3 to Level of all Lightning Spell Skills',
          '35% increased Critical Hit Chance for Spells',
          '+30% to Lightning Resistance',
        ],
      }),
      'Ring 1': item({
        name: 'Galvanic Loop', base: 'Sapphire Ring',
        implicits: ['+25% to Cold Resistance'],
        explicits: [
          '238% increased Lightning Damage',
          'Adds 15 to 280 Lightning Damage to Spells',
          '+35% to Fire Resistance',
        ],
      }),
      'Ring 2': item({
        name: 'Arcing Band', base: 'Amethyst Ring',
        implicits: ['+17% to Chaos Resistance'],
        explicits: [
          '210% increased Lightning Damage',
          '+40% to Lightning Resistance',
          '+90 to maximum Mana',
        ],
      }),
      'Body Armour': item({
        name: 'Stormweave', base: 'Elementalist Robe',
        explicits: [
          '+140 to maximum Energy Shield',
          '+110 to maximum Life',
          '+35% to Cold Resistance',
        ],
      }),
      Helmet: item({
        name: 'Conductor Crown', base: 'Feathered Tiara',
        explicits: [
          '49% increased Cast Speed',
          '+95 to maximum Life',
          '+38% to Chaos Resistance',
        ],
      }),
      Gloves: item({
        name: 'Voltaic Grasp', base: 'Silk Gloves',
        explicits: [
          '44% increased Cast Speed',
          '15% increased Projectile Damage',
          '+80 to maximum Life',
        ],
      }),
      Boots: item({
        name: 'Stormstride', base: 'Silk Slippers',
        explicits: [
          '35% increased Movement Speed',
          '+95 to maximum Life',
          '+40% to Fire Resistance',
        ],
      }),
      Belt: item({
        name: 'Chargebinder', base: 'Utility Belt',
        explicits: [
          '+120 to maximum Life',
          '+35% to Lightning Resistance',
          '25% increased Flask Charges gained',
        ],
      }),
    },
  };

  const generated = {
    skillId: 'SparkPlayer',
    skillName: 'Spark',
    weaponBase: 'Siphoning Wand',
    weaponRarity: 'RARE',
    weaponUniqueName: null,
    weaponModIds: [],
    triggerMode: 'direct',
    characterLevel: CHARACTER_LEVEL,
    build,
  };

  const xml = buildPob2Xml(generated);
  // PoB2 reads URL-safe base64 of zlib-deflated XML. compressToPobCode() in
  // pob2Export.ts does the same thing with the browser's CompressionStream;
  // zlib here produces the identical RFC1950 framing.
  const code = zlib.deflateSync(Buffer.from(xml, 'utf8'))
    .toString('base64').replace(/\+/g, '-').replace(/\//g, '_');

  const outDir = path.join(ROOT, 'docs', 'builds');
  fs.writeFileSync(path.join(outDir, 'spark-stormweaver.pob.xml'), xml);
  fs.writeFileSync(path.join(outDir, 'spark-stormweaver.pob.txt'), code);
  console.log(`\nXML  ${xml.length} bytes  -> docs/builds/spark-stormweaver.pob.xml`);
  console.log(`code ${code.length} chars  -> docs/builds/spark-stormweaver.pob.txt`);

  if (process.argv.includes('--verify')) {
    const back = zlib.inflateSync(Buffer.from(code.replace(/-/g, '+').replace(/_/g, '/'), 'base64')).toString('utf8');
    const checks = [
      ['round-trips to identical XML', back === xml],
      ['declares the Sorceress class', /className="Sorceress"/.test(xml)],
      ['declares Stormweaver', /ascendClassName="Stormweaver"/.test(xml) && /ascendancyInternalId="Sorceress1"/.test(xml)],
      ['tree version matches dataset', new RegExp(`treeVersion="${tree.treeVersion}"`).test(xml)],
      [`allocates ${nodes.length} nodes`, new RegExp(`nodes="[0-9,]{10,}"`).test(xml)],
      ['Spark is the main skill', /skillId="SparkPlayer"/.test(xml)],
      ['both skill groups present', (xml.match(/<Skill /g) || []).length === 2],
      ['all 9 gear slots present', (xml.match(/<Slot /g) || []).length === 9],
    ];
    console.log();
    let bad = 0;
    for (const [label, ok] of checks) { console.log(`${ok ? 'ok  ' : 'FAIL'}  ${label}`); if (!ok) bad += 1; }
    console.log(`\n${checks.length - bad}/${checks.length} checks passed`);
    if (bad) process.exit(1);
  }
}

main();
