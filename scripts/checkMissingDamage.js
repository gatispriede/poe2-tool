// Check spells without damage data
const s = require('../src/data/PoBSkills.json');
const spellDamage = require('../src/data/SpellBaseDamage.json');

const spells = s.filter(x => x.gemType === 'Spell' || x.type === 'Spell' || x.type === 'Elemental');
console.log('Total spells:', spells.length);

const noDmg = spells.filter(x => !x.minDamageLvl20 && !x.estimatedBaseDamageLvl20);
console.log('Without damage data:', noDmg.length);

console.log('\nSpells missing damage:');
noDmg.forEach(x => console.log('-', x.name, '| id:', x.id));

console.log('\n--- SpellBaseDamage.json entries ---');
console.log('Total entries:', Object.keys(spellDamage).length);

// Try to find matches
console.log('\nAttempting to match...');
noDmg.slice(0, 10).forEach(skill => {
  const nameKey = skill.name.toLowerCase().replace(/[^a-z0-9]+/g, '_');
  const found = spellDamage[nameKey];
  console.log(skill.name, '->', nameKey, ':', found ? 'FOUND' : 'NOT FOUND');
});

