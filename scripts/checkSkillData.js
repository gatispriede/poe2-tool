const skills = require('../src/data/PoBSkills.json');

const spells = skills.filter(s => s.gemType === 'Spell');
const attacks = skills.filter(s => s.gemType === 'Attack');

console.log('=== SKILL DATA SUMMARY ===');
console.log('');
console.log('SPELLS: ' + spells.length + ' total');
console.log('  With minDamageLvl20: ' + spells.filter(s => s.minDamageLvl20).length);
console.log('  With critChance: ' + spells.filter(s => s.critChance).length);
console.log('  With castTime: ' + spells.filter(s => s.castTime).length);
console.log('  With baseEffectiveness: ' + spells.filter(s => s.baseEffectiveness).length);

const spellsNoDamage = spells.filter(s => !s.minDamageLvl20);
if (spellsNoDamage.length > 0) {
  console.log('\n  Spells WITHOUT damage data:');
  spellsNoDamage.slice(0, 10).forEach(s => console.log('    -', s.name));
  if (spellsNoDamage.length > 10) console.log('    ... and', spellsNoDamage.length - 10, 'more');
}

console.log('\nATTACKS:', attacks.length);
console.log('  With baseMultiplierLvl20:', attacks.filter(s => s.baseDamageData?.baseMultiplierLvl20).length);
console.log('  With critChance:', attacks.filter(s => s.critChance || s.baseDamageData?.critChance).length);

const attacksNoMult = attacks.filter(s => !s.baseDamageData?.baseMultiplierLvl20 && !s.baseDamageData?.baseMultiplier);
if (attacksNoMult.length > 0) {
  console.log('\n  Attacks WITHOUT baseMultiplier:');
  attacksNoMult.slice(0, 10).forEach(s => console.log('    -', s.name));
  if (attacksNoMult.length > 10) console.log('    ... and', attacksNoMult.length - 10, 'more');
}

console.log('\n=== SAMPLE DATA ===\n');

const sampleSpell = spells.find(s => s.minDamageLvl20 && s.critChance);
if (sampleSpell) {
  console.log('Sample Spell:', sampleSpell.name);
  console.log('  Damage Lvl20:', sampleSpell.minDamageLvl20, '-', sampleSpell.maxDamageLvl20);
  console.log('  Crit Chance:', sampleSpell.critChance + '%');
  console.log('  Cast Time:', sampleSpell.castTime + 's');
  console.log('  Element:', sampleSpell.element);
}

const sampleAttack = attacks.find(s => s.baseDamageData?.baseMultiplierLvl20);
if (sampleAttack) {
  console.log('\nSample Attack:', sampleAttack.name);
  console.log('  Base Multiplier Lvl20:', (sampleAttack.baseDamageData.baseMultiplierLvl20 * 100).toFixed(0) + '%');
  console.log('  Crit Chance:', (sampleAttack.critChance || sampleAttack.baseDamageData?.critChance || 'from weapon') + '%');
  console.log('  Weapon Req:', sampleAttack.weaponRequirements);
}

