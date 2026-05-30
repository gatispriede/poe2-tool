/**
 * Item Modifier Data Types and Loader
 * Parses ModItem.lua from PoB data
 */

import { fetchLuaFile, parseStatRange } from './pobParser';

export interface ItemMod {
  id: string;
  type: 'Prefix' | 'Suffix';
  affix: string;
  statText: string;
  statMin: number;
  statMax: number;
  level: number;
  group: string;
  weightKey: string[];
  weightVal: number[];
  modTags: string[];
  statOrder: number;
}

/**
 * Maps weapon types to their weightKey values
 * Keys must be lowercase to match Lua mod data weightKeys
 */
export const WEAPON_WEIGHT_KEYS: Record<string, string[]> = {
  'One Handed Mace': ['mace', 'one_hand_weapon', 'weapon'],
  'Two Handed Mace': ['mace', 'two_hand_weapon', 'weapon'],
  'One Handed Sword': ['sword', 'one_hand_weapon', 'weapon'],
  'Two Handed Sword': ['sword', 'two_hand_weapon', 'weapon'],
  'One Handed Axe': ['axe', 'one_hand_weapon', 'weapon'],
  'Two Handed Axe': ['axe', 'two_hand_weapon', 'weapon'],
  'Bow': ['bow', 'ranged', 'two_hand_weapon', 'weapon'],
  'Claw': ['claw', 'one_hand_weapon', 'weapon'],
  'Dagger': ['dagger', 'one_hand_weapon', 'weapon'],
  'Flail': ['flail', 'one_hand_weapon', 'weapon'],
  'Spear': ['spear', 'one_hand_weapon', 'weapon'],
  'Staff': ['staff', 'two_hand_weapon', 'weapon'],
  'Warstaff': ['warstaff', 'staff', 'two_hand_weapon', 'weapon'],
  'Quarterstaff': ['quarterstaff', 'staff', 'two_hand_weapon', 'weapon'],
  'Wand': ['wand', 'one_hand_weapon', 'weapon'],
  'Sceptre': ['sceptre', 'one_hand_weapon', 'weapon'],
  'Crossbow': ['crossbow', 'ranged', 'two_hand_weapon', 'weapon'],
};

/**
 * Caster weapon types that use spell mods
 */
export const CASTER_WEAPON_TYPES = ['Staff', 'Wand', 'Sceptre'];

/**
 * Elemental spell gem level mod groups - these are mutually exclusive
 * You can only have ONE element's spell gem level mods on a weapon
 */
export const ELEMENTAL_SPELL_GEM_GROUPS = [
  'GlobalIncreaseFireSpellSkillGemLevelWeapon',
  'GlobalIncreaseColdSpellSkillGemLevelWeapon',
  'GlobalIncreaseLightningSpellSkillGemLevelWeapon',
  'GlobalIncreaseChaosSpellSkillGemLevelWeapon',
  'GlobalIncreasePhysicalSpellSkillGemLevelWeapon',
];

/**
 * Checks if two mods are mutually exclusive (can't coexist on same item)
 */
export function areModsMutuallyExclusive(mod1: ItemMod, mod2: ItemMod): boolean {
  // Same group = mutually exclusive
  if (mod1.group === mod2.group) {
    return true;
  }

  // Elemental spell gem level mods are mutually exclusive with each other
  const isElementalGem1 = ELEMENTAL_SPELL_GEM_GROUPS.includes(mod1.group);
  const isElementalGem2 = ELEMENTAL_SPELL_GEM_GROUPS.includes(mod2.group);
  if (isElementalGem1 && isElementalGem2) {
    return true;
  }

  return false;
}

/**
 * Checks if a mod can coexist with a set of already selected mods
 */
export function canModCoexist(mod: ItemMod, selectedMods: ItemMod[]): boolean {
  for (const selected of selectedMods) {
    if (areModsMutuallyExclusive(mod, selected)) {
      return false;
    }
  }
  return true;
}

/**
 * Equipment slot to weightKey mapping
 */
export const EQUIPMENT_WEIGHT_KEYS: Record<string, string[]> = {
  'helmet': ['helmet', 'armour'],
  'body_armour': ['body_armour', 'armour'],
  'gloves': ['gloves', 'armour'],
  'boots': ['boots', 'armour'],
  'belt': ['belt'],
  'amulet': ['amulet'],
  'ring': ['ring'],
  'quiver': ['quiver'],
  'shield': ['shield', 'armour'],
  // Armor type specific
  'str_armour': ['str_armour', 'armour'],
  'dex_armour': ['dex_armour', 'armour'],
  'int_armour': ['int_armour', 'armour'],
  'str_dex_armour': ['str_dex_armour', 'armour'],
  'str_int_armour': ['str_int_armour', 'armour'],
  'dex_int_armour': ['dex_int_armour', 'armour'],
  'str_dex_int_armour': ['str_dex_int_armour', 'armour'],
};

// Cache for loaded mods
let modsCache: ItemMod[] | null = null;

