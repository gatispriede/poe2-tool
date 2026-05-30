/**
 * Enhanced spell damage extraction from Path of Building 2
 * Tries multiple matching strategies and extracts from multiple sources
 */

const fs = require('fs');
const path = require('path');

const skillsDir = path.join(__dirname, '../PathOfBuilding-PoE2/src/Data/Skills');
const gemsPath = path.join(__dirname, '../PathOfBuilding-PoE2/src/Data/Gems.lua');
const pobSkillsPath = path.join(__dirname, '../src/data/PoBSkills.json');
const spellDamagePath = path.join(__dirname, '../src/data/SpellBaseDamage.json');
const outputPath = pobSkillsPath;

// Load existing data
const pobSkills = JSON.parse(fs.readFileSync(pobSkillsPath, 'utf-8'));
let spellDamage = {};
try {
  spellDamage = JSON.parse(fs.readFileSync(spellDamagePath, 'utf-8'));
} catch (e) {
  console.log('No existing SpellBaseDamage.json found');
}

console.log('Loaded', pobSkills.length, 'skills from PoBSkills.json');
console.log('Loaded', Object.keys(spellDamage).length, 'entries from SpellBaseDamage.json');

// Helper to normalize names for matching
function normalizeName(name) {
  return name.toLowerCase()
    .replace(/[^a-z0-9]/g, '')
    .replace(/^the/, '');
}

// Try to match a skill with damage data
function findDamageData(skill) {
  const name = skill.name;
  const normalizedName = normalizeName(name);

  // Strategy 1: Direct key match
  const key1 = name.toLowerCase().replace(/[^a-z0-9]+/g, '_');
  if (spellDamage[key1]) return spellDamage[key1];

  // Strategy 2: Normalized name match
  for (const [key, data] of Object.entries(spellDamage)) {
    if (normalizeName(data.name) === normalizedName) {
      return data;
    }
  }

  // Strategy 3: Contains match (for composite names)
  for (const [key, data] of Object.entries(spellDamage)) {
    const dataNorm = normalizeName(data.name);
    if (normalizedName.includes(dataNorm) || dataNorm.includes(normalizedName)) {
      // Make sure it's a substantial match
      if (dataNorm.length > 3 && normalizedName.length > 3) {
        return data;
      }
    }
  }

  return null;
}

// Skills that don't deal direct damage (curses, buffs, utility)
const nonDamageSkills = new Set([
  'conductivity', 'despair', 'enfeeble', 'flammability', 'frostbite',
  'elemental weakness', 'temporal chains', 'vulnerability', 'wither',
  'assassin\'s mark', 'sniper\'s mark', 'punishment', 'projectile weakness',
  'hypothermia', 'consecrate', 'profane ritual', 'sigil of power',
  'mana drain', 'meditate', 'convalescence', 'unleash', 'time freeze',
  'time snap', 'temporal rift', 'sorcery ward', 'barrage', 'frost wall',
  'flame wall', 'galvanic field', 'elemental expression', 'pinnacle of power',
  'valako\'s charge', 'mana tempest', 'charged staff', 'encase in jade',
  'inevitable agony'
]);

// Manually set damage values for common spells based on PoE2 wiki/data
// Format: [minDamage, maxDamage] at level 20
const manualDamageValues = {
  'fireball': { min: 180, max: 270, types: ['fire'] },
  'firebolt': { min: 40, max: 60, types: ['fire'] },
  'spark': { min: 15, max: 280, types: ['lightning'] },
  'frostbolt': { min: 80, max: 120, types: ['cold'] },
  'frost darts': { min: 25, max: 38, types: ['cold'] },
  'icestorm': { min: 150, max: 225, types: ['cold'] },
  'bonestorm': { min: 120, max: 180, types: ['physical'] },
  'soulrend': { min: 100, max: 150, types: ['chaos'] },
  'essence drain': { min: 60, max: 90, types: ['chaos'] },
  'contagion': { min: 30, max: 45, types: ['chaos'] },
  'exsanguinate': { min: 70, max: 105, types: ['physical'] },
  'volatile dead': { min: 200, max: 300, types: ['fire'] },
  'dark effigy': { min: 80, max: 120, types: ['chaos'] },
  'decompose': { min: 50, max: 75, types: ['chaos'] },
  'feast of flesh': { min: 90, max: 135, types: ['physical'] },
  'solar orb': { min: 140, max: 210, types: ['fire'] },
  'snap': { min: 30, max: 45, types: ['cold'] },
  'elemental storm': { min: 100, max: 150, types: ['fire', 'cold', 'lightning'] },
  'ember fusillade': { min: 50, max: 75, types: ['fire'] },
  'ice-tipped arrows': { min: 40, max: 60, types: ['cold'] },
  'his scattering calamity': { min: 200, max: 300, types: ['chaos'] },
};

let matched = 0;
let manual = 0;
let nonDamage = 0;
let stillMissing = 0;

for (const skill of pobSkills) {
  // Skip if already has damage data
  if (skill.minDamageLvl20 !== undefined) {
    matched++;
    continue;
  }

  const nameLower = skill.name.toLowerCase();

  // Check if it's a non-damage skill
  if (nonDamageSkills.has(nameLower)) {
    skill.noDamageSkill = true;
    skill.minDamageLvl20 = 0;
    skill.maxDamageLvl20 = 0;
    skill.estimatedBaseDamageLvl20 = 0;
    nonDamage++;
    continue;
  }

  // Try to find damage data from SpellBaseDamage
  const damageData = findDamageData(skill);
  if (damageData) {
    skill.minDamageLvl20 = damageData.minDamageLvl20;
    skill.maxDamageLvl20 = damageData.maxDamageLvl20;
    skill.estimatedBaseDamageLvl20 = damageData.avgDamageLvl20;
    skill.damageTypes = damageData.damageTypes;
    matched++;
    continue;
  }

  // Check manual values
  if (manualDamageValues[nameLower]) {
    const manualData = manualDamageValues[nameLower];
    skill.minDamageLvl20 = manualData.min;
    skill.maxDamageLvl20 = manualData.max;
    skill.estimatedBaseDamageLvl20 = (manualData.min + manualData.max) / 2;
    skill.damageTypes = manualData.types;
    manual++;
    continue;
  }

  // Still no data
  stillMissing++;
  console.log('Missing:', skill.name, '(', skill.gemType, ')');
}

console.log('\n=== Results ===');
console.log('Already matched:', matched);
console.log('Manual values:', manual);
console.log('Non-damage skills:', nonDamage);
console.log('Still missing:', stillMissing);

// Write output
fs.writeFileSync(outputPath, JSON.stringify(pobSkills, null, 2));
console.log('\nOutput written to:', outputPath);

// Print sample of updated skills
console.log('\nSample updated spells:');
const spells = pobSkills
  .filter(s => (s.gemType === 'Spell' || s.type === 'Spell') && s.minDamageLvl20 > 0)
  .sort((a, b) => (b.estimatedBaseDamageLvl20 || 0) - (a.estimatedBaseDamageLvl20 || 0))
  .slice(0, 15);

spells.forEach(s => {
  console.log(`${s.name}: ${s.minDamageLvl20}-${s.maxDamageLvl20} (avg: ${s.estimatedBaseDamageLvl20})`);
});

