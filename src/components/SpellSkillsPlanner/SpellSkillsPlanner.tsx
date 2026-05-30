import React, { useState, useEffect, useMemo, useRef } from 'react';
import { SciChartSurface } from 'scichart/Charting/Visuals/SciChartSurface';
import { NumericAxis } from 'scichart/Charting/Visuals/Axis/NumericAxis';
import { FastColumnRenderableSeries } from 'scichart/Charting/Visuals/RenderableSeries/FastColumnRenderableSeries';
import { XyDataSeries } from 'scichart/Charting/Model/XyDataSeries';
import { GradientParams } from 'scichart/Core/GradientParams';
import { Point } from 'scichart/Core/Point';
import { NumberRange } from 'scichart/Core/NumberRange';
import { EAxisAlignment } from 'scichart/types/AxisAlignment';
import PassiveTreeOptimizerComponent from './PassiveTreeOptimizer';

// Interfaces
interface BaseDamageData {
  baseMultiplier?: number;
  baseMultiplierLvl20?: number;
  critChance?: number;
  attackSpeedMultiplier?: number;
}

interface Skill {
  id: string;
  name: string;
  description: string;
  fullDescription?: string;
  gemType: string;
  type: string;
  element: string | null;
  tags: string[];
  tagString: string;
  weaponRequirements: string | null;
  requirements: { str: number; dex: number; int: number };
  tier: number;
  moreDamageMultipliersPct: number[];
  moreAttackSpeedMultipliersPct: number[];
  baseDamageData?: BaseDamageData;
  estimatedBaseDamageLvl1?: number;
  estimatedBaseDamageLvl20?: number;
  minDamageLvl1?: number;
  maxDamageLvl1?: number;
  minDamageLvl20?: number;
  maxDamageLvl20?: number;
  damageTypes?: string[];
  baseEffectiveness?: number;
  incrementalEffectiveness?: number;
  levelDamageData?: Record<string, Record<string, { min: number; max: number }>>;
  castTime?: number;
  isTrigger?: boolean;
  supportFamily?: string | null;
}

interface WeaponDamage {
  physical: { min: number; max: number };
  fire: { min: number; max: number };
  cold: { min: number; max: number };
  lightning: { min: number; max: number };
  chaos: { min: number; max: number };
}

interface Weapon {
  id: string;
  name: string;
  category: string;
  type: string;
  implicit: string | null;
  damage: WeaponDamage;
  critChance: number;
  attackRate: number;
  range: number;
  requirements: { level: number; str: number; dex: number; int: number };
  dps: { physical: number; elemental: number; chaos: number; total: number };
}

interface WeaponMod {
  id: string;
  type: 'Prefix' | 'Suffix';
  affix: string;
  level: number;
  group: string | null;
  stats: string[];
  category: string;
  applicableWeapons: string[];
}

interface WeaponModsData {
  prefixes: WeaponMod[];
  suffixes: WeaponMod[];
}

// Helper to get skill damage at specific level (with interpolation)
const getSkillDamageAtLevel = (skill: Skill, level: number): { min: number; max: number } => {
  const effectiveLevel = Math.max(1, Math.min(level, 30)); // Cap at reasonable range

  // If we have exact level data, use it
  if (skill.levelDamageData && skill.levelDamageData[effectiveLevel.toString()]) {
    const dmgData = skill.levelDamageData[effectiveLevel.toString()];
    const damageType = skill.damageTypes?.[0] || 'Fire'; // Default to first damage type
    if (dmgData[damageType]) {
      return dmgData[damageType];
    }
  }

  // Interpolate between level 1 and level 20
  if (skill.minDamageLvl1 !== undefined && skill.minDamageLvl20 !== undefined &&
      skill.maxDamageLvl1 !== undefined && skill.maxDamageLvl20 !== undefined) {
    const ratio = (effectiveLevel - 1) / 19; // 0 at level 1, 1 at level 20
    const min = skill.minDamageLvl1 + (skill.minDamageLvl20 - skill.minDamageLvl1) * ratio;
    const max = skill.maxDamageLvl1 + (skill.maxDamageLvl20 - skill.maxDamageLvl1) * ratio;
    return { min, max };
  }

  // Fallback to level 20 or level 1
  if (skill.minDamageLvl20 !== undefined && skill.maxDamageLvl20 !== undefined) {
    return { min: skill.minDamageLvl20, max: skill.maxDamageLvl20 };
  }
  if (skill.minDamageLvl1 !== undefined && skill.maxDamageLvl1 !== undefined) {
    return { min: skill.minDamageLvl1, max: skill.maxDamageLvl1 };
  }

  // Last resort: use estimated values
  const baseDmg = skill.estimatedBaseDamageLvl20 || skill.estimatedBaseDamageLvl1 || 100;
  return { min: baseDmg * 0.9, max: baseDmg * 1.1 };
};

// Helper to get skill damage (average) - now uses level
const getSkillBaseDamage = (skill: Skill, level: number = 20): number => {
  const dmgRange = getSkillDamageAtLevel(skill, level);
  return (dmgRange.min + dmgRange.max) / 2;
};

// Helper to get skill min/max damage (backward compatibility)
const getSkillDamageRange = (skill: Skill): { min: number; max: number } => {
  return getSkillDamageAtLevel(skill, 20); // Default to level 20
};

// Parse mod value from stat string
const parseModValue = (stat: string): { min: number; max: number; type: string } | null => {
  const rangeMatch = stat.match(/\((\d+(?:\.\d+)?)-(\d+(?:\.\d+)?)\)/);
  const plusMatch = stat.match(/\+(\d+(?:\.\d+)?)/);

  let min = 0, max = 0;
  if (rangeMatch) {
    min = parseFloat(rangeMatch[1]);
    max = parseFloat(rangeMatch[2]);
  } else if (plusMatch) {
    min = max = parseFloat(plusMatch[1]);
  }
  
  let type = 'other';
  const lowerStat = stat.toLowerCase();
  if (lowerStat.includes('spell damage') && lowerStat.includes('increased')) type = 'spellPercent';
  else if (lowerStat.includes('fire damage') && lowerStat.includes('spell')) type = 'spellFire';
  else if (lowerStat.includes('cold damage') && lowerStat.includes('spell')) type = 'spellCold';
  else if (lowerStat.includes('lightning damage') && lowerStat.includes('spell')) type = 'spellLightning';
  else if (lowerStat.includes('chaos damage') && lowerStat.includes('spell')) type = 'spellChaos';
  else if (lowerStat.includes('cast speed')) type = 'castSpeed';
  else if ((lowerStat.includes('critical hit chance') || lowerStat.includes('critical strike chance')) && lowerStat.includes('spell')) type = 'spellCritChance';
  else if (lowerStat.includes('critical damage bonus') || lowerStat.includes('critical strike multiplier')) type = 'critMulti';
  else if (lowerStat.includes('fire damage')) type = 'fire';
  else if (lowerStat.includes('cold damage')) type = 'cold';
  else if (lowerStat.includes('lightning damage')) type = 'lightning';
  else if (lowerStat.includes('elemental damage')) type = 'elemental';
  else if (lowerStat.includes('spell damage')) type = 'spellPercent';
  
  return { min, max, type };
};


// Calculate spell DPS with mods
const calculateSpellDps = (
  skill: Skill,
  weapon: Weapon | null,
  prefixes: WeaponMod[],
  suffixes: WeaponMod[],
  bonusCritMult: number = 0,
  bonusCrit: number = 0,
  bonusCast: number = 0,
  supportMoreDamage: number = 0,
  supportMoreSpeed: number = 0,
  passiveStats: any = null,
  skillLevel: number = 20,
  additionalLevels: number = 0
): number => {
  const breakdown = getSpellDpsBreakdown(skill, weapon, prefixes, suffixes, bonusCritMult, bonusCrit, bonusCast, supportMoreDamage, supportMoreSpeed, passiveStats, skillLevel, additionalLevels);
  return breakdown.finalDps;
};

// Get detailed breakdown of spell DPS calculation
interface SpellDpsBreakdown {
  // Weapon base damage
  weaponPhysicalDamage: number;
  weaponElementalDamage: number;
  weaponTotalDamage: number;
  // Skill multiplier
  skillBaseMultiplier: number;
  // Converted weapon damage
  convertedWeaponDamage: number;
  // Skill base damage (if any)
  skillBaseDamage: number;
  skillMinDamage: number;
  skillMaxDamage: number;
  // Total base before mods
  totalBaseDamage: number;
  // Mod bonuses
  spellDamagePercent: number;
  elementalPercent: number;
  addedDamage: number;
  physicalDamagePercent: number;
  // Final damage
  totalDamageMultiplier: number;
  finalDamage: number;
  // Speed
  castSpeedPercent: number;
  baseCastSpeed: number;
  finalCastSpeed: number;
  // Crit
  critChanceAdd: number;
  baseCritChance: number;
  finalCritChance: number;
  effectiveCritMult: number;
  // Support skill multipliers
  supportMoreDamage: number;
  supportMoreSpeed: number;
  supportDamageMultiplier: number;
  supportSpeedMultiplier: number;
  // Final DPS
  finalDps: number;
}

