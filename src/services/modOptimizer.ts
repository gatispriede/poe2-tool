/**
 * Mod Optimizer Service
 * Calculates optimal mods for weapons and equipment based on build choices
 */

import { WeaponBase } from '../data/weapons';
import { Skill } from '../data/skills';
import {
  ItemMod,
  getWeaponMods,
  filterModsByType,
  getBestTierMod,
  MOD_CATEGORIES,
  WEAPON_WEIGHT_KEYS,
  CASTER_WEAPON_TYPES,
  canModCoexist,
  ELEMENTAL_SPELL_GEM_GROUPS
} from '../data/mods';

export interface OptimizedMods {
  prefixes: ItemMod[];
  suffixes: ItemMod[];
  totalDpsIncrease: number;
  summary: string[];
}

export interface ModScore {
  mod: ItemMod;
  score: number;
  dpsContribution: number;
  reason: string;
}

/**
 * Gets the element type from a skill
 */
function getSkillElement(skill: Skill): string | null {
  return skill.element || null;
}

/**
 * Checks if the skill is a spell
 */
function isSpellSkill(skill: Skill): boolean {
  return skill.gemType === 'Spell';
}

/**
 * Checks if the weapon is a caster weapon
 */
function isCasterWeapon(weapon: WeaponBase): boolean {
  return CASTER_WEAPON_TYPES.includes(weapon.type);
}

/**
 * Checks if a mod is a gem level mod
 */
function isGemLevelMod(mod: ItemMod): boolean {
  return mod.group.includes('SpellSkillGemLevel') || mod.modTags.includes('gem');
}

/**
 * Gets the element-specific gem level group for a skill element
 */
function getElementGemLevelGroup(element: string | null): string | null {
  if (!element) return null;
  const elementMap: Record<string, string> = {
    'fire': MOD_CATEGORIES.FIRE_SPELL_GEM_LEVEL,
    'cold': MOD_CATEGORIES.COLD_SPELL_GEM_LEVEL,
    'lightning': MOD_CATEGORIES.LIGHTNING_SPELL_GEM_LEVEL,
    'chaos': MOD_CATEGORIES.CHAOS_SPELL_GEM_LEVEL,
    'physical': MOD_CATEGORIES.PHYSICAL_SPELL_GEM_LEVEL,
  };
  return elementMap[element] || null;
}

/**
 * Checks if a mod is relevant for a skill's damage type
 */
function isModRelevantForSkill(mod: ItemMod, skill: Skill): boolean {
  const skillElement = getSkillElement(skill);
  const tags = mod.modTags;
  const isSpell = isSpellSkill(skill);

  // For spells, prioritize caster mods
  if (isSpell) {
    // Gem level mods are extremely important for spells
    if (isGemLevelMod(mod)) {
      // Element-specific gem levels are best if they match
      if (skillElement) {
        const elementGemGroup = getElementGemLevelGroup(skillElement);
        if (mod.group === elementGemGroup) {
          return true;
        }
      }
      // Generic spell gem level is always good
      if (mod.group === MOD_CATEGORIES.SPELL_GEM_LEVEL) {
        return true;
      }
    }
    // Caster mods are always relevant for spells
    if (tags.includes('caster') || tags.includes('caster_damage')) {
      return true;
    }
    // Speed mods (cast speed)
    if (tags.includes('speed')) {
      return true;
    }
    // Crit mods for spells
    if (tags.includes('critical')) {
      return true;
    }
    // Element-specific mods for spells
    if (skillElement && tags.includes(skillElement)) {
      return true;
    }
    // Generic damage mods
    if (tags.includes('damage')) {
      return true;
    }
    return false;
  }

  // For attacks
  // Physical damage mods are always relevant for attack skills
  if (tags.includes('physical') || tags.includes('physical_damage')) {
    return true;
  }

  // Element-specific mods
  if (skillElement && tags.includes(skillElement)) {
    return true;
  }

  // Generic damage/attack mods
  if (tags.includes('attack') || tags.includes('damage') || tags.includes('speed') || tags.includes('critical')) {
    return true;
  }

  return false;
}

