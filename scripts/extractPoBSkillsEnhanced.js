/**
 * Enhanced extraction of skills from Path of Building 2 (PoE2)
 * Extracts base damage, crit chance, cast time, attack speed multipliers from skill files
 */

const fs = require('fs');
const path = require('path');

const skillsDir = path.join(__dirname, '../PathOfBuilding-PoE2/src/Data/Skills');
const gemsLuaPath = path.join(__dirname, '../PathOfBuilding-PoE2/src/Data/Gems.lua');
const outputPath = path.join(__dirname, '../src/data/PoBSkills.json');

// Read all skill files
const skillFiles = [
  'act_str.lua',  // Strength active skills (attacks)
  'act_dex.lua',  // Dexterity active skills
  'act_int.lua',  // Intelligence active skills (spells)
  'sup_str.lua',  // Strength supports
  'sup_dex.lua',  // Dexterity supports
  'sup_int.lua',  // Intelligence supports
  'minion.lua',   // Minion skills
  'other.lua',    // Other skills
];

// Parse a Lua table value
function parseLuaValue(str) {
  str = str.trim();
  if (str === 'true') return true;
  if (str === 'false') return false;
  if (str === 'nil') return null;
  if (/^-?\d+\.?\d*$/.test(str)) return parseFloat(str);
  if (str.startsWith('"') && str.endsWith('"')) return str.slice(1, -1);
  return str;
}

