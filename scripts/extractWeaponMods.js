/**
 * Extract weapon mods (prefixes and suffixes) from Path of Building 2 ModItem.lua
 * and save as JSON for the web application
 */

const fs = require('fs');
const path = require('path');

const modItemPath = path.join(__dirname, '../PathOfBuilding-PoE2/src/Data/ModItem.lua');
const outputPath = path.join(__dirname, '../src/data/WeaponMods.json');

const content = fs.readFileSync(modItemPath, 'utf-8');

// Map of weightKey to actual weapon types in our data
const weightKeyToWeaponType = {
  'weapon': ['All Weapons'],
  'sword': ['One Handed Sword', 'Two Handed Sword'],
  'axe': ['One Handed Axe', 'Two Handed Axe'],
  'mace': ['One Handed Mace', 'Two Handed Mace'],
  'dagger': ['Dagger'],
  'claw': ['Claw'],
  'staff': ['Staff'],
  'warstaff': ['Staff'],
  'wand': ['Wand'],
  'bow': ['Bow'],
  'crossbow': ['Crossbow'],
  'spear': ['Spear'],
  'flail': ['Flail'],
  'sceptre': ['Sceptre'],
  'ranged': ['Bow', 'Crossbow', 'Wand'],
  'onehand': ['One Handed Sword', 'One Handed Axe', 'One Handed Mace', 'Dagger', 'Claw', 'Wand', 'Sceptre'],
  'twohand': ['Two Handed Sword', 'Two Handed Axe', 'Two Handed Mace', 'Staff', 'Bow'],
  'one_hand_weapon': ['One Handed Sword', 'One Handed Axe', 'One Handed Mace', 'Dagger', 'Claw', 'Wand', 'Sceptre'],
  'two_hand_weapon': ['Two Handed Sword', 'Two Handed Axe', 'Two Handed Mace', 'Staff', 'Bow'],
};

// All weapon-related keys
const weaponWeightKeys = Object.keys(weightKeyToWeaponType);

const mods = [];

// Process line by line since each mod is on a single line
const lines = content.split('\n');