const getSpellDpsBreakdown = (
  skill: Skill,
  weapon: Weapon | null,
  prefixes: WeaponMod[],
  suffixes: WeaponMod[],
  bonusCritMult: number = 0,
  bonusCrit: number = 0,
  bonusCast: number = 0,
  supportMoreDamage: number = 0,
  supportMoreSpeed: number = 0,
  passiveStats: any = null,
  skillLevel: number = 20,
  additionalLevels: number = 0
): SpellDpsBreakdown => {
  // Calculate effective skill level (base + additional from gear/mods)
  const effectiveSkillLevel = skillLevel + additionalLevels;

  // Get skill's base damage multiplier (for weapon damage conversion)
  const skillBaseMultiplier = skill.baseDamageData?.baseMultiplierLvl20 || skill.baseDamageData?.baseMultiplier || 0;

  // Get skill's own base damage using accurate min/max from PoB data at effective level
  const damageRange = getSkillDamageAtLevel(skill, effectiveSkillLevel);
  const skillMinDamage = damageRange.min;
  const skillMaxDamage = damageRange.max;
  const skillBaseDamage = (skillMinDamage + skillMaxDamage) / 2;

  // Calculate weapon damage
  let weaponPhysicalDamage = 0;
  let weaponElementalDamage = 0;

  if (weapon) {
    weaponPhysicalDamage = (weapon.damage.physical.min + weapon.damage.physical.max) / 2;
    weaponElementalDamage =
      (weapon.damage.fire.min + weapon.damage.fire.max) / 2 +
      (weapon.damage.cold.min + weapon.damage.cold.max) / 2 +
      (weapon.damage.lightning.min + weapon.damage.lightning.max) / 2 +
      (weapon.damage.chaos.min + weapon.damage.chaos.max) / 2;
  }

  const weaponTotalDamage = weaponPhysicalDamage + weaponElementalDamage;

  // Parse mod bonuses
  let spellDamagePercent = 0;
  let elementalPercent = 0;
  let castSpeedPercent = bonusCast;
  let critChanceAdd = bonusCrit;
  let addedDamage = 0;
  let physicalDamagePercent = 0;
  let addedPhysicalMin = 0;
  let addedPhysicalMax = 0;

  // Add passive tree bonuses if available
  if (passiveStats) {
    spellDamagePercent += passiveStats.increasedSpellDamagePct || 0;
    spellDamagePercent += passiveStats.increasedDamagePct || 0;
    elementalPercent += passiveStats.increasedElementalDamagePct || 0;
    castSpeedPercent += passiveStats.increasedCastSpeedPct || 0;
    critChanceAdd += passiveStats.increasedSpellCritChancePct || 0;
    critChanceAdd += passiveStats.increasedCritChancePct || 0;
    bonusCritMult += passiveStats.increasedSpellCritMultiplierPct || 0;
    bonusCritMult += passiveStats.increasedCritMultiplierPct || 0;
    addedDamage += passiveStats.addedSpellDamage || 0;

    // Element-specific bonuses based on skill element
    if (skill.element === 'Fire') {
      elementalPercent += passiveStats.increasedFireDamagePct || 0;
    } else if (skill.element === 'Cold') {
      elementalPercent += passiveStats.increasedColdDamagePct || 0;
    } else if (skill.element === 'Lightning') {
      elementalPercent += passiveStats.increasedLightningDamagePct || 0;
    } else if (skill.element === 'Chaos') {
      spellDamagePercent += passiveStats.increasedChaosDamagePct || 0;
    } else if (skill.element === 'Physical') {
      physicalDamagePercent += passiveStats.increasedPhysicalDamagePct || 0;
    }

    // Area and Projectile damage if applicable
    if (skill.tags.includes('area') || skill.tags.includes('Area')) {
      spellDamagePercent += passiveStats.increasedAreaDamagePct || 0;
    }
    if (skill.tags.includes('projectile') || skill.tags.includes('Projectile')) {
      spellDamagePercent += passiveStats.increasedProjectileDamagePct || 0;
    }
  }

  [...prefixes, ...suffixes].forEach(mod => {
    mod.stats.forEach(stat => {
      const parsed = parseModValue(stat);
      if (!parsed) return;
      
      const avgValue = (parsed.min + parsed.max) / 2;
      
      switch (parsed.type) {
        case 'spellPercent':
          spellDamagePercent += avgValue;
          break;
        case 'elemental':
          elementalPercent += avgValue;
          break;
        case 'castSpeed':
          castSpeedPercent += avgValue;
          break;
        case 'spellCritChance':
        case 'critChance':
          critChanceAdd += avgValue;
          break;
        case 'spellFire':
        case 'spellCold':
        case 'spellLightning':
        case 'spellChaos':
        case 'fire':
        case 'cold':
        case 'lightning':
          addedDamage += avgValue;
          break;
        case 'physPercent':
          physicalDamagePercent += avgValue;
          break;
        case 'physFlat':
          addedPhysicalMin += parsed.min;
          addedPhysicalMax += parsed.max;
          break;
      }
    });
  });
  
  // Calculate modified weapon physical damage (with flat and % mods)
  const modifiedWeaponPhysical = weapon
    ? ((weapon.damage.physical.min + addedPhysicalMin + weapon.damage.physical.max + addedPhysicalMax) / 2) * (1 + physicalDamagePercent / 100)
    : 0;

  // Convert weapon damage to spell base using skill multiplier
  // If skill has a baseMultiplier, use weapon damage; otherwise use skill's own base damage
  const convertedWeaponDamage = skillBaseMultiplier > 0
    ? (modifiedWeaponPhysical + weaponElementalDamage) * skillBaseMultiplier
    : 0;

  // Total base damage: skill's own damage + converted weapon damage + added damage
  const totalBaseDamage = skillBaseDamage + convertedWeaponDamage;

  // Apply spell damage multiplier
  const totalDamageMultiplier = 1 + (spellDamagePercent + elementalPercent) / 100;
  const finalDamage = (totalBaseDamage + addedDamage) * totalDamageMultiplier;

  // Cast speed
  const baseCastSpeed = skill.castTime ? 1 / skill.castTime : 1;
  const finalCastSpeed = baseCastSpeed * (1 + castSpeedPercent / 100);

  // Critical strike
  const baseCritChance = skill.baseDamageData?.critChance || (weapon?.critChance) || 5;
  const finalCritChance = Math.min(100, baseCritChance + critChanceAdd);
  const baseCritMultiplier = 1.5 + bonusCritMult / 100;
  const effectiveCritMult = 1 + (finalCritChance / 100) * (baseCritMultiplier - 1);

  // Support skill multipliers (more damage is multiplicative)
  const supportDamageMultiplier = 1 + supportMoreDamage / 100;
  const supportSpeedMultiplier = 1 + supportMoreSpeed / 100;

  // Final DPS with support multipliers
  const finalDps = finalDamage * finalCastSpeed * supportSpeedMultiplier * effectiveCritMult * supportDamageMultiplier;

  return {
    weaponPhysicalDamage,
    weaponElementalDamage,
    weaponTotalDamage,
    skillBaseMultiplier,
    convertedWeaponDamage,
    skillBaseDamage,
    skillMinDamage,
    skillMaxDamage,
    totalBaseDamage,
    spellDamagePercent,
    elementalPercent,
    addedDamage,
    physicalDamagePercent,
    totalDamageMultiplier,
    finalDamage,
    castSpeedPercent,
    baseCastSpeed,
    finalCastSpeed,
    critChanceAdd,
    baseCritChance,
    finalCritChance,
    effectiveCritMult,
    supportMoreDamage,
    supportMoreSpeed,
    supportDamageMultiplier,
    supportSpeedMultiplier,
    finalDps
  };
};

// Generate spell mod combinations
interface ModCombination {
  name: string;
  dps: number;
  prefixes: WeaponMod[];
  suffixes: WeaponMod[];
}

// Calculate damage contribution of a single mod
const calculateModDpsContribution = (
  skill: Skill,
  weapon: Weapon | null,
  mod: WeaponMod,
  baseDps: number,
  bonusCritMult: number,
  bonusCrit: number,
  bonusCast: number,
  supportMoreDamage: number = 0,
  supportMoreSpeed: number = 0,
  passiveStats: any = null,
  skillLevel: number = 20,
  additionalLevels: number = 0
): number => {
  const isPrefix = mod.type === 'Prefix';
  const dpsWithMod = calculateSpellDps(
    skill,
    weapon,
    isPrefix ? [mod] : [],
    isPrefix ? [] : [mod],
    bonusCritMult,
    bonusCrit,
    bonusCast,
    supportMoreDamage,
    supportMoreSpeed,
    passiveStats,
    skillLevel,
    additionalLevels
  );
  return dpsWithMod - baseDps;
};

// Get the best mods sorted by DPS contribution (excludes unique mods)
const getBestModsForSpell = (
  skill: Skill,
  weapon: Weapon | null,
  mods: WeaponMod[],
  weaponType: string,
  bonusCritMult: number,
  bonusCrit: number,
  bonusCast: number,
  supportMoreDamage: number = 0,
  supportMoreSpeed: number = 0,
  passiveStats: any = null,
  skillLevel: number = 20,
  additionalLevels: number = 0
): WeaponMod[] => {
  const baseDps = calculateSpellDps(skill, weapon, [], [], bonusCritMult, bonusCrit, bonusCast, supportMoreDamage, supportMoreSpeed, passiveStats, skillLevel, additionalLevels);

  // Filter mods that can roll on this weapon and are spell/damage relevant
  const spellKeywords = ['spell', 'elemental', 'fire damage', 'cold damage', 'lightning damage', 'chaos damage', 'cast speed', 'critical', 'physical damage'];

  const applicableMods = mods.filter(mod => {
    // Check weapon type
    const canRollOnWeapon = mod.applicableWeapons.includes('All Weapons') ||
      mod.applicableWeapons.some(w => w === weaponType || weaponType.includes(w));
    if (!canRollOnWeapon) return false;

    // Check if spell-relevant
    return mod.stats.some(s => {
      const lower = s.toLowerCase();
      return spellKeywords.some(kw => lower.includes(kw));
    });
  });

  // Get highest tier for each group
  const modsByGroup: Record<string, WeaponMod> = {};
  applicableMods.forEach(mod => {
    const key = mod.group || mod.id;
    if (!modsByGroup[key] || mod.level > modsByGroup[key].level) {
      modsByGroup[key] = mod;
    }
  });

  const uniqueMods = Object.values(modsByGroup);

  // Calculate DPS contribution for each mod and sort
  const modsWithDps = uniqueMods.map(mod => ({
    mod,
    dpsContribution: calculateModDpsContribution(skill, weapon, mod, baseDps, bonusCritMult, bonusCrit, bonusCast, supportMoreDamage, supportMoreSpeed, passiveStats, skillLevel, additionalLevels)
  }));

  modsWithDps.sort((a, b) => b.dpsContribution - a.dpsContribution);

  return modsWithDps.map(m => m.mod);
};

