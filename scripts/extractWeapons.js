/**
 * Extract weapon data from Path of Building 2 (PoE2) base files
 * and save as JSON for the web application
 */

const fs = require('fs');
const path = require('path');

const basesDir = path.join(__dirname, '../PathOfBuilding-PoE2/src/Data/Bases');
const outputPath = path.join(__dirname, '../src/data/Weapons.json');

// Weapon base files to parse
const weaponFiles = [
  'axe.lua',
  'bow.lua',
  'claw.lua',
  'crossbow.lua',
  'dagger.lua',
  'flail.lua',
  'mace.lua',
  'sceptre.lua',
  'spear.lua',
  'staff.lua',
  'sword.lua',
  'wand.lua',
  'fishing.lua'
];

const weapons = [];

weaponFiles.forEach(file => {
  const filePath = path.join(basesDir, file);
  if (!fs.existsSync(filePath)) {
    console.log(`File not found: ${file}`);
    return;
  }

  const content = fs.readFileSync(filePath, 'utf-8');
  const category = file.replace('.lua', '');

  // Parse each item base entry
  // Match itemBases["Name"] = { ... }
  const itemRegex = /itemBases\["([^"]+)"\]\s*=\s*\{/g;
  let match;
  const positions = [];

  while ((match = itemRegex.exec(content)) !== null) {
    positions.push({
      name: match[1],
      start: match.index
    });
  }

  positions.forEach((pos, idx) => {
    const start = pos.start;
    const end = idx < positions.length - 1 ? positions[idx + 1].start : content.length;
    const itemBlock = content.substring(start, end);

    const weapon = {
      id: pos.name.toLowerCase().replace(/\s+/g, '-'),
      name: pos.name,
      category: category,
      type: null,
      quality: 20,
      socketLimit: 0,
      implicit: null,
      tags: [],
      damage: {
        physical: { min: 0, max: 0 },
        fire: { min: 0, max: 0 },
        cold: { min: 0, max: 0 },
        lightning: { min: 0, max: 0 },
        chaos: { min: 0, max: 0 }
      },
      critChance: 5,
      attackRate: 1.0,
      range: 11,
      requirements: {
        level: 0,
        str: 0,
        dex: 0,
        int: 0
      },
      dps: {
        physical: 0,
        elemental: 0,
        chaos: 0,
        total: 0
      }
    };

    // Extract type
    const typeMatch = itemBlock.match(/type\s*=\s*"([^"]+)"/);
    if (typeMatch) {
      weapon.type = typeMatch[1];
    }

    // Extract socketLimit
    const socketMatch = itemBlock.match(/socketLimit\s*=\s*(\d+)/);
    if (socketMatch) {
      weapon.socketLimit = parseInt(socketMatch[1]);
    }

    // Extract implicit
    const implicitMatch = itemBlock.match(/implicit\s*=\s*"([^"]+)"/);
    if (implicitMatch) {
      weapon.implicit = implicitMatch[1];
    }

    // Extract tags
    const tagsMatch = itemBlock.match(/tags\s*=\s*\{([^}]+)\}/);
    if (tagsMatch) {
      const tagsStr = tagsMatch[1];
      const tagMatches = tagsStr.match(/(\w+)\s*=\s*true/g);
      if (tagMatches) {
        weapon.tags = tagMatches.map(t => t.replace(/\s*=\s*true/, ''));
      }
    }

    // Extract weapon stats from weapon = { ... }
    const weaponStatsMatch = itemBlock.match(/weapon\s*=\s*\{([^}]+)\}/);
    if (weaponStatsMatch) {
      const statsStr = weaponStatsMatch[1];

      // Physical damage
      const physMinMatch = statsStr.match(/PhysicalMin\s*=\s*(\d+)/);
      const physMaxMatch = statsStr.match(/PhysicalMax\s*=\s*(\d+)/);
      if (physMinMatch) weapon.damage.physical.min = parseInt(physMinMatch[1]);
      if (physMaxMatch) weapon.damage.physical.max = parseInt(physMaxMatch[1]);

      // Fire damage
      const fireMinMatch = statsStr.match(/FireMin\s*=\s*(\d+)/);
      const fireMaxMatch = statsStr.match(/FireMax\s*=\s*(\d+)/);
      if (fireMinMatch) weapon.damage.fire.min = parseInt(fireMinMatch[1]);
      if (fireMaxMatch) weapon.damage.fire.max = parseInt(fireMaxMatch[1]);

      // Cold damage
      const coldMinMatch = statsStr.match(/ColdMin\s*=\s*(\d+)/);
      const coldMaxMatch = statsStr.match(/ColdMax\s*=\s*(\d+)/);
      if (coldMinMatch) weapon.damage.cold.min = parseInt(coldMinMatch[1]);
      if (coldMaxMatch) weapon.damage.cold.max = parseInt(coldMaxMatch[1]);

      // Lightning damage
      const lightMinMatch = statsStr.match(/LightningMin\s*=\s*(\d+)/);
      const lightMaxMatch = statsStr.match(/LightningMax\s*=\s*(\d+)/);
      if (lightMinMatch) weapon.damage.lightning.min = parseInt(lightMinMatch[1]);
      if (lightMaxMatch) weapon.damage.lightning.max = parseInt(lightMaxMatch[1]);

      // Chaos damage
      const chaosMinMatch = statsStr.match(/ChaosMin\s*=\s*(\d+)/);
      const chaosMaxMatch = statsStr.match(/ChaosMax\s*=\s*(\d+)/);
      if (chaosMinMatch) weapon.damage.chaos.min = parseInt(chaosMinMatch[1]);
      if (chaosMaxMatch) weapon.damage.chaos.max = parseInt(chaosMaxMatch[1]);

      // Crit chance
      const critMatch = statsStr.match(/CritChanceBase\s*=\s*([\d.]+)/);
      if (critMatch) weapon.critChance = parseFloat(critMatch[1]);

      // Attack rate
      const atkRateMatch = statsStr.match(/AttackRateBase\s*=\s*([\d.]+)/);
      if (atkRateMatch) weapon.attackRate = parseFloat(atkRateMatch[1]);

      // Range
      const rangeMatch = statsStr.match(/Range\s*=\s*(\d+)/);
      if (rangeMatch) weapon.range = parseInt(rangeMatch[1]);
    }

    // Extract requirements from req = { ... }
    const reqMatch = itemBlock.match(/req\s*=\s*\{([^}]*)\}/);
    if (reqMatch) {
      const reqStr = reqMatch[1];

      const levelMatch = reqStr.match(/level\s*=\s*(\d+)/);
      const strMatch = reqStr.match(/str\s*=\s*(\d+)/);
      const dexMatch = reqStr.match(/dex\s*=\s*(\d+)/);
      const intMatch = reqStr.match(/int\s*=\s*(\d+)/);

      if (levelMatch) weapon.requirements.level = parseInt(levelMatch[1]);
      if (strMatch) weapon.requirements.str = parseInt(strMatch[1]);
      if (dexMatch) weapon.requirements.dex = parseInt(dexMatch[1]);
      if (intMatch) weapon.requirements.int = parseInt(intMatch[1]);
    }

    // Calculate DPS
    const physAvg = (weapon.damage.physical.min + weapon.damage.physical.max) / 2;
    const fireAvg = (weapon.damage.fire.min + weapon.damage.fire.max) / 2;
    const coldAvg = (weapon.damage.cold.min + weapon.damage.cold.max) / 2;
    const lightAvg = (weapon.damage.lightning.min + weapon.damage.lightning.max) / 2;
    const chaosAvg = (weapon.damage.chaos.min + weapon.damage.chaos.max) / 2;

    weapon.dps.physical = Math.round(physAvg * weapon.attackRate * 100) / 100;
    weapon.dps.elemental = Math.round((fireAvg + coldAvg + lightAvg) * weapon.attackRate * 100) / 100;
    weapon.dps.chaos = Math.round(chaosAvg * weapon.attackRate * 100) / 100;
    weapon.dps.total = Math.round((physAvg + fireAvg + coldAvg + lightAvg + chaosAvg) * weapon.attackRate * 100) / 100;

    // Only include weapons with actual damage values or wands (which may not have weapon damage but are still weapons)
    if (weapon.type) {
      weapons.push(weapon);
    }
  });
});