/**
 * Calculates a DPS contribution score for a mod
 *
 * PoE damage formula basics:
 * - "increased" modifiers are additive with each other
 * - "more" modifiers are multiplicative (gem levels effectively provide "more" damage)
 * - Gem levels increase base damage which is the most impactful
 *
 * Gem level is roughly 10-15% MORE damage per level for most spells
 */
function calculateModDpsContribution(
  mod: ItemMod,
  weapon: WeaponBase,
  skill: Skill
): number {
  const avgValue = (mod.statMin + mod.statMax) / 2;
  let contribution = 0;
  const isSpell = isSpellSkill(skill);
  const skillElement = getSkillElement(skill);

  // Spell damage mods (for spell skills)
  if (isSpell) {
    // Gem level mods are the most valuable - they increase BASE damage
    // Each gem level is roughly 10-15% MORE damage (multiplicative)
    if (isGemLevelMod(mod)) {
      // Element-specific gem levels get bonus if they match the skill
      const elementGemGroup = getElementGemLevelGroup(skillElement);
      if (elementGemGroup && mod.group === elementGemGroup) {
        // Element-specific gem level for matching skill - highest priority
        contribution = avgValue * 15.0; // ~15% more damage per level
      } else if (mod.group === MOD_CATEGORIES.SPELL_GEM_LEVEL) {
        // Generic spell gem level - very high priority
        contribution = avgValue * 12.0; // ~12% more damage per level
      } else {
        // Non-matching element gem level - still useful but lower priority
        contribution = avgValue * 5.0;
      }
      return contribution;
    }

    // Spell damage percent - "increased" modifier (additive with other increased)
    // Value depends on how much increased you already have
    // Assuming ~100% increased from other sources, +100% spell damage is ~50% more DPS
    if (mod.group === MOD_CATEGORIES.SPELL_DAMAGE || mod.group === MOD_CATEGORIES.SPELL_DAMAGE_AND_MANA) {
      contribution = avgValue * 0.5; // Each 1% increased is ~0.5% effective DPS
    }
    // Cast speed - multiplicative with damage (effectively "more")
    else if (mod.group === MOD_CATEGORIES.CAST_SPEED) {
      contribution = avgValue * 1.0; // Each 1% cast speed is ~1% more DPS
    }
    // Spell crit chance - multiplicative benefit
    else if (mod.group === MOD_CATEGORIES.SPELL_CRITICAL_CHANCE) {
      // Assuming 200% crit multi and 10% base crit
      // Each 10% increased crit chance adds ~1% crit, which is ~1% more damage
      contribution = avgValue * 0.1;
    }
    // Spell crit multiplier - multiplicative but depends on crit chance
    else if (mod.group === MOD_CATEGORIES.SPELL_CRITICAL_MULTIPLIER) {
      // Assuming 20% effective crit chance
      contribution = avgValue * 0.2;
    }
    // Mana does NOT contribute to damage - score of 0
    else if (mod.group === MOD_CATEGORIES.MANA) {
      contribution = 0;
    }
    return contribution;
  }

  // Attack skill mods
  // Physical damage percent - major DPS increase
  if (mod.group === MOD_CATEGORIES.PHYSICAL_DAMAGE_PERCENT) {
    // Each 1% physical damage increases DPS by roughly 1%
    contribution = avgValue * 1.0;
  }
  // Added physical damage
  else if (mod.group === MOD_CATEGORIES.ADDED_PHYSICAL_DAMAGE) {
    // Added flat damage contribution depends on attack speed
    contribution = avgValue * weapon.attackRate * 0.8;
  }
  // Attack speed - multiplicative with damage
  else if (mod.group === MOD_CATEGORIES.ATTACK_SPEED) {
    // Each 1% attack speed increases DPS by roughly 1%
    contribution = avgValue * 1.0;
  }
  // Critical chance - significant for crit builds
  else if (mod.group === MOD_CATEGORIES.CRITICAL_CHANCE) {
    // Crit chance has diminishing returns but is valuable
    contribution = avgValue * 2.0; // Assuming crit multi of ~200%
  }
  // Critical multiplier
  else if (mod.group === MOD_CATEGORIES.CRITICAL_MULTIPLIER) {
    // Crit multi is good when you have reasonable crit chance
    contribution = avgValue * (weapon.critChance / 100) * 0.5;
  }
  // Elemental damage mods
  else if (mod.group.includes('AddedFire') || mod.group.includes('AddedCold') || mod.group.includes('AddedLightning')) {
    contribution = avgValue * weapon.attackRate * 0.6;
  }
  // Accuracy - important but diminishing
  else if (mod.group.includes('Accuracy')) {
    contribution = avgValue * 0.05;
  }

  return contribution;
}

