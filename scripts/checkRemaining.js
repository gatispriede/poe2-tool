// Check remaining spells without damage
const s = require('../src/data/PoBSkills.json');
const spellsMissing = s.filter(x =>
  (x.gemType === 'Spell' || x.type === 'Spell' || x.type === 'Elemental') &&
  !x.minDamageLvl20 &&
  !x.noDamageSkill
);
console.log('Spells still missing damage:', spellsMissing.length);
spellsMissing.forEach(x => console.log('-', x.name, '(', x.gemType, ')'));

