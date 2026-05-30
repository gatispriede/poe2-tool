/**
 * Weapon Data Types and Loader
 * Loads weapon base types from PoB Lua files
 */

import { fetchLuaFile, parseItemBases } from './pobParser';

export interface WeaponBase {
  id: string;
  name: string;
  type: string;           // "One Handed Mace", "Two Handed Sword", etc.
  category: string;       // "mace", "sword", "axe", etc.
  physicalMin: number;
  physicalMax: number;
  fireMin?: number;
  fireMax?: number;
  coldMin?: number;
  coldMax?: number;
  lightningMin?: number;
  lightningMax?: number;
  chaosMin?: number;
  chaosMax?: number;
  critChance: number;
  attackRate: number;
  range: number;
  requirements: {
    level?: number;
    str?: number;
    dex?: number;
    int?: number;
  };
  implicit?: string;
  tags: string[];
  socketLimit: number;
  quality: number;
}

export interface WeaponCategory {
  id: string;
  name: string;
  types: string[];  // e.g. ["One Handed Mace", "Two Handed Mace"]
}

// Weapon file to category mapping
const WEAPON_FILES: Record<string, string> = {
  'axe': 'Axes',
  'bow': 'Bows',
  'claw': 'Claws',
  'crossbow': 'Crossbows',
  'dagger': 'Daggers',
  'flail': 'Flails',
  'mace': 'Maces',
  'sceptre': 'Sceptres',
  'spear': 'Spears',
  'staff': 'Staves',
  'sword': 'Swords',
  'wand': 'Wands',
};

// Cache for loaded weapons
let weaponsCache: WeaponBase[] | null = null;
let categoriesCache: WeaponCategory[] | null = null;

/**
 * Transforms raw PoB weapon data to our WeaponBase interface
 */
function transformWeapon(name: string, data: any, category: string): WeaponBase {
  const weapon = data.weapon || {};
  const req = data.req || {};
  const tags = data.tags || {};

  return {
    id: name.toLowerCase().replace(/\s+/g, '_'),
    name,
    type: data.type || 'Unknown',
    category,
    physicalMin: weapon.PhysicalMin || 0,
    physicalMax: weapon.PhysicalMax || 0,
    fireMin: weapon.FireMin,
    fireMax: weapon.FireMax,
    coldMin: weapon.ColdMin,
    coldMax: weapon.ColdMax,
    lightningMin: weapon.LightningMin,
    lightningMax: weapon.LightningMax,
    chaosMin: weapon.ChaosMin,
    chaosMax: weapon.ChaosMax,
    critChance: weapon.CritChanceBase || 5,
    attackRate: weapon.AttackRateBase || 1.0,
    range: weapon.Range || 11,
    requirements: {
      level: req.level,
      str: req.str,
      dex: req.dex,
      int: req.int,
    },
    implicit: data.implicit,
    tags: Object.keys(tags).filter(k => tags[k] === true),
    socketLimit: data.socketLimit || 3,
    quality: data.quality || 20,
  };
}

/**
 * Loads all weapon bases from PoB Lua files
 */
export async function loadWeapons(): Promise<WeaponBase[]> {
  if (weaponsCache) {
    return weaponsCache;
  }

  const allWeapons: WeaponBase[] = [];

  for (const [file, categoryName] of Object.entries(WEAPON_FILES)) {
    try {
      const luaContent = await fetchLuaFile(`Bases/${file}.lua`);
      const parsed = parseItemBases(luaContent);

      for (const [name, data] of Object.entries(parsed)) {
        // Skip development/test items
        if (name.startsWith('[DNT]') || name.startsWith('Test')) continue;

        // Include items with weapon stats OR caster weapons (staff, wand, sceptre)
        const isCasterWeapon = ['staff', 'wand', 'sceptre'].includes(file);
        if (data.weapon || isCasterWeapon) {
          allWeapons.push(transformWeapon(name, data, file));
        }
      }
    } catch (error) {
      console.warn(`Failed to load weapons from ${file}.lua:`, error);
    }
  }

  // Sort by level requirement, then by name
  allWeapons.sort((a, b) => {
    const levelA = a.requirements.level || 0;
    const levelB = b.requirements.level || 0;
    if (levelA !== levelB) return levelA - levelB;
    return a.name.localeCompare(b.name);
  });

  weaponsCache = allWeapons;
  return allWeapons;
}

/**
 * Gets weapon categories with their weapon types
 */
export async function getWeaponCategories(): Promise<WeaponCategory[]> {
  if (categoriesCache) {
    return categoriesCache;
  }

  const weapons = await loadWeapons();
  const categoryMap = new Map<string, Set<string>>();

  for (const weapon of weapons) {
    const categoryId = weapon.category;
    if (!categoryMap.has(categoryId)) {
      categoryMap.set(categoryId, new Set());
    }
    categoryMap.get(categoryId)!.add(weapon.type);
  }

  const categories: WeaponCategory[] = [];
  for (const [categoryId, types] of Array.from(categoryMap.entries())) {
    categories.push({
      id: categoryId,
      name: WEAPON_FILES[categoryId] || categoryId,
      types: Array.from(types as Set<string>).sort(),
    });
  }

  // Sort categories alphabetically
  categories.sort((a, b) => a.name.localeCompare(b.name));

  categoriesCache = categories;
  return categories;
}

/**
 * Gets weapons filtered by category
 */
export async function getWeaponsByCategory(category: string): Promise<WeaponBase[]> {
  const weapons = await loadWeapons();
  return weapons.filter(w => w.category === category);
}

/**
 * Gets a specific weapon by ID
 */
export async function getWeaponById(id: string): Promise<WeaponBase | undefined> {
  const weapons = await loadWeapons();
  return weapons.find(w => w.id === id);
}

/**
 * Calculates average weapon damage
 */
export function getAverageDamage(weapon: WeaponBase): number {
  let total = (weapon.physicalMin + weapon.physicalMax) / 2;
  if (weapon.fireMin && weapon.fireMax) {
    total += (weapon.fireMin + weapon.fireMax) / 2;
  }
  if (weapon.coldMin && weapon.coldMax) {
    total += (weapon.coldMin + weapon.coldMax) / 2;
  }
  if (weapon.lightningMin && weapon.lightningMax) {
    total += (weapon.lightningMin + weapon.lightningMax) / 2;
  }
  if (weapon.chaosMin && weapon.chaosMax) {
    total += (weapon.chaosMin + weapon.chaosMax) / 2;
  }
  return total;
}

/**
 * Calculates weapon DPS (damage per second)
 */
export function getWeaponDPS(weapon: WeaponBase): number {
  return getAverageDamage(weapon) * weapon.attackRate;
}

/**
 * Clears the weapon cache (useful for reloading)
 */
export function clearWeaponCache(): void {
  weaponsCache = null;
  categoriesCache = null;
}