/**
 * Scores a mod for weapon optimization
 */
function scoreWeaponMod(
  mod: ItemMod,
  weapon: WeaponBase,
  skill: Skill
): ModScore {
  let score = 0;
  let reason = '';
  const isSpell = isSpellSkill(skill);

  const dpsContribution = calculateModDpsContribution(mod, weapon, skill);
  score += dpsContribution;

  // Bonus for relevance to skill
  if (isModRelevantForSkill(mod, skill)) {
    score *= 1.2;
    reason = `Synergizes with ${skill.name}`;
  }

  // Bonus for higher tier mods
  score += mod.level * 0.1;

  // Prioritize certain mod types based on skill type
  if (isSpell) {
    const skillElement = getSkillElement(skill);
    const elementGemGroup = getElementGemLevelGroup(skillElement);

    // Gem level mods are highest priority for spells
    if (isGemLevelMod(mod)) {
      if (elementGemGroup && mod.group === elementGemGroup) {
        score *= 2.0;
        reason = `+Gem Level (${skillElement}) - Best in slot`;
      } else if (mod.group === MOD_CATEGORIES.SPELL_GEM_LEVEL) {
        score *= 1.8;
        reason = '+Spell Gem Level - Major damage boost';
      }
    }
    // Spell damage and cast speed are good but lower than gem levels
    else if (mod.group === MOD_CATEGORIES.SPELL_DAMAGE || mod.group === MOD_CATEGORIES.SPELL_DAMAGE_AND_MANA) {
      score *= 1.4;
      reason = reason || 'Increased spell damage';
    } else if (mod.group === MOD_CATEGORIES.CAST_SPEED) {
      score *= 1.5;
      reason = reason || 'Cast speed (more multiplier)';
    } else if (mod.group === MOD_CATEGORIES.SPELL_CRITICAL_CHANCE) {
      score *= 1.2;
      reason = reason || 'Spell critical chance';
    } else if (mod.group === MOD_CATEGORIES.SPELL_CRITICAL_MULTIPLIER) {
      score *= 1.1;
      reason = reason || 'Spell critical damage';
    }
  } else {
    // Attack mod priorities
    if (mod.group === MOD_CATEGORIES.PHYSICAL_DAMAGE_PERCENT) {
      score *= 1.5;
      reason = reason || 'Core damage modifier';
    } else if (mod.group === MOD_CATEGORIES.ADDED_PHYSICAL_DAMAGE) {
      score *= 1.4;
      reason = reason || 'Flat damage increase';
    } else if (mod.group === MOD_CATEGORIES.ATTACK_SPEED) {
      score *= 1.3;
      reason = reason || 'Attack speed multiplier';
    }
  }

  return {
    mod,
    score,
    dpsContribution,
    reason: reason || 'General utility',
  };
}

/**
 * Gets optimal weapon mods for a weapon/skill combination
 */
