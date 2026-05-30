/**
 * Extract skill descriptions from Path of Building 2 (PoE2) skill files
 * and update the PoBSkills.json with detailed descriptions and base damage data
 */

const fs = require('fs');
const path = require('path');

const skillsDir = path.join(__dirname, '../PathOfBuilding-PoE2/src/Data/Skills');
const pobSkillsPath = path.join(__dirname, '../src/data/PoBSkills.json');
const outputPath = path.join(__dirname, '../src/data/PoBSkills.json');

// Read existing PoBSkills.json
const existingSkills = JSON.parse(fs.readFileSync(pobSkillsPath, 'utf-8'));

// Create a map for quick lookup by name
const skillsMap = new Map();
existingSkills.forEach(skill => {
  skillsMap.set(skill.name.toLowerCase(), skill);
});

// Skill files to parse
const skillFiles = [
  'act_str.lua',
  'act_dex.lua',
  'act_int.lua',
  'minion.lua',
  'other.lua'
];

// Parse skill data from Lua files
const skillData = new Map();

skillFiles.forEach(file => {
  const filePath = path.join(skillsDir, file);
  if (!fs.existsSync(filePath)) {
    console.log(`File not found: ${file}`);
    return;
  }

  const content = fs.readFileSync(filePath, 'utf-8');

  // Parse each skill entry
  // Match skill blocks like: skills["SkillName"] = { ... }
  const skillRegex = /skills\["([^"]+)"\]\s*=\s*\{/g;
  let match;
  const positions = [];

  while ((match = skillRegex.exec(content)) !== null) {
    positions.push({
      skillId: match[1],
      start: match.index
    });
  }

  // For each skill, extract its properties
  positions.forEach((pos, idx) => {
    const start = pos.start;
    const end = idx < positions.length - 1 ? positions[idx + 1].start : content.length;
    const skillBlock = content.substring(start, end);

    // Extract name
    const nameMatch = skillBlock.match(/name\s*=\s*"([^"]+)"/);
    if (!nameMatch) return;
    const name = nameMatch[1];

    const data = {
      description: null,
      castTime: null,
      levels: [],
      incrementalEffectiveness: null,
      critChance: null,
      baseMultiplier: null,
      attackSpeedMultiplier: null
    };

    // Extract description
    const descMatch = skillBlock.match(/description\s*=\s*"([^"]+)"/);
    if (descMatch) {
      data.description = descMatch[1];
    }

    // Extract cast time
    const castTimeMatch = skillBlock.match(/castTime\s*=\s*([\d.]+)/);
    if (castTimeMatch) {
      data.castTime = parseFloat(castTimeMatch[1]);
    }

    // Extract incrementalEffectiveness from statSets
    const incEffMatch = skillBlock.match(/incrementalEffectiveness\s*=\s*([\d.]+)/);
    if (incEffMatch) {
      data.incrementalEffectiveness = parseFloat(incEffMatch[1]);
    }

    // Extract level data - find the levels = { ... } block
    const levelsBlockMatch = skillBlock.match(/levels\s*=\s*\{([\s\S]*?)\n\t\},/);
    if (levelsBlockMatch) {
      const levelsBlock = levelsBlockMatch[1];

      // Parse individual level entries: [1] = { baseMultiplier = 0.5, levelRequirement = 0, cost = { Mana = 5, }, },
      const levelRegex = /\[(\d+)\]\s*=\s*\{([^}]+)\}/g;
      let levelMatch;

      while ((levelMatch = levelRegex.exec(levelsBlock)) !== null) {
        const levelNum = parseInt(levelMatch[1]);
        const levelContent = levelMatch[2];

        const levelData = {
          level: levelNum,
          levelRequirement: null,
          baseMultiplier: null,
          critChance: null,
          attackSpeedMultiplier: null,
          manaCost: null
        };

        // Extract levelRequirement
        const lvlReqMatch = levelContent.match(/levelRequirement\s*=\s*(\d+)/);
        if (lvlReqMatch) {
          levelData.levelRequirement = parseInt(lvlReqMatch[1]);
        }

        // Extract baseMultiplier
        const baseMultMatch = levelContent.match(/baseMultiplier\s*=\s*([\d.]+)/);
        if (baseMultMatch) {
          levelData.baseMultiplier = parseFloat(baseMultMatch[1]);
        }

        // Extract critChance
        const critMatch = levelContent.match(/critChance\s*=\s*([\d.]+)/);
        if (critMatch) {
          levelData.critChance = parseFloat(critMatch[1]);
        }

        // Extract attackSpeedMultiplier
        const atkSpdMatch = levelContent.match(/attackSpeedMultiplier\s*=\s*(-?[\d.]+)/);
        if (atkSpdMatch) {
          levelData.attackSpeedMultiplier = parseInt(atkSpdMatch[1]);
        }

        // Extract mana cost
        const manaMatch = levelContent.match(/Mana\s*=\s*(\d+)/);
        if (manaMatch) {
          levelData.manaCost = parseInt(manaMatch[1]);
        }

        data.levels.push(levelData);
      }
    }

    // Get level 1 and level 20 base data for quick reference
    if (data.levels.length > 0) {
      const level1 = data.levels.find(l => l.level === 1);
      const level20 = data.levels.find(l => l.level === 20);

      if (level1) {
        data.baseMultiplier = level1.baseMultiplier;
        data.critChance = level1.critChance;
        data.attackSpeedMultiplier = level1.attackSpeedMultiplier;
      }

      if (level20) {
        data.baseMultiplierLvl20 = level20.baseMultiplier;
        data.critChanceLvl20 = level20.critChance;
        data.attackSpeedMultiplierLvl20 = level20.attackSpeedMultiplier;
      }
    }

    skillData.set(name.toLowerCase(), data);
  });
});

