/**
 * Extract unique items from Path of Building 2 (PoE2)
 * Source: PathOfBuilding-PoE2/src/Data/Uniques/*.lua
 */

const fs = require('fs');
const path = require('path');

const uniquesDir = path.join(__dirname, '../PathOfBuilding-PoE2/src/Data/Uniques');
const outputPath = path.join(__dirname, '../src/data/Uniques.json');

// Map file names to categories and item classes
const fileToCategory = {
  // Weapons
  'axe.lua': { category: 'weapon', defaultClass: 'Axe' },
  'bow.lua': { category: 'weapon', defaultClass: 'Bow' },
  'claw.lua': { category: 'weapon', defaultClass: 'Claw' },
  'crossbow.lua': { category: 'weapon', defaultClass: 'Crossbow' },
  'dagger.lua': { category: 'weapon', defaultClass: 'Dagger' },
  'flail.lua': { category: 'weapon', defaultClass: 'Flail' },
  'mace.lua': { category: 'weapon', defaultClass: 'Mace' },
  'sceptre.lua': { category: 'weapon', defaultClass: 'Sceptre' },
  'spear.lua': { category: 'weapon', defaultClass: 'Spear' },
  'staff.lua': { category: 'weapon', defaultClass: 'Staff' },
  'sword.lua': { category: 'weapon', defaultClass: 'Sword' },
  'wand.lua': { category: 'weapon', defaultClass: 'Wand' },
  // Armour
  'body.lua': { category: 'armour', defaultClass: 'Body Armour' },
  'boots.lua': { category: 'armour', defaultClass: 'Boots' },
  'gloves.lua': { category: 'armour', defaultClass: 'Gloves' },
  'helmet.lua': { category: 'armour', defaultClass: 'Helmet' },
  // Accessories
  'amulet.lua': { category: 'accessory', defaultClass: 'Amulet' },
  'belt.lua': { category: 'accessory', defaultClass: 'Belt' },
  'ring.lua': { category: 'accessory', defaultClass: 'Ring' },
  // Offhand
  'focus.lua': { category: 'offhand', defaultClass: 'Focus' },
  'quiver.lua': { category: 'offhand', defaultClass: 'Quiver' },
  'shield.lua': { category: 'offhand', defaultClass: 'Shield' },
  // Other
  'jewel.lua': { category: 'jewel', defaultClass: 'Jewel' },
  'flask.lua': { category: 'flask', defaultClass: 'Flask' },
  'soulcore.lua': { category: 'jewel', defaultClass: 'Soulcore' },
  'fishing.lua': { category: 'weapon', defaultClass: 'Fishing Rod' },
  'traptool.lua': { category: 'offhand', defaultClass: 'Trap Tool' },
  'tincture.lua': { category: 'flask', defaultClass: 'Tincture' },
};

// Determine item class from base type name
function inferItemClass(baseType, defaultClass) {
  const baseLower = baseType.toLowerCase();

  // Two-handed weapon detection
  if (baseLower.includes('greatclub') || baseLower.includes('greathammer') ||
      baseLower.includes('greataxe') || baseLower.includes('maul') ||
      baseLower.includes('totemic') || baseLower.includes('cultist') ||
      baseLower.includes('temple maul') || baseLower.includes('giant maul')) {
    if (defaultClass === 'Mace') return 'Two Handed Mace';
  }
  if (baseLower.includes('great') && defaultClass === 'Sword') return 'Two Handed Sword';
  if (baseLower.includes('great') && defaultClass === 'Axe') return 'Two Handed Axe';

  // One-handed by default for weapons
  if (['Mace', 'Sword', 'Axe'].includes(defaultClass)) {
    return `One Handed ${defaultClass}`;
  }

  return defaultClass;
}