export function getOptimalWeaponMods(
  allMods: ItemMod[],
  weapon: WeaponBase,
  skill: Skill,
  itemLevel: number = 83
): OptimizedMods {
  // Get all mods that can roll on this weapon
  const availableMods = getWeaponMods(allMods, weapon.type, itemLevel);

  const prefixes = filterModsByType(availableMods, 'Prefix');
  const suffixes = filterModsByType(availableMods, 'Suffix');

  // Score all prefixes
  const scoredPrefixes = prefixes.map(mod => scoreWeaponMod(mod, weapon, skill));
  scoredPrefixes.sort((a, b) => b.score - a.score);

  // Score all suffixes
  const scoredSuffixes = suffixes.map(mod => scoreWeaponMod(mod, weapon, skill));
  scoredSuffixes.sort((a, b) => b.score - a.score);

  // Select best 3 prefixes (respecting group constraints and mutual exclusions)
  const selectedPrefixes: ModScore[] = [];

  for (const scored of scoredPrefixes) {
    if (selectedPrefixes.length >= 3) break;
    // Check if this mod can coexist with already selected mods
    if (!canModCoexist(scored.mod, selectedPrefixes.map(s => s.mod))) continue;

    selectedPrefixes.push(scored);
  }

  // Select best 3 suffixes (respecting group constraints and mutual exclusions)
  const selectedSuffixes: ModScore[] = [];
  // Suffixes must also not conflict with prefixes (for cross-slot exclusions if any)
  const allSelectedMods = selectedPrefixes.map(s => s.mod);

  for (const scored of scoredSuffixes) {
    if (selectedSuffixes.length >= 3) break;
    // Check if this mod can coexist with already selected mods (both prefixes and suffixes)
    if (!canModCoexist(scored.mod, [...allSelectedMods, ...selectedSuffixes.map(s => s.mod)])) continue;

    selectedSuffixes.push(scored);
  }

  // Calculate total DPS increase estimate
  const totalDpsIncrease = [
    ...selectedPrefixes,
    ...selectedSuffixes
  ].reduce((sum, s) => sum + s.dpsContribution, 0);

  // Generate summary
  const summary: string[] = [];
  for (const scored of selectedPrefixes) {
    summary.push(`${scored.mod.affix}: ${scored.mod.statText} - ${scored.reason}`);
  }
  for (const scored of selectedSuffixes) {
    summary.push(`${scored.mod.affix}: ${scored.mod.statText} - ${scored.reason}`);
  }

  return {
    prefixes: selectedPrefixes.map(s => s.mod),
    suffixes: selectedSuffixes.map(s => s.mod),
    totalDpsIncrease,
    summary,
  };
}

/**
 * Gets recommended mods for physical damage weapons
 */
export function getPhysicalDamageMods(
  allMods: ItemMod[],
  weaponType: string,
  itemLevel: number = 83
): OptimizedMods {
  const availableMods = getWeaponMods(allMods, weaponType, itemLevel);

  // Priority order for physical builds
  const prefixPriority = [
    MOD_CATEGORIES.PHYSICAL_DAMAGE_PERCENT,
    MOD_CATEGORIES.ADDED_PHYSICAL_DAMAGE,
  ];

  const suffixPriority = [
    MOD_CATEGORIES.ATTACK_SPEED,
    MOD_CATEGORIES.CRITICAL_CHANCE,
    MOD_CATEGORIES.CRITICAL_MULTIPLIER,
  ];

  const selectedPrefixes: ItemMod[] = [];
  const selectedSuffixes: ItemMod[] = [];

  // Select best tier of each priority prefix
  for (const group of prefixPriority) {
    const best = getBestTierMod(
      filterModsByType(availableMods, 'Prefix').filter(m => m.group === group),
      group,
      itemLevel
    );
    if (best) selectedPrefixes.push(best);
  }

  // Select best tier of each priority suffix
  for (const group of suffixPriority) {
    const best = getBestTierMod(
      filterModsByType(availableMods, 'Suffix').filter(m => m.group === group),
      group,
      itemLevel
    );
    if (best) selectedSuffixes.push(best);
  }

  return {
    prefixes: selectedPrefixes.slice(0, 3),
    suffixes: selectedSuffixes.slice(0, 3),
    totalDpsIncrease: 0,
    summary: [],
  };
}

/**
 * Gets recommended mods for elemental damage weapons
 */
