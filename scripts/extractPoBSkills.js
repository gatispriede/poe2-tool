/**
 * Extract skills from Path of Building 2 (PoE2) Gems.lua file
 * and convert them to a JSON format compatible with our calculator
 */

const fs = require('fs');
const path = require('path');

const gemsLuaPath = path.join(__dirname, '../PathOfBuilding-PoE2/src/Data/Gems.lua');
const outputPath = path.join(__dirname, '../src/data/PoBSkills.json');

// Read the Gems.lua file
const content = fs.readFileSync(gemsLuaPath, 'utf-8');

// Split content by gem entries
const lines = content.split('\n');
const skills = [];
let currentGem = null;
let braceDepth = 0;
let inTags = false;
let currentTags = [];

for (let i = 0; i < lines.length; i++) {
  const line = lines[i];

  // Check for start of a new gem entry
  const gemStartMatch = line.match(/\["Metadata\/Items\/Gems\/(SkillGem[^\]]+)"\]\s*=\s*\{/);
  if (gemStartMatch) {
    currentGem = {
      metadataId: gemStartMatch[1],
      raw: {}
    };
    braceDepth = 1;
    currentTags = [];
    continue;
  }

  if (!currentGem) continue;

  // Track brace depth
  const openBraces = (line.match(/\{/g) || []).length;
  const closeBraces = (line.match(/\}/g) || []).length;

  // Check for tags block
  if (line.includes('tags = {')) {
    inTags = true;
    continue;
  }

  if (inTags) {
    const tagMatch = line.match(/(\w+)\s*=\s*true/);
    if (tagMatch) {
      currentTags.push(tagMatch[1]);
    }
    if (line.includes('},')) {
      inTags = false;
      currentGem.raw.tags = currentTags;
    }
    continue;
  }

  // Extract properties
  const nameMatch = line.match(/^\s*name\s*=\s*"([^"]+)"/);
  if (nameMatch) currentGem.raw.name = nameMatch[1];

  const gemTypeMatch = line.match(/^\s*gemType\s*=\s*"([^"]+)"/);
  if (gemTypeMatch) currentGem.raw.gemType = gemTypeMatch[1];

  const gemFamilyMatch = line.match(/^\s*gemFamily\s*=\s*"([^"]+)"/);
  if (gemFamilyMatch) currentGem.raw.gemFamily = gemFamilyMatch[1];

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

  // End of gem entry
  if (braceDepth === 0 && currentGem.raw.name) {
    // Skip templates but include support gems
    if (!currentGem.raw.name.includes('{0}')) {
      const name = currentGem.raw.name;
      const tags = currentGem.raw.tags || [];
      const gemType = currentGem.raw.gemType || 'Unknown';

      // Determine element type
      let element = null;
      if (tags.includes('fire')) element = 'Fire';
      else if (tags.includes('cold')) element = 'Cold';
      else if (tags.includes('lightning')) element = 'Lightning';
      else if (tags.includes('chaos')) element = 'Chaos';
      else if (tags.includes('physical')) element = 'Physical';

      // Determine skill type for calculator
      let type = gemType;
      if (gemType === 'Spell' && element && ['Fire', 'Cold', 'Lightning'].includes(element)) {
        type = 'Elemental';
      }

      // Generate unique ID
      const id = name.toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-|-$/g, '');

      // Estimate damage multipliers based on tags
      let moreDamageMultipliersPct = [];
      let moreAttackSpeedMultipliersPct = [];

      if (tags.includes('slam')) {
        moreDamageMultipliersPct = [40];
        moreAttackSpeedMultipliersPct = [-20];
      } else if (tags.includes('strike')) {
        moreDamageMultipliersPct = [25];
      } else if (tags.includes('channelling')) {
        moreDamageMultipliersPct = [35];
      } else if (tags.includes('projectile') && gemType === 'Spell') {
        moreDamageMultipliersPct = [20];
      } else if (tags.includes('area') && gemType === 'Spell') {
        moreDamageMultipliersPct = [25];
      } else if (gemType === 'Attack') {
        moreDamageMultipliersPct = [20];
      } else if (gemType === 'Spell') {
        moreDamageMultipliersPct = [30];
      } else if (gemType === 'Minion') {
        moreDamageMultipliersPct = [0];
      }

      if (tags.includes('travel')) {
        moreAttackSpeedMultipliersPct = [15];
      }

      // Determine if skill is trigger-based
      const isTrigger = tags.includes('trigger');

      // Determine support category/family
      let supportFamily = null;
      if (gemType === 'Support') {
        supportFamily = currentGem.raw.gemFamily || 'Unclassified';
      }

      skills.push({
        id,
        name,
        description: `${gemType} skill - ${currentGem.raw.tagString || tags.join(', ')}`,
        gemType,
        type,
        element,
        tags,
        tagString: currentGem.raw.tagString || '',
        weaponRequirements: currentGem.raw.weaponRequirements || null,
        requirements: {
          str: currentGem.raw.reqStr || 0,
          dex: currentGem.raw.reqDex || 0,
          int: currentGem.raw.reqInt || 0
        },
        tier: currentGem.raw.tier || 0,
        moreDamageMultipliersPct,
        moreAttackSpeedMultipliersPct,
        isTrigger,
        supportFamily,
        source: 'PathOfBuilding-PoE2'
      });
    }
    currentGem = null;
  }
}

// Sort skills by name
skills.sort((a, b) => a.name.localeCompare(b.name));

// Remove duplicates based on name
const uniqueSkills = [];
const seenNames = new Set();
for (const skill of skills) {
  if (!seenNames.has(skill.name)) {
    seenNames.add(skill.name);
    uniqueSkills.push(skill);
  }
}

// Write the output
fs.writeFileSync(outputPath, JSON.stringify(uniqueSkills, null, 2));

console.log(`Extracted ${uniqueSkills.length} unique skills from PathOfBuilding-PoE2`);
console.log(`Output written to: ${outputPath}`);

// Print summary by type
const typeCount = {};
for (const skill of uniqueSkills) {
  typeCount[skill.gemType] = (typeCount[skill.gemType] || 0) + 1;
}
console.log('\nSkills by gem type:');
for (const [type, count] of Object.entries(typeCount).sort((a, b) => b[1] - a[1])) {
  console.log(`  ${type}: ${count}`);
}

// Print summary by element
const elementCount = {};
for (const skill of uniqueSkills) {
  const elem = skill.element || 'None';
  elementCount[elem] = (elementCount[elem] || 0) + 1;
}
console.log('\nSkills by element:');
for (const [elem, count] of Object.entries(elementCount).sort((a, b) => b[1] - a[1])) {
  console.log(`  ${elem}: ${count}`);
}

// Print some examples
console.log('\nSample skills:');
uniqueSkills.slice(0, 5).forEach(s => {
  console.log(`  - ${s.name} (${s.gemType}, ${s.element || 'no element'})`);
});