console.log(`Extracted ${skillData.size} skills with data from skill files`);

// Update existing skills with descriptions and damage data
let updatedCount = 0;
existingSkills.forEach(skill => {
  const nameLower = skill.name.toLowerCase();

  const data = skillData.get(nameLower);
  if (data) {
    // Add description
    if (data.description) {
      skill.fullDescription = data.description;
    }

    // Add cast time if available
    if (data.castTime != null) {
      skill.castTime = data.castTime;
    }

    // Add base damage info
    skill.baseDamageData = {
      baseMultiplier: data.baseMultiplier,
      baseMultiplierLvl20: data.baseMultiplierLvl20,
      critChance: data.critChance,
      critChanceLvl20: data.critChanceLvl20,
      attackSpeedMultiplier: data.attackSpeedMultiplier,
      attackSpeedMultiplierLvl20: data.attackSpeedMultiplierLvl20,
      incrementalEffectiveness: data.incrementalEffectiveness,
      levels: data.levels
    };

    // Calculate estimated base damage assuming weapon base damage of 100 (for display purposes)
    const baseWeaponDamage = 100;
    if (data.baseMultiplier) {
      skill.estimatedBaseDamageLvl1 = Math.round(baseWeaponDamage * data.baseMultiplier);
    }
    if (data.baseMultiplierLvl20) {
      skill.estimatedBaseDamageLvl20 = Math.round(baseWeaponDamage * data.baseMultiplierLvl20);
    }

    updatedCount++;
  }
});

console.log(`Updated ${updatedCount} skills with base damage data`);

// Write updated skills
fs.writeFileSync(outputPath, JSON.stringify(existingSkills, null, 2));
console.log(`Output written to: ${outputPath}`);

// Print some examples
console.log('\nSample skills with base damage data:');
existingSkills.filter(s => s.baseDamageData && s.baseDamageData.baseMultiplier).slice(0, 10).forEach(s => {
  console.log(`\n${s.name}:`);
  console.log(`  Base Multiplier (Lvl 1): ${s.baseDamageData.baseMultiplier}`);
  console.log(`  Base Multiplier (Lvl 20): ${s.baseDamageData.baseMultiplierLvl20 || 'N/A'}`);
  console.log(`  Est. Damage (Lvl 1): ${s.estimatedBaseDamageLvl1}`);
  console.log(`  Est. Damage (Lvl 20): ${s.estimatedBaseDamageLvl20 || 'N/A'}`);
  if (s.baseDamageData.critChance) {
    console.log(`  Crit Chance: ${s.baseDamageData.critChance}%`);
  }
  if (s.baseDamageData.attackSpeedMultiplier) {
    console.log(`  Attack Speed Mult: ${s.baseDamageData.attackSpeedMultiplier}%`);
  }
});