/**
 * Parses the ModItem.lua file content to extract mods
 */
function parseModItemLua(content: string): ItemMod[] {
  const mods: ItemMod[] = [];

  // Split content into lines for easier processing (file uses single-line format)
  const lines = content.split('\n');

  for (const line of lines) {
    // Match mod entries: ["ModId"] = { ... },
    const match = line.match(/^\s*\["([^"]+)"\]\s*=\s*\{(.+)\},?\s*$/);
    if (!match) continue;

    const modId = match[1];
    const modContent = match[2];

    try {
      const mod = parseModEntry(modId, modContent);
      if (mod) {
        mods.push(mod);
      }
    } catch (e) {
      // Skip malformed entries
    }
  }

  console.log(`Parsed ${mods.length} mods from ModItem.lua`);
  return mods;
}

/**
 * Parses a single mod entry
 */
function parseModEntry(id: string, content: string): ItemMod | null {
  // Extract type
  const typeMatch = content.match(/type\s*=\s*"(Prefix|Suffix)"/);
  if (!typeMatch) return null;

  // Extract affix
  const affixMatch = content.match(/affix\s*=\s*"([^"]+)"/);

  // Extract stat text (quoted string that describes the stat)
  const statTextMatch = content.match(/"([+-]?\([^)]+\)[^"]*|[+-]?\d+[^"]+)"/);

  // Extract level
  const levelMatch = content.match(/level\s*=\s*(\d+)/);

  // Extract group
  const groupMatch = content.match(/group\s*=\s*"([^"]+)"/);

  // Extract statOrder
  const statOrderMatch = content.match(/statOrder\s*=\s*\{\s*(\d+)/);

  // Extract weightKey array
  const weightKeyMatch = content.match(/weightKey\s*=\s*\{([^}]+)\}/);
  const weightKey: string[] = [];
  if (weightKeyMatch) {
    const keyContent = weightKeyMatch[1];
    const keyPattern = /"([^"]+)"/g;
    let keyMatch;
    while ((keyMatch = keyPattern.exec(keyContent)) !== null) {
      weightKey.push(keyMatch[1]);
    }
  }

  // Extract weightVal array
  const weightValMatch = content.match(/weightVal\s*=\s*\{([^}]+)\}/);
  const weightVal: number[] = [];
  if (weightValMatch) {
    const valContent = weightValMatch[1];
    const valPattern = /(\d+)/g;
    let valMatch;
    while ((valMatch = valPattern.exec(valContent)) !== null) {
      weightVal.push(parseInt(valMatch[1]));
    }
  }

  // Extract modTags array
  const modTagsMatch = content.match(/modTags\s*=\s*\{([^}]+)\}/);
  const modTags: string[] = [];
  if (modTagsMatch) {
    const tagsContent = modTagsMatch[1];
    const tagPattern = /"([^"]+)"/g;
    let tagMatch;
    while ((tagMatch = tagPattern.exec(tagsContent)) !== null) {
      modTags.push(tagMatch[1]);
    }
  }

  const statText = statTextMatch ? statTextMatch[1] : '';
  const statRange = parseStatRange(statText);

  return {
    id,
    type: typeMatch[1] as 'Prefix' | 'Suffix',
    affix: affixMatch ? affixMatch[1] : '',
    statText,
    statMin: statRange?.min || 0,
    statMax: statRange?.max || 0,
    level: levelMatch ? parseInt(levelMatch[1]) : 1,
    group: groupMatch ? groupMatch[1] : id,
    weightKey,
    weightVal,
    modTags,
    statOrder: statOrderMatch ? parseInt(statOrderMatch[1]) : 0,
  };
}

/**
 * Loads all item mods from PoB data
 */
export async function loadMods(): Promise<ItemMod[]> {
  if (modsCache) {
    return modsCache;
  }

  try {
    const content = await fetchLuaFile('ModItem.lua');
    modsCache = parseModItemLua(content);
    console.log(`Loaded ${modsCache.length} item mods`);
    return modsCache;
  } catch (error) {
    console.error('Failed to load mods:', error);
    throw error;
  }
}

/**
 * Gets mods that can roll on a specific item type
 */
export function getModsForItemType(
  mods: ItemMod[],
  weightKeys: string[],
  itemLevel: number = 83
): ItemMod[] {
  return mods.filter(mod => {
    // Check item level requirement
    if (mod.level > itemLevel) return false;

    // Check if any weightKey matches with non-zero weight
    for (let i = 0; i < mod.weightKey.length; i++) {
      if (weightKeys.includes(mod.weightKey[i]) && mod.weightVal[i] > 0) {
        return true;
      }
    }

    return false;
  });
}

/**
 * Gets weapon mods for a specific weapon type
 */
export function getWeaponMods(
  mods: ItemMod[],
  weaponType: string,
  itemLevel: number = 83
): ItemMod[] {
  const weightKeys = WEAPON_WEIGHT_KEYS[weaponType] || ['weapon'];
  return getModsForItemType(mods, weightKeys, itemLevel);
}

