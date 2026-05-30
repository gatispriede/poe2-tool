/**
 * Extract spell base damage from Path of Building 2 skill files
 * This extracts the actual min/max damage values at each level
 */

const fs = require('fs');
const path = require('path');

// Skill files to process
const skillFiles = [
  'act_int.lua',   // Intelligence skills (most spells)
  'act_dex.lua',   // Dexterity skills
  'act_str.lua',   // Strength skills
];

const skillsDir = path.join(__dirname, '../PathOfBuilding-PoE2/src/Data/Skills');
const outputPath = path.join(__dirname, '../src/data/SpellBaseDamage.json');

const allSkillDamage = {};

// Parse damage type from stat name
function getDamageType(statName) {
  if (statName.includes('physical')) return 'physical';
  if (statName.includes('fire')) return 'fire';
  if (statName.includes('cold')) return 'cold';
  if (statName.includes('lightning')) return 'lightning';
  if (statName.includes('chaos')) return 'chaos';
  return null;
}

// Process each skill file
for (const fileName of skillFiles) {
  const filePath = path.join(skillsDir, fileName);
  if (!fs.existsSync(filePath)) {
    console.log(`Skipping ${fileName} - not found`);
    continue;
  }

  console.log(`Processing ${fileName}...`);
  const content = fs.readFileSync(filePath, 'utf-8');
  const lines = content.split('\n');

  let currentSkill = null;
  let inStatSets = false;
  let inLevels = false;
  let currentStats = [];
  let currentLevels = {};
  let braceCount = 0;
  let statSetBraceStart = 0;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    // Track when we enter a statSets block
    if (line.includes('statSets = {')) {
      inStatSets = true;
      continue;
    }

    // Find skill label
    if (inStatSets && line.includes('label = "')) {
      const labelMatch = line.match(/label\s*=\s*"([^"]+)"/);
      if (labelMatch) {
        const skillName = labelMatch[1];
        // Skip templates
        if (skillName.includes('{0}') || skillName.includes('{1}')) continue;

        currentSkill = {
          name: skillName,
          isSpell: false,
          baseEffectiveness: null,
          incrementalEffectiveness: null,
          damageTypes: [],
          levels: {}
        };
      }
    }

    if (!currentSkill) continue;

    // Check for spell flag
    if (line.includes('spell = true')) {
      currentSkill.isSpell = true;
    }

    // Get baseEffectiveness
    if (line.includes('baseEffectiveness')) {
      const match = line.match(/baseEffectiveness\s*=\s*([\d.]+)/);
      if (match) currentSkill.baseEffectiveness = parseFloat(match[1]);
    }

    // Get incrementalEffectiveness
    if (line.includes('incrementalEffectiveness')) {
      const match = line.match(/incrementalEffectiveness\s*=\s*([\d.]+)/);
      if (match) currentSkill.incrementalEffectiveness = parseFloat(match[1]);
    }

    // Parse stats array
    if (line.includes('stats = {')) {
      currentStats = [];
      // Read stats until closing brace
      let j = i;
      while (j < lines.length && !lines[j].includes('},')) {
        const statMatch = lines[j].match(/"([^"]+)"/);
        if (statMatch) currentStats.push(statMatch[1]);
        j++;
      }
    }

    // Parse levels array
    if (line.includes('levels = {') && currentStats.length > 0) {
      inLevels = true;
      currentLevels = {};
      continue;
    }

    if (inLevels) {
      // Match level entries like [20] = { 20, 386, 9, ... }
      const levelMatch = line.match(/\[(\d+)\]\s*=\s*\{([^}]+)\}/);
      if (levelMatch) {
        const level = parseInt(levelMatch[1]);
        const valuesStr = levelMatch[2].split('statInterpolation')[0];
        const values = valuesStr.match(/-?\d+\.?\d*/g)?.map(v => parseFloat(v)) || [];

        // Map values to damage types
        const damageData = {};
        currentStats.forEach((stat, idx) => {
          const damageType = getDamageType(stat);
          if (!damageType) return;

          if (stat.includes('minimum') && stat.includes('damage')) {
            if (!damageData[damageType]) damageData[damageType] = {};
            damageData[damageType].min = values[idx] || 0;
            if (!currentSkill.damageTypes.includes(damageType)) {
              currentSkill.damageTypes.push(damageType);
            }
          } else if (stat.includes('maximum') && stat.includes('damage')) {
            if (!damageData[damageType]) damageData[damageType] = {};
            damageData[damageType].max = values[idx] || 0;
          }
        });

        if (Object.keys(damageData).length > 0) {
          currentLevels[level] = damageData;
        }
      }

      // End of levels array
      if (line.trim() === '},') {
        inLevels = false;
        if (Object.keys(currentLevels).length > 0) {
          currentSkill.levels = currentLevels;

          // Calculate average damages
          const lvl1 = currentLevels['1'];
          const lvl20 = currentLevels['20'];

          if (lvl1) {
            let min = 0, max = 0;
            for (const dmg of Object.values(lvl1)) {
              min += dmg.min || 0;
              max += dmg.max || 0;
            }
            currentSkill.minDamageLvl1 = min;
            currentSkill.maxDamageLvl1 = max;
            currentSkill.avgDamageLvl1 = (min + max) / 2;
          }

          if (lvl20) {
            let min = 0, max = 0;
            for (const dmg of Object.values(lvl20)) {
              min += dmg.min || 0;
              max += dmg.max || 0;
            }
            currentSkill.minDamageLvl20 = min;
            currentSkill.maxDamageLvl20 = max;
            currentSkill.avgDamageLvl20 = (min + max) / 2;
          }

          // Save skill
          const skillId = currentSkill.name.toLowerCase().replace(/[^a-z0-9]+/g, '_');
          allSkillDamage[skillId] = currentSkill;
        }
        currentSkill = null;
        currentStats = [];
        currentLevels = {};
      }
    }
  }
}

// Write output
fs.writeFileSync(outputPath, JSON.stringify(allSkillDamage, null, 2));

console.log(`\nExtracted base damage for ${Object.keys(allSkillDamage).length} skills`);
console.log(`Output written to: ${outputPath}`);

// Print some examples
console.log('\nSample spell damage data (sorted by avg damage):');
const spells = Object.entries(allSkillDamage)
  .filter(([_, data]) => data.isSpell && data.avgDamageLvl20)
  .sort((a, b) => (b[1].avgDamageLvl20 || 0) - (a[1].avgDamageLvl20 || 0))
  .slice(0, 15);

spells.forEach(([id, data]) => {
  console.log(`${data.name}: ${data.damageTypes.join('+')} - Lvl20: ${data.minDamageLvl20}-${data.maxDamageLvl20} (avg: ${data.avgDamageLvl20?.toFixed(0)})`);
});

