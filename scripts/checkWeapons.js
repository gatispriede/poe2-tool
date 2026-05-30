const w = require('../src/data/Weapons.json');
const m = require('../src/data/WeaponMods.json');

const weaponTypes = [...new Set(w.map(x => x.type))].sort();
const modWeapons = new Set();
m.prefixes.forEach(p => p.applicableWeapons.forEach(x => modWeapons.add(x)));
m.suffixes.forEach(s => s.applicableWeapons.forEach(x => modWeapons.add(x)));

console.log('=== Weapon Types in Weapons.json ===');
console.log(weaponTypes);

console.log('\n=== Weapon Types in WeaponMods.json ===');
console.log([...modWeapons].sort());

console.log('\n=== Missing in WeaponMods (weapons with no mods) ===');
console.log(weaponTypes.filter(t => !modWeapons.has(t)));

console.log('\n=== Extra in WeaponMods (mods for non-existent weapons) ===');
console.log([...modWeapons].filter(t => !weaponTypes.includes(t)));

console.log('\n=== Sample Weapon Stats ===');
const samples = {};
weaponTypes.forEach(t => {
  const ws = w.filter(x => x.type === t);
  if (ws.length > 0) {
    const sample = ws[Math.floor(ws.length / 2)]; // middle weapon
    samples[t] = {
      name: sample.name,
      physMin: sample.damage.physical.min,
      physMax: sample.damage.physical.max,
      critChance: sample.critChance,
      attackRate: sample.attackRate,
      quality: sample.quality
    };
  }
});
console.log(JSON.stringify(samples, null, 2));

