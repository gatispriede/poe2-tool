// Type definitions for POE2 Unique Items and Corruptions

export type UniqueCategory = 'weapon' | 'armour' | 'accessory' | 'offhand' | 'jewel' | 'flask';

export interface UniqueVariant {
  id: number;
  name: string;
  isDefault?: boolean;
}

export interface UniqueMod {
  text: string;
  variantIds?: number[];
  tags?: string[];
  isImplicit: boolean;
}

export interface UniqueItem {
  id: string;
  name: string;
  baseType: string;
  category: UniqueCategory;
  itemClass: string;
  league?: string | null;
  source?: string | null;
  requiresLevel?: number | null;
  variants: UniqueVariant[];
  mods: UniqueMod[];
}

export interface CorruptionMod {
  id: string;
  type: 'Corrupted' | 'SpecialCorrupted';
  stat: string;
  statRange?: {
    min: number;
    max: number;
  } | null;
  level: number;
  group: string | null;
  applicableSlots: string[];
  modTags: string[];
  tradeHash: number | null;
}

// Mapping from item class to corruption slot types
export const ITEM_CLASS_TO_SLOTS: Record<string, string[]> = {
  // Weapons - One Handed
  'One Handed Sword': ['weapon', 'one_hand_weapon'],
  'One Handed Axe': ['weapon', 'one_hand_weapon'],
  'One Handed Mace': ['weapon', 'one_hand_weapon', 'mace'],
  'Claw': ['weapon', 'one_hand_weapon'],
  'Dagger': ['weapon', 'one_hand_weapon'],
  'Wand': ['weapon', 'one_hand_weapon', 'wand'],
  'Sceptre': ['weapon', 'one_hand_weapon', 'sceptre'],
  'Spear': ['weapon', 'one_hand_weapon'],
  'Flail': ['weapon', 'one_hand_weapon'],
  // Weapons - Two Handed
  'Two Handed Sword': ['weapon', 'two_hand_weapon'],
  'Two Handed Axe': ['weapon', 'two_hand_weapon'],
  'Two Handed Mace': ['weapon', 'two_hand_weapon', 'mace', 'warstaff'],
  'Staff': ['weapon', 'two_hand_weapon', 'staff'],
  'Bow': ['weapon', 'two_hand_weapon', 'bow'],
  'Crossbow': ['weapon', 'two_hand_weapon', 'crossbow'],
  // Weapons - Generic
  'Sword': ['weapon', 'one_hand_weapon'],
  'Axe': ['weapon', 'one_hand_weapon'],
  'Mace': ['weapon', 'one_hand_weapon', 'mace'],
  'Fishing Rod': ['weapon'],
  // Armour
  'Body Armour': ['body_armour', 'str_armour', 'dex_armour', 'int_armour', 'str_dex_armour', 'str_int_armour', 'dex_int_armour', 'armour'],
  'Helmet': ['helmet'],
  'Gloves': ['gloves'],
  'Boots': ['boots'],
  // Accessories
  'Amulet': ['amulet'],
  'Belt': ['belt'],
  'Ring': ['ring'],
  // Offhand
  'Shield': ['shield'],
  'Focus': ['focus'],
  'Quiver': ['quiver'],
  'Trap Tool': [],
  // Other
  'Jewel': ['jewel'],
  'Soulcore': ['jewel'],
  'Flask': ['flask'],
  'Tincture': [],
};

// Get all applicable corruption slots for an item class
export function getCorruptionSlotsForItemClass(itemClass: string): string[] {
  return ITEM_CLASS_TO_SLOTS[itemClass] || [];
}

// Check if a corruption can apply to an item class
export function canCorruptionApplyToItemClass(corruption: CorruptionMod, itemClass: string): boolean {
  const slots = getCorruptionSlotsForItemClass(itemClass);
  return corruption.applicableSlots.some(slot => slots.includes(slot));
}

// Unique item colors (POE conventions)
export const UNIQUE_COLORS = {
  uniqueName: '#af6025',      // Orange unique item name
  corruptedMod: '#d46bff',    // Purple corrupted mods
  implicitMod: '#4CAF50',     // Green implicit mods
  explicitMod: '#8888FF',     // Blue explicit mods
  flavorText: '#7f7f7f',      // Gray flavor text
  requirement: '#c8c8c8',     // Light gray requirements
};

// League colors
export const LEAGUE_COLORS: Record<string, string> = {
  'Dawn of the Hunt': '#5c9e5c',
  'Rise of the Abyssal': '#6666cc',
};
