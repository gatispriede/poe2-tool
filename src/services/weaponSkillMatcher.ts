/**
 * Weapon-Skill Matcher Service
 * Determines which skills are valid for a given weapon
 */

import { WeaponBase } from '../data/weapons';
import { Skill } from '../data/skills';

/**
 * Weapon type to category mapping for matching
 */
const WEAPON_TYPE_CATEGORIES: Record<string, string[]> = {
  'One Handed Mace': ['mace', 'one hand mace', 'one handed mace'],
  'Two Handed Mace': ['mace', 'two hand mace', 'two handed mace'],
  'One Handed Sword': ['sword', 'one hand sword', 'one handed sword'],
  'Two Handed Sword': ['sword', 'two hand sword', 'two handed sword'],
  'One Handed Axe': ['axe', 'one hand axe', 'one handed axe'],
  'Two Handed Axe': ['axe', 'two hand axe', 'two handed axe'],
  'Bow': ['bow'],
  'Claw': ['claw'],
  'Dagger': ['dagger'],
  'Flail': ['flail'],
  'Spear': ['spear'],
  'Staff': ['staff'],
  'Warstaff': ['staff', 'warstaff'],
  'Quarterstaff': ['staff', 'quarterstaff'],
  'Wand': ['wand'],
  'Sceptre': ['sceptre'],
  'Crossbow': ['crossbow'],
};

/**
 * Normalizes a weapon requirement string for matching
 */
function normalizeRequirement(req: string): string {
  return req.toLowerCase().trim()
    .replace(/one handed/g, 'one hand')
    .replace(/two handed/g, 'two hand');
}

/**
 * Checks if a weapon type matches a skill's weapon requirement
 */
function doesWeaponMatchRequirement(weaponType: string, requirement: string): boolean {
  const normalizedReq = normalizeRequirement(requirement);
  const normalizedType = normalizeRequirement(weaponType);

  // Direct match
  if (normalizedType === normalizedReq) {
    return true;
  }

  // Check if the weapon type contains the requirement
  if (normalizedType.includes(normalizedReq)) {
    return true;
  }

  // Check category mappings
  const typeCategories = WEAPON_TYPE_CATEGORIES[weaponType] || [];
  for (const category of typeCategories) {
    if (normalizedReq.includes(category) || category.includes(normalizedReq)) {
      return true;
    }
  }

  // Special case: extract base weapon type (e.g., "One Handed Mace" -> "Mace")
  const weaponBase = weaponType.replace(/^(One Handed?|Two Handed?)\s+/i, '').toLowerCase();
  const reqBase = requirement.replace(/^(One Hand|Two Hand)\s+/i, '').toLowerCase();
  if (weaponBase === reqBase) {
    return true;
  }

  return false;
}

/**
 * Gets all skills that can be used with a given weapon
 */
export function getSkillsForWeapon(weapon: WeaponBase, allSkills: Skill[]): Skill[] {
  return allSkills.filter(skill => isSkillValidForWeapon(skill, weapon));
}

/**
 * Caster weapon categories that should show spell skills
 */
const CASTER_WEAPON_CATEGORIES = ['staff', 'wand', 'sceptre'];

/**
 * Checks if a specific skill is valid for a given weapon
 */
export function isSkillValidForWeapon(skill: Skill, weapon: WeaponBase): boolean {
  const isCasterWeapon = CASTER_WEAPON_CATEGORIES.includes(weapon.category);

  // For caster weapons, show spell skills
  if (isCasterWeapon && skill.gemType === 'Spell') {
    return true;
  }

  // Attack skills check weapon requirements
  if (skill.gemType === 'Attack') {
    // If skill has no weapon requirements, it works with all weapons
    if (skill.weaponRequirements.length === 0) {
      return true;
    }

    // Check if any of the skill's weapon requirements match the weapon
    return skill.weaponRequirements.some(req =>
      doesWeaponMatchRequirement(weapon.type, req)
    );
  }

  // For non-caster weapons, don't show spell skills by default
  return false;
}

/**
 * Gets all weapons that can be used with a given skill
 */
export function getWeaponsForSkill(skill: Skill, allWeapons: WeaponBase[]): WeaponBase[] {
  // Spells don't require specific weapons (though they may benefit from certain types)
  if (skill.gemType !== 'Attack') {
    return allWeapons;
  }

  // If skill has no weapon requirements, all weapons are valid
  if (skill.weaponRequirements.length === 0) {
    return allWeapons;
  }

  return allWeapons.filter(weapon =>
    skill.weaponRequirements.some(req =>
      doesWeaponMatchRequirement(weapon.type, req)
    )
  );
}

/**
 * Gets the weapon categories that a skill can use
 */
export function getWeaponCategoriesForSkill(skill: Skill): string[] {
  if (skill.gemType !== 'Attack' || skill.weaponRequirements.length === 0) {
    return ['all'];
  }

  const categories = new Set<string>();

  for (const req of skill.weaponRequirements) {
    const normalizedReq = normalizeRequirement(req);

    // Try to extract the base weapon type
    if (normalizedReq.includes('mace')) categories.add('mace');
    if (normalizedReq.includes('sword')) categories.add('sword');
    if (normalizedReq.includes('axe')) categories.add('axe');
    if (normalizedReq.includes('bow')) categories.add('bow');
    if (normalizedReq.includes('claw')) categories.add('claw');
    if (normalizedReq.includes('dagger')) categories.add('dagger');
    if (normalizedReq.includes('flail')) categories.add('flail');
    if (normalizedReq.includes('spear')) categories.add('spear');
    if (normalizedReq.includes('staff') || normalizedReq.includes('quarterstaff')) {
      categories.add('staff');
    }
    if (normalizedReq.includes('wand')) categories.add('wand');
    if (normalizedReq.includes('sceptre')) categories.add('sceptre');
    if (normalizedReq.includes('crossbow')) categories.add('crossbow');
  }

  return Array.from(categories);
}

/**
 * Groups skills by their primary element
 */
export function groupSkillsByElement(skills: Skill[]): Record<string, Skill[]> {
  const groups: Record<string, Skill[]> = {
    physical: [],
    fire: [],
    cold: [],
    lightning: [],
    chaos: [],
    other: [],
  };

  for (const skill of skills) {
    const element = skill.element || 'other';
    if (groups[element]) {
      groups[element].push(skill);
    } else {
      groups.other.push(skill);
    }
  }

  return groups;
}

/**
 * Sorts skills by relevance to a weapon
 * (Skills with more specific weapon requirements rank higher)
 */
export function sortSkillsByRelevance(skills: Skill[], weapon: WeaponBase): Skill[] {
  return [...skills].sort((a, b) => {
    // Skills with specific weapon requirements rank higher
    const aSpecific = a.weaponRequirements.length > 0;
    const bSpecific = b.weaponRequirements.length > 0;

    if (aSpecific && !bSpecific) return -1;
    if (!aSpecific && bSpecific) return 1;

    // If both have requirements, prefer exact matches
    const aExact = a.weaponRequirements.some(req =>
      normalizeRequirement(req) === normalizeRequirement(weapon.type)
    );
    const bExact = b.weaponRequirements.some(req =>
      normalizeRequirement(req) === normalizeRequirement(weapon.type)
    );

    if (aExact && !bExact) return -1;
    if (!aExact && bExact) return 1;

    // Otherwise sort by tier then name
    if (a.tier !== b.tier) return a.tier - b.tier;
    return a.name.localeCompare(b.name);
  });
}