const generateSpellModCombinations = (
  skill: Skill,
  weapon: Weapon | null,
  allPrefixes: WeaponMod[],
  allSuffixes: WeaponMod[],
  weaponType: string = 'Wand',
  bonusCritMult: number = 0,
  bonusCrit: number = 0,
  bonusCast: number = 0,
  supportMoreDamage: number = 0,
  supportMoreSpeed: number = 0,
  passiveStats: any = null,
  skillLevel: number = 20,
  additionalLevels: number = 0
): ModCombination[] => {
  // Get best mods sorted by DPS contribution
  const bestPrefixes = getBestModsForSpell(skill, weapon, allPrefixes, weaponType, bonusCritMult, bonusCrit, bonusCast, supportMoreDamage, supportMoreSpeed, passiveStats, skillLevel, additionalLevels);
  const bestSuffixes = getBestModsForSpell(skill, weapon, allSuffixes, weaponType, bonusCritMult, bonusCrit, bonusCast, supportMoreDamage, supportMoreSpeed, passiveStats, skillLevel, additionalLevels);

  // Take top 3 of each
  const top3Prefixes = bestPrefixes.slice(0, 3);
  const top3Suffixes = bestSuffixes.slice(0, 3);

  const combinations: ModCombination[] = [];
  
  // Base (no mods)
  const baseDps = calculateSpellDps(skill, weapon, [], [], bonusCritMult, bonusCrit, bonusCast, supportMoreDamage, supportMoreSpeed, passiveStats, skillLevel, additionalLevels);
  combinations.push({
    name: 'No Mods (Base)',
    dps: baseDps,
    prefixes: [],
    suffixes: []
  });
  
  // TOP 1: Full 6 mods - Best possible
  if (top3Prefixes.length >= 3 && top3Suffixes.length >= 3) {
    combinations.push({
      name: '🥇 BEST: 3P + 3S',
      dps: calculateSpellDps(skill, weapon, top3Prefixes, top3Suffixes, bonusCritMult, bonusCrit, bonusCast, supportMoreDamage, supportMoreSpeed, passiveStats, skillLevel, additionalLevels),
      prefixes: top3Prefixes,
      suffixes: top3Suffixes
    });
  }

  // TOP 2: 3 Prefixes + 2 Suffixes
  if (top3Prefixes.length >= 3 && top3Suffixes.length >= 2) {
    combinations.push({
      name: '🥈 3P + 2S',
      dps: calculateSpellDps(skill, weapon, top3Prefixes, top3Suffixes.slice(0, 2), bonusCritMult, bonusCrit, bonusCast, supportMoreDamage, supportMoreSpeed, passiveStats, skillLevel, additionalLevels),
      prefixes: top3Prefixes,
      suffixes: top3Suffixes.slice(0, 2)
    });
  }

  // TOP 3: 2 Prefixes + 3 Suffixes
  if (top3Prefixes.length >= 2 && top3Suffixes.length >= 3) {
    combinations.push({
      name: '🥉 2P + 3S',
      dps: calculateSpellDps(skill, weapon, top3Prefixes.slice(0, 2), top3Suffixes, bonusCritMult, bonusCrit, bonusCast, supportMoreDamage, supportMoreSpeed, passiveStats, skillLevel, additionalLevels),
      prefixes: top3Prefixes.slice(0, 2),
      suffixes: top3Suffixes
    });
  }

  // 3 Prefixes + 1 Suffix
  if (top3Prefixes.length >= 3 && top3Suffixes.length >= 1) {
    combinations.push({
      name: '3P + 1S',
      dps: calculateSpellDps(skill, weapon, top3Prefixes, top3Suffixes.slice(0, 1), bonusCritMult, bonusCrit, bonusCast, supportMoreDamage, supportMoreSpeed, passiveStats, skillLevel, additionalLevels),
      prefixes: top3Prefixes,
      suffixes: top3Suffixes.slice(0, 1)
    });
  }

  // 1 Prefix + 3 Suffixes
  if (top3Prefixes.length >= 1 && top3Suffixes.length >= 3) {
    combinations.push({
      name: '1P + 3S',
      dps: calculateSpellDps(skill, weapon, top3Prefixes.slice(0, 1), top3Suffixes, bonusCritMult, bonusCrit, bonusCast, supportMoreDamage, supportMoreSpeed, passiveStats, skillLevel, additionalLevels),
      prefixes: top3Prefixes.slice(0, 1),
      suffixes: top3Suffixes
    });
  }

  // 3 Prefixes Only
  if (top3Prefixes.length >= 3) {
    combinations.push({
      name: '3 Prefixes Only',
      dps: calculateSpellDps(skill, weapon, top3Prefixes, [], bonusCritMult, bonusCrit, bonusCast, supportMoreDamage, supportMoreSpeed, passiveStats, skillLevel, additionalLevels),
      prefixes: top3Prefixes,
      suffixes: []
    });
  }

  // 3 Suffixes Only
  if (top3Suffixes.length >= 3) {
    combinations.push({
      name: '3 Suffixes Only',
      dps: calculateSpellDps(skill, weapon, [], top3Suffixes, bonusCritMult, bonusCrit, bonusCast, supportMoreDamage, supportMoreSpeed, passiveStats, skillLevel, additionalLevels),
      prefixes: [],
      suffixes: top3Suffixes
    });
  }

  // Best Single Prefix
  if (top3Prefixes.length >= 1) {
    combinations.push({
      name: `Best Prefix: ${top3Prefixes[0].affix}`,
      dps: calculateSpellDps(skill, weapon, [top3Prefixes[0]], [], bonusCritMult, bonusCrit, bonusCast, supportMoreDamage, supportMoreSpeed, passiveStats, skillLevel, additionalLevels),
      prefixes: [top3Prefixes[0]],
      suffixes: []
    });
  }

  // Best Single Suffix
  if (top3Suffixes.length >= 1) {
    combinations.push({
      name: `Best Suffix: ${top3Suffixes[0].affix}`,
      dps: calculateSpellDps(skill, weapon, [], [top3Suffixes[0]], bonusCritMult, bonusCrit, bonusCast, supportMoreDamage, supportMoreSpeed, passiveStats, skillLevel, additionalLevels),
      prefixes: [],
      suffixes: [top3Suffixes[0]]
    });
  }

  // Sort by DPS ascending (for chart display)
  combinations.sort((a, b) => a.dps - b.dps);
  
  return combinations;
};


