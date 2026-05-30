const skills = require('../src/data/PoBSkills.json');
const weapons = require('../src/data/Weapons.json');

console.log('=== Skills Analysis ===');
console.log('Total skills:', skills.length);

const attackSkills = skills.filter(s => s.type === 'Attack' || s.gemType === 'Attack');
console.log('Attack skills:', attackSkills.length);

console.log('\n=== Attack Skills with Weapon Requirements ===');
attackSkills.filter(s => s.weaponRequirements).slice(0, 10).forEach(s => {
  console.log(`- ${s.name}: ${s.weaponRequirements}`);
});

console.log('\n=== Weapon Types ===');
const types = [...new Set(weapons.map(w => w.type))].sort();
console.log('Weapon types:', types);

console.log('\n=== Quarterstaffs ===');
const qs = weapons.filter(w => w.type === 'Quarterstaff');
console.log('Quarterstaff count:', qs.length);
if (qs.length > 0) {
  console.log('Sample:', qs[0].name, '- Crit:', qs[0].critChance, '- APS:', qs[0].attackRate);
}

// Test mapping
const mapWeaponRequirementToTypes = (requirement) => {
  if (!requirement) return [];
  const mapping = {
    'One Hand Mace': ['One Handed Mace'],
    'Two Hand Mace': ['Two Handed Mace'],
    'One Hand Sword': ['One Handed Sword'],
    'Two Hand Sword': ['Two Handed Sword'],
    'One Hand Axe': ['One Handed Axe'],
    'Two Hand Axe': ['Two Handed Axe'],
    'Bow': ['Bow'],
    'Crossbow': ['Crossbow'],
    'Staff': ['Staff', 'Quarterstaff'],
    'Quarterstaff': ['Quarterstaff'],
    'Wand': ['Wand'],
    'Dagger': ['Dagger'],
    'Claw': ['Claw'],
    'Spear': ['Spear'],
    'Flail': ['Flail'],
    'Sceptre': ['Sceptre'],
    'Any Melee Martial Weapon': ['One Handed Sword', 'Two Handed Sword', 'One Handed Axe', 'Two Handed Axe', 'One Handed Mace', 'Two Handed Mace', 'Staff', 'Quarterstaff', 'Dagger', 'Claw', 'Spear', 'Flail', 'Sceptre'],
    'Unarmed': [],
  };
  const types = [];
  requirement.split(/,|or/).map(p => p.trim()).forEach(part => {
    if (mapping[part]) types.push(...mapping[part]);
    else types.push(part);
  });
  return [...new Set(types)];
};

console.log('\n=== Testing Weapon Mapping ===');
console.log('Staff requirement maps to:', mapWeaponRequirementToTypes('Staff'));
console.log('Any Melee maps to:', mapWeaponRequirementToTypes('Any Melee Martial Weapon'));

// Test filtering
const staffAllowed = mapWeaponRequirementToTypes('Staff');
const staffWeapons = weapons.filter(w => staffAllowed.includes(w.type));
console.log('\nWeapons for Staff skill:', staffWeapons.length);
staffWeapons.slice(0, 5).forEach(w => console.log('-', w.name, '('+w.type+')'));

