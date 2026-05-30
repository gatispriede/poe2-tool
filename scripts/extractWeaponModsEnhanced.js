// Enhanced weapon mod extraction to include ALL mods
// Including "+# to Level of all Skill Gems" and other missing affixes

const fs = require('fs');
const path = require('path');

const modItemPath = path.join(__dirname, '../PathOfBuilding-PoE2/src/Data/ModItem.lua');
const outputPath = path.join(__dirname, '../src/data/WeaponModsEnhanced.json');

console.log('Reading ModItem.lua...');
const content = fs.readFileSync(modItemPath, 'utf-8');

const mods = { prefixes: [], suffixes: [] };
const lines = content.split('\n');

// Common weapon-related keywords to identify weapon mods
const weaponKeywords = ['weapon', 'wand', 'staff', 'sceptre', 'mace', 'axe', 'sword',
                        'dagger', 'claw', 'bow', 'crossbow', 'spear', 'flail',
                        'one_hand', 'two_hand', 'melee', 'ranged'];

const globalModKeywords = ['skill gems', 'socketed gems', 'all skills', 'level of'];

let currentMod = null;
let modId = null;

for (let i = 0; i < lines.length; i++) {
  const line = lines[i].trim();

  // Start of new mod definition
  const modStartMatch = line.match(/^\["([^"]+)"\]\s*=\s*\{/);
  if (modStartMatch) {
    modId = modStartMatch[1];
    currentMod = { id: modId, content: line };
    continue;
  }

  // Continue building current mod
  if (currentMod && !line.match(/^}\s*,?\s*$/)) {
    currentMod.content += ' ' + line;
    continue;
  }

  // End of mod definition
  if (currentMod && line.match(/^}\s*,?\s*$/)) {
    currentMod.content += ' ' + line;
    const parsed = parseMod(currentMod.content, currentMod.id);

    if (parsed) {
      if (parsed.type === 'Prefix') {
        mods.prefixes.push(parsed);
      } else if (parsed.type === 'Suffix') {
        mods.suffixes.push(parsed);
      }
    }

    currentMod = null;
    modId = null;
  }
}

function parseMod(content, id) {
  // Extract type
  const typeMatch = content.match(/type\s*=\s*"([^"]+)"/);
  if (!typeMatch) return null;
  const type = typeMatch[1];

  if (type !== 'Prefix' && type !== 'Suffix') return null;

  // Extract affix name
  const affixMatch = content.match(/affix\s*=\s*"([^"]+)"/);
  const affix = affixMatch ? affixMatch[1] : id;

  // Extract level
  const levelMatch = content.match(/level\s*=\s*(\d+)/);
  const level = levelMatch ? parseInt(levelMatch[1]) : 1;

  // Extract group
  const groupMatch = content.match(/group\s*=\s*"([^"]+)"/);
  const group = groupMatch ? groupMatch[1] : null;

  // Extract stats - all quoted strings that look like stat descriptions
  const stats = [];
  const statRegex = /"([^"]*(?:\+|\-|%|to |Adds |adds |increased|reduced|more|less|Damage|Speed|Critical|Chance|Level|Gems?|Socketed)[^"]*)"/gi;
  let match;
  while ((match = statRegex.exec(content)) !== null) {
    const stat = match[1].trim();
    // Filter out obvious non-stat strings
    if (stat && stat.length > 5 && !stat.startsWith('Local')) {
      stats.push(stat);
    }
  }

  // Extract weightKey and weightVal
  const weightKeyMatch = content.match(/weightKey\s*=\s*\{([^}]+)\}/);
  const weightValMatch = content.match(/weightVal\s*=\s*\{([^}]+)\}/);

  if (!weightKeyMatch || !weightValMatch || stats.length === 0) return null;

  const weightKeys = weightKeyMatch[1].match(/"([^"]+)"/g)?.map(s => s.replace(/"/g, '')) || [];
  const weightVals = weightValMatch[1].split(',').map(v => parseInt(v.trim())).filter(v => !isNaN(v));

  // Determine applicable weapons
  const applicableWeapons = [];
  const isWeaponMod = weightKeys.some(key => {
    const keyLower = key.toLowerCase();
    return weaponKeywords.some(kw => keyLower.includes(kw));
  });

  // Check if it's a global mod that applies to all items
  const isGlobalMod = stats.some(stat => {
    const statLower = stat.toLowerCase();
    return globalModKeywords.some(kw => statLower.includes(kw));
  });

  if (!isWeaponMod && !isGlobalMod) return null;

  // Map weight keys to weapon types
  weightKeys.forEach((key, idx) => {
    if (weightVals[idx] > 0) {
      const keyLower = key.toLowerCase();

      if (keyLower.includes('wand')) applicableWeapons.push('Wand');
      if (keyLower.includes('staff') || keyLower.includes('warstaff')) applicableWeapons.push('Staff', 'Warstaff');
      if (keyLower.includes('sceptre')) applicableWeapons.push('Sceptre');
      if (keyLower.includes('mace')) applicableWeapons.push('Mace', 'One Handed Mace', 'Two Handed Mace');
      if (keyLower.includes('axe')) applicableWeapons.push('Axe', 'One Handed Axe', 'Two Handed Axe');
      if (keyLower.includes('sword')) applicableWeapons.push('Sword', 'One Handed Sword', 'Two Handed Sword');
      if (keyLower.includes('dagger')) applicableWeapons.push('Dagger');
      if (keyLower.includes('claw')) applicableWeapons.push('Claw');
      if (keyLower.includes('bow')) applicableWeapons.push('Bow');
      if (keyLower.includes('crossbow')) applicableWeapons.push('Crossbow');
      if (keyLower.includes('spear')) applicableWeapons.push('Spear');
      if (keyLower.includes('flail')) applicableWeapons.push('Flail');
      if (keyLower.includes('quarterstaff')) applicableWeapons.push('Quarterstaff');
      if (keyLower.includes('one_hand') || keyLower.includes('melee')) {
        // One handed weapons
        applicableWeapons.push('One Handed Sword', 'One Handed Axe', 'One Handed Mace', 'Dagger', 'Claw', 'Wand', 'Sceptre');
      }
      if (keyLower.includes('two_hand')) {
        // Two handed weapons
        applicableWeapons.push('Two Handed Sword', 'Two Handed Axe', 'Two Handed Mace', 'Staff', 'Warstaff', 'Bow', 'Crossbow', 'Quarterstaff');
      }
      if (keyLower.includes('weapon') || isGlobalMod) {
        // All weapons
        applicableWeapons.push('All Weapons');
      }
    }
  });

  if (applicableWeapons.length === 0) return null;

  // Extract mod tags for categorization
  const modTagsMatch = content.match(/modTags\s*=\s*\{([^}]+)\}/);
  const modTags = modTagsMatch ?
    modTagsMatch[1].match(/"([^"]+)"/g)?.map(s => s.replace(/"/g, '')) || [] : [];

  // Categorize based on stats
  const category = [...new Set([...modTags, ...categorizeStats(stats)])].join(', ');

  return {
    id,
    type,
    affix,
    level,
    group,
    stats,
    category,
    applicableWeapons: [...new Set(applicableWeapons)],
    modTags
  };
}