// Extract skills from a Lua file
function extractSkillsFromFile(filePath) {
  const content = fs.readFileSync(filePath, 'utf-8');
  const skills = [];

  // Find all skill definitions: skills["SkillName"] = { ... }
  const skillRegex = /skills\["(\w+)"\]\s*=\s*\{/g;
  let match;

  while ((match = skillRegex.exec(content)) !== null) {
    const skillId = match[1];
    const startPos = match.index + match[0].length;

    // Find the matching closing brace
    let braceDepth = 1;
    let endPos = startPos;
    for (let i = startPos; i < content.length && braceDepth > 0; i++) {
      if (content[i] === '{') braceDepth++;
      else if (content[i] === '}') braceDepth--;
      endPos = i;
    }

    const skillBlock = content.slice(match.index, endPos + 1);
    const skill = parseSkillBlock(skillId, skillBlock);
    if (skill) {
      skills.push(skill);
    }
  }

  return skills;
}

// Parse a skill block
function parseSkillBlock(skillId, block) {
  const skill = {
    rawId: skillId,
    id: '',
    name: '',
    description: '',
    skillTypes: [],
    castTime: null,
    critChance: null,
    baseEffectiveness: null,
    incrementalEffectiveness: null,
    damageTypes: [],
    baseFlags: [],
    levels: {},
    statSetLevels: {},
  };

  // Extract name
  const nameMatch = block.match(/name\s*=\s*"([^"]+)"/);
  if (nameMatch) {
    skill.name = nameMatch[1];
    skill.id = skill.name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
  }

  // Extract description
  const descMatch = block.match(/description\s*=\s*"([^"]+)"/);
  if (descMatch) skill.description = descMatch[1];

  // Extract castTime
  const castTimeMatch = block.match(/castTime\s*=\s*([\d.]+)/);
  if (castTimeMatch) skill.castTime = parseFloat(castTimeMatch[1]);

  // Extract skillTypes
  const skillTypesMatch = block.match(/skillTypes\s*=\s*\{([^}]+)\}/);
  if (skillTypesMatch) {
    const typesStr = skillTypesMatch[1];
    const typeMatches = typesStr.matchAll(/\[SkillType\.(\w+)\]\s*=\s*true/g);
    for (const tm of typeMatches) {
      skill.skillTypes.push(tm[1]);
    }
  }

  // Extract main levels block for critChance and costs
  const levelsMatch = block.match(/^\s*levels\s*=\s*\{/m);
  if (levelsMatch) {
    const levelsStart = levelsMatch.index + levelsMatch[0].length;
    let braceDepth = 1;
    let levelsEnd = levelsStart;
    for (let i = levelsStart; i < block.length && braceDepth > 0; i++) {
      if (block[i] === '{') braceDepth++;
      else if (block[i] === '}') braceDepth--;
      levelsEnd = i;
    }
    const levelsBlock = block.slice(levelsStart, levelsEnd);

    // Parse each level
    const levelRegex = /\[(\d+)\]\s*=\s*\{([^}]+)\}/g;
    let levelMatch;
    while ((levelMatch = levelRegex.exec(levelsBlock)) !== null) {
      const level = parseInt(levelMatch[1]);
      const levelData = levelMatch[2];

      const levelObj = {};

      // Extract critChance
      const critMatch = levelData.match(/critChance\s*=\s*([\d.]+)/);
      if (critMatch) levelObj.critChance = parseFloat(critMatch[1]);

      // Extract attackSpeedMultiplier
      const aspMatch = levelData.match(/attackSpeedMultiplier\s*=\s*([\d.]+)/);
      if (aspMatch) levelObj.attackSpeedMultiplier = parseFloat(aspMatch[1]);

      // Extract baseMultiplier (for attacks)
      const baseMultMatch = levelData.match(/baseMultiplier\s*=\s*([\d.]+)/);
      if (baseMultMatch) levelObj.baseMultiplier = parseFloat(baseMultMatch[1]);

      // Extract damageEffectiveness
      const dmgEffMatch = levelData.match(/damageEffectiveness\s*=\s*([\d.]+)/);
      if (dmgEffMatch) levelObj.damageEffectiveness = parseFloat(dmgEffMatch[1]);

      // Extract levelRequirement
      const lvlReqMatch = levelData.match(/levelRequirement\s*=\s*(\d+)/);
      if (lvlReqMatch) levelObj.levelRequirement = parseInt(lvlReqMatch[1]);

      // Extract mana cost
      const manaMatch = levelData.match(/Mana\s*=\s*(\d+)/);
      if (manaMatch) levelObj.manaCost = parseInt(manaMatch[1]);

      skill.levels[level] = levelObj;
    }
  }

  // Extract statSets for damage values and effectiveness
  const statSetsMatch = block.match(/statSets\s*=\s*\{/);
  if (statSetsMatch) {
    const statSetsStart = statSetsMatch.index + statSetsMatch[0].length;
    let braceDepth = 1;
    let statSetsEnd = statSetsStart;
    for (let i = statSetsStart; i < block.length && braceDepth > 0; i++) {
      if (block[i] === '{') braceDepth++;
      else if (block[i] === '}') braceDepth--;
      statSetsEnd = i;
    }
    const statSetsBlock = block.slice(statSetsStart, statSetsEnd);

    // Extract baseEffectiveness
    const baseEffMatch = statSetsBlock.match(/baseEffectiveness\s*=\s*([\d.]+)/);
    if (baseEffMatch) skill.baseEffectiveness = parseFloat(baseEffMatch[1]);

    // Extract incrementalEffectiveness
    const incEffMatch = statSetsBlock.match(/incrementalEffectiveness\s*=\s*([\d.]+)/);
    if (incEffMatch) skill.incrementalEffectiveness = parseFloat(incEffMatch[1]);

    // Extract baseFlags
    const baseFlagsMatch = statSetsBlock.match(/baseFlags\s*=\s*\{([^}]+)\}/);
    if (baseFlagsMatch) {
      const flagMatches = baseFlagsMatch[1].matchAll(/(\w+)\s*=\s*true/g);
      for (const fm of flagMatches) {
        skill.baseFlags.push(fm[1]);
      }
    }

    // Extract stats array to determine damage types
    const statsMatch = statSetsBlock.match(/stats\s*=\s*\{([^}]+)\}/);
    if (statsMatch) {
      const statsStr = statsMatch[1];
      if (statsStr.includes('lightning')) skill.damageTypes.push('lightning');
      if (statsStr.includes('fire')) skill.damageTypes.push('fire');
      if (statsStr.includes('cold')) skill.damageTypes.push('cold');
      if (statsStr.includes('chaos')) skill.damageTypes.push('chaos');
      if (statsStr.includes('physical') && !statsStr.includes('physical_damage_can_shock')) {
        skill.damageTypes.push('physical');
      }
    }

    // Extract damage values from statSet levels
    // Format: [level] = { minDmg, maxDmg, statInterpolation = { ... }, actorLevel = X, }
    // We need to find the levels = { block inside statSets
    const statSetLevelsBlockMatch = statSetsBlock.match(/levels\s*=\s*\{/);
    if (statSetLevelsBlockMatch) {
      const levelsStart = statSetLevelsBlockMatch.index + statSetLevelsBlockMatch[0].length;
      let braceDepth = 1;
      let levelsEnd = levelsStart;
      for (let i = levelsStart; i < statSetsBlock.length && braceDepth > 0; i++) {
        if (statSetsBlock[i] === '{') braceDepth++;
        else if (statSetsBlock[i] === '}') braceDepth--;
        levelsEnd = i;
      }
      const levelsStr = statSetsBlock.slice(levelsStart, levelsEnd);

      // Parse each level entry: [N] = { val1, val2, ... }
      const levelEntryRegex = /\[(\d+)\]\s*=\s*\{\s*(-?\d+(?:\.\d+)?)\s*,\s*(-?\d+(?:\.\d+)?)/g;
      let levelMatch;
      while ((levelMatch = levelEntryRegex.exec(levelsStr)) !== null) {
        const level = parseInt(levelMatch[1]);
        const minDmg = parseFloat(levelMatch[2]);
        const maxDmg = parseFloat(levelMatch[3]);

        skill.statSetLevels[level] = {
          minDamage: minDmg,
          maxDamage: maxDmg
        };
      }
    }
  }

  // Set critChance from level 1 or level 20
  if (skill.levels[1]?.critChance) {
    skill.critChance = skill.levels[1].critChance;
  }
  if (skill.levels[20]?.critChance) {
    skill.critChance = skill.levels[20].critChance;
  }

  return skill;
}