for (const line of lines) {
  // Match mod entries: ["ModName"] = { ... }
  const modMatch = line.match(/^\s*\["([^"]+)"\]\s*=\s*\{(.+)\},?\s*$/);
  if (!modMatch) continue;

  const modId = modMatch[1];
  const modContent = modMatch[2];

  // Extract type (Prefix/Suffix)
  const typeMatch = modContent.match(/type\s*=\s*"([^"]+)"/);
  if (!typeMatch) continue;
  const type = typeMatch[1];
  if (type !== 'Prefix' && type !== 'Suffix') continue;

  // Extract affix name
  const affixMatch = modContent.match(/affix\s*=\s*"([^"]+)"/);
  if (!affixMatch) continue;
  const affix = affixMatch[1];

  // Extract level requirement
  const levelMatch = modContent.match(/level\s*=\s*(\d+)/);
  const level = levelMatch ? parseInt(levelMatch[1]) : 1;

  // Extract group
  const groupMatch = modContent.match(/group\s*=\s*"([^"]+)"/);
  const group = groupMatch ? groupMatch[1] : null;

  // Extract weight keys and values
  const weightKeyMatch = modContent.match(/weightKey\s*=\s*\{([^}]+)\}/);
  const weightValMatch = modContent.match(/weightVal\s*=\s*\{([^}]+)\}/);
  if (!weightKeyMatch || !weightValMatch) continue;

  const weightKeys = weightKeyMatch[1].match(/"([^"]+)"/g)?.map(k => k.replace(/"/g, '')) || [];
  const weightVals = weightValMatch[1].match(/\d+/g)?.map(v => parseInt(v)) || [];

  // Build map of key -> value for this mod
  const weights = {};
  weightKeys.forEach((key, i) => {
    weights[key] = weightVals[i] || 0;
  });

  // Check if it applies to any weapons (weight > 0)
  const hasWeaponWeight = weaponWeightKeys.some(key => weights[key] > 0);
  if (!hasWeaponWeight) continue;

  // Extract stat descriptions
  const statDescriptions = [];
  const afterAffix = modContent.split(/affix\s*=\s*"[^"]+"/)[1];
  if (afterAffix) {
    const beforeStatOrder = afterAffix.split(/statOrder/)[0];
    const statMatches = beforeStatOrder.match(/"([^"]+)"/g);
    if (statMatches) {
      for (const match of statMatches) {
        const stat = match.replace(/"/g, '');
        if (stat.length > 5 && (
          stat.includes('%') ||
          stat.includes('+') ||
          stat.includes('to ') ||
          stat.includes('increased') ||
          stat.includes('reduced') ||
          stat.includes('added') ||
          stat.includes('Adds') ||
          stat.includes('Gain') ||
          stat.includes('Regenerate') ||
          stat.includes('Leech')
        )) {
          statDescriptions.push(stat);
        }
      }
    }
  }

  if (statDescriptions.length === 0) continue;

  // Determine which weapon types this mod can actually roll on (weight > 0)
  const applicableWeaponTypes = new Set();

  for (const [weightKey, weight] of Object.entries(weights)) {
    if (weight > 0 && weightKeyToWeaponType[weightKey]) {
      weightKeyToWeaponType[weightKey].forEach(wt => applicableWeaponTypes.add(wt));
    }
  }

  // Convert to array
  const applicableWeapons = Array.from(applicableWeaponTypes);

  // Skip if no applicable weapons
  if (applicableWeapons.length === 0) continue;

  // Categorize the mod
  let category = 'Other';
  const statText = statDescriptions.join(' ').toLowerCase();
  if (statText.includes('physical damage')) category = 'Physical Damage';
  else if (statText.includes('fire damage') || statText.includes('adds') && statText.includes('fire')) category = 'Fire Damage';
  else if (statText.includes('cold damage') || statText.includes('adds') && statText.includes('cold')) category = 'Cold Damage';
  else if (statText.includes('lightning damage') || statText.includes('adds') && statText.includes('lightning')) category = 'Lightning Damage';
  else if (statText.includes('chaos damage')) category = 'Chaos Damage';
  else if (statText.includes('attack speed')) category = 'Attack Speed';
  else if (statText.includes('critical')) category = 'Critical';
  else if (statText.includes('accuracy')) category = 'Accuracy';
  else if (statText.includes('strength') || statText.includes('dexterity') || statText.includes('intelligence') || statText.includes('attributes')) category = 'Attributes';
  else if (statText.includes('mana')) category = 'Mana';
  else if (statText.includes('life')) category = 'Life';
  else if (statText.includes('leech')) category = 'Leech';
  else if (statText.includes('spell')) category = 'Spell Damage';
  else if (statText.includes('cast speed')) category = 'Cast Speed';

  mods.push({
    id: modId,
    type: type,
    affix: affix,
    level: level,
    group: group,
    stats: statDescriptions,
    category: category,
    applicableWeapons: applicableWeapons,
    weightKeys: Object.keys(weights).filter(k => weights[k] > 0)
  });
}

// Sort by type, then category, then level
mods.sort((a, b) => {
  if (a.type !== b.type) return a.type.localeCompare(b.type);
  if (a.category !== b.category) return a.category.localeCompare(b.category);
  return a.level - b.level;
});

// Create organized structure
const organizedMods = {
  prefixes: mods.filter(m => m.type === 'Prefix'),
  suffixes: mods.filter(m => m.type === 'Suffix')
};

console.log(`Extracted ${mods.length} weapon mods`);
console.log(`  Prefixes: ${organizedMods.prefixes.length}`);
console.log(`  Suffixes: ${organizedMods.suffixes.length}`);

// Count by category
const categories = {};
mods.forEach(m => {
  categories[m.category] = (categories[m.category] || 0) + 1;
});
console.log('\nMods by category:');
Object.entries(categories).sort().forEach(([cat, count]) => {
  console.log(`  ${cat}: ${count}`);
});

// Write to file
fs.writeFileSync(outputPath, JSON.stringify(organizedMods, null, 2));
console.log(`\nOutput written to: ${outputPath}`);

// Print some examples
console.log('\nSample Prefixes:');
organizedMods.prefixes.slice(0, 5).forEach(m => {
  console.log(`  ${m.affix} (Lvl ${m.level}): ${m.stats.join(', ')}`);
});

console.log('\nSample Suffixes:');
organizedMods.suffixes.slice(0, 5).forEach(m => {
  console.log(`  ${m.affix} (Lvl ${m.level}): ${m.stats.join(', ')}`);
});

