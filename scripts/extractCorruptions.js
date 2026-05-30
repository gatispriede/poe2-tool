/**
 * Extract corruption mods from Path of Building 2 (PoE2)
 * Source: PathOfBuilding-PoE2/src/Data/ModCorrupted.lua
 */

const fs = require('fs');
const path = require('path');

const modCorruptedPath = path.join(__dirname, '../PathOfBuilding-PoE2/src/Data/ModCorrupted.lua');
const outputPath = path.join(__dirname, '../src/data/Corruptions.json');

// Read the Lua file
const content = fs.readFileSync(modCorruptedPath, 'utf-8');

console.log('Extracting corruption mods from ModCorrupted.lua...\n');

const corruptions = [];

// Process line by line - each mod is on its own line
const lines = content.split('\n');

for (const line of lines) {
  // Match mod entries: ["ModId"] = { type = "...", affix = "", "stat text", ... }
  const modMatch = line.match(/^\s*\["([^"]+)"\]\s*=\s*\{(.+)\},?\s*$/);
  if (!modMatch) continue;

  const modId = modMatch[1];
  const modContent = modMatch[2];

  // Extract type (Corrupted or SpecialCorrupted)
  const typeMatch = modContent.match(/type\s*=\s*"([^"]+)"/);
  if (!typeMatch) continue;
  const modType = typeMatch[1];

  // Only process Corrupted and SpecialCorrupted
  if (modType !== 'Corrupted' && modType !== 'SpecialCorrupted') continue;

  // Extract stat text - quoted strings that look like stats
  const statsSection = modContent.split('statOrder')[0];
  const statMatches = statsSection.match(/"([^"]*(?:\+|\-|%|to |Adds |adds |increased|reduced|more|Damage|Speed|Critical|Chance|Life|Mana|Armour|Evasion|Energy Shield|Resistance|Spirit|Block|Leech|Regenerat|Penetrat|Level|Skill|charge|Immune|cannot)[^"]*)"/gi);
  const stat = statMatches && statMatches.length > 0
    ? statMatches[0].replace(/^"|"$/g, '')
    : null;

  if (!stat) continue;

  // Extract level requirement
  const levelMatch = modContent.match(/level\s*=\s*(\d+)/);
  const level = levelMatch ? parseInt(levelMatch[1]) : 1;

  // Extract group
  const groupMatch = modContent.match(/group\s*=\s*"([^"]+)"/);
  const group = groupMatch ? groupMatch[1] : null;

  // Extract weightKey (item slots that can roll this mod)
  const weightKeyMatch = modContent.match(/weightKey\s*=\s*\{([^}]+)\}/);
  const weightValMatch = modContent.match(/weightVal\s*=\s*\{([^}]+)\}/);

  let applicableSlots = [];
  if (weightKeyMatch && weightValMatch) {
    const weightKeys = weightKeyMatch[1].match(/"([^"]+)"/g)?.map(s => s.replace(/"/g, '')) || [];
    const weightVals = weightValMatch[1].split(',').map(v => parseInt(v.trim())).filter(v => !isNaN(v));

    // Only include slots where weight > 0
    for (let i = 0; i < weightKeys.length && i < weightVals.length; i++) {
      if (weightVals[i] > 0 && weightKeys[i] !== 'default') {
        applicableSlots.push(weightKeys[i]);
      }
    }
  }

  // Extract mod tags
  const modTagsMatch = modContent.match(/modTags\s*=\s*\{([^}]+)\}/);
  let modTags = [];
  if (modTagsMatch) {
    modTags = modTagsMatch[1].match(/"([^"]+)"/g)?.map(s => s.replace(/"/g, '')) || [];
  }

  // Extract trade hash
  const tradeHashMatch = modContent.match(/tradeHash\s*=\s*(\d+)/);
  const tradeHash = tradeHashMatch ? parseInt(tradeHashMatch[1]) : null;

  // Parse stat ranges (e.g., "(15-25)%" -> { min: 15, max: 25 })
  let statRange = null;
  const rangeMatch = stat.match(/\((\d+)-(\d+)\)/);
  if (rangeMatch) {
    statRange = {
      min: parseInt(rangeMatch[1]),
      max: parseInt(rangeMatch[2])
    };
  }

  corruptions.push({
    id: modId,
    type: modType,
    stat,
    statRange,
    level,
    group,
    applicableSlots,
    modTags,
    tradeHash
  });
}

// Sort by type then by stat
corruptions.sort((a, b) => {
  if (a.type !== b.type) return a.type.localeCompare(b.type);
  return a.stat.localeCompare(b.stat);
});

// Write output
fs.writeFileSync(outputPath, JSON.stringify(corruptions, null, 2));

console.log(`Total corruption mods: ${corruptions.length}`);
console.log(`Output written to: ${outputPath}`);

// Slot breakdown
const slotStats = {};
for (const corruption of corruptions) {
  for (const slot of corruption.applicableSlots) {
    slotStats[slot] = (slotStats[slot] || 0) + 1;
  }
}
console.log('\nCorruptions by slot:');
for (const [slot, count] of Object.entries(slotStats).sort((a, b) => b[1] - a[1])) {
  console.log(`  ${slot}: ${count}`);
}

// Type breakdown
const typeStats = {};
for (const corruption of corruptions) {
  typeStats[corruption.type] = (typeStats[corruption.type] || 0) + 1;
}
console.log('\nBy type:');
for (const [type, count] of Object.entries(typeStats)) {
  console.log(`  ${type}: ${count}`);
}
