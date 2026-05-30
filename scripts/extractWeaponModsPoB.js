/**
 * Extract weapon mods from Path of Building 2 (PoE2)
 * Source: PathOfBuilding-PoE2/src/Data/ModItem.lua
 */

const fs = require('fs');
const path = require('path');

const modItemPath = path.join(__dirname, '../PathOfBuilding-PoE2/src/Data/ModItem.lua');
const outputPath = path.join(__dirname, '../src/data/WeaponMods.json');

// Weapon type mappings from PoB weightKey to our weapon types
const weaponTypeMapping = {
  'wand': 'Wand',
  'staff': 'Staff',
  'warstaff': 'Warstaff',
  'sceptre': 'Sceptre',
  'mace': 'Mace',
  'axe': 'Axe',
  'sword': 'Sword',
  'dagger': 'Dagger',
  'claw': 'Claw',
  'bow': 'Bow',
  'crossbow': 'Crossbow',
  'spear': 'Spear',
  'flail': 'Flail',
  'one_hand_weapon': 'One Handed',
  'two_hand_weapon': 'Two Handed',
  'ranged_weapon': 'Ranged',
  'melee_weapon': 'Melee',
};

// Read the Lua file
const content = fs.readFileSync(modItemPath, 'utf-8');

console.log('File loaded, length:', content.length);
console.log('First 500 chars:', content.substring(0, 500));

const mods = [];

// Process line by line - each mod is on its own line
const lines = content.split('\n');
console.log('Total lines:', lines.length);

// Write debug info to file
fs.writeFileSync(path.join(__dirname, 'debug.txt'),
  `Lines: ${lines.length}\nFirst 1000 chars:\n${content.substring(0, 1000)}\n\nSample lines:\n${lines.slice(3, 10).join('\n')}`
);

let matchCount = 0;
for (const line of lines) {
  // Match mod entries: ["ModId"] = { type = "...", affix = "...", "stat", ... }
  const modMatch = line.match(/^\s*\["([^"]+)"\]\s*=\s*\{(.+)\},?\s*$/);
  if (!modMatch) continue;

  matchCount++;
  if (matchCount <= 3) {
    console.log('Matched mod:', modMatch[1]);
  }

  const modId = modMatch[1];
  const modContent = modMatch[2];

  // Extract type (Prefix/Suffix)
  const typeMatch = modContent.match(/type\s*=\s*"([^"]+)"/);
  if (!typeMatch) continue;
  const modType = typeMatch[1];
  
  // Only process Prefix and Suffix
  if (modType !== 'Prefix' && modType !== 'Suffix') continue;
  
  // Extract affix name
  const affixMatch = modContent.match(/affix\s*=\s*"([^"]+)"/);
  const affix = affixMatch ? affixMatch[1] : modId;
  
  // Extract stat description - the quoted strings that look like stat descriptions
  // They come after affix and before statOrder
  const statsSection = modContent.split('statOrder')[0];
  const statMatches = statsSection.match(/"([^"]*(?:\+|\-|%|to |Adds |adds |increased|more|Damage|Speed|Critical|Chance|Life|Mana|Armour|Evasion|Energy Shield)[^"]*)"/gi);
  const stats = statMatches ? statMatches.map(s => s.replace(/^"|"$/g, '')) : [];
  
  // Extract level requirement
  const levelMatch = modContent.match(/level\s*=\s*(\d+)/);
  const level = levelMatch ? parseInt(levelMatch[1]) : 1;
  
  // Extract group
  const groupMatch = modContent.match(/group\s*=\s*"([^"]+)"/);
  const group = groupMatch ? groupMatch[1] : null;
  
  // Extract weightKey (item types that can roll this mod)
  const weightKeyMatch = modContent.match(/weightKey\s*=\s*\{([^}]+)\}/);
  const weightValMatch = modContent.match(/weightVal\s*=\s*\{([^}]+)\}/);
  
  if (!weightKeyMatch || !weightValMatch) continue;
  
  const weightKeys = weightKeyMatch[1].match(/"([^"]+)"/g)?.map(s => s.replace(/"/g, '')) || [];
  const weightVals = weightValMatch[1].split(',').map(v => parseInt(v.trim())).filter(v => !isNaN(v));
  
  // Determine which weapon types can roll this mod
  const applicableWeapons = [];
  
  for (let i = 0; i < weightKeys.length && i < weightVals.length; i++) {
    const key = weightKeys[i];
    const val = weightVals[i];
    
    if (val <= 0) continue; // Weight 0 means cannot roll
    if (key === 'default') continue;

    // Map to our weapon types
    if (weaponTypeMapping[key]) {
      applicableWeapons.push(weaponTypeMapping[key]);
    }
  }
  
  // If no specific weapons, check for armor/accessory - skip those
  if (applicableWeapons.length === 0) continue;
  
  // Extract modTags
  const modTagsMatch = modContent.match(/modTags\s*=\s*\{([^}]+)\}/);
  const modTags = modTagsMatch 
    ? modTagsMatch[1].match(/"([^"]+)"/g)?.map(s => s.replace(/"/g, '')) || []
    : [];
  
  // Filter stats - only keep meaningful ones
  if (stats.length === 0) continue;

  mods.push({
    id: modId,
    type: modType,
    affix,
    level,
    group,
    stats,
    category: modTags.join(', '),
    applicableWeapons: [...new Set(applicableWeapons)],
    modTags
  });
}

// Separate into prefixes and suffixes
const prefixes = mods.filter(m => m.type === 'Prefix');
const suffixes = mods.filter(m => m.type === 'Suffix');

// Sort by level descending
prefixes.sort((a, b) => b.level - a.level);
suffixes.sort((a, b) => b.level - a.level);

const output = { prefixes, suffixes };

fs.writeFileSync(outputPath, JSON.stringify(output, null, 2));

console.log('=== Weapon Mods Extraction ===');
console.log('Prefixes:', prefixes.length);
console.log('Suffixes:', suffixes.length);
console.log('Total:', mods.length);

// Show some samples
console.log('\n=== Sample Prefixes ===');
prefixes.slice(0, 5).forEach(m => {
  console.log(`  ${m.affix} (Lvl ${m.level}): ${m.stats[0]} [${m.applicableWeapons.slice(0,3).join(', ')}]`);
});

console.log('\n=== Sample Suffixes ===');
suffixes.slice(0, 5).forEach(m => {
  console.log(`  ${m.affix} (Lvl ${m.level}): ${m.stats[0]} [${m.applicableWeapons.slice(0,3).join(', ')}]`);
});

// Count by weapon type
const byWeapon = {};
mods.forEach(m => {
  m.applicableWeapons.forEach(w => {
    byWeapon[w] = (byWeapon[w] || 0) + 1;
  });
});
console.log('\n=== Mods by Weapon Type ===');
Object.entries(byWeapon)
  .sort((a, b) => b[1] - a[1])
  .forEach(([type, count]) => {
    console.log(`  ${type}: ${count}`);
  });

console.log('\nOutput written to:', outputPath);
