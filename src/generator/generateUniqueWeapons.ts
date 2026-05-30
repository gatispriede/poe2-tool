// Build ParsedItem candidates from extracted unique weapons.
//
// Unique items have fixed mod text (with range stubs we resolve to
// midpoint), distinct from rare items where we PICK affixes. The composer
// treats every item's mods as text lines regardless of rarity, so a
// unique-as-ParsedItem feeds through the same pipeline.
//
// We filter to uniques whose baseType exists in weapon-bases.json (so the
// weapon has known base damage / APS / crit for the composer) and whose
// category is a weapon (excludes amulets/jewels even if loaded).

import uniquesJson from '../data/generated/uniques.json';
import weaponBasesJson from '../data/generated/weapon-bases.json';
import skillsJson from '../data/generated/skills.json';
import { ParsedItem } from '../validation/types';

interface UniqueItem {
  name: string;
  baseType: string;
  category: string;
  implicits: string[];
  explicits: string[];
  league?: string;
  source?: string;
}

interface WeaponBase {
  id: string;
  type: string;
  category: string;
}

interface SkillRecord {
  id: string;
  weaponTypes: string[];
  skillTypes: string[];
}

const allUniques: UniqueItem[] = uniquesJson as UniqueItem[];
const basesByName: Record<string, WeaponBase> = {};
for (const b of weaponBasesJson as WeaponBase[]) basesByName[b.id] = b;
const skillsById: Record<string, SkillRecord> = {};
for (const s of skillsJson as SkillRecord[]) skillsById[s.id] = s;

const WEAPON_CATEGORIES = new Set([
  'bow','crossbow','mace','axe','sword','spear','staff','dagger',
  'wand','sceptre','claw','flail',
]);

/** Resolve `(min-max)` ranges in unique mod text to the midpoint. */
function resolveRanges(text: string): string {
  return text.replace(/\((\-?[\d.]+)-(\-?[\d.]+)\)/g, (_, a, b) => {
    const lo = parseFloat(a), hi = parseFloat(b);
    return String(Math.floor((lo + hi) / 2));
  });
}

/**
 * Return all viable unique weapons for the given skill. "Viable" means:
 *   - Unique is from a weapon category
 *   - Its baseType exists in weapon-bases.json
 *   - The base's `type` matches one of the skill's allowed weapon types
 *     (or the skill is weapon-agnostic with an inferred type)
 */
export function pickUniqueWeaponsForSkill(
  skillId: string,
): { item: ParsedItem; baseId: string; uniqueName: string }[] {
  const skill = skillsById[skillId];
  if (!skill) return [];

  const wantedTypes = skill.weaponTypes.length
    ? new Set(skill.weaponTypes)
    : new Set([skill.skillTypes.find(t => ['Bow','Crossbow','Sword','Axe','Mace','Spear','Staff','Wand','Sceptre','Dagger','Claw','Flail'].includes(t))].filter(Boolean) as string[]);

  const out: { item: ParsedItem; baseId: string; uniqueName: string }[] = [];

  for (const u of allUniques) {
    if (!WEAPON_CATEGORIES.has(u.category)) continue;
    const base = basesByName[u.baseType];
    if (!base) continue;            // unique's base not in our DB
    if (!wantedTypes.has(base.type)) continue;

    out.push(uniqueToCandidate(u));
  }
  return out;
}

/**
 * Slot name (as it appears in ParsedBuild.equipped) → unique categories
 * eligible for that slot. PoE has multiple ring/quiver/charm slots that
 * map to the same item category.
 */
const SLOT_TO_UNIQUE_CATEGORIES: Record<string, string[]> = {
  'Helmet':       ['helmet'],
  'Body Armour':  ['body'],
  'Gloves':       ['gloves'],
  'Boots':        ['boots'],
  'Belt':         ['belt'],
  'Amulet':       ['amulet'],
  'Ring 1':       ['ring'],
  'Ring 2':       ['ring'],
  'Weapon 2':     ['quiver', 'focus', 'shield', 'sceptre'], // offhand options
};

/**
 * Return all viable UNIQUE items for a given slot name. Used by the
 * orchestrator to upgrade non-weapon slots beyond the template defaults.
 */
export function pickUniquesForSlot(slotName: string): { item: ParsedItem; uniqueName: string }[] {
  const categories = SLOT_TO_UNIQUE_CATEGORIES[slotName];
  if (!categories) return [];
  const out: { item: ParsedItem; uniqueName: string }[] = [];
  for (const u of allUniques) {
    if (!categories.includes(u.category)) continue;
    out.push({ item: uniqueToCandidate(u).item, uniqueName: u.name });
  }
  return out;
}

function uniqueToCandidate(u: UniqueItem): { item: ParsedItem; baseId: string; uniqueName: string } {
  const implicits = u.implicits.map(resolveRanges);
  const explicits = u.explicits.map(resolveRanges);
  const item: ParsedItem = {
    id: `unique-${u.name.replace(/\s+/g, '_')}`,
    rarity: 'UNIQUE',
    name: u.name,
    base: u.baseType,
    itemLevel: 86,
    quality: 20,
    sockets: 'S S',
    levelReq: null,
    runes: [],
    implicits,
    explicits,
    rawLines: ['Rarity: UNIQUE', u.name, u.baseType, ...implicits, ...explicits],
  };
  return { item, baseId: u.baseType, uniqueName: u.name };
}