const SpellSkillsPlanner: React.FC = () => {
  const [skills, setSkills] = useState<Skill[]>([]);
  const [weapons, setWeapons] = useState<Weapon[]>([]);
  const [weaponMods, setWeaponMods] = useState<WeaponModsData>({ prefixes: [], suffixes: [] });
  const [selectedSkill, setSelectedSkill] = useState<Skill | null>(null);
  const [selectedWeapon, setSelectedWeapon] = useState<Weapon | null>(null);
  const [searchSkill, setSearchSkill] = useState('');
  const [searchWeapon, setSearchWeapon] = useState('');
  const [selectedElement, setSelectedElement] = useState<string>('all');
  const [selectedCombination, setSelectedCombination] = useState<ModCombination | null>(null);
  const [selectedWeaponType, setSelectedWeaponType] = useState<string>('Wand');


  // Support skills selection (up to 5)
  const [selectedSupportSkills, setSelectedSupportSkills] = useState<Skill[]>([]);
  const [searchSupport, setSearchSupport] = useState('');

  // Trigger skills selection
  const [selectedTriggerSkills, setSelectedTriggerSkills] = useState<Skill[]>([]);
  const [searchTrigger, setSearchTrigger] = useState('');

  // Manual bonus inputs
  const [bonusCritMultiplier, setBonusCritMultiplier] = useState<number>(0);
  const [bonusCritChance, setBonusCritChance] = useState<number>(0);
  const [bonusCastSpeed, setBonusCastSpeed] = useState<number>(0);

  // Skill level inputs
  const [skillLevel, setSkillLevel] = useState<number>(20);
  const [additionalGemLevels, setAdditionalGemLevels] = useState<number>(0);

  // Passive tree stats
  const [passiveTreeStats, setPassiveTreeStats] = useState<any>(null);

  // Spell weapon types
  const spellWeaponTypes = ['Wand', 'Sceptre', 'Staff'];

  const chartRef = useRef<HTMLDivElement>(null);
  const sciChartSurfaceRef = useRef<SciChartSurface | null>(null);

  // Load data
  useEffect(() => {
    Promise.all([
      import('../../data/PoBSkills.json').then(mod => (mod as any).default || mod).catch(() => []),
      import('../../data/Weapons.json').then(mod => (mod as any).default || mod).catch(() => []),
      import('../../data/WeaponMods.json').then(mod => (mod as any).default || mod).catch(() => ({ prefixes: [], suffixes: [] }))
    ]).then(([skillsData, weaponsData, modsData]) => {
      setSkills(skillsData);
      setWeapons(weaponsData);
      setWeaponMods(modsData);
    });
  }, []);

  // Filter weapons by selected type
  const filteredWeapons = useMemo(() => {
    let filtered = weapons.filter(w => w.type === selectedWeaponType);
    if (searchWeapon) {
      filtered = filtered.filter(w => w.name.toLowerCase().includes(searchWeapon.toLowerCase()));
    }
    // Sort by DPS descending (highest first)
    return filtered.sort((a, b) => b.dps.total - a.dps.total);
  }, [weapons, selectedWeaponType, searchWeapon]);

  // Filter to active spell skills only (exclude support gems)
  const spellSkills = useMemo(() => {
    return skills.filter(s => 
      // Must be a spell type
      (s.type === 'Spell' ||
       s.gemType === 'Spell' ||
       (s.tagString && s.tagString.toLowerCase().includes('spell')) ||
       (!s.weaponRequirements && s.baseDamageData)) &&
      // Exclude support gems
      s.gemType !== 'Support' &&
      s.type !== 'Support'
      // Note: isTrigger means "can be triggered", not "is a trigger gem" - so we don't filter by it
    ).sort((a, b) => getSkillBaseDamage(b) - getSkillBaseDamage(a));
  }, [skills]);

  // Filter to support skills that can work with spells
  const supportSkills = useMemo(() => {
    return skills.filter(s =>
      s.gemType === 'Support' &&
      !s.isTrigger &&
      // Support skills that work with spells (have spell tag or no weapon requirement)
      (s.tags.includes('spell') ||
       !s.tags.includes('attack') ||
       s.tagString.toLowerCase().includes('spell') ||
       (!s.tags.includes('melee') && !s.tags.includes('bow') && !s.tags.includes('crossbow')))
    ).sort((a, b) => {
      // Sort by damage contribution (moreDamageMultipliersPct)
      const aDmg = a.moreDamageMultipliersPct.reduce((sum, v) => sum + v, 0);
      const bDmg = b.moreDamageMultipliersPct.reduce((sum, v) => sum + v, 0);
      return bDmg - aDmg;
    });
  }, [skills]);

  // Filter to trigger skills
  const triggerSkills = useMemo(() => {
    return skills.filter(s =>
      s.isTrigger === true &&
      // Must be spell-related or work with spells
      (s.gemType === 'Spell' ||
       s.type === 'Spell' ||
       s.tags.includes('spell') ||
       s.tagString.toLowerCase().includes('spell'))
    ).sort((a, b) => a.name.localeCompare(b.name));
  }, [skills]);

  // Get unique elements
  const elements = useMemo(() => {
    const elemSet = new Set<string>();
    spellSkills.forEach(s => {
      if (s.element) elemSet.add(s.element);
    });
    return ['all', ...Array.from(elemSet).sort()];
  }, [spellSkills]);

  // Filtered skills
  const filteredSkills = useMemo(() => {
    let filtered = spellSkills;
    if (searchSkill) {
      filtered = filtered.filter(s => s.name.toLowerCase().includes(searchSkill.toLowerCase()));
    }
    if (selectedElement !== 'all') {
      filtered = filtered.filter(s => s.element === selectedElement);
    }
    return filtered;
  }, [spellSkills, searchSkill, selectedElement]);

  // Filtered support skills
  const filteredSupportSkills = useMemo(() => {
    if (!searchSupport) return supportSkills;
    return supportSkills.filter(s => s.name.toLowerCase().includes(searchSupport.toLowerCase()));
  }, [supportSkills, searchSupport]);

  // Filtered trigger skills
  const filteredTriggerSkills = useMemo(() => {
    if (!searchTrigger) return triggerSkills;
    return triggerSkills.filter(s => s.name.toLowerCase().includes(searchTrigger.toLowerCase()));
  }, [triggerSkills, searchTrigger]);

  // Calculate total support skill multipliers
  const supportMultipliers = useMemo(() => {
    let totalMoreDamage = 0;
    let totalMoreSpeed = 0;

    selectedSupportSkills.forEach(support => {
      // More damage is multiplicative, so we sum for display
      support.moreDamageMultipliersPct.forEach(m => totalMoreDamage += m);
      support.moreAttackSpeedMultipliersPct.forEach(m => totalMoreSpeed += m);
    });

    return { totalMoreDamage, totalMoreSpeed };
  }, [selectedSupportSkills]);


  // Calculate mod combinations for chart (uses all applicable mods for weapon type)
  const modCombinations = useMemo(() => {
    if (!selectedSkill) return [];
    // Get all mods that can apply to this weapon type
    const allPrefixes = weaponMods.prefixes.filter(mod => 
      mod.applicableWeapons.includes('All Weapons') ||
      mod.applicableWeapons.includes(selectedWeaponType) ||
      mod.applicableWeapons.some(w => selectedWeaponType.includes(w))
    );
    const allSuffixes = weaponMods.suffixes.filter(mod => 
      mod.applicableWeapons.includes('All Weapons') ||
      mod.applicableWeapons.includes(selectedWeaponType) ||
      mod.applicableWeapons.some(w => selectedWeaponType.includes(w))
    );
    return generateSpellModCombinations(selectedSkill, selectedWeapon, allPrefixes, allSuffixes, selectedWeaponType, bonusCritMultiplier, bonusCritChance, bonusCastSpeed, supportMultipliers.totalMoreDamage, supportMultipliers.totalMoreSpeed, passiveTreeStats, skillLevel, additionalGemLevels);
  }, [selectedSkill, selectedWeapon, weaponMods, selectedWeaponType, bonusCritMultiplier, bonusCritChance, bonusCastSpeed, supportMultipliers, passiveTreeStats, skillLevel, additionalGemLevels]);

  // Get best mods for display (all applicable mods for weapon type)
  const bestMods = useMemo(() => {
    if (!selectedSkill) return { prefixes: [], suffixes: [] };
    // Get all mods that can apply to this weapon type
    const allPrefixes = weaponMods.prefixes.filter(mod => 
      mod.applicableWeapons.includes('All Weapons') ||
      mod.applicableWeapons.includes(selectedWeaponType) ||
      mod.applicableWeapons.some(w => selectedWeaponType.includes(w))
    );
    const allSuffixes = weaponMods.suffixes.filter(mod => 
      mod.applicableWeapons.includes('All Weapons') ||
      mod.applicableWeapons.includes(selectedWeaponType) ||
      mod.applicableWeapons.some(w => selectedWeaponType.includes(w))
    );
    const bestPrefixes = getBestModsForSpell(selectedSkill, selectedWeapon, allPrefixes, selectedWeaponType, bonusCritMultiplier, bonusCritChance, bonusCastSpeed, supportMultipliers.totalMoreDamage, supportMultipliers.totalMoreSpeed, passiveTreeStats, skillLevel, additionalGemLevels);
    const bestSuffixes = getBestModsForSpell(selectedSkill, selectedWeapon, allSuffixes, selectedWeaponType, bonusCritMultiplier, bonusCritChance, bonusCastSpeed, supportMultipliers.totalMoreDamage, supportMultipliers.totalMoreSpeed, passiveTreeStats, skillLevel, additionalGemLevels);
    return {
      prefixes: bestPrefixes.slice(0, 5),
      suffixes: bestSuffixes.slice(0, 5)
    };
  }, [selectedSkill, selectedWeapon, weaponMods, selectedWeaponType, bonusCritMultiplier, bonusCritChance, bonusCastSpeed, supportMultipliers, passiveTreeStats, skillLevel, additionalGemLevels]);


  // Initialize and update SciChart
  useEffect(() => {
    if (!chartRef.current || modCombinations.length === 0) return;

    const initChart = async () => {
      if (sciChartSurfaceRef.current) {
        sciChartSurfaceRef.current.delete();
        sciChartSurfaceRef.current = null;
      }

      try {
        const { sciChartSurface, wasmContext } = await SciChartSurface.create(chartRef.current!, {
          theme: {
            type: 'Dark',
            sciChartBackground: '#1a1a1a',
            loadingAnimationBackground: '#1a1a1a',
            axisBandsFill: '#1a1a1a',
            axisTitleColor: '#888',
            majorGridLineBrush: '#333',
            minorGridLineBrush: '#222',
            tickTextBrush: '#888',
          }
        });

        sciChartSurfaceRef.current = sciChartSurface;

        const xAxis = new NumericAxis(wasmContext, {
          axisTitle: 'Mod Combination',
          axisTitleStyle: { color: '#9B59B6' },
          labelStyle: { color: '#888' },
          drawMajorGridLines: false,
          drawMinorGridLines: false,
        });
        sciChartSurface.xAxes.add(xAxis);

        const maxDps = Math.max(...modCombinations.map(c => c.dps));
        const yAxis = new NumericAxis(wasmContext, {
          axisTitle: 'DPS',
          axisTitleStyle: { color: '#9B59B6' },
          labelStyle: { color: '#888' },
          axisAlignment: EAxisAlignment.Left,
          visibleRange: new NumberRange(0, maxDps * 1.1),
          drawMajorGridLines: true,
          drawMinorGridLines: false,
        });
        sciChartSurface.yAxes.add(yAxis);

        const xValues = modCombinations.map((_, i) => i);
        const yValues = modCombinations.map(c => c.dps);

        const dataSeries = new XyDataSeries(wasmContext, { xValues, yValues });

        const columnSeries = new FastColumnRenderableSeries(wasmContext, {
          dataSeries,
          fill: '#9B59B688',
          stroke: '#9B59B6',
          strokeThickness: 2,
          dataPointWidth: 0.7,
          fillLinearGradient: new GradientParams(new Point(0, 0), new Point(0, 1), [
            { color: '#9B59B6', offset: 0 },
            { color: '#6C3483', offset: 1 }
          ])
        });

        sciChartSurface.renderableSeries.add(columnSeries);
      } catch (error) {
        console.error('SciChart initialization error:', error);
      }
    };

    initChart();

    return () => {
      if (sciChartSurfaceRef.current) {
        sciChartSurfaceRef.current.delete();
        sciChartSurfaceRef.current = null;
      }
    };
  }, [modCombinations]);

  const getElementColor = (element: string | null): string => {
    switch (element) {
      case 'Fire': return '#FF6B35';
      case 'Cold': return '#4FC3F7';
      case 'Lightning': return '#FFD54F';
      case 'Chaos': return '#8E44AD';
      case 'Physical': return '#CCCCCC';
      default: return '#888';
    }
  };

  return (
    <div style={{ padding: 20, background: '#121212', minHeight: '100vh', color: '#fff' }}>
      <h1 style={{ margin: 0, marginBottom: 8, color: '#9B59B6' }}>
        🔮 Spell Skills Planner
      </h1>
      <p style={{ margin: 0, marginBottom: 24, color: '#888', fontSize: '0.9rem' }}>
        Select a spell skill to see damage scaling with weapon mods (Wands, Sceptres, Staves)
      </p>

      <div style={{ display: 'flex', gap: 24, flexWrap: 'wrap' }}>
        {/* Selection Panel */}
        <div style={{ flex: '1 1 350px', maxWidth: 450 }}>
          {/* Element Filter */}
          <div style={{ marginBottom: 16 }}>
            <label style={{ display: 'block', marginBottom: 8, color: '#9B59B6', fontWeight: 'bold' }}>
              Element Filter
            </label>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              {elements.map(elem => (
                <button
                  key={elem}
                  onClick={() => setSelectedElement(elem)}
                  style={{
                    padding: '6px 12px',
                    background: selectedElement === elem ? getElementColor(elem === 'all' ? null : elem) + '44' : '#222',
                    border: `1px solid ${selectedElement === elem ? getElementColor(elem === 'all' ? null : elem) : '#444'}`,
                    borderRadius: 4,
                    color: selectedElement === elem ? getElementColor(elem === 'all' ? null : elem) : '#888',
                    cursor: 'pointer',
                    fontSize: '0.8rem'
                  }}
                >
                  {elem === 'all' ? 'All' : elem}
                </button>
              ))}
            </div>
          </div>

          {/* Weapon Type Selection */}
          <div style={{ marginBottom: 16 }}>
            <label style={{ display: 'block', marginBottom: 8, color: '#9B59B6', fontWeight: 'bold' }}>
              Weapon Type (for mods)
            </label>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              {spellWeaponTypes.map(wType => (
                <button
                  key={wType}
                  onClick={() => {
                    setSelectedWeaponType(wType);
                    setSelectedWeapon(null);
                    setSelectedCombination(null);
                  }}
                  style={{
                    padding: '6px 12px',
                    background: selectedWeaponType === wType ? '#9B59B644' : '#222',
                    border: `1px solid ${selectedWeaponType === wType ? '#9B59B6' : '#444'}`,
                    borderRadius: 4,
                    color: selectedWeaponType === wType ? '#9B59B6' : '#888',
                    cursor: 'pointer',
                    fontSize: '0.8rem'
                  }}
                >
                  {wType}
                </button>
              ))}
            </div>
            <div style={{ marginTop: 4, fontSize: '0.7rem', color: '#666' }}>
              {selectedWeaponType === 'Sceptre'
                ? 'Sceptres have "Allies in Presence" mods (party buffs) instead of direct spell damage'
                : selectedWeaponType === 'Staff'
                ? 'Staves have higher spell damage values (2H weapon bonus)'
                : 'Wands have standard spell damage and cast speed mods'
              }
            </div>
          </div>

          {/* Weapon Selection */}
          <div style={{ marginBottom: 16 }}>
            <label style={{ display: 'block', marginBottom: 8, color: '#9B59B6', fontWeight: 'bold' }}>
              Base {selectedWeaponType} ({filteredWeapons.length} available)
            </label>
            <input
              type="text"
              placeholder={`Search ${selectedWeaponType.toLowerCase()}s...`}
              value={searchWeapon}
              onChange={(e) => setSearchWeapon(e.target.value)}
              style={{
                width: '100%',
                padding: '8px 10px',
                background: '#222',
                border: '1px solid #444',
                borderRadius: 4,
                color: '#fff',
                marginBottom: 8,
                fontSize: '0.85rem'
              }}
            />
            <div style={{ maxHeight: 150, overflowY: 'auto', background: '#1a1a1a', borderRadius: 4, border: '1px solid #333' }}>
              {filteredWeapons.slice(0, 30).map(weapon => (
                <div
                  key={weapon.id}
                  onClick={() => {
                    setSelectedWeapon(weapon);
                    setSelectedCombination(null);
                  }}
                  style={{
                    padding: '6px 10px',
                    cursor: 'pointer',
                    background: selectedWeapon?.id === weapon.id ? '#2d1f3d' : 'transparent',
                    borderBottom: '1px solid #333',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center'
                  }}
                >
                  <span style={{ color: selectedWeapon?.id === weapon.id ? '#9B59B6' : '#fff', fontSize: '0.8rem' }}>
                    {weapon.name}
                  </span>
                  <span style={{ color: '#666', fontSize: '0.7rem' }}>
                    {weapon.dps.total > 0 ? `${weapon.dps.total.toFixed(0)} DPS` : 'No base dmg'}
                  </span>
                </div>
              ))}
            </div>
            {selectedWeapon && (
              <div style={{ marginTop: 8, padding: 8, background: '#222', borderRadius: 4, fontSize: '0.75rem' }}>
                <div style={{ color: '#9B59B6', fontWeight: 'bold', marginBottom: 4 }}>{selectedWeapon.name}</div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 4 }}>
                  <div><span style={{ color: '#888' }}>Physical: </span><span style={{ color: '#fff' }}>{selectedWeapon.damage.physical.min}-{selectedWeapon.damage.physical.max}</span></div>
                  <div><span style={{ color: '#888' }}>Crit: </span><span style={{ color: '#E91E63' }}>{selectedWeapon.critChance}%</span></div>
                  <div><span style={{ color: '#888' }}>Attack Speed: </span><span style={{ color: '#fff' }}>{selectedWeapon.attackRate}/s</span></div>
                  <div><span style={{ color: '#888' }}>Total DPS: </span><span style={{ color: '#4CAF50' }}>{selectedWeapon.dps.total.toFixed(0)}</span></div>
                </div>
              </div>
            )}
          </div>

          {/* Skill Selection */}
          <div style={{ marginBottom: 20 }}>
            <label style={{ display: 'block', marginBottom: 8, color: '#9B59B6', fontWeight: 'bold' }}>
              Spell Skill ({filteredSkills.length} skills)
            </label>
            <input
              type="text"
              placeholder="Search spell skills..."
              value={searchSkill}
              onChange={(e) => setSearchSkill(e.target.value)}
              style={{
                width: '100%',
                padding: '10px 12px',
                background: '#222',
                border: '1px solid #444',
                borderRadius: 4,
                color: '#fff',
                marginBottom: 8
              }}
            />
            <div style={{ maxHeight: 300, overflowY: 'auto', background: '#1a1a1a', borderRadius: 4, border: '1px solid #333' }}>
              {filteredSkills.slice(0, 50).map(skill => (
                <div
                  key={skill.id}
                  onClick={() => setSelectedSkill(skill)}
                  style={{
                    padding: '8px 12px',
                    cursor: 'pointer',
                    background: selectedSkill?.id === skill.id ? '#2d1f3d' : 'transparent',
                    borderBottom: '1px solid #333',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center'
                  }}
                >
                  <div>
                    <span style={{ color: selectedSkill?.id === skill.id ? '#9B59B6' : '#fff' }}>
                      {skill.name}
                    </span>
                    {skill.element && (
                      <span style={{ 
                        color: getElementColor(skill.element), 
                        fontSize: '0.7rem', 
                        marginLeft: 8,
                        padding: '2px 6px',
                        background: getElementColor(skill.element) + '22',
                        borderRadius: 3
                      }}>
                        {skill.element}
                      </span>
                    )}
                  </div>
                  <span style={{ color: '#4CAF50', fontSize: '0.75rem' }}>
                    {skill.minDamageLvl20 !== undefined
                      ? `${skill.minDamageLvl20}-${skill.maxDamageLvl20}`
                      : getSkillBaseDamage(skill).toFixed(0)
                    }
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* Selected Skill Info */}
          {selectedSkill && (
            <div style={{ background: '#1a1a1a', borderRadius: 8, padding: 16, border: '1px solid #333' }}>
              <h3 style={{ margin: 0, marginBottom: 12, color: '#9B59B6' }}>{selectedSkill.name}</h3>
              <div style={{ fontSize: '0.85rem', color: '#888', marginBottom: 12 }}>
                {selectedSkill.description}
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, fontSize: '0.8rem' }}>
                <div>
                  <span style={{ color: '#888' }}>Base Damage (Lvl 20): </span>
                  {selectedSkill.minDamageLvl20 !== undefined ? (
                    <span style={{ color: '#4CAF50' }}>
                      {selectedSkill.minDamageLvl20} - {selectedSkill.maxDamageLvl20}
                    </span>
                  ) : (
                    <span style={{ color: '#4CAF50' }}>{getSkillBaseDamage(selectedSkill).toFixed(0)}</span>
                  )}
                </div>
                {selectedSkill.damageTypes && selectedSkill.damageTypes.length > 0 && (
                  <div>
                    <span style={{ color: '#888' }}>Damage Type: </span>
                    <span style={{ color: getElementColor(selectedSkill.damageTypes[0]) }}>
                      {selectedSkill.damageTypes.map(t => t.charAt(0).toUpperCase() + t.slice(1)).join(', ')}
                    </span>
                  </div>
                )}
                {selectedSkill.element && !selectedSkill.damageTypes && (
                  <div>
                    <span style={{ color: '#888' }}>Element: </span>
                    <span style={{ color: getElementColor(selectedSkill.element) }}>{selectedSkill.element}</span>
                  </div>
                )}
                {selectedSkill.castTime && (
                  <div>
                    <span style={{ color: '#888' }}>Cast Time: </span>
                    <span style={{ color: '#fff' }}>{selectedSkill.castTime}s</span>
                  </div>
                )}
                {selectedSkill.baseDamageData?.critChance && (
                  <div>
                    <span style={{ color: '#888' }}>Crit Chance: </span>
                    <span style={{ color: '#E91E63' }}>{selectedSkill.baseDamageData.critChance}%</span>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Skill Level Inputs */}
          <div style={{ background: '#1a1a1a', borderRadius: 8, padding: 16, border: '1px solid #9B59B6', marginTop: 16 }}>
            <h4 style={{ margin: 0, marginBottom: 12, color: '#9B59B6', fontSize: '0.9rem' }}>
              📊 Skill Level Configuration
            </h4>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <div>
                <label style={{ display: 'block', marginBottom: 4, color: '#888', fontSize: '0.75rem' }}>
                  Base Skill Level (1-30)
                </label>
                <input
                  type="number"
                  min="1"
                  max="30"
                  value={skillLevel}
                  onChange={(e) => setSkillLevel(Math.max(1, Math.min(30, Number(e.target.value) || 20)))}
                  style={{
                    width: '100%',
                    padding: '6px 10px',
                    background: '#222',
                    border: '1px solid #444',
                    borderRadius: 4,
                    color: '#fff',
                    fontSize: '0.85rem'
                  }}
                />
                <div style={{ fontSize: '0.7rem', color: '#666', marginTop: 4 }}>
                  Default: 20 (max gem level)
                </div>
              </div>
              <div>
                <label style={{ display: 'block', marginBottom: 4, color: '#888', fontSize: '0.75rem' }}>
                  Additional Gem Levels (from mods)
                </label>
                <input
                  type="number"
                  min="0"
                  max="10"
                  value={additionalGemLevels}
                  onChange={(e) => setAdditionalGemLevels(Math.max(0, Math.min(10, Number(e.target.value) || 0)))}
                  style={{
                    width: '100%',
                    padding: '6px 10px',
                    background: '#222',
                    border: '1px solid #444',
                    borderRadius: 4,
                    color: '#fff',
                    fontSize: '0.85rem'
                  }}
                />
                <div style={{ fontSize: '0.7rem', color: '#666', marginTop: 4 }}>
                  From "+X to Level of all Skill Gems" mods
                </div>
              </div>
            </div>
            {(skillLevel !== 20 || additionalGemLevels !== 0) && selectedSkill && (
              <div style={{ marginTop: 12, padding: 8, background: '#9B59B622', borderRadius: 4, borderLeft: '3px solid #9B59B6' }}>
                <div style={{ fontSize: '0.75rem', color: '#888' }}>Effective Level: {skillLevel + additionalGemLevels}</div>
                <div style={{ fontSize: '0.75rem', color: '#4CAF50', marginTop: 4 }}>
                  Base Damage: {getSkillDamageAtLevel(selectedSkill, skillLevel + additionalGemLevels).min.toFixed(0)} - {getSkillDamageAtLevel(selectedSkill, skillLevel + additionalGemLevels).max.toFixed(0)}
                </div>
              </div>
            )}
          </div>

          {/* Manual Bonus Inputs */}
          <div style={{ background: '#1a1a1a', borderRadius: 8, padding: 16, border: '1px solid #333', marginTop: 16 }}>
            <h4 style={{ margin: 0, marginBottom: 12, color: '#9B59B6', fontSize: '0.9rem' }}>
              🎯 Additional Bonuses (from gear, passives, etc.)
            </h4>
            <div style={{ display: 'grid', gap: 12 }}>
              <div>
                <label style={{ display: 'block', marginBottom: 4, color: '#888', fontSize: '0.75rem' }}>
                  Bonus Critical Strike Multiplier (%)
                </label>
                <input
                  type="number"
                  value={bonusCritMultiplier}
                  onChange={(e) => setBonusCritMultiplier(Number(e.target.value) || 0)}
                  placeholder="0"
                  style={{
                    width: '100%',
                    padding: '8px 10px',
                    background: '#222',
                    border: '1px solid #444',
                    borderRadius: 4,
                    color: '#E91E63',
                    fontSize: '0.9rem'
                  }}
                />
              </div>
              <div>
                <label style={{ display: 'block', marginBottom: 4, color: '#888', fontSize: '0.75rem' }}>
                  Bonus Critical Strike Chance (%)
                </label>
                <input
                  type="number"
                  value={bonusCritChance}
                  onChange={(e) => setBonusCritChance(Number(e.target.value) || 0)}
                  placeholder="0"
                  style={{
                    width: '100%',
                    padding: '8px 10px',
                    background: '#222',
                    border: '1px solid #444',
                    borderRadius: 4,
                    color: '#E91E63',
                    fontSize: '0.9rem'
                  }}
                />
              </div>
              <div>
                <label style={{ display: 'block', marginBottom: 4, color: '#888', fontSize: '0.75rem' }}>
                  Bonus Cast Speed (%)
                </label>
                <input
                  type="number"
                  value={bonusCastSpeed}
                  onChange={(e) => setBonusCastSpeed(Number(e.target.value) || 0)}
                  placeholder="0"
                  style={{
                    width: '100%',
                    padding: '8px 10px',
                    background: '#222',
                    border: '1px solid #444',
                    borderRadius: 4,
                    color: '#4CAF50',
                    fontSize: '0.9rem'
                  }}
                />
              </div>
            </div>
          </div>

          {/* Support Skills Selection (up to 5) */}
          <div style={{ background: '#1a1a1a', borderRadius: 8, padding: 16, border: '1px solid #2ECC71', marginTop: 16 }}>
            <h4 style={{ margin: 0, marginBottom: 8, color: '#2ECC71', fontSize: '0.9rem' }}>
              💎 Support Skills ({selectedSupportSkills.length}/5)
            </h4>
            <p style={{ margin: 0, marginBottom: 12, color: '#666', fontSize: '0.7rem' }}>
              Select up to 5 support gems to link with your spell. Sorted by damage contribution.
            </p>

            <input
              type="text"
              placeholder="Search support skills..."
              value={searchSupport}
              onChange={(e) => setSearchSupport(e.target.value)}
              style={{
                width: '100%',
                padding: '8px 10px',
                background: '#222',
                border: '1px solid #444',
                borderRadius: 4,
                color: '#fff',
                marginBottom: 8,
                fontSize: '0.8rem'
              }}
            />

            <div style={{ maxHeight: 150, overflowY: 'auto', background: '#222', borderRadius: 4, border: '1px solid #333', marginBottom: 8 }}>
              {filteredSupportSkills.slice(0, 30).map(support => {
                const isSelected = selectedSupportSkills.some(s => s.id === support.id);
                const moreDmg = support.moreDamageMultipliersPct.reduce((s, v) => s + v, 0);
                const moreSpd = support.moreAttackSpeedMultipliersPct.reduce((s, v) => s + v, 0);
                return (
                  <div
                    key={support.id}
                    onClick={() => {
                      if (isSelected) {
                        setSelectedSupportSkills(selectedSupportSkills.filter(s => s.id !== support.id));
                      } else if (selectedSupportSkills.length < 5) {
                        setSelectedSupportSkills([...selectedSupportSkills, support]);
                      }
                    }}
                    style={{
                      padding: '6px 10px',
                      cursor: selectedSupportSkills.length >= 5 && !isSelected ? 'not-allowed' : 'pointer',
                      background: isSelected ? '#2ECC7133' : 'transparent',
                      borderBottom: '1px solid #333',
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      opacity: selectedSupportSkills.length >= 5 && !isSelected ? 0.5 : 1
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      {isSelected && <span style={{ color: '#2ECC71' }}>✓</span>}
                      <span style={{ color: isSelected ? '#2ECC71' : '#fff', fontSize: '0.8rem' }}>
                        {support.name}
                      </span>
                    </div>
                    <div style={{ display: 'flex', gap: 8, fontSize: '0.7rem' }}>
                      {moreDmg !== 0 && (
                        <span style={{ color: moreDmg > 0 ? '#4CAF50' : '#E74C3C' }}>
                          {moreDmg > 0 ? '+' : ''}{moreDmg}% dmg
                        </span>
                      )}
                      {moreSpd !== 0 && (
                        <span style={{ color: moreSpd > 0 ? '#3498DB' : '#E74C3C' }}>
                          {moreSpd > 0 ? '+' : ''}{moreSpd}% spd
                        </span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Selected Support Skills */}
            {selectedSupportSkills.length > 0 && (
              <div style={{ marginTop: 8 }}>
                <div style={{ fontSize: '0.75rem', color: '#888', marginBottom: 4 }}>Selected:</div>
                {selectedSupportSkills.map(support => {
                  const moreDmg = support.moreDamageMultipliersPct.reduce((s, v) => s + v, 0);
                  const moreSpd = support.moreAttackSpeedMultipliersPct.reduce((s, v) => s + v, 0);
                  return (
                    <div
                      key={support.id}
                      style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        padding: '4px 8px',
                        background: '#2ECC7122',
                        borderRadius: 4,
                        marginBottom: 4,
                        fontSize: '0.75rem'
                      }}
                    >
                      <span style={{ color: '#2ECC71' }}>{support.name}</span>
                      <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                        {moreDmg !== 0 && <span style={{ color: moreDmg > 0 ? '#4CAF50' : '#E74C3C' }}>{moreDmg > 0 ? '+' : ''}{moreDmg}%</span>}
                        {moreSpd !== 0 && <span style={{ color: moreSpd > 0 ? '#3498DB' : '#E74C3C' }}>{moreSpd > 0 ? '+' : ''}{moreSpd}%</span>}
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setSelectedSupportSkills(selectedSupportSkills.filter(s => s.id !== support.id));
                          }}
                          style={{
                            background: '#E74C3C44',
                            border: 'none',
                            color: '#E74C3C',
                            padding: '2px 8px',
                            borderRadius: 3,
                            cursor: 'pointer',
                            fontSize: '0.7rem'
                          }}
                        >
                          ✕
                        </button>
                      </div>
                    </div>
                  );
                })}

                {/* Support totals */}
                <div style={{ marginTop: 8, padding: 8, background: '#2ECC7122', borderRadius: 4, borderLeft: '3px solid #2ECC71' }}>
                  <div style={{ fontSize: '0.75rem', color: '#888' }}>Total Support Multipliers:</div>
                  <div style={{ display: 'flex', gap: 16, fontSize: '0.85rem' }}>
                    <span style={{ color: supportMultipliers.totalMoreDamage >= 0 ? '#4CAF50' : '#E74C3C' }}>
                      {supportMultipliers.totalMoreDamage >= 0 ? '+' : ''}{supportMultipliers.totalMoreDamage}% More Damage
                    </span>
                    {supportMultipliers.totalMoreSpeed !== 0 && (
                      <span style={{ color: supportMultipliers.totalMoreSpeed >= 0 ? '#3498DB' : '#E74C3C' }}>
                        {supportMultipliers.totalMoreSpeed >= 0 ? '+' : ''}{supportMultipliers.totalMoreSpeed}% More Speed
                      </span>
                    )}
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Trigger Skills Section */}
          {triggerSkills.length > 0 && (
            <div style={{ background: '#1a1a1a', borderRadius: 8, padding: 16, border: '1px solid #F39C12', marginTop: 16 }}>
              <h4 style={{ margin: 0, marginBottom: 8, color: '#F39C12', fontSize: '0.9rem' }}>
                ⚡ Trigger Skills
              </h4>
              <p style={{ margin: 0, marginBottom: 12, color: '#666', fontSize: '0.7rem' }}>
                Trigger skills activate based on conditions (e.g., on hit, on kill). They work alongside your active spell.
              </p>

              <input
                type="text"
                placeholder="Search trigger skills..."
                value={searchTrigger}
                onChange={(e) => setSearchTrigger(e.target.value)}
                style={{
                  width: '100%',
                  padding: '8px 10px',
                  background: '#222',
                  border: '1px solid #444',
                  borderRadius: 4,
                  color: '#fff',
                  marginBottom: 8,
                  fontSize: '0.8rem'
                }}
              />

              <div style={{ maxHeight: 120, overflowY: 'auto', background: '#222', borderRadius: 4, border: '1px solid #333' }}>
                {filteredTriggerSkills.slice(0, 20).map(trigger => {
                  const isSelected = selectedTriggerSkills.some(s => s.id === trigger.id);
                  return (
                    <div
                      key={trigger.id}
                      onClick={() => {
                        if (isSelected) {
                          setSelectedTriggerSkills(selectedTriggerSkills.filter(s => s.id !== trigger.id));
                        } else {
                          setSelectedTriggerSkills([...selectedTriggerSkills, trigger]);
                        }
                      }}
                      style={{
                        padding: '6px 10px',
                        cursor: 'pointer',
                        background: isSelected ? '#F39C1233' : 'transparent',
                        borderBottom: '1px solid #333',
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center'
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        {isSelected && <span style={{ color: '#F39C12' }}>✓</span>}
                        <span style={{ color: isSelected ? '#F39C12' : '#fff', fontSize: '0.8rem' }}>
                          {trigger.name}
                        </span>
                      </div>
                      <span style={{ color: '#666', fontSize: '0.7rem' }}>
                        {trigger.tagString}
                      </span>
                    </div>
                  );
                })}
              </div>

              {/* Selected Trigger Skills */}
              {selectedTriggerSkills.length > 0 && (
                <div style={{ marginTop: 8 }}>
                  <div style={{ fontSize: '0.75rem', color: '#888', marginBottom: 4 }}>Selected Triggers:</div>
                  {selectedTriggerSkills.map(trigger => (
                    <div
                      key={trigger.id}
                      style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        padding: '4px 8px',
                        background: '#F39C1222',
                        borderRadius: 4,
                        marginBottom: 4,
                        fontSize: '0.75rem'
                      }}
                    >
                      <div>
                        <span style={{ color: '#F39C12' }}>{trigger.name}</span>
                        <span style={{ color: '#666', marginLeft: 8, fontSize: '0.65rem' }}>
                          {trigger.description}
                        </span>
                      </div>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setSelectedTriggerSkills(selectedTriggerSkills.filter(s => s.id !== trigger.id));
                        }}
                        style={{
                          background: '#E74C3C44',
                          border: 'none',
                          color: '#E74C3C',
                          padding: '2px 8px',
                          borderRadius: 3,
                          cursor: 'pointer',
                          fontSize: '0.7rem'
                        }}
                      >
                        ✕
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Chart Panel */}
        <div style={{ flex: '2 1 600px' }}>
          {/* Best Available Mods for Weapon Type */}
          {selectedSkill && (
            <div style={{
              background: '#1a1a1a',
              borderRadius: 8,
              padding: 16,
              border: '1px solid #333',
              marginBottom: 16
            }}>
              <h3 style={{ margin: 0, marginBottom: 12, color: '#9B59B6', fontSize: '0.95rem' }}>
                🏆 Best {selectedWeaponType} Mods for {selectedSkill.name}
              </h3>
              <p style={{ margin: 0, marginBottom: 12, color: '#666', fontSize: '0.75rem' }}>
                All applicable mods ranked by DPS contribution
              </p>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
                {/* Best Prefixes */}
                <div>
                  <h4 style={{ margin: 0, marginBottom: 8, color: '#E74C3C', fontSize: '0.85rem' }}>
                    Best Prefixes
                  </h4>
                  {bestMods.prefixes.length === 0 ? (
                    <div style={{ color: '#666', fontSize: '0.8rem', fontStyle: 'italic' }}>
                      No spell prefixes available for {selectedWeaponType}
                    </div>
                  ) : (
                    bestMods.prefixes.map((mod, i) => (
                      <div
                        key={mod.id}
                        style={{
                          padding: '6px 10px',
                          marginBottom: 4,
                          background: i < 3 ? '#3a251088' : '#22222288',
                          borderRadius: 4,
                          borderLeft: `3px solid ${i < 3 ? '#E74C3C' : '#444'}`,
                          opacity: i < 3 ? 1 : 0.6
                        }}
                      >
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <span style={{ color: i < 3 ? '#c58602' : '#888', fontSize: '0.8rem', fontWeight: i < 3 ? 'bold' : 'normal' }}>
                            {i + 1}. {mod.affix}
                          </span>
                          <span style={{ color: '#666', fontSize: '0.7rem' }}>Lvl {mod.level}</span>
                        </div>
                        <div style={{ color: '#4CAF50', fontSize: '0.7rem', marginTop: 2 }}>
                          {mod.stats[0]}
                        </div>
                      </div>
                    ))
                  )}
                </div>

                {/* Best Suffixes */}
                <div>
                  <h4 style={{ margin: 0, marginBottom: 8, color: '#3498DB', fontSize: '0.85rem' }}>
                    Best Suffixes
                  </h4>
                  {bestMods.suffixes.length === 0 ? (
                    <div style={{ color: '#666', fontSize: '0.8rem', fontStyle: 'italic' }}>
                      No spell suffixes available for {selectedWeaponType}
                    </div>
                  ) : (
                    bestMods.suffixes.map((mod, i) => (
                      <div
                        key={mod.id}
                        style={{
                          padding: '6px 10px',
                          marginBottom: 4,
                          background: i < 3 ? '#102a3a88' : '#22222288',
                          borderRadius: 4,
                          borderLeft: `3px solid ${i < 3 ? '#3498DB' : '#444'}`,
                          opacity: i < 3 ? 1 : 0.6
                        }}
                      >
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <span style={{ color: i < 3 ? '#3498DB' : '#888', fontSize: '0.8rem', fontWeight: i < 3 ? 'bold' : 'normal' }}>
                            {i + 1}. {mod.affix}
                          </span>
                          <span style={{ color: '#666', fontSize: '0.7rem' }}>Lvl {mod.level}</span>
                        </div>
                        <div style={{ color: '#4CAF50', fontSize: '0.7rem', marginTop: 2 }}>
                          {mod.stats[0]}
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>
          )}

          <div style={{
            background: '#1a1a1a',
            borderRadius: 8,
            padding: 16,
            border: '1px solid #333'
          }}>
            <h3 style={{ margin: 0, marginBottom: 16, color: '#9B59B6' }}>
              Spell DPS with Top-Tier Weapon Mods
            </h3>
            
            {!selectedSkill ? (
              <div style={{ height: 400, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#666' }}>
                Select a spell skill to see damage chart
              </div>
            ) : (
              <>
                <div ref={chartRef} style={{ height: 350, width: '100%' }} />
                
                {/* Mod combinations table */}
                <div style={{ marginTop: 16, maxHeight: 200, overflowY: 'auto' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.8rem' }}>
                    <thead>
                      <tr style={{ borderBottom: '1px solid #333' }}>
                        <th style={{ padding: 8, textAlign: 'left', color: '#888' }}>#</th>
                        <th style={{ padding: 8, textAlign: 'left', color: '#888' }}>Combination</th>
                        <th style={{ padding: 8, textAlign: 'right', color: '#888' }}>DPS</th>
                        <th style={{ padding: 8, textAlign: 'right', color: '#888' }}>vs Base</th>
                      </tr>
                    </thead>
                    <tbody>
                      {modCombinations.map((combo, i) => {
                        const baseDps = modCombinations[0]?.dps || 1;
                        const increase = ((combo.dps / baseDps) - 1) * 100;
                        const isSelected = selectedCombination?.name === combo.name;
                        return (
                          <tr
                            key={i}
                            onClick={() => setSelectedCombination(combo)}
                            style={{
                              borderBottom: '1px solid #222',
                              cursor: 'pointer',
                              background: isSelected ? '#2d1f3d' : 'transparent'
                            }}
                          >
                            <td style={{ padding: 8, color: '#666' }}>{i + 1}</td>
                            <td style={{ padding: 8, color: isSelected ? '#9B59B6' : '#9B59B6' }}>{combo.name}</td>
                            <td style={{ padding: 8, textAlign: 'right', color: '#4CAF50', fontWeight: 'bold' }}>
                              {combo.dps.toFixed(0)}
                            </td>
                            <td style={{ padding: 8, textAlign: 'right', color: increase > 0 ? '#4CAF50' : '#888' }}>
                              {increase > 0 ? `+${increase.toFixed(0)}%` : '—'}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </>
            )}
          </div>

          {/* Selected Combination Breakdown */}
          {selectedSkill && selectedCombination && (
            <div style={{
              background: '#1a1a1a',
              borderRadius: 8,
              padding: 16,
              border: '1px solid #9B59B6',
              marginTop: 16
            }}>
              <h3 style={{ margin: 0, marginBottom: 16, color: '#9B59B6' }}>
                📊 {selectedCombination.name} - Calculation Breakdown
              </h3>

              {/* Selected Mods */}
              <div style={{ marginBottom: 16 }}>
                <h4 style={{ margin: 0, marginBottom: 8, color: '#E74C3C', fontSize: '0.9rem' }}>
                  Prefixes ({selectedCombination.prefixes.length}/3)
                </h4>
                {selectedCombination.prefixes.length === 0 ? (
                  <div style={{ color: '#666', fontSize: '0.8rem', fontStyle: 'italic' }}>No prefixes selected</div>
                ) : (
                  selectedCombination.prefixes.map((mod, i) => (
                    <div key={i} style={{
                      padding: '8px 12px',
                      background: '#222',
                      borderRadius: 4,
                      marginBottom: 4,
                      borderLeft: '3px solid #E74C3C'
                    }}>
                      <div style={{ color: '#c58602', fontWeight: 'bold', fontSize: '0.85rem' }}>
                        {mod.affix} <span style={{ color: '#666', fontWeight: 'normal' }}>(Lvl {mod.level})</span>
                      </div>
                      {mod.stats.map((stat, j) => (
                        <div key={j} style={{ color: '#4CAF50', fontSize: '0.8rem' }}>{stat}</div>
                      ))}
                    </div>
                  ))
                )}

                <h4 style={{ margin: '16px 0 8px 0', color: '#3498DB', fontSize: '0.9rem' }}>
                  Suffixes ({selectedCombination.suffixes.length}/3)
                </h4>
                {selectedCombination.suffixes.length === 0 ? (
                  <div style={{ color: '#666', fontSize: '0.8rem', fontStyle: 'italic' }}>No suffixes selected</div>
                ) : (
                  selectedCombination.suffixes.map((mod, i) => (
                    <div key={i} style={{
                      padding: '8px 12px',
                      background: '#222',
                      borderRadius: 4,
                      marginBottom: 4,
                      borderLeft: '3px solid #3498DB'
                    }}>
                      <div style={{ color: '#3498DB', fontWeight: 'bold', fontSize: '0.85rem' }}>
                        {mod.affix} <span style={{ color: '#666', fontWeight: 'normal' }}>(Lvl {mod.level})</span>
                      </div>
                      {mod.stats.map((stat, j) => (
                        <div key={j} style={{ color: '#4CAF50', fontSize: '0.8rem' }}>{stat}</div>
                      ))}
                    </div>
                  ))
                )}
              </div>

              {/* Calculation Steps */}
              {(() => {
                const breakdown = getSpellDpsBreakdown(selectedSkill, selectedWeapon, selectedCombination.prefixes, selectedCombination.suffixes, bonusCritMultiplier, bonusCritChance, bonusCastSpeed, supportMultipliers.totalMoreDamage, supportMultipliers.totalMoreSpeed, passiveTreeStats, skillLevel, additionalGemLevels);
                return (
                  <div style={{ borderTop: '1px solid #333', paddingTop: 16 }}>
                    <h4 style={{ margin: 0, marginBottom: 12, color: '#888', fontSize: '0.9rem' }}>
                      Damage Calculation
                    </h4>

                    {/* Weapon Damage (if skill uses weapon) */}
                    {selectedWeapon && breakdown.skillBaseMultiplier > 0 && (
                      <div style={{ marginBottom: 16 }}>
                        <div style={{ color: '#666', fontSize: '0.75rem', marginBottom: 4 }}>WEAPON DAMAGE CONVERSION</div>
                        <div style={{ display: 'grid', gap: 4, fontSize: '0.8rem' }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                            <span style={{ color: '#888' }}>Weapon Physical</span>
                            <span style={{ color: '#fff' }}>{breakdown.weaponPhysicalDamage.toFixed(0)}</span>
                          </div>
                          {breakdown.weaponElementalDamage > 0 && (
                            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                              <span style={{ color: '#888' }}>Weapon Elemental</span>
                              <span style={{ color: '#FF9800' }}>{breakdown.weaponElementalDamage.toFixed(0)}</span>
                            </div>
                          )}
                          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                            <span style={{ color: '#888' }}>Skill Base Multiplier</span>
                            <span style={{ color: '#9B59B6' }}>×{(breakdown.skillBaseMultiplier * 100).toFixed(0)}%</span>
                          </div>
                          <div style={{ display: 'flex', justifyContent: 'space-between', borderTop: '1px solid #333', paddingTop: 4 }}>
                            <span style={{ color: '#888' }}>Converted Weapon Damage</span>
                            <span style={{ color: '#fff', fontWeight: 'bold' }}>{breakdown.convertedWeaponDamage.toFixed(0)}</span>
                          </div>
                        </div>
                      </div>
                    )}

                    {/* Base Damage */}
                    <div style={{ marginBottom: 16 }}>
                      <div style={{ color: '#666', fontSize: '0.75rem', marginBottom: 4 }}>BASE DAMAGE</div>
                      <div style={{ display: 'grid', gap: 4, fontSize: '0.8rem' }}>
                        {breakdown.skillBaseDamage > 0 && (
                          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                            <span style={{ color: '#888' }}>Skill Base Damage</span>
                            <span style={{ color: '#fff' }}>{breakdown.skillBaseDamage.toFixed(0)}</span>
                          </div>
                        )}
                        {breakdown.convertedWeaponDamage > 0 && (
                          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                            <span style={{ color: '#888' }}>+ From Weapon</span>
                            <span style={{ color: '#9B59B6' }}>+{breakdown.convertedWeaponDamage.toFixed(0)}</span>
                          </div>
                        )}
                        {breakdown.addedDamage > 0 && (
                          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                            <span style={{ color: '#888' }}>+ Added Damage (mods)</span>
                            <span style={{ color: '#4CAF50' }}>+{breakdown.addedDamage.toFixed(0)}</span>
                          </div>
                        )}
                        <div style={{ display: 'flex', justifyContent: 'space-between', borderTop: '1px solid #333', paddingTop: 4 }}>
                          <span style={{ color: '#888' }}>Total Base</span>
                          <span style={{ color: '#fff', fontWeight: 'bold' }}>{breakdown.totalBaseDamage.toFixed(0)}</span>
                        </div>
                      </div>
                    </div>

                    {/* Passive Tree Stats (if available) */}
                    {passiveTreeStats && Object.keys(passiveTreeStats).length > 0 && (
                      <div style={{ marginBottom: 16, background: '#2a4a2a22', padding: 8, borderRadius: 4, border: '1px solid #2a4a2a' }}>
                        <div style={{ color: '#4CAF50', fontSize: '0.75rem', marginBottom: 4, fontWeight: 'bold' }}>🌳 PASSIVE TREE BONUSES</div>
                        <div style={{ display: 'grid', gap: 2, fontSize: '0.75rem' }}>
                          {passiveTreeStats.increasedSpellDamagePct > 0 && (
                            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                              <span style={{ color: '#888' }}>Spell Damage</span>
                              <span style={{ color: '#4fc3f7' }}>+{passiveTreeStats.increasedSpellDamagePct}%</span>
                            </div>
                          )}
                          {passiveTreeStats.increasedElementalDamagePct > 0 && (
                            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                              <span style={{ color: '#888' }}>Elemental Damage</span>
                              <span style={{ color: '#4fc3f7' }}>+{passiveTreeStats.increasedElementalDamagePct}%</span>
                            </div>
                          )}
                          {passiveTreeStats.increasedFireDamagePct > 0 && (
                            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                              <span style={{ color: '#888' }}>Fire Damage</span>
                              <span style={{ color: '#ff6b6b' }}>+{passiveTreeStats.increasedFireDamagePct}%</span>
                            </div>
                          )}
                          {passiveTreeStats.increasedColdDamagePct > 0 && (
                            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                              <span style={{ color: '#888' }}>Cold Damage</span>
                              <span style={{ color: '#74c0fc' }}>+{passiveTreeStats.increasedColdDamagePct}%</span>
                            </div>
                          )}
                          {passiveTreeStats.increasedLightningDamagePct > 0 && (
                            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                              <span style={{ color: '#888' }}>Lightning Damage</span>
                              <span style={{ color: '#ffe066' }}>+{passiveTreeStats.increasedLightningDamagePct}%</span>
                            </div>
                          )}
                          {passiveTreeStats.increasedChaosDamagePct > 0 && (
                            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                              <span style={{ color: '#888' }}>Chaos Damage</span>
                              <span style={{ color: '#d946ef' }}>+{passiveTreeStats.increasedChaosDamagePct}%</span>
                            </div>
                          )}
                          {passiveTreeStats.increasedCastSpeedPct > 0 && (
                            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                              <span style={{ color: '#888' }}>Cast Speed</span>
                              <span style={{ color: '#a78bfa' }}>+{passiveTreeStats.increasedCastSpeedPct}%</span>
                            </div>
                          )}
                          {(passiveTreeStats.increasedSpellCritChancePct > 0 || passiveTreeStats.increasedCritChancePct > 0) && (
                            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                              <span style={{ color: '#888' }}>Crit Chance</span>
                              <span style={{ color: '#fbbf24' }}>+{(passiveTreeStats.increasedSpellCritChancePct || 0) + (passiveTreeStats.increasedCritChancePct || 0)}%</span>
                            </div>
                          )}
                          {(passiveTreeStats.increasedSpellCritMultiplierPct > 0 || passiveTreeStats.increasedCritMultiplierPct > 0) && (
                            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                              <span style={{ color: '#888' }}>Crit Multiplier</span>
                              <span style={{ color: '#f87171' }}>+{(passiveTreeStats.increasedSpellCritMultiplierPct || 0) + (passiveTreeStats.increasedCritMultiplierPct || 0)}%</span>
                            </div>
                          )}
                        </div>
                      </div>
                    )}

                    {/* Damage Multipliers */}
                    <div style={{ marginBottom: 16 }}>
                      <div style={{ color: '#666', fontSize: '0.75rem', marginBottom: 4 }}>DAMAGE MULTIPLIERS (Total including Passives)</div>
                      <div style={{ display: 'grid', gap: 4, fontSize: '0.8rem' }}>
                        {breakdown.spellDamagePercent > 0 && (
                          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                            <span style={{ color: '#888' }}>Spell Damage %</span>
                            <span style={{ color: '#4CAF50' }}>+{breakdown.spellDamagePercent.toFixed(0)}%</span>
                          </div>
                        )}
                        {breakdown.elementalPercent > 0 && (
                          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                            <span style={{ color: '#888' }}>Elemental Damage %</span>
                            <span style={{ color: '#FF9800' }}>+{breakdown.elementalPercent.toFixed(0)}%</span>
                          </div>
                        )}
                        {breakdown.physicalDamagePercent > 0 && (
                          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                            <span style={{ color: '#888' }}>Physical Damage %</span>
                            <span style={{ color: '#4CAF50' }}>+{breakdown.physicalDamagePercent.toFixed(0)}%</span>
                          </div>
                        )}
                        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                          <span style={{ color: '#888' }}>Total Multiplier</span>
                          <span style={{ color: '#fff' }}>×{breakdown.totalDamageMultiplier.toFixed(2)}</span>
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', borderTop: '1px solid #333', paddingTop: 4 }}>
                          <span style={{ color: '#888' }}>Final Hit Damage</span>
                          <span style={{ color: '#fff', fontWeight: 'bold' }}>{breakdown.finalDamage.toFixed(0)}</span>
                        </div>
                      </div>
                    </div>

                    {/* Cast Speed */}
                    <div style={{ marginBottom: 16 }}>
                      <div style={{ color: '#666', fontSize: '0.75rem', marginBottom: 4 }}>CAST SPEED</div>
                      <div style={{ display: 'grid', gap: 4, fontSize: '0.8rem' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                          <span style={{ color: '#888' }}>Base Cast Speed</span>
                          <span style={{ color: '#fff' }}>{breakdown.baseCastSpeed.toFixed(2)}/s</span>
                        </div>
                        {breakdown.castSpeedPercent > 0 && (
                          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                            <span style={{ color: '#888' }}>Cast Speed Bonus</span>
                            <span style={{ color: '#4CAF50' }}>+{breakdown.castSpeedPercent.toFixed(0)}%</span>
                          </div>
                        )}
                        <div style={{ display: 'flex', justifyContent: 'space-between', borderTop: '1px solid #333', paddingTop: 4 }}>
                          <span style={{ color: '#888' }}>Final Cast Speed</span>
                          <span style={{ color: '#fff', fontWeight: 'bold' }}>{breakdown.finalCastSpeed.toFixed(2)}/s</span>
                        </div>
                      </div>
                    </div>

                    {/* Critical Strike */}
                    <div style={{ marginBottom: 16 }}>
                      <div style={{ color: '#666', fontSize: '0.75rem', marginBottom: 4 }}>CRITICAL STRIKE</div>
                      <div style={{ display: 'grid', gap: 4, fontSize: '0.8rem' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                          <span style={{ color: '#888' }}>Base Crit Chance</span>
                          <span style={{ color: '#fff' }}>{breakdown.baseCritChance.toFixed(0)}%</span>
                        </div>
                        {breakdown.critChanceAdd > 0 && (
                          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                            <span style={{ color: '#888' }}>Added Crit Chance</span>
                            <span style={{ color: '#E91E63' }}>+{breakdown.critChanceAdd.toFixed(0)}%</span>
                          </div>
                        )}
                        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                          <span style={{ color: '#888' }}>Final Crit Chance</span>
                          <span style={{ color: '#E91E63' }}>{breakdown.finalCritChance.toFixed(0)}%</span>
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', borderTop: '1px solid #333', paddingTop: 4 }}>
                          <span style={{ color: '#888' }}>Effective Crit Multi</span>
                          <span style={{ color: '#fff' }}>×{breakdown.effectiveCritMult.toFixed(3)}</span>
                        </div>
                      </div>
                    </div>

                    {/* Support Skills Multipliers */}
                    {(breakdown.supportMoreDamage !== 0 || breakdown.supportMoreSpeed !== 0) && (
                      <div style={{ marginBottom: 16 }}>
                        <div style={{ color: '#666', fontSize: '0.75rem', marginBottom: 4 }}>SUPPORT SKILLS</div>
                        <div style={{ display: 'grid', gap: 4, fontSize: '0.8rem' }}>
                          {breakdown.supportMoreDamage !== 0 && (
                            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                              <span style={{ color: '#888' }}>More Damage</span>
                              <span style={{ color: breakdown.supportMoreDamage > 0 ? '#2ECC71' : '#E74C3C' }}>
                                {breakdown.supportMoreDamage > 0 ? '+' : ''}{breakdown.supportMoreDamage}%
                              </span>
                            </div>
                          )}
                          {breakdown.supportMoreSpeed !== 0 && (
                            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                              <span style={{ color: '#888' }}>More Cast Speed</span>
                              <span style={{ color: breakdown.supportMoreSpeed > 0 ? '#3498DB' : '#E74C3C' }}>
                                {breakdown.supportMoreSpeed > 0 ? '+' : ''}{breakdown.supportMoreSpeed}%
                              </span>
                            </div>
                          )}
                          <div style={{ display: 'flex', justifyContent: 'space-between', borderTop: '1px solid #333', paddingTop: 4 }}>
                            <span style={{ color: '#888' }}>Support Damage Multi</span>
                            <span style={{ color: '#2ECC71' }}>×{breakdown.supportDamageMultiplier.toFixed(2)}</span>
                          </div>
                          {breakdown.supportSpeedMultiplier !== 1 && (
                            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                              <span style={{ color: '#888' }}>Support Speed Multi</span>
                              <span style={{ color: '#3498DB' }}>×{breakdown.supportSpeedMultiplier.toFixed(2)}</span>
                            </div>
                          )}
                        </div>
                      </div>
                    )}

                    {/* Final DPS */}
                    <div style={{
                      background: '#2d1f3d',
                      padding: 12,
                      borderRadius: 4,
                      border: '1px solid #9B59B6'
                    }}>
                      <div style={{ color: '#888', fontSize: '0.75rem', marginBottom: 4 }}>FINAL DPS</div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <span style={{ color: '#888', fontSize: '0.7rem' }}>
                          {breakdown.finalDamage.toFixed(0)} × {breakdown.finalCastSpeed.toFixed(2)} × {breakdown.effectiveCritMult.toFixed(3)}
                          {breakdown.supportDamageMultiplier !== 1 && ` × ${breakdown.supportDamageMultiplier.toFixed(2)}`}
                          {breakdown.supportSpeedMultiplier !== 1 && ` × ${breakdown.supportSpeedMultiplier.toFixed(2)}`}
                        </span>
                        <span style={{ color: '#4CAF50', fontWeight: 'bold', fontSize: '1.3rem' }}>
                          {breakdown.finalDps.toFixed(0)}
                        </span>
                      </div>
                    </div>
                  </div>
                );
              })()}
            </div>
          )}
        </div>
      </div>

      {/* Passive Tree Optimizer Section */}
      {selectedSkill && (
        <PassiveTreeOptimizerComponent
          skillElement={
            selectedSkill.element === 'Fire' ? 'fire' :
            selectedSkill.element === 'Cold' ? 'cold' :
            selectedSkill.element === 'Lightning' ? 'lightning' :
            selectedSkill.element === 'Chaos' ? 'chaos' :
            selectedSkill.element === 'Physical' ? 'physical' :
            selectedSkill.element ? 'elemental' : 'generic'
          }
          baseDamage={getSkillBaseDamage(selectedSkill)}
          baseCastSpeed={selectedSkill.castTime ? 1 / selectedSkill.castTime : 1}
          baseCritChance={selectedSkill.baseDamageData?.critChance || (selectedWeapon?.critChance) || 5}
          maxPoints={120}
          onStatsChange={(stats) => setPassiveTreeStats(stats)}
        />
      )}
    </div>
  );
};

export default SpellSkillsPlanner;