export function getElementalDamageMods(
  allMods: ItemMod[],
  weaponType: string,
  element: 'fire' | 'cold' | 'lightning',
  itemLevel: number = 83
): OptimizedMods {
  const availableMods = getWeaponMods(allMods, weaponType, itemLevel);

  // Map element to mod category
  const elementDamageGroup: Record<string, string> = {
    fire: 'LocalAddedFireDamage',
    cold: 'LocalAddedColdDamage',
    lightning: 'LocalAddedLightningDamage',
  };

  const prefixPriority = [
    elementDamageGroup[element],
    MOD_CATEGORIES.ADDED_PHYSICAL_DAMAGE, // Physical still useful
  ];

  const suffixPriority = [
    MOD_CATEGORIES.ATTACK_SPEED,
    MOD_CATEGORIES.CRITICAL_CHANCE,
    MOD_CATEGORIES.CRITICAL_MULTIPLIER,
  ];

  const selectedPrefixes: ItemMod[] = [];
  const selectedSuffixes: ItemMod[] = [];

  // Select best tier of each priority prefix
  for (const group of prefixPriority) {
    const best = getBestTierMod(
      filterModsByType(availableMods, 'Prefix').filter(m => m.group === group),
      group,
      itemLevel
    );
    if (best) selectedPrefixes.push(best);
  }

  // Select best tier of each priority suffix
  for (const group of suffixPriority) {
    const best = getBestTierMod(
      filterModsByType(availableMods, 'Suffix').filter(m => m.group === group),
      group,
      itemLevel
    );
    if (best) selectedSuffixes.push(best);
  }

  return {
    prefixes: selectedPrefixes.slice(0, 3),
    suffixes: selectedSuffixes.slice(0, 3),
    totalDpsIncrease: 0,
    summary: [],
  };
}

/**
 * Gets recommended mods for spell damage caster weapons
 */
export function getSpellDamageMods(
  allMods: ItemMod[],
  weaponType: string,
  itemLevel: number = 83,
  skillElement?: string | null
): OptimizedMods {
  const availableMods = getWeaponMods(allMods, weaponType, itemLevel);

  // Priority order for spell builds
  // Prefixes: Spell damage % is the main prefix option
  const prefixPriority = [
    MOD_CATEGORIES.SPELL_DAMAGE,
    MOD_CATEGORIES.SPELL_DAMAGE_AND_MANA,
  ];

  // Suffixes: Gem levels are most important, then cast speed, then crit
  // Build element-specific suffix priority
  const suffixPriority: string[] = [];

  // Element-specific gem level first if we have an element
  if (skillElement) {
    const elementGemGroup = {
      'fire': MOD_CATEGORIES.FIRE_SPELL_GEM_LEVEL,
      'cold': MOD_CATEGORIES.COLD_SPELL_GEM_LEVEL,
      'lightning': MOD_CATEGORIES.LIGHTNING_SPELL_GEM_LEVEL,
      'chaos': MOD_CATEGORIES.CHAOS_SPELL_GEM_LEVEL,
      'physical': MOD_CATEGORIES.PHYSICAL_SPELL_GEM_LEVEL,
    }[skillElement];
    if (elementGemGroup) {
      suffixPriority.push(elementGemGroup);
    }
  }

  // Then generic spell gem level
  suffixPriority.push(MOD_CATEGORIES.SPELL_GEM_LEVEL);
  // Then cast speed (more multiplier)
  suffixPriority.push(MOD_CATEGORIES.CAST_SPEED);
  // Then crit
  suffixPriority.push(MOD_CATEGORIES.SPELL_CRITICAL_CHANCE);
  suffixPriority.push(MOD_CATEGORIES.SPELL_CRITICAL_MULTIPLIER);

  const selectedPrefixes: ItemMod[] = [];
  const selectedSuffixes: ItemMod[] = [];
  const usedPrefixGroups = new Set<string>();
  const usedSuffixGroups = new Set<string>();

  // Select best tier of each priority prefix
  for (const group of prefixPriority) {
    if (usedPrefixGroups.has(group)) continue;
    const best = getBestTierMod(
      filterModsByType(availableMods, 'Prefix').filter(m => m.group === group),
      group,
      itemLevel
    );
    if (best) {
      selectedPrefixes.push(best);
      usedPrefixGroups.add(best.group);
    }
  }

  // Select best tier of each priority suffix
  for (const group of suffixPriority) {
    if (usedSuffixGroups.has(group)) continue;
    const best = getBestTierMod(
      filterModsByType(availableMods, 'Suffix').filter(m => m.group === group),
      group,
      itemLevel
    );
    if (best) {
      selectedSuffixes.push(best);
      usedSuffixGroups.add(best.group);
    }
  }

  return {
    prefixes: selectedPrefixes.slice(0, 3),
    suffixes: selectedSuffixes.slice(0, 3),
    totalDpsIncrease: 0,
    summary: [],
  };
}