function parseUniqueBlock(block, fileInfo) {
  const lines = block.trim().split('\n').map(l => l.trim()).filter(l => l);
  if (lines.length < 2) return null;

  const name = lines[0];
  const baseType = lines[1];

  // Generate ID from name
  const id = name.toLowerCase()
    .replace(/[^a-z0-9\s]/g, '')
    .replace(/\s+/g, '-');

  const unique = {
    id,
    name,
    baseType,
    category: fileInfo.category,
    itemClass: inferItemClass(baseType, fileInfo.defaultClass),
    league: null,
    source: null,
    requiresLevel: null,
    variants: [],
    mods: [],
  };

  let implicitCount = 0;
  let currentModIndex = 0;
  let inMods = false;

  for (let i = 2; i < lines.length; i++) {
    const line = lines[i];

    // Parse metadata
    if (line.startsWith('League:')) {
      unique.league = line.replace('League:', '').trim();
      continue;
    }
    if (line.startsWith('Source:')) {
      unique.source = line.replace('Source:', '').trim();
      continue;
    }
    if (line.startsWith('Requires Level')) {
      const match = line.match(/Requires Level (\d+)/);
      if (match) unique.requiresLevel = parseInt(match[1]);
      continue;
    }
    if (line.startsWith('Variant:')) {
      const variantName = line.replace('Variant:', '').trim();
      unique.variants.push({
        id: unique.variants.length + 1,
        name: variantName,
      });
      continue;
    }
    if (line.startsWith('Implicits:')) {
      const match = line.match(/Implicits:\s*(\d+)/);
      if (match) implicitCount = parseInt(match[1]);
      inMods = true;
      continue;
    }

    // Parse mods
    if (line.length > 0 && !line.startsWith('--')) {
      inMods = true;

      let modText = line;
      let variantIds = [];
      let tags = [];

      // Extract variant info: {variant:1,2}
      const variantMatch = modText.match(/\{variant:([0-9,]+)\}/);
      if (variantMatch) {
        variantIds = variantMatch[1].split(',').map(v => parseInt(v.trim()));
        modText = modText.replace(/\{variant:[0-9,]+\}/, '').trim();
      }

      // Extract tags: {tags:life,mana}
      const tagsMatch = modText.match(/\{tags:([^}]+)\}/);
      if (tagsMatch) {
        tags = tagsMatch[1].split(',').map(t => t.trim());
        modText = modText.replace(/\{tags:[^}]+\}/, '').trim();
      }

      if (modText.length > 0) {
        const isImplicit = currentModIndex < implicitCount;
        unique.mods.push({
          text: modText,
          variantIds: variantIds.length > 0 ? variantIds : undefined,
          tags: tags.length > 0 ? tags : undefined,
          isImplicit,
        });
        currentModIndex++;
      }
    }
  }

  // Mark current variant if variants exist
  if (unique.variants.length > 0) {
    const lastVariant = unique.variants[unique.variants.length - 1];
    if (lastVariant.name === 'Current') {
      lastVariant.isDefault = true;
    } else {
      unique.variants[unique.variants.length - 1].isDefault = true;
    }
  }

  return unique;
}

function parseLuaFile(filePath, fileInfo) {
  const content = fs.readFileSync(filePath, 'utf-8');
  const uniques = [];

  // Extract all [[ ... ]] blocks
  const blockRegex = /\[\[([\s\S]*?)\]\]/g;
  let match;

  while ((match = blockRegex.exec(content)) !== null) {
    const unique = parseUniqueBlock(match[1], fileInfo);
    if (unique) {
      uniques.push(unique);
    }
  }

  return uniques;
}

// Main execution
console.log('Extracting unique items from Path of Building 2...\n');

const allUniques = [];
const stats = {};

// Process each Lua file
const files = fs.readdirSync(uniquesDir).filter(f => f.endsWith('.lua'));

for (const file of files) {
  const fileInfo = fileToCategory[file];
  if (!fileInfo) {
    console.log(`Skipping unknown file: ${file}`);
    continue;
  }

  const filePath = path.join(uniquesDir, file);
  const uniques = parseLuaFile(filePath, fileInfo);

  stats[file] = uniques.length;
  allUniques.push(...uniques);

  console.log(`${file}: ${uniques.length} uniques`);
}

// Sort by name
allUniques.sort((a, b) => a.name.localeCompare(b.name));

// Write output
fs.writeFileSync(outputPath, JSON.stringify(allUniques, null, 2));

console.log('\n=== Summary ===');
console.log(`Total unique items: ${allUniques.length}`);
console.log(`Output written to: ${outputPath}`);

// Category breakdown
const categoryStats = {};
for (const unique of allUniques) {
  categoryStats[unique.category] = (categoryStats[unique.category] || 0) + 1;
}
console.log('\nBy category:');
for (const [cat, count] of Object.entries(categoryStats).sort((a, b) => b[1] - a[1])) {
  console.log(`  ${cat}: ${count}`);
}
