// Validity gate: bow skills require a bow; spells can't be cast with bows.

import { checkSkillWeapon } from '../skillWeaponRules';

const iceShot = { name: 'Ice Shot', skillTypes: ['Attack', 'Projectile', 'Cold', 'Bow'], weaponTypes: ['Bow'] };
const spark = { name: 'Spark', skillTypes: ['Spell', 'Projectile', 'Lightning'], weaponTypes: [] };
const meleeStrike = { name: 'Some Strike', skillTypes: ['Attack', 'Melee'], weaponTypes: [] };

describe('skill ↔ weapon eligibility', () => {
  it('bow skill requires a bow', () => {
    expect(checkSkillWeapon(iceShot, 'Bow').ok).toBe(true);
    expect(checkSkillWeapon(iceShot, 'Wand').ok).toBe(false);
    expect(checkSkillWeapon(iceShot, 'Crossbow').ok).toBe(false);
  });

  it('spell cannot be cast with a bow or crossbow, works with casters/melee', () => {
    expect(checkSkillWeapon(spark, 'Bow').ok).toBe(false);
    expect(checkSkillWeapon(spark, 'Crossbow').ok).toBe(false);
    expect(checkSkillWeapon(spark, 'Wand').ok).toBe(true);
    expect(checkSkillWeapon(spark, 'Sceptre').ok).toBe(true);
    expect(checkSkillWeapon(spark, 'Staff').ok).toBe(true);
    expect(checkSkillWeapon(spark, 'One Hand Sword').ok).toBe(true);
  });

  it('generic attack with no restriction is allowed broadly', () => {
    expect(checkSkillWeapon(meleeStrike, 'One Hand Sword').ok).toBe(true);
    expect(checkSkillWeapon(meleeStrike, 'Bow').ok).toBe(true); // attacks aren't spell-restricted
  });
});