/**
 * Gets all available mod options for manual selection
 */
export function getAvailableModOptions(
  allMods: ItemMod[],
  weaponType: string,
  itemLevel: number = 83
): { prefixes: ItemMod[], suffixes: ItemMod[] } {
  const availableMods = getWeaponMods(allMods, weaponType, itemLevel);

  // Group by mod group and get best tier of each
  const prefixGroups = new Map<string, ItemMod>();
  const suffixGroups = new Map<string, ItemMod>();

  for (const mod of availableMods) {
    const groups = mod.type === 'Prefix' ? prefixGroups : suffixGroups;
    const existing = groups.get(mod.group);

    if (!existing || mod.level > existing.level) {
      groups.set(mod.group, mod);
    }
  }

  return {
    prefixes: Array.from(prefixGroups.values()).sort((a, b) => a.group.localeCompare(b.group)),
    suffixes: Array.from(suffixGroups.values()).sort((a, b) => a.group.localeCompare(b.group)),
  };
}

/**
 * Formats mod stat text for display
 */
export function formatModStatText(mod: ItemMod): string {
  // Replace range format (X-Y) with actual values
  let text = mod.statText;

  if (mod.statMin !== mod.statMax) {
    text = text.replace(/\((\d+)-(\d+)\)/g, `(${mod.statMin}-${mod.statMax})`);
  }

  return text;
}

/**
 * Gets the display color for a mod based on its type
 */
export function getModColor(mod: ItemMod): string {
  if (mod.type === 'Prefix') {
    return '#8888ff'; // Blue-ish for prefixes
  }
  return '#88ff88'; // Green-ish for suffixes
}

/**
 * Calculates estimated DPS with given mods applied to a weapon
 * For spell builds, calculates spell power increase instead of weapon DPS
 */
export function calculateWeaponDpsWithMods(
  weapon: WeaponBase,
  mods: ItemMod[]
): { baseDps: number; modifiedDps: number; increase: number } {
  // Check if this is a caster weapon with spell mods
  const hasSpellMods = mods.some(m =>
    m.group === MOD_CATEGORIES.SPELL_DAMAGE ||
    m.group === MOD_CATEGORIES.SPELL_DAMAGE_AND_MANA ||
    m.group === MOD_CATEGORIES.CAST_SPEED ||
    m.group === MOD_CATEGORIES.SPELL_CRITICAL_CHANCE ||
    m.group === MOD_CATEGORIES.SPELL_CRITICAL_MULTIPLIER
  );

  if (hasSpellMods) {
    return calculateSpellPowerWithMods(mods);
  }

  // Attack weapon DPS calculation
  const baseDps = ((weapon.physicalMin + weapon.physicalMax) / 2) * weapon.attackRate;

  let physicalDamagePercent = 0;
  let addedPhysicalMin = 0;
  let addedPhysicalMax = 0;
  let attackSpeedPercent = 0;
  let critChanceBonus = 0;
  let critMultiBonus = 0;

  for (const mod of mods) {
    const avgValue = (mod.statMin + mod.statMax) / 2;

    if (mod.group === MOD_CATEGORIES.PHYSICAL_DAMAGE_PERCENT) {
      physicalDamagePercent += avgValue;
    } else if (mod.group === MOD_CATEGORIES.ADDED_PHYSICAL_DAMAGE) {
      addedPhysicalMin += mod.statMin;
      addedPhysicalMax += mod.statMax;
    } else if (mod.group === MOD_CATEGORIES.ATTACK_SPEED) {
      attackSpeedPercent += avgValue;
    } else if (mod.group === MOD_CATEGORIES.CRITICAL_CHANCE) {
      critChanceBonus += avgValue;
    } else if (mod.group === MOD_CATEGORIES.CRITICAL_MULTIPLIER) {
      critMultiBonus += avgValue;
    }
  }

  // Calculate modified values
  const modifiedPhysMin = weapon.physicalMin * (1 + physicalDamagePercent / 100) + addedPhysicalMin;
  const modifiedPhysMax = weapon.physicalMax * (1 + physicalDamagePercent / 100) + addedPhysicalMax;
  const modifiedAttackRate = weapon.attackRate * (1 + attackSpeedPercent / 100);
  const modifiedCritChance = Math.min(100, weapon.critChance + critChanceBonus);
  const modifiedCritMulti = 200 + critMultiBonus; // Base crit multi is 200%

  // Calculate DPS with crit factored in
  const avgDamage = (modifiedPhysMin + modifiedPhysMax) / 2;
  const critFactor = 1 + (modifiedCritChance / 100) * ((modifiedCritMulti - 100) / 100);
  const modifiedDps = avgDamage * modifiedAttackRate * critFactor;

  return {
    baseDps,
    modifiedDps,
    increase: ((modifiedDps - baseDps) / baseDps) * 100,
  };
}

