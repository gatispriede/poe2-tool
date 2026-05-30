const fs = require('fs');
const path = require('path');

const modsPath = path.join(__dirname, '../src/data/WeaponMods.json');
const mods = require(modsPath);

// Add Quarterstaff to all mods that have Staff (attack weapon mods)
let updated = 0;

const addQuarterstaff = (modArray) => {
  modArray.forEach(mod => {
    // If it has Staff and also has attack weapons (like One Handed Sword), add Quarterstaff
    if (mod.applicableWeapons.includes('Staff') &&
        (mod.applicableWeapons.includes('One Handed Sword') ||
         mod.applicableWeapons.includes('Bow') ||
         mod.modTags.includes('attack'))) {
      if (!mod.applicableWeapons.includes('Quarterstaff')) {
        mod.applicableWeapons.push('Quarterstaff');
        updated++;
      }
    }
  });
};

addQuarterstaff(mods.prefixes);
addQuarterstaff(mods.suffixes);

console.log(`Added Quarterstaff to ${updated} mods`);

// Write back
fs.writeFileSync(modsPath, JSON.stringify(mods, null, 2));
console.log('Saved WeaponMods.json');

// Verify weapon coverage
const allWeapons = new Set();
mods.prefixes.forEach(p => p.applicableWeapons.forEach(w => allWeapons.add(w)));
mods.suffixes.forEach(s => s.applicableWeapons.forEach(w => allWeapons.add(w)));
console.log('Weapons in mods:', [...allWeapons].sort());