// Read gems metadata for gem types and requirements
function readGemsMetadata() {
  const content = fs.readFileSync(gemsLuaPath, 'utf-8');
  const gems = {};

  const lines = content.split('\n');
  let currentGem = null;
  let braceDepth = 0;
  let inTags = false;
  let currentTags = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    const gemStartMatch = line.match(/\["Metadata\/Items\/Gems\/(SkillGem[^\]]+)"\]\s*=\s*\{/);
    if (gemStartMatch) {
      currentGem = { metadataId: gemStartMatch[1], raw: {} };
      braceDepth = 1;
      currentTags = [];
      continue;
    }

    if (!currentGem) continue;

    const openBraces = (line.match(/\{/g) || []).length;
    const closeBraces = (line.match(/\}/g) || []).length;

    if (line.includes('tags = {')) {
      inTags = true;
      continue;
    }

    if (inTags) {
      const tagMatch = line.match(/(\w+)\s*=\s*true/);
      if (tagMatch) currentTags.push(tagMatch[1]);
      if (line.includes('},')) {
        inTags = false;
        currentGem.raw.tags = currentTags;
      }
      continue;
    }

    const nameMatch = line.match(/^\s*name\s*=\s*"([^"]+)"/);
    if (nameMatch) currentGem.raw.name = nameMatch[1];

    const gemTypeMatch = line.match(/^\s*gemType\s*=\s*"([^"]+)"/);
    if (gemTypeMatch) currentGem.raw.gemType = gemTypeMatch[1];

    const tagStringMatch = line.match(/^\s*tagString\s*=\s*"([^"]*)"/);
    if (tagStringMatch) currentGem.raw.tagString = tagStringMatch[1];

    const weaponReqMatch = line.match(/^\s*weaponRequirements\s*=\s*"([^"]+)"/);
    if (weaponReqMatch) currentGem.raw.weaponRequirements = weaponReqMatch[1];

    const reqStrMatch = line.match(/^\s*reqStr\s*=\s*(\d+)/);
    if (reqStrMatch) currentGem.raw.reqStr = parseInt(reqStrMatch[1]);

    const reqDexMatch = line.match(/^\s*reqDex\s*=\s*(\d+)/);
    if (reqDexMatch) currentGem.raw.reqDex = parseInt(reqDexMatch[1]);

    const reqIntMatch = line.match(/^\s*reqInt\s*=\s*(\d+)/);
    if (reqIntMatch) currentGem.raw.reqInt = parseInt(reqIntMatch[1]);

    const tierMatch = line.match(/^\s*Tier\s*=\s*(\d+)/);
    if (tierMatch) currentGem.raw.tier = parseInt(tierMatch[1]);

    braceDepth += openBraces - closeBraces;

    if (braceDepth === 0 && currentGem.raw.name) {
      if (!currentGem.raw.name.includes('{0}')) {
        gems[currentGem.raw.name] = currentGem.raw;
      }
      currentGem = null;
    }
  }

  return gems;
}

