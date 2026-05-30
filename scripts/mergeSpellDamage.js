/**
 * Merge spell base damage data into PoBSkills.json
 */

const fs = require('fs');
const path = require('path');

const skillsPath = path.join(__dirname, '../src/data/PoBSkills.json');
const spellDamagePath = path.join(__dirname, '../src/data/SpellBaseDamage.json');
const outputPath = skillsPath; // Overwrite

// Load data
const skills = JSON.parse(fs.readFileSync(skillsPath, 'utf-8'));
const spellDamage = JSON.parse(fs.readFileSync(spellDamagePath, 'utf-8'));

console.log(`Loaded ${skills.length} skills`);
console.log(`Loaded ${Object.keys(spellDamage).length} spell damage entries`);

let matched = 0;
let updated = 0;

// Match skills by name (lowercase, with variations)
for (const skill of skills) {
  const skillNameKey = skill.name.toLowerCase().replace(/[^a-z0-9]+/g, '_');
  const skillNameKey2 = skill.name.toLowerCase().replace(/[^a-z0-9]+/g, '');

  // Try to find matching spell damage data
  let damageData = spellDamage[skillNameKey];

  if (!damageData) {
    // Try without underscores
    for (const [key, data] of Object.entries(spellDamage)) {
      if (key.replace(/_/g, '') === skillNameKey2 || data.name.toLowerCase() === skill.name.toLowerCase()) {
        damageData = data;
        break;
      }
    }
  }

  if (damageData) {
    matched++;

    // Update skill with actual base damage
    if (damageData.avgDamageLvl20) {
      skill.estimatedBaseDamageLvl20 = Math.round(damageData.avgDamageLvl20);
      skill.minDamageLvl20 = damageData.minDamageLvl20;
      skill.maxDamageLvl20 = damageData.maxDamageLvl20;
      updated++;
    }

    if (damageData.avgDamageLvl1) {
      skill.estimatedBaseDamageLvl1 = Math.round(damageData.avgDamageLvl1);
      skill.minDamageLvl1 = damageData.minDamageLvl1;
      skill.maxDamageLvl1 = damageData.maxDamageLvl1;
    }

    // Add base effectiveness for damage scaling
    if (damageData.baseEffectiveness) {
      skill.baseEffectiveness = damageData.baseEffectiveness;
    }

    if (damageData.incrementalEffectiveness) {
      skill.incrementalEffectiveness = damageData.incrementalEffectiveness;
    }

    // Set damage types
    if (damageData.damageTypes && damageData.damageTypes.length > 0) {
      skill.damageTypes = damageData.damageTypes;
    }

    // Store full level data for detailed calculations
    if (damageData.levels) {
      skill.levelDamageData = damageData.levels;
    }
  }
}

console.log(`\nMatched ${matched} skills with damage data`);
console.log(`Updated ${updated} skills with level 20 damage`);

// Write output
fs.writeFileSync(outputPath, JSON.stringify(skills, null, 2));
console.log(`\nOutput written to: ${outputPath}`);

// Print some examples
console.log('\nSample updated skills:');
const updatedSkills = skills.filter(s => s.estimatedBaseDamageLvl20 && s.gemType === 'Spell')
  .sort((a, b) => b.estimatedBaseDamageLvl20 - a.estimatedBaseDamageLvl20)
  .slice(0, 15);

updatedSkills.forEach(s => {
  console.log(`${s.name}: ${s.minDamageLvl20}-${s.maxDamageLvl20} (avg: ${s.estimatedBaseDamageLvl20})`);
});

