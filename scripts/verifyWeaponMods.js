/**
 * Verify weapon mods are correctly assigned to each weapon type
 */
const m = require('../src/data/WeaponMods.json');

console.log('=== WEAPON MOD VERIFICATION ===\n');
console.log('Total Prefixes:', m.prefixes.length);
console.log('Total Suffixes:', m.suffixes.length);

// Get all unique weapon types
const allWeaponTypes = new Set();
m.prefixes.forEach(p => p.applicableWeapons.forEach(w => allWeaponTypes.add(w)));
m.suffixes.forEach(s => s.applicableWeapons.forEach(w => allWeaponTypes.add(w)));
console.log('\nWeapon types found:', [...allWeaponTypes].sort().join(', '));

// Check mods for spell weapons
const spellWeapons = ['Wand', 'Sceptre', 'Staff'];

spellWeapons.forEach(weaponType => {
  console.log(`\n=== ${weaponType.toUpperCase()} ===`);

  // Filter prefixes
  const prefixes = m.prefixes.filter(p =>
    p.applicableWeapons.includes('All Weapons') ||
    p.applicableWeapons.includes(weaponType)
  );

  // Filter suffixes
  const suffixes = m.suffixes.filter(s =>
    s.applicableWeapons.includes('All Weapons') ||
    s.applicableWeapons.includes(weaponType)
  );

  console.log(`Prefixes: ${prefixes.length}`);
  console.log(`Suffixes: ${suffixes.length}`);

  // Get spell damage prefixes
  const spellDmgPrefixes = prefixes.filter(p =>
    p.stats.some(s => s.toLowerCase().includes('spell damage'))
  );
  console.log(`  Spell Damage prefixes: ${spellDmgPrefixes.length}`);

  // Get highest tier spell damage
  const highestSpell = spellDmgPrefixes.sort((a, b) => b.level - a.level)[0];
  if (highestSpell) {
    console.log(`  Best spell prefix: ${highestSpell.affix} (Lvl ${highestSpell.level})`);
    console.log(`    ${highestSpell.stats[0]}`);
  }

  // Get cast speed suffixes
  const castSpeedSuffixes = suffixes.filter(s =>
    s.stats.some(st => st.toLowerCase().includes('cast speed'))
  );
  console.log(`  Cast Speed suffixes: ${castSpeedSuffixes.length}`);

  const highestCast = castSpeedSuffixes.sort((a, b) => b.level - a.level)[0];
  if (highestCast) {
    console.log(`  Best cast speed: ${highestCast.affix} (Lvl ${highestCast.level})`);
    console.log(`    ${highestCast.stats[0]}`);
  }

  // Get crit suffixes
  const critSuffixes = suffixes.filter(s =>
    s.stats.some(st => st.toLowerCase().includes('critical'))
  );
  console.log(`  Critical suffixes: ${critSuffixes.length}`);
});

// Check for weapon-specific mods
console.log('\n=== WEAPON-SPECIFIC MODS ===');

// Find mods that are ONLY on specific weapons
const wandOnlyPrefixes = m.prefixes.filter(p =>
  p.applicableWeapons.includes('Wand') &&
  !p.applicableWeapons.includes('All Weapons') &&
  !p.applicableWeapons.includes('Sceptre') &&
  !p.applicableWeapons.includes('Staff')
);
console.log(`\nWand-only prefixes: ${wandOnlyPrefixes.length}`);
wandOnlyPrefixes.slice(0, 3).forEach(p => console.log(`  - ${p.affix}: ${p.stats[0]}`));

const sceptreOnlyPrefixes = m.prefixes.filter(p =>
  p.applicableWeapons.includes('Sceptre') &&
  !p.applicableWeapons.includes('All Weapons') &&
  !p.applicableWeapons.includes('Wand') &&
  !p.applicableWeapons.includes('Staff')
);
console.log(`\nSceptre-only prefixes: ${sceptreOnlyPrefixes.length}`);
sceptreOnlyPrefixes.slice(0, 3).forEach(p => console.log(`  - ${p.affix}: ${p.stats[0]}`));

const staffOnlyPrefixes = m.prefixes.filter(p =>
  p.applicableWeapons.includes('Staff') &&
  !p.applicableWeapons.includes('All Weapons') &&
  !p.applicableWeapons.includes('Wand') &&
  !p.applicableWeapons.includes('Sceptre')
);
console.log(`\nStaff-only prefixes: ${staffOnlyPrefixes.length}`);
staffOnlyPrefixes.slice(0, 3).forEach(p => console.log(`  - ${p.affix}: ${p.stats[0]}`));

// Check physical damage mods for weapons with damage
console.log('\n=== PHYSICAL DAMAGE MODS ===');
const physPrefixes = m.prefixes.filter(p =>
  p.stats.some(s => s.toLowerCase().includes('physical damage') && !s.toLowerCase().includes('spell'))
);
console.log(`Physical (non-spell) prefixes: ${physPrefixes.length}`);
const highestPhys = physPrefixes.sort((a, b) => b.level - a.level)[0];
if (highestPhys) {
  console.log(`  Best: ${highestPhys.affix} (Lvl ${highestPhys.level})`);
  console.log(`    ${highestPhys.stats[0]}`);
  console.log(`    Applies to: ${highestPhys.applicableWeapons.join(', ')}`);
}