/**
 * Calculates spell power increase from mods
 * Uses a base spell power of 100 for relative comparison
 *
 * PoE damage calculation:
 * Final Damage = Base Damage * (1 + sum of "increased") * product of "more" multipliers * crit factor
 *
 * Gem levels increase base damage (~12% per level on average)
 * Spell damage % is "increased" (additive with other sources)
 * Cast speed is effectively "more" (multiplicative)
 */
function calculateSpellPowerWithMods(
  mods: ItemMod[]
): { baseDps: number; modifiedDps: number; increase: number } {
  const baseSpellPower = 100; // Arbitrary base for comparison

  let gemLevels = 0; // Total gem levels added
  let spellDamagePercent = 0; // "increased" damage (additive)
  let castSpeedPercent = 0; // Effectively "more" (multiplicative)
  let spellCritChance = 5; // Base 5% crit chance for spells
  let spellCritMulti = 0;

  for (const mod of mods) {
    const avgValue = (mod.statMin + mod.statMax) / 2;

    // Gem level mods - these increase base damage
    if (isGemLevelMod(mod)) {
      gemLevels += avgValue;
    }
    // Spell damage % - "increased" modifier
    else if (mod.group === MOD_CATEGORIES.SPELL_DAMAGE || mod.group === MOD_CATEGORIES.SPELL_DAMAGE_AND_MANA) {
      spellDamagePercent += avgValue;
    }
    // Cast speed - "more" multiplier
    else if (mod.group === MOD_CATEGORIES.CAST_SPEED) {
      castSpeedPercent += avgValue;
    }
    // Crit chance
    else if (mod.group === MOD_CATEGORIES.SPELL_CRITICAL_CHANCE) {
      // "increased" crit chance, assuming 5% base
      spellCritChance += 5 * (avgValue / 100);
    }
    // Crit multi
    else if (mod.group === MOD_CATEGORIES.SPELL_CRITICAL_MULTIPLIER) {
      spellCritMulti += avgValue;
    }
  }

  // Calculate modified spell power using proper PoE formula:
  // 1. Gem levels increase base damage (~12% per level = 1.12^levels)
  const gemLevelMultiplier = Math.pow(1.12, gemLevels);
  const modifiedBaseDamage = baseSpellPower * gemLevelMultiplier;

  // 2. "increased" damage is additive (assuming ~100% from other sources)
  // Real formula: base * (1 + sum_increased/100)
  // We show just the weapon contribution, so use the raw increased
  const increasedMultiplier = 1 + spellDamagePercent / 100;

  // 3. Cast speed is a "more" multiplier
  const castSpeedMultiplier = 1 + castSpeedPercent / 100;

  // 4. Crit factor
  const modifiedCritChance = Math.min(100, spellCritChance);
  const modifiedCritMulti = 200 + spellCritMulti; // Base crit multi is 200%
  const critFactor = 1 + (modifiedCritChance / 100) * ((modifiedCritMulti - 100) / 100);

  // Final calculation
  const modifiedSpellPower = modifiedBaseDamage * increasedMultiplier * castSpeedMultiplier * critFactor;

  return {
    baseDps: baseSpellPower,
    modifiedDps: modifiedSpellPower,
    increase: ((modifiedSpellPower - baseSpellPower) / baseSpellPower) * 100,
  };
}