/**
 * Gets equipment mods for a specific slot
 */
export function getEquipmentMods(
  mods: ItemMod[],
  slot: string,
  armorType?: string,
  itemLevel: number = 83
): ItemMod[] {
  let weightKeys = EQUIPMENT_WEIGHT_KEYS[slot] || [];

  // Add armor type if specified
  if (armorType && EQUIPMENT_WEIGHT_KEYS[armorType]) {
    weightKeys = [...weightKeys, ...EQUIPMENT_WEIGHT_KEYS[armorType]];
  }

  return getModsForItemType(mods, weightKeys, itemLevel);
}

/**
 * Filters mods by type (Prefix or Suffix)
 */
export function filterModsByType(mods: ItemMod[], type: 'Prefix' | 'Suffix'): ItemMod[] {
  return mods.filter(mod => mod.type === type);
}

/**
 * Gets the best tier of a mod (highest level within item level constraint)
 */
export function getBestTierMod(
  mods: ItemMod[],
  group: string,
  itemLevel: number = 83
): ItemMod | null {
  const groupMods = mods
    .filter(mod => mod.group === group && mod.level <= itemLevel)
    .sort((a, b) => b.level - a.level);

  return groupMods[0] || null;
}

/**
 * Gets all mod groups available for an item type
 */
export function getModGroups(mods: ItemMod[]): { prefixGroups: string[], suffixGroups: string[] } {
  const prefixGroups = new Set<string>();
  const suffixGroups = new Set<string>();

  for (const mod of mods) {
    if (mod.type === 'Prefix') {
      prefixGroups.add(mod.group);
    } else {
      suffixGroups.add(mod.group);
    }
  }

  return {
    prefixGroups: Array.from(prefixGroups),
    suffixGroups: Array.from(suffixGroups),
  };
}

/**
 * Mod categories for prioritization
 */
export const MOD_CATEGORIES = {
  // Weapon damage mods (Physical/Attack)
  PHYSICAL_DAMAGE_PERCENT: 'LocalPhysicalDamagePercent',
  ADDED_PHYSICAL_DAMAGE: 'LocalPhysicalDamage',
  ADDED_FIRE_DAMAGE: 'LocalAddedFireDamage',
  ADDED_COLD_DAMAGE: 'LocalAddedColdDamage',
  ADDED_LIGHTNING_DAMAGE: 'LocalAddedLightningDamage',
  ADDED_CHAOS_DAMAGE: 'LocalAddedChaosDamage',

  // Weapon utility mods (Attack)
  ATTACK_SPEED: 'LocalIncreasedAttackSpeed',
  CRITICAL_CHANCE: 'LocalBaseCriticalStrikeChance',
  CRITICAL_MULTIPLIER: 'LocalCriticalStrikeMultiplier',
  ACCURACY: 'LocalAccuracyRating',

  // Spell damage mods (Caster)
  SPELL_DAMAGE: 'WeaponSpellDamage',
  SPELL_DAMAGE_AND_MANA: 'WeaponSpellDamageAndMana',
  CAST_SPEED: 'IncreasedCastSpeed',
  SPELL_CRITICAL_CHANCE: 'SpellCriticalStrikeChance',
  SPELL_CRITICAL_MULTIPLIER: 'SpellCriticalStrikeMultiplier',

  // Spell gem level mods (most important for spell damage)
  SPELL_GEM_LEVEL: 'GlobalIncreaseSpellSkillGemLevelWeapon',
  FIRE_SPELL_GEM_LEVEL: 'GlobalIncreaseFireSpellSkillGemLevelWeapon',
  COLD_SPELL_GEM_LEVEL: 'GlobalIncreaseColdSpellSkillGemLevelWeapon',
  LIGHTNING_SPELL_GEM_LEVEL: 'GlobalIncreaseLightningSpellSkillGemLevelWeapon',
  CHAOS_SPELL_GEM_LEVEL: 'GlobalIncreaseChaosSpellSkillGemLevelWeapon',
  PHYSICAL_SPELL_GEM_LEVEL: 'GlobalIncreasePhysicalSpellSkillGemLevelWeapon',

  // Defensive mods
  LIFE: 'IncreasedLife',
  MANA: 'IncreasedMana',
  ENERGY_SHIELD: 'EnergyShield',
  ARMOUR: 'LocalPhysicalDamageReductionRating',
  EVASION: 'LocalEvasionRating',

  // Resistance mods
  FIRE_RESISTANCE: 'FireResistance',
  COLD_RESISTANCE: 'ColdResistance',
  LIGHTNING_RESISTANCE: 'LightningResistance',
  CHAOS_RESISTANCE: 'ChaosResistance',
  ALL_RESISTANCES: 'AllResistances',

  // Attribute mods
  STRENGTH: 'Strength',
  DEXTERITY: 'Dexterity',
  INTELLIGENCE: 'Intelligence',
  ALL_ATTRIBUTES: 'AllAttributes',
};