function categorizeStats(stats) {
  const categories = [];
  const statsLower = stats.join(' ').toLowerCase();

  if (statsLower.includes('physical damage')) categories.push('physical_damage');
  if (statsLower.includes('fire damage')) categories.push('fire_damage');
  if (statsLower.includes('cold damage')) categories.push('cold_damage');
  if (statsLower.includes('lightning damage')) categories.push('lightning_damage');
  if (statsLower.includes('chaos damage')) categories.push('chaos_damage');
  if (statsLower.includes('elemental damage')) categories.push('elemental_damage');
  if (statsLower.includes('spell damage')) categories.push('spell_damage');
  if (statsLower.includes('attack speed')) categories.push('attack_speed');
  if (statsLower.includes('cast speed')) categories.push('cast_speed');
  if (statsLower.includes('critical')) categories.push('critical');
  if (statsLower.includes('level')) categories.push('skill_level');
  if (statsLower.includes('mana')) categories.push('mana');
  if (statsLower.includes('life')) categories.push('life');

  return categories;
}

console.log(`\nExtracted ${mods.prefixes.length} prefixes and ${mods.suffixes.length} suffixes`);

// Find and report "+X to Level of all Skill Gems" mods
const levelMods = [...mods.prefixes, ...mods.suffixes].filter(mod =>
  mod.stats.some(s => s.toLowerCase().includes('level') && s.toLowerCase().includes('skill'))
);
console.log(`\nFound ${levelMods.length} skill level mods:`);
levelMods.forEach(mod => {
  console.log(`  ${mod.type} - ${mod.affix} (Level ${mod.level}): ${mod.stats.join(', ')}`);
});

// Save to file
fs.writeFileSync(outputPath, JSON.stringify(mods, null, 2));
console.log(`\nSaved to ${outputPath}`);

// Also save a summary
const summary = {
  totalPrefixes: mods.prefixes.length,
  totalSuffixes: mods.suffixes.length,
  categories: {},
  sampleMods: {
    levelMods: levelMods.slice(0, 5),
    spellMods: mods.prefixes.filter(m => m.category.includes('spell')).slice(0, 5)
  }
};

fs.writeFileSync(
  path.join(__dirname, '../src/data/WeaponModsSummary.json'),
  JSON.stringify(summary, null, 2)
);

console.log('\nExtraction complete!');