// Sort by category, then by level requirement
weapons.sort((a, b) => {
  if (a.category !== b.category) {
    return a.category.localeCompare(b.category);
  }
  return (a.requirements.level || 0) - (b.requirements.level || 0);
});

console.log(`Extracted ${weapons.length} weapons from PoB2 base files`);

// Count by category
const categoryCounts = {};
weapons.forEach(w => {
  categoryCounts[w.category] = (categoryCounts[w.category] || 0) + 1;
});
console.log('\nWeapons by category:');
Object.entries(categoryCounts).sort().forEach(([cat, count]) => {
  console.log(`  ${cat}: ${count}`);
});

// Write to file
fs.writeFileSync(outputPath, JSON.stringify(weapons, null, 2));
console.log(`\nOutput written to: ${outputPath}`);

// Print some examples
console.log('\nSample weapons:');
weapons.slice(0, 5).forEach(w => {
  console.log(`\n${w.name} (${w.type}):`);
  console.log(`  Physical: ${w.damage.physical.min}-${w.damage.physical.max}`);
  console.log(`  Attack Rate: ${w.attackRate}`);
  console.log(`  Crit Chance: ${w.critChance}%`);
  console.log(`  Total DPS: ${w.dps.total}`);
  if (w.implicit) console.log(`  Implicit: ${w.implicit}`);
});

