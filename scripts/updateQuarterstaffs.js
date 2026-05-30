const fs = require('fs');
const path = require('path');

const weaponsPath = path.join(__dirname, '../src/data/Weapons.json');
const weapons = require(weaponsPath);

// Update all quarterstaff weapons to have type "Quarterstaff"
let updated = 0;
weapons.forEach(w => {
  if (w.id && w.id.includes('quarterstaff')) {
    w.type = 'Quarterstaff';
    w.category = 'quarterstaff';
    updated++;
  }
});

console.log(`Updated ${updated} quarterstaff weapons`);

// Write back
fs.writeFileSync(weaponsPath, JSON.stringify(weapons, null, 2));
console.log('Saved Weapons.json');

// Verify
const weaponTypes = [...new Set(weapons.map(w => w.type))].sort();
console.log('Weapon types:', weaponTypes);

