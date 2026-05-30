// Enumerate active skills a given class can plausibly use.
//
// "Plausibly use" today means: the skill is tagged Attack or Spell, and its
// weaponTypes list either includes a weapon type the class can wield (we use
// a static class→weapon-type map for now), OR is empty (meaning the skill
// imposes no weapon restriction).
//
// We do NOT yet filter by:
//   - Ascendancy availability (some skills are tied to ascendancy unlocks)
//   - Quest gem availability (skills you can only acquire via reward choice)
//   - Spirit cost vs character spirit budget
//   - Useability with the player's actual weapon (we'll re-check in the
//     generator when we pick a weapon)

import skillsJson from '../data/generated/skills.json';

interface SkillRecord {
  id: string;
  name: string;
  isSupport: boolean;
  skillTypes: string[];
  weaponTypes: string[];
  levels: { level: number; levelRequirement?: number }[];
}

// Static class → typical weapon types. Conservative — only the weapons the
// class is most commonly built around, not every possible combination.
// Source: PoE2 class design (Huntress favours bows/spears, etc.).
const CLASS_WEAPONS: Record<string, string[]> = {
  Huntress:  ['Bow', 'Spear'],
  Ranger:    ['Bow', 'Spear', 'Crossbow'],
  Witch:     ['Wand', 'Staff', 'Sceptre', 'Focus'],
  Sorceress: ['Wand', 'Staff', 'Sceptre', 'Focus'],
  Warrior:   ['Mace', 'Axe', 'Sword', 'Two Hand Mace', 'Two Hand Axe', 'Two Hand Sword'],
  Mercenary: ['Crossbow', 'Bow', 'Sceptre'],
  Druid:     ['Quarterstaff', 'Staff', 'Mace'],
  Monk:      ['Quarterstaff', 'Staff'],
};

const ALL_SKILLS: SkillRecord[] = skillsJson as SkillRecord[];

export interface SkillCandidate {
  id: string;
  name: string;
  profile: 'attack' | 'spell' | 'aura' | 'mark' | 'curse' | 'other';
  weaponTypes: string[];
  minLevel: number;
  skillTypes: string[];
}

function profileOf(s: SkillRecord): SkillCandidate['profile'] {
  const t = new Set(s.skillTypes);
  if (t.has('Mark'))         return 'mark';
  if (t.has('AppliesCurse')) return 'curse';
  if (t.has('Aura'))         return 'aura';
  if (t.has('Attack'))       return 'attack';
  if (t.has('Spell'))        return 'spell';
  return 'other';
}

function minLevel(s: SkillRecord): number {
  if (!s.levels || !s.levels.length) return 1;
  return s.levels[0].levelRequirement ?? 1;
}

/**
 * Active skills the class can plausibly use, filtered by profile.
 * Pass `{ requireExactTag: 'Bow' }` to insist the skill's skillTypes
 * includes 'Bow' (more reliable than weaponTypes for bow-specific skills).
 */
export function candidateSkills(
  className: string,
  options: {
    profile?: SkillCandidate['profile'];
    requireExactTag?: string;
    maxCharacterLevel?: number;
  } = {},
): SkillCandidate[] {
  const weaponPool = new Set(CLASS_WEAPONS[className] ?? []);
  const profile = options.profile;
  const requireTag = options.requireExactTag;
  const maxLevel = options.maxCharacterLevel ?? 100;

  const out: SkillCandidate[] = [];
  for (const s of ALL_SKILLS) {
    if (s.isSupport) continue;
    if (minLevel(s) > maxLevel) continue;
    if (requireTag && !s.skillTypes.includes(requireTag)) continue;

    // Weapon compatibility: skill has no restriction (empty array) OR one of
    // its allowed weapon types is in our class pool.
    const noRestriction = !s.weaponTypes || s.weaponTypes.length === 0;
    const overlaps = s.weaponTypes.some(t => weaponPool.has(t));
    if (!noRestriction && !overlaps) continue;

    const candidate: SkillCandidate = {
      id: s.id,
      name: s.name,
      profile: profileOf(s),
      weaponTypes: s.weaponTypes ?? [],
      minLevel: minLevel(s),
      skillTypes: s.skillTypes,
    };
    if (profile && candidate.profile !== profile) continue;
    out.push(candidate);
  }

  // Stable sort: profile, then name.
  out.sort((a, b) => a.profile.localeCompare(b.profile) || a.name.localeCompare(b.name));
  return out;
}
