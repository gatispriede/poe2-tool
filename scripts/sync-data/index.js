// Orchestrator. `npm run sync-data` runs this to regenerate all typed JSON.
// Output: src/data/generated/{weapon-bases.json, item-mods.json, manifest.json}.

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');
const { extractBases } = require('./extractBases');
const { extractArmour } = require('./extractArmour');
const { extractMods } = require('./extractMods');
const { extractSkills } = require('./extractSkills');
const { extractTree } = require('./extractTree');
const { extractUniques } = require('./extractUniques');
const { Manifest } = require('./schemas');

const POB_DIR = path.resolve(__dirname, '../../PathOfBuilding-PoE2');
const POB_DATA_DIR = path.join(POB_DIR, 'src/Data');
const OUT_DIR = path.resolve(__dirname, '../../src/data/generated');

function pobCommit() {
  try {
    return execSync('git rev-parse HEAD', { cwd: POB_DIR }).toString().trim();
  } catch {
    return 'unknown';
  }
}

function writeJSON(file, value) {
  const full = path.join(OUT_DIR, file);
  fs.writeFileSync(full, JSON.stringify(value, null, 2) + '\n');
  return full;
}

function main() {
  if (!fs.existsSync(POB_DATA_DIR)) {
    console.error(`PoB-PoE2 data dir not found at ${POB_DATA_DIR}`);
    process.exit(1);
  }
  fs.mkdirSync(OUT_DIR, { recursive: true });

  console.log('Extracting weapon bases...');
  const { bases, errors: baseErrors } = extractBases(POB_DATA_DIR);
  writeJSON('weapon-bases.json', bases);
  console.log(`  ${bases.length} bases  (${baseErrors.length} errors)`);
  if (baseErrors.length) {
    writeJSON('weapon-bases.errors.json', baseErrors);
  }

  console.log('Extracting armour / jewellery / offhand bases...');
  const { bases: armourBases, errors: armourErrors, perCategory: armourPerCat } = extractArmour(POB_DATA_DIR);
  writeJSON('armour-bases.json', armourBases);
  console.log(`  ${armourBases.length} bases  (${armourErrors.length} errors)`);
  console.log(`  by category: ${Object.entries(armourPerCat).map(([k,v]) => k+':'+v).join(', ')}`);
  if (armourErrors.length) {
    writeJSON('armour-bases.errors.json', armourErrors);
  }

  console.log('Extracting item mods...');
  const { mods, errors: modErrors } = extractMods(POB_DATA_DIR);
  writeJSON('item-mods.json', mods);
  console.log(`  ${mods.length} mods   (${modErrors.length} errors)`);
  if (modErrors.length) {
    writeJSON('item-mods.errors.json', modErrors);
  }

  console.log('Extracting skills...');
  const { skills, errors: skillErrors } = extractSkills(POB_DATA_DIR);
  writeJSON('skills.json', skills);
  const active = skills.filter(s => !s.isSupport).length;
  const support = skills.filter(s => s.isSupport).length;
  console.log(`  ${skills.length} skills  (${active} active + ${support} support, ${skillErrors.length} errors)`);
  if (skillErrors.length) {
    writeJSON('skills.errors.json', skillErrors);
  }

  console.log('Extracting uniques...');
  const { uniques, errors: uniqueErrors } = extractUniques(POB_DATA_DIR);
  writeJSON('uniques.json', uniques);
  const byCat = {};
  for (const u of uniques) byCat[u.category] = (byCat[u.category] || 0) + 1;
  console.log(`  ${uniques.length} uniques  (${uniqueErrors.length} errors)`);
  console.log(`  by category: ${Object.entries(byCat).map(([k,v]) => k+':'+v).join(', ')}`);
  if (uniqueErrors.length) {
    writeJSON('uniques.errors.json', uniqueErrors);
  }

  console.log('Extracting passive tree...');
  const { tree, errors: treeErrors, preserve, missingVersion } = extractTree(POB_DIR);
  if (tree) {
    writeJSON('passive-tree.json', tree);
    console.log(`  ${Object.keys(tree.nodes).length} nodes, ${tree.classes.length} classes  (tree v${tree.treeVersion}, ${treeErrors.length} errors)`);
  } else if (preserve) {
    console.log(`  PRESERVED existing passive-tree.json — v${missingVersion} ships tree.lua only (no tree.json). Parse tree.lua as a follow-up.`);
  } else {
    writeJSON('passive-tree.errors.json', treeErrors);
    console.log(`  FAILED: ${treeErrors.length} errors`);
  }

  const manifest = Manifest.parse({
    sourceCommit: pobCommit(),
    generatedAt: new Date().toISOString(),
    counts: {
      bases: bases.length,
      armourBases: armourBases.length,
      mods: mods.length,
      skills: skills.length,
      treeNodes: tree ? Object.keys(tree.nodes).length : 0,
      basesDropped: baseErrors.length,
      armourBasesDropped: armourErrors.length,
      modsDropped: modErrors.length,
      skillsDropped: skillErrors.length,
      treeErrors: treeErrors.length,
    },
  });
  writeJSON('manifest.json', manifest);

  // A quick sanity sample so we can eyeball multi-stat captures and exclude tags.
  const dualRange = mods.find(m => m.stats.some(s => s.ranges.length >= 2));
  const excluded = bases.find(b => b.excludeTags.length > 0);
  console.log('\nSanity samples:');
  if (dualRange) {
    console.log(`  dual-range mod : ${dualRange.id}  "${dualRange.stats.map(s => s.text).join(' | ')}"`);
  } else {
    console.log('  WARN: no dual-range mod found — stat extraction may be regressing');
  }
  if (excluded) {
    console.log(`  excludeTags    : ${excluded.id}  -> [${excluded.excludeTags.join(', ')}]`);
  } else {
    console.log('  WARN: no base with excludeTags — eligibility rule will be a no-op');
  }

  console.log(`\nSource commit  : ${manifest.sourceCommit}`);
  console.log(`Wrote to       : ${OUT_DIR}`);
}

main();
