/**
 * Skill Data Types and Loader
 * Loads skill gems from PoB Gems.lua
 */

import { fetchLuaFile, parseReturnTable } from './pobParser';

export interface Skill {
  id: string;
  name: string;
  gemType: 'Attack' | 'Spell' | 'Support' | 'Other';
  weaponRequirements: string[];  // Parsed from "One Hand Mace, Two Hand Mace"
  tags: string[];
  tagString: string;
  element?: string;              // fire, cold, lightning, chaos, physical
  reqStr: number;
  reqDex: number;
  reqInt: number;
  tier: number;
  description?: string;
}

// Cache for loaded skills
let skillsCache: Skill[] | null = null;

/**
 * Parses weapon requirements string into array
 * e.g. "One Hand Mace, Two Hand Mace" -> ["One Hand Mace", "Two Hand Mace"]
 */
function parseWeaponRequirements(reqString?: string): string[] {
  if (!reqString) return [];
  return reqString.split(',').map(s => s.trim()).filter(s => s.length > 0);
}

/**
 * Determines the primary element from skill tags
 */
function determineElement(tags: Record<string, boolean>): string | undefined {
  if (tags.fire) return 'fire';
  if (tags.cold) return 'cold';
  if (tags.lightning) return 'lightning';
  if (tags.chaos) return 'chaos';
  if (tags.physical) return 'physical';
  return undefined;
}

/**
 * Determines gem type from tags
 */
function determineGemType(tags: Record<string, boolean>, rawGemType?: string): 'Attack' | 'Spell' | 'Support' | 'Other' {
  if (rawGemType === 'Attack' || tags.attack) return 'Attack';
  if (rawGemType === 'Spell' || tags.spell) return 'Spell';
  if (rawGemType === 'Support' || tags.support) return 'Support';
  return 'Other';
}

/**
 * Transforms raw PoB skill data to our Skill interface
 */
function transformSkill(id: string, data: any): Skill {
  const tags = data.tags || {};
  const tagKeys = Object.keys(tags).filter(k => tags[k] === true);

  return {
    id,
    name: data.name || id,
    gemType: determineGemType(tags, data.gemType),
    weaponRequirements: parseWeaponRequirements(data.weaponRequirements),
    tags: tagKeys,
    tagString: data.tagString || tagKeys.join(', '),
    element: determineElement(tags),
    reqStr: data.reqStr || 0,
    reqDex: data.reqDex || 0,
    reqInt: data.reqInt || 0,
    tier: data.Tier || 1,
    description: data.description,
  };
}

/**
 * Loads all skills from PoB Gems.lua
 */
export async function loadSkills(): Promise<Skill[]> {
  if (skillsCache) {
    return skillsCache;
  }

  try {
    const luaContent = await fetchLuaFile('Gems.lua');
    const parsed = parseReturnTable(luaContent);

    const skills: Skill[] = [];
    for (const [id, data] of Object.entries(parsed)) {
      // Skip non-skill gems or internal entries
      if (!data.name || !data.tags) continue;

      // Only include skills that grant active abilities
      const tags = data.tags as Record<string, boolean>;
      if (!tags.grants_active_skill) continue;

      skills.push(transformSkill(id, data));
    }

    // Sort by tier, then by name
    skills.sort((a, b) => {
      if (a.tier !== b.tier) return a.tier - b.tier;
      return a.name.localeCompare(b.name);
    });

    skillsCache = skills;
    return skills;
  } catch (error) {
    console.error('Failed to load skills:', error);
    return [];
  }
}

/**
 * Gets only attack skills
 */
export async function getAttackSkills(): Promise<Skill[]> {
  const skills = await loadSkills();
  return skills.filter(s => s.gemType === 'Attack');
}

/**
 * Gets only spell skills
 */
export async function getSpellSkills(): Promise<Skill[]> {
  const skills = await loadSkills();
  return skills.filter(s => s.gemType === 'Spell');
}

/**
 * Gets skills that are compatible with a specific weapon type
 */
export async function getSkillsForWeaponType(weaponType: string): Promise<Skill[]> {
  const skills = await loadSkills();

  return skills.filter(skill => {
    // Only attack skills have weapon requirements
    if (skill.gemType !== 'Attack') return false;

    // If no requirements, skill works with all weapons
    if (skill.weaponRequirements.length === 0) return true;

    // Check if weapon type matches any requirement
    return skill.weaponRequirements.some(req => {
      // Direct match
      if (weaponType === req) return true;

      // Partial match: "One Hand Mace" contains "Mace"
      if (weaponType.includes(req)) return true;

      // Handle "One Hand" vs "Two Hand" prefixes
      const weaponBase = weaponType.replace(/^(One Handed?|Two Handed?)\s+/i, '');
      const reqBase = req.replace(/^(One Handed?|Two Handed?)\s+/i, '');
      if (weaponBase === reqBase) return true;

      return false;
    });
  });
}

/**
 * Gets skills that are compatible with a weapon category (e.g., "mace", "sword")
 */
export async function getSkillsForWeaponCategory(category: string): Promise<Skill[]> {
  const skills = await loadSkills();

  // Map category to possible weapon type patterns
  const categoryPatterns: Record<string, RegExp[]> = {
    'mace': [/mace/i],
    'sword': [/sword/i],
    'axe': [/axe/i],
    'bow': [/bow/i],
    'claw': [/claw/i],
    'dagger': [/dagger/i],
    'flail': [/flail/i],
    'spear': [/spear/i],
    'staff': [/staff/i, /warstaff/i, /quarterstaff/i],
    'wand': [/wand/i],
    'crossbow': [/crossbow/i],
  };

  const patterns = categoryPatterns[category.toLowerCase()] || [new RegExp(category, 'i')];

  return skills.filter(skill => {
    // Only attack skills have weapon requirements
    if (skill.gemType !== 'Attack') return false;

    // If no requirements, skill works with all weapons
    if (skill.weaponRequirements.length === 0) return true;

    // Check if any requirement matches the category
    return skill.weaponRequirements.some(req =>
      patterns.some(pattern => pattern.test(req))
    );
  });
}

/**
 * Gets a specific skill by ID
 */
export async function getSkillById(id: string): Promise<Skill | undefined> {
  const skills = await loadSkills();
  return skills.find(s => s.id === id);
}

/**
 * Gets a specific skill by name
 */
export async function getSkillByName(name: string): Promise<Skill | undefined> {
  const skills = await loadSkills();
  return skills.find(s => s.name.toLowerCase() === name.toLowerCase());
}

/**
 * Clears the skills cache (useful for reloading)
 */
export function clearSkillsCache(): void {
  skillsCache = null;
}
