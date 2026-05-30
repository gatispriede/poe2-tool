// Skill ↔ weapon eligibility — a build-VALIDITY gate, not a damage tweak.
//
// PoE2 restricts which weapon a skill can be used with. Getting this wrong
// produces builds that can't exist in game, so it's a layer-1 validity check
// (valid weapon → valid skill → ...), enforced BEFORE any DPS is computed.
//
// Two rules, from PoB skill data + in-game behaviour:
//   1. A skill with a non-empty `weaponTypes` list REQUIRES one of those
//      weapon types. Bow skills (Ice Shot, Lightning Arrow) carry
//      weaponTypes:["Bow"] → they only work with a Bow. This is the data's
//      own restriction and is authoritative.
//   2. A SPELL (Spell tag, empty weaponTypes) works with most weapons BUT
//      NOT with ranged-attack weapons — you cannot cast a spell while
//      wielding a Bow (confirmed) or Crossbow (same family: two-handed
//      ranged-attack weapon — assumed identical, flag to verify). Casters
//      use wands / sceptres / staves / foci, or melee weapons.
//
// `weaponBaseType` is the weapon's `type` field from weapon-bases.json
// (e.g. "Bow", "Wand", "Sceptre", "Staff", "Crossbow", "One Hand Sword").

export interface SkillWeaponInfo {
  name: string;
  skillTypes: string[];
  weaponTypes: string[];
}

/** Weapon families that cannot cast spells (ranged-attack two-handers). */
const SPELL_FORBIDDEN_WEAPONS = new Set(['Bow', 'Crossbow']);

export interface EligibilityVerdict {
  ok: boolean;
  reason: string;
}

export function checkSkillWeapon(skill: SkillWeaponInfo, weaponBaseType: string): EligibilityVerdict {
  const isSpell = skill.skillTypes.includes('Spell') && !skill.skillTypes.includes('Attack');

  // Rule 1 — explicit weaponTypes requirement (authoritative from data).
  if (skill.weaponTypes.length > 0) {
    if (skill.weaponTypes.includes(weaponBaseType)) {
      return { ok: true, reason: `${skill.name} accepts ${weaponBaseType}` };
    }
    return {
      ok: false,
      reason: `${skill.name} requires one of [${skill.weaponTypes.join(', ')}] — ${weaponBaseType} is not allowed`,
    };
  }

  // Rule 2 — spells can't be cast with ranged-attack weapons.
  if (isSpell && SPELL_FORBIDDEN_WEAPONS.has(weaponBaseType)) {
    return {
      ok: false,
      reason: `${skill.name} is a spell — cannot be cast while wielding a ${weaponBaseType}`,
    };
  }

  // No restriction recorded and no spell/ranged conflict → allowed.
  return { ok: true, reason: `${skill.name} has no weapon restriction for ${weaponBaseType}` };
}

export function isSkillUsableWithWeapon(skill: SkillWeaponInfo, weaponBaseType: string): boolean {
  return checkSkillWeapon(skill, weaponBaseType).ok;
}