// Main extraction
function main() {
  console.log('Extracting skills from PathOfBuilding-PoE2...\n');

  // Read gems metadata
  const gemsMetadata = readGemsMetadata();
  console.log(`Loaded metadata for ${Object.keys(gemsMetadata).length} gems\n`);

  // Extract from all skill files
  const allSkills = [];

  for (const file of skillFiles) {
    const filePath = path.join(skillsDir, file);
    if (!fs.existsSync(filePath)) {
      console.log(`Warning: ${file} not found`);
      continue;
    }

    const skills = extractSkillsFromFile(filePath);
    console.log(`${file}: ${skills.length} skills extracted`);
    allSkills.push(...skills);
  }

  console.log(`\nTotal raw skills: ${allSkills.length}`);

  // Merge with gem metadata and format output
  const outputSkills = [];
  const seenNames = new Set();

  for (const skill of allSkills) {
    if (!skill.name || seenNames.has(skill.name)) continue;
    seenNames.add(skill.name);

    const gemData = gemsMetadata[skill.name] || {};
    const tags = gemData.tags || [];

    // Determine gem type
    let gemType = gemData.gemType || 'Unknown';
    if (skill.skillTypes.includes('Spell')) gemType = 'Spell';
    else if (skill.skillTypes.includes('Attack')) gemType = 'Attack';
    else if (skill.skillTypes.includes('Minion') || skill.skillTypes.includes('CreateMinion')) gemType = 'Minion';
    else if (skill.baseFlags.includes('spell')) gemType = 'Spell';
    else if (skill.baseFlags.includes('attack')) gemType = 'Attack';
    else if (tags.includes('support')) gemType = 'Support';

    // Determine element
    let element = null;
    if (skill.damageTypes.includes('fire') || tags.includes('fire')) element = 'Fire';
    else if (skill.damageTypes.includes('cold') || tags.includes('cold')) element = 'Cold';
    else if (skill.damageTypes.includes('lightning') || tags.includes('lightning')) element = 'Lightning';
    else if (skill.damageTypes.includes('chaos') || tags.includes('chaos')) element = 'Chaos';
    else if (skill.damageTypes.includes('physical') || tags.includes('physical')) element = 'Physical';

    // Get damage values at level 1 and 20
    const lvl1Dmg = skill.statSetLevels[1] || {};
    const lvl20Dmg = skill.statSetLevels[20] || {};

    // Get base multiplier for attack skills
    const baseMultLvl1 = skill.levels[1]?.baseMultiplier;
    const baseMultLvl20 = skill.levels[20]?.baseMultiplier;

    // Build output skill
    const outputSkill = {
      id: skill.id,
      name: skill.name,
      description: skill.description || `${gemType} skill - ${gemData.tagString || ''}`,
      gemType,
      type: gemType,
      element,
      tags: [...new Set([...tags, ...skill.baseFlags])],
      tagString: gemData.tagString || '',
      weaponRequirements: gemData.weaponRequirements || null,
      requirements: {
        str: gemData.reqStr || 0,
        dex: gemData.reqDex || 0,
        int: gemData.reqInt || 0
      },
      tier: gemData.tier || 0,

      // Base damage data
      castTime: skill.castTime,
      critChance: skill.critChance,
      baseEffectiveness: skill.baseEffectiveness,
      incrementalEffectiveness: skill.incrementalEffectiveness,
      damageTypes: skill.damageTypes,

      // Level 1 damage
      minDamageLvl1: lvl1Dmg.minDamage || null,
      maxDamageLvl1: lvl1Dmg.maxDamage || null,

      // Level 20 damage
      minDamageLvl20: lvl20Dmg.minDamage || null,
      maxDamageLvl20: lvl20Dmg.maxDamage || null,

      // Attack skill multipliers
      baseDamageData: (baseMultLvl1 || baseMultLvl20) ? {
        baseMultiplier: baseMultLvl1,
        baseMultiplierLvl20: baseMultLvl20,
        critChance: skill.critChance,
        attackSpeedMultiplier: skill.levels[20]?.attackSpeedMultiplier || skill.levels[1]?.attackSpeedMultiplier
      } : null,

      // For compatibility
      moreDamageMultipliersPct: [],
      moreAttackSpeedMultipliersPct: [],
      isTrigger: skill.skillTypes.includes('Triggerable') || skill.skillTypes.includes('Triggered'),
      supportFamily: gemType === 'Support' ? (gemData.gemFamily || skill.name) : null,
      source: 'PathOfBuilding-PoE2'
    };

    // Calculate more damage multipliers based on tags (estimation)
    if (tags.includes('slam')) {
      outputSkill.moreDamageMultipliersPct = [40];
      outputSkill.moreAttackSpeedMultipliersPct = [-20];
    } else if (tags.includes('strike')) {
      outputSkill.moreDamageMultipliersPct = [25];
    } else if (tags.includes('channelling')) {
      outputSkill.moreDamageMultipliersPct = [35];
    } else if (gemType === 'Attack') {
      outputSkill.moreDamageMultipliersPct = [20];
    } else if (gemType === 'Spell') {
      outputSkill.moreDamageMultipliersPct = [30];
    }

    outputSkills.push(outputSkill);
  }

  // Sort by name
  outputSkills.sort((a, b) => a.name.localeCompare(b.name));

  // Write output
  fs.writeFileSync(outputPath, JSON.stringify(outputSkills, null, 2));

  console.log(`\n=== Output Summary ===`);
  console.log(`Total unique skills: ${outputSkills.length}`);

  // Count by type
  const byType = {};
  for (const s of outputSkills) {
    byType[s.gemType] = (byType[s.gemType] || 0) + 1;
  }
  console.log('\nBy gem type:');
  for (const [type, count] of Object.entries(byType).sort((a, b) => b[1] - a[1])) {
    console.log(`  ${type}: ${count}`);
  }

  // Count skills with damage data
  const withDamage = outputSkills.filter(s => s.minDamageLvl20 && s.maxDamageLvl20);
  console.log(`\nSkills with damage data: ${withDamage.length}`);

  const withCrit = outputSkills.filter(s => s.critChance);
  console.log(`Skills with crit chance: ${withCrit.length}`);

  const withCastTime = outputSkills.filter(s => s.castTime);
  console.log(`Skills with cast time: ${withCastTime.length}`);

  const withBaseMultiplier = outputSkills.filter(s => s.baseDamageData?.baseMultiplier || s.baseDamageData?.baseMultiplierLvl20);
  console.log(`Skills with base multiplier: ${withBaseMultiplier.length}`);

  // Sample output
  console.log('\n=== Sample Skills ===');
  const samples = outputSkills.filter(s => s.gemType === 'Spell' && s.minDamageLvl20).slice(0, 3);
  for (const s of samples) {
    console.log(`\n${s.name} (${s.gemType}):`);
    console.log(`  Damage Lvl20: ${s.minDamageLvl20} - ${s.maxDamageLvl20}`);
    console.log(`  Crit Chance: ${s.critChance}%`);
    console.log(`  Cast Time: ${s.castTime}s`);
    console.log(`  Element: ${s.element}`);
  }

  const attackSamples = outputSkills.filter(s => s.gemType === 'Attack' && s.baseDamageData?.baseMultiplierLvl20).slice(0, 3);
  for (const s of attackSamples) {
    console.log(`\n${s.name} (${s.gemType}):`);
    console.log(`  Base Multiplier Lvl20: ${s.baseDamageData.baseMultiplierLvl20}%`);
    console.log(`  Crit Chance: ${s.critChance}%`);
    console.log(`  Attack Speed Multi: ${s.baseDamageData.attackSpeedMultiplier}`);
  }

  console.log(`\nOutput written to: ${outputPath}`);
}

main();

