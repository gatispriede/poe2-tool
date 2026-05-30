import React, { useState, useEffect, useMemo, useRef } from 'react';
import { SciChartSurface } from 'scichart/Charting/Visuals/SciChartSurface';
import { NumericAxis } from 'scichart/Charting/Visuals/Axis/NumericAxis';
import { FastColumnRenderableSeries } from 'scichart/Charting/Visuals/RenderableSeries/FastColumnRenderableSeries';
import { XyDataSeries } from 'scichart/Charting/Model/XyDataSeries';
import { GradientParams } from 'scichart/Core/GradientParams';
import { Point } from 'scichart/Core/Point';
import { NumberRange } from 'scichart/Core/NumberRange';
import { EAxisAlignment } from 'scichart/types/AxisAlignment';

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

// Helper functions
const getSkillBaseDamageMultiplier = (skill: Skill): number => {
  // First check baseDamageData
  if (skill.baseDamageData?.baseMultiplierLvl20) {
    return skill.baseDamageData.baseMultiplierLvl20;
  }
  if (skill.baseDamageData?.baseMultiplier) {
    return skill.baseDamageData.baseMultiplier;
  }
  // Use moreDamageMultipliersPct if available (convert % to multiplier)
  if (skill.moreDamageMultipliersPct && skill.moreDamageMultipliersPct.length > 0) {
    // moreDamageMultipliersPct contains values like [20] meaning +20% more damage
    // We convert to multiplier: 1 + sum/100
    const totalMore = skill.moreDamageMultipliersPct.reduce((sum, val) => sum + val, 0);
    return 1 + totalMore / 100;
  }
  return 1;
};


const mapWeaponRequirementToTypes = (requirement: string | null): string[] => {
  if (!requirement) return [];
  const mapping: Record<string, string[]> = {
    'One Hand Mace': ['One Handed Mace'],
    'Two Hand Mace': ['Two Handed Mace'],
    'One Hand Sword': ['One Handed Sword'],
    'Two Hand Sword': ['Two Handed Sword'],
    'One Hand Axe': ['One Handed Axe'],
    'Two Hand Axe': ['Two Handed Axe'],
    'Bow': ['Bow'],
    'Crossbow': ['Crossbow'],
    'Staff': ['Staff', 'Quarterstaff'],
    'Quarterstaff': ['Quarterstaff'],
    'Wand': ['Wand'],
    'Dagger': ['Dagger'],
    'Claw': ['Claw'],
    'Spear': ['Spear'],
    'Flail': ['Flail'],
    'Sceptre': ['Sceptre'],
    'Any Melee Martial Weapon': ['One Handed Sword', 'Two Handed Sword', 'One Handed Axe', 'Two Handed Axe', 'One Handed Mace', 'Two Handed Mace', 'Staff', 'Quarterstaff', 'Dagger', 'Claw', 'Spear', 'Flail', 'Sceptre'],
    'Unarmed': [],
  };
  const types: string[] = [];
  requirement.split(/,|or/).map(p => p.trim()).forEach(part => {
    if (mapping[part]) types.push(...mapping[part]);
    else types.push(part);
  });
  return Array.from(new Set(types));
};

// Parse mod value from stat string like "(40-49)% increased Physical Damage"
const parseModValue = (stat: string): { min: number; max: number; type: string } | null => {
  // Match patterns like (40-49)% or +(4.41-5)% or +5 to +10 or +(5-8)
  const rangeMatch = stat.match(/\((\d+(?:\.\d+)?)-(\d+(?:\.\d+)?)\)/);
  const plusMatch = stat.match(/\+(\d+(?:\.\d+)?)/);

  let min = 0, max = 0;
  if (rangeMatch) {
    min = parseFloat(rangeMatch[1]);
    max = parseFloat(rangeMatch[2]);
  } else if (plusMatch) {
    min = max = parseFloat(plusMatch[1]);
  }

  // Determine type
  let type = 'other';
  const lowerStat = stat.toLowerCase();
  if (lowerStat.includes('physical damage') && lowerStat.includes('increased')) type = 'physPercent';
  else if (lowerStat.includes('physical damage') && lowerStat.includes('adds')) type = 'physFlat';
  else if (lowerStat.includes('attack speed')) type = 'attackSpeed';
  else if (lowerStat.includes('critical hit chance') || lowerStat.includes('critical strike chance')) type = 'critChance';
  else if (lowerStat.includes('critical damage bonus') || lowerStat.includes('critical strike multiplier') || lowerStat.includes('critical damage')) type = 'critMulti';
  else if (lowerStat.includes('fire damage')) type = 'fire';
  else if (lowerStat.includes('cold damage')) type = 'cold';
  else if (lowerStat.includes('lightning damage')) type = 'lightning';
  else if (lowerStat.includes('chaos damage')) type = 'chaos';

  return { min, max, type };
};


// Calculate DPS with mods applied
const calculateModdedDps = (
  weapon: Weapon,
  skill: Skill,
  prefixes: WeaponMod[],
  suffixes: WeaponMod[],
  bonusCritMult: number = 0,
  bonusCrit: number = 0,
  bonusAttackSpeed: number = 0,
  supportMoreDamage: number = 0,
  supportMoreSpeed: number = 0
): number => {
  const breakdown = getAttackDpsBreakdown(weapon, skill, prefixes, suffixes, bonusCritMult, bonusCrit, bonusAttackSpeed, supportMoreDamage, supportMoreSpeed);
  return breakdown.finalDps;
};

// Detailed breakdown interface
interface AttackDpsBreakdown {
  basePhysMin: number;
  basePhysMax: number;
  physFlatMin: number;
  physFlatMax: number;
  physPercent: number;
  newPhysMin: number;
  newPhysMax: number;
  avgPhys: number;
  elemental: number;
  totalAvgDamage: number;
  baseAttackSpeed: number;
  attackSpeedPercent: number;
  newAttackSpeed: number;
  skillMult: number;
  baseCritChance: number;
  critChanceAdd: number;
  effectiveCritMult: number;
  // Support skill multipliers
  supportMoreDamage: number;
  supportMoreSpeed: number;
  supportDamageMultiplier: number;
  supportSpeedMultiplier: number;
  finalDps: number;
}

const getAttackDpsBreakdown = (
  weapon: Weapon,
  skill: Skill,
  prefixes: WeaponMod[],
  suffixes: WeaponMod[],
  bonusCritMult: number = 0,
  bonusCrit: number = 0,
  bonusAttackSpeed: number = 0,
  supportMoreDamage: number = 0,
  supportMoreSpeed: number = 0
): AttackDpsBreakdown => {
  let physPercent = 0;
  let physFlatMin = 0;
  let physFlatMax = 0;
  let attackSpeedPercent = bonusAttackSpeed;
  let critChanceAdd = bonusCrit;
  let elemental = 0;

  [...prefixes, ...suffixes].forEach(mod => {
    mod.stats.forEach(stat => {
      const parsed = parseModValue(stat);
      if (!parsed) return;

      const avgValue = (parsed.min + parsed.max) / 2;

      switch (parsed.type) {
        case 'physPercent':
          physPercent += avgValue;
          break;
        case 'physFlat':
          physFlatMin += parsed.min;
          physFlatMax += parsed.max;
          break;
        case 'attackSpeed':
          attackSpeedPercent += avgValue;
          break;
        case 'critChance':
          critChanceAdd += avgValue;
          break;
        case 'fire':
        case 'cold':
        case 'lightning':
        case 'chaos':
          elemental += avgValue;
          break;
      }
    });
  });

  const basePhysMin = weapon.damage.physical.min;
  const basePhysMax = weapon.damage.physical.max;
  const newPhysMin = (basePhysMin + physFlatMin) * (1 + physPercent / 100);
  const newPhysMax = (basePhysMax + physFlatMax) * (1 + physPercent / 100);
  const avgPhys = (newPhysMin + newPhysMax) / 2;

  const baseElemental =
    (weapon.damage.fire.min + weapon.damage.fire.max) / 2 +
    (weapon.damage.cold.min + weapon.damage.cold.max) / 2 +
    (weapon.damage.lightning.min + weapon.damage.lightning.max) / 2 +
    (weapon.damage.chaos.min + weapon.damage.chaos.max) / 2;

  const totalAvgDamage = avgPhys + elemental + baseElemental;

  const baseAttackSpeed = weapon.attackRate;
  const newAttackSpeed = baseAttackSpeed * (1 + attackSpeedPercent / 100);
  const skillMult = getSkillBaseDamageMultiplier(skill);
  const baseCritChance = weapon.critChance;
  const critChance = Math.min(100, baseCritChance + critChanceAdd);
  // Base crit multiplier is 150% (1.5x), bonus adds to that
  const baseCritMultiplier = 1.5 + bonusCritMult / 100;
  const effectiveCritMult = 1 + (critChance / 100) * (baseCritMultiplier - 1);

  // Support skill multipliers
  const supportDamageMultiplier = 1 + supportMoreDamage / 100;
  const supportSpeedMultiplier = 1 + supportMoreSpeed / 100;

  // Final DPS with support multipliers
  const finalDps = totalAvgDamage * skillMult * newAttackSpeed * supportSpeedMultiplier * effectiveCritMult * supportDamageMultiplier;

  return {
    basePhysMin,
    basePhysMax,
    physFlatMin,
    physFlatMax,
    physPercent,
    newPhysMin,
    newPhysMax,
    avgPhys,
    elemental,
    totalAvgDamage,
    baseAttackSpeed,
    attackSpeedPercent,
    newAttackSpeed,
    skillMult,
    baseCritChance,
    critChanceAdd,
    effectiveCritMult,
    supportMoreDamage,
    supportMoreSpeed,
    supportDamageMultiplier,
    supportSpeedMultiplier,
    finalDps
  };
};

// Generate mod combinations for chart
interface ModCombination {
  name: string;
  dps: number;
  prefixes: WeaponMod[];
  suffixes: WeaponMod[];
}

// Calculate DPS contribution of a single mod
const calculateModDpsContribution = (
  weapon: Weapon,
  skill: Skill,
  mod: WeaponMod,
  baseDps: number,
  bonusCritMult: number,
  bonusCrit: number,
  bonusAttackSpeed: number
): number => {
  const dpsWithMod = calculateModdedDps(weapon, skill,
    mod.type === 'Prefix' ? [mod] : [],
    mod.type === 'Suffix' ? [mod] : [],
    bonusCritMult, bonusCrit, bonusAttackSpeed);
  return dpsWithMod - baseDps;
};

// Get best mods sorted by DPS contribution
const getBestModsForAttack = (
  weapon: Weapon,
  skill: Skill,
  mods: WeaponMod[],
  bonusCritMult: number,
  bonusCrit: number,
  bonusAttackSpeed: number
): WeaponMod[] => {
  const baseDps = calculateModdedDps(weapon, skill, [], [], bonusCritMult, bonusCrit, bonusAttackSpeed);

  // Filter mods that can roll on this weapon
  const applicableMods = mods.filter(mod => {
    return mod.applicableWeapons.some(w => {
      if (w === 'All Weapons') return true;
      if (w === weapon.type) return true;
      if (weapon.type.includes(w)) return true;
      return false;
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

  // Calculate DPS contribution for each and sort
  const modsWithDps = uniqueMods.map(mod => ({
    mod,
    dpsContribution: calculateModDpsContribution(weapon, skill, mod, baseDps, bonusCritMult, bonusCrit, bonusAttackSpeed)
  }));

  modsWithDps.sort((a, b) => b.dpsContribution - a.dpsContribution);

  return modsWithDps.map(m => m.mod);
};

const generateModCombinations = (
  weapon: Weapon,
  skill: Skill,
  allPrefixes: WeaponMod[],
  allSuffixes: WeaponMod[],
  bonusCritMult: number = 0,
  bonusCrit: number = 0,
  bonusAttackSpeed: number = 0
): ModCombination[] => {
  // Get best mods sorted by DPS contribution
  const bestPrefixes = getBestModsForAttack(weapon, skill, allPrefixes, bonusCritMult, bonusCrit, bonusAttackSpeed);
  const bestSuffixes = getBestModsForAttack(weapon, skill, allSuffixes, bonusCritMult, bonusCrit, bonusAttackSpeed);

  const top3Prefixes = bestPrefixes.slice(0, 3);
  const top3Suffixes = bestSuffixes.slice(0, 3);

  const combinations: ModCombination[] = [];

  // Base (no mods)
  combinations.push({
    name: 'No Mods (Base)',
    dps: calculateModdedDps(weapon, skill, [], [], bonusCritMult, bonusCrit, bonusAttackSpeed),
    prefixes: [],
    suffixes: []
  });

  // TOP 1: Best 3 Prefixes + Best 3 Suffixes (Full 6 mods)
  if (top3Prefixes.length >= 3 && top3Suffixes.length >= 3) {
    combinations.push({
      name: '🥇 BEST: 3P + 3S',
      dps: calculateModdedDps(weapon, skill, top3Prefixes, top3Suffixes, bonusCritMult, bonusCrit, bonusAttackSpeed),
      prefixes: top3Prefixes,
      suffixes: top3Suffixes
    });
  }

  // TOP 2: Best 3 Prefixes + Best 2 Suffixes
  if (top3Prefixes.length >= 3 && top3Suffixes.length >= 2) {
    combinations.push({
      name: '🥈 3P + 2S',
      dps: calculateModdedDps(weapon, skill, top3Prefixes, top3Suffixes.slice(0, 2), bonusCritMult, bonusCrit, bonusAttackSpeed),
      prefixes: top3Prefixes,
      suffixes: top3Suffixes.slice(0, 2)
    });
  }

  // TOP 3: Best 2 Prefixes + Best 3 Suffixes
  if (top3Prefixes.length >= 2 && top3Suffixes.length >= 3) {
    combinations.push({
      name: '🥉 2P + 3S',
      dps: calculateModdedDps(weapon, skill, top3Prefixes.slice(0, 2), top3Suffixes, bonusCritMult, bonusCrit, bonusAttackSpeed),
      prefixes: top3Prefixes.slice(0, 2),
      suffixes: top3Suffixes
    });
  }

  // Additional combinations for comparison
  // 3 Prefixes + 1 Suffix
  if (top3Prefixes.length >= 3 && top3Suffixes.length >= 1) {
    combinations.push({
      name: '3P + 1S',
      dps: calculateModdedDps(weapon, skill, top3Prefixes, top3Suffixes.slice(0, 1), bonusCritMult, bonusCrit, bonusAttackSpeed),
      prefixes: top3Prefixes,
      suffixes: top3Suffixes.slice(0, 1)
    });
  }

  // 1 Prefix + 3 Suffixes
  if (top3Prefixes.length >= 1 && top3Suffixes.length >= 3) {
    combinations.push({
      name: '1P + 3S',
      dps: calculateModdedDps(weapon, skill, top3Prefixes.slice(0, 1), top3Suffixes, bonusCritMult, bonusCrit, bonusAttackSpeed),
      prefixes: top3Prefixes.slice(0, 1),
      suffixes: top3Suffixes
    });
  }

  // 3 Prefixes Only
  if (top3Prefixes.length >= 3) {
    combinations.push({
      name: '3 Prefixes Only',
      dps: calculateModdedDps(weapon, skill, top3Prefixes, [], bonusCritMult, bonusCrit, bonusAttackSpeed),
      prefixes: top3Prefixes,
      suffixes: []
    });
  }

  // 3 Suffixes Only
  if (top3Suffixes.length >= 3) {
    combinations.push({
      name: '3 Suffixes Only',
      dps: calculateModdedDps(weapon, skill, [], top3Suffixes, bonusCritMult, bonusCrit, bonusAttackSpeed),
      prefixes: [],
      suffixes: top3Suffixes
    });
  }

  // Best Single Prefix
  if (top3Prefixes.length >= 1) {
    combinations.push({
      name: `Best Prefix: ${top3Prefixes[0].affix}`,
      dps: calculateModdedDps(weapon, skill, [top3Prefixes[0]], [], bonusCritMult, bonusCrit, bonusAttackSpeed),
      prefixes: [top3Prefixes[0]],
      suffixes: []
    });
  }

  // Best Single Suffix
  if (top3Suffixes.length >= 1) {
    combinations.push({
      name: `Best Suffix: ${top3Suffixes[0].affix}`,
      dps: calculateModdedDps(weapon, skill, [], [top3Suffixes[0]], bonusCritMult, bonusCrit, bonusAttackSpeed),
      prefixes: [],
      suffixes: [top3Suffixes[0]]
    });
  }

  // Sort by DPS ascending (for chart display - bars grow left to right)
  combinations.sort((a, b) => a.dps - b.dps);

  return combinations;
};

const AttackSkillsPlanner: React.FC = () => {
  const [skills, setSkills] = useState<Skill[]>([]);
  const [weapons, setWeapons] = useState<Weapon[]>([]);
  const [weaponMods, setWeaponMods] = useState<WeaponModsData>({ prefixes: [], suffixes: [] });
  const [selectedSkill, setSelectedSkill] = useState<Skill | null>(null);
  const [selectedWeapon, setSelectedWeapon] = useState<Weapon | null>(null);
  const [searchSkill, setSearchSkill] = useState('');
  const [searchWeapon, setSearchWeapon] = useState('');
  const [selectedCombination, setSelectedCombination] = useState<ModCombination | null>(null);

  // Support skills selection (up to 5)
  const [selectedSupportSkills, setSelectedSupportSkills] = useState<Skill[]>([]);
  const [searchSupport, setSearchSupport] = useState('');

  // Trigger skills selection
  const [selectedTriggerSkills, setSelectedTriggerSkills] = useState<Skill[]>([]);
  const [searchTrigger, setSearchTrigger] = useState('');

  // Manual bonus inputs
  const [bonusCritMultiplier, setBonusCritMultiplier] = useState<number>(0);
  const [bonusCritChance, setBonusCritChance] = useState<number>(0);
  const [bonusAttackSpeed, setBonusAttackSpeed] = useState<number>(0);

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

  // Filter to active attack skills only (exclude support and trigger skills)
  const attackSkills = useMemo(() => {
    return skills.filter(s =>
      (s.type === 'Attack' ||
       s.gemType === 'Attack' ||
       (s.baseDamageData?.baseMultiplier && s.weaponRequirements)) &&
      // Exclude support gems
      s.gemType !== 'Support' &&
      s.type !== 'Support'
      // Note: isTrigger means "can be triggered", not "is a trigger gem" - so we don't filter by it
    ).sort((a, b) => getSkillBaseDamageMultiplier(b) - getSkillBaseDamageMultiplier(a));
  }, [skills]);

  // Filter to support skills that can work with attacks
  const supportSkills = useMemo(() => {
    return skills.filter(s =>
      s.gemType === 'Support' &&
      !s.isTrigger &&
      // Support skills that work with attacks
      (s.tags.includes('attack') ||
       s.tagString.toLowerCase().includes('attack') ||
       s.tags.includes('melee') ||
       (!s.tags.includes('spell')))
    ).sort((a, b) => {
      // Sort by damage contribution
      const aDmg = a.moreDamageMultipliersPct.reduce((sum, v) => sum + v, 0);
      const bDmg = b.moreDamageMultipliersPct.reduce((sum, v) => sum + v, 0);
      return bDmg - aDmg;
    });
  }, [skills]);

  // Filter to trigger skills
  const triggerSkills = useMemo(() => {
    return skills.filter(s =>
      s.isTrigger === true &&
      // Must be attack-related
      (s.gemType === 'Attack' ||
       s.type === 'Attack' ||
       s.tags.includes('attack') ||
       s.tags.includes('melee'))
    ).sort((a, b) => a.name.localeCompare(b.name));
  }, [skills]);

  // Filter weapons by skill requirements
  const compatibleWeapons = useMemo(() => {
    if (!selectedSkill) return weapons;
    const allowedTypes = mapWeaponRequirementToTypes(selectedSkill.weaponRequirements);
    if (allowedTypes.length === 0) {
      if (selectedSkill.weaponRequirements === 'Unarmed') return [];
      return weapons;
    }
    return weapons.filter(w => allowedTypes.includes(w.type));
  }, [weapons, selectedSkill]);

  // Filtered lists for dropdowns
  const filteredSkills = useMemo(() => {
    if (!searchSkill) return attackSkills;
    return attackSkills.filter(s => s.name.toLowerCase().includes(searchSkill.toLowerCase()));
  }, [attackSkills, searchSkill]);

  const filteredWeapons = useMemo(() => {
    let result = compatibleWeapons;
    if (searchWeapon) {
      result = result.filter(w => w.name.toLowerCase().includes(searchWeapon.toLowerCase()));
    }
    // Sort by DPS descending (highest first)
    return result.sort((a, b) => b.dps.total - a.dps.total);
  }, [compatibleWeapons, searchWeapon]);

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
      support.moreDamageMultipliersPct.forEach(m => totalMoreDamage += m);
      support.moreAttackSpeedMultipliersPct.forEach(m => totalMoreSpeed += m);
    });

    return { totalMoreDamage, totalMoreSpeed };
  }, [selectedSupportSkills]);

  // Calculate best mods for display (top 3 prefixes and suffixes by DPS contribution)
  const bestMods = useMemo(() => {
    if (!selectedSkill || !selectedWeapon) return { prefixes: [], suffixes: [] };

    const bestPrefixes = getBestModsForAttack(selectedWeapon, selectedSkill, weaponMods.prefixes, bonusCritMultiplier, bonusCritChance, bonusAttackSpeed);
    const bestSuffixes = getBestModsForAttack(selectedWeapon, selectedSkill, weaponMods.suffixes, bonusCritMultiplier, bonusCritChance, bonusAttackSpeed);

    return {
      prefixes: bestPrefixes.slice(0, 3),
      suffixes: bestSuffixes.slice(0, 3)
    };
  }, [selectedSkill, selectedWeapon, weaponMods, bonusCritMultiplier, bonusCritChance, bonusAttackSpeed]);

  // Calculate mod combinations for chart
  const modCombinations = useMemo(() => {
    if (!selectedSkill || !selectedWeapon) return [];
    return generateModCombinations(selectedWeapon, selectedSkill, weaponMods.prefixes, weaponMods.suffixes, bonusCritMultiplier, bonusCritChance, bonusAttackSpeed);
  }, [selectedSkill, selectedWeapon, weaponMods, bonusCritMultiplier, bonusCritChance, bonusAttackSpeed]);

  // Initialize and update SciChart
  useEffect(() => {
    if (!chartRef.current || modCombinations.length === 0) return;

    const initChart = async () => {
      // Clean up previous chart
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

        // X Axis (categories)
        const xAxis = new NumericAxis(wasmContext, {
          axisTitle: 'Mod Combination',
          axisTitleStyle: { color: '#c58602' },
          labelStyle: { color: '#888' },
          drawMajorGridLines: false,
          drawMinorGridLines: false,
        });
        sciChartSurface.xAxes.add(xAxis);

        // Y Axis (DPS)
        const maxDps = Math.max(...modCombinations.map(c => c.dps));
        const yAxis = new NumericAxis(wasmContext, {
          axisTitle: 'DPS',
          axisTitleStyle: { color: '#c58602' },
          labelStyle: { color: '#888' },
          axisAlignment: EAxisAlignment.Left,
          visibleRange: new NumberRange(0, maxDps * 1.1),
          drawMajorGridLines: true,
          drawMinorGridLines: false,
        });
        sciChartSurface.yAxes.add(yAxis);

        // Data
        const xValues = modCombinations.map((_, i) => i);
        const yValues = modCombinations.map(c => c.dps);

        const dataSeries = new XyDataSeries(wasmContext, { xValues, yValues });

        const columnSeries = new FastColumnRenderableSeries(wasmContext, {
          dataSeries,
          fill: '#c5860288',
          stroke: '#c58602',
          strokeThickness: 2,
          dataPointWidth: 0.7,
          fillLinearGradient: new GradientParams(new Point(0, 0), new Point(0, 1), [
            { color: '#c58602', offset: 0 },
            { color: '#8B5A00', offset: 1 }
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

  return (
    <div style={{ padding: 20, background: '#121212', minHeight: '100vh', color: '#fff' }}>
      <h1 style={{ margin: 0, marginBottom: 8, color: '#c58602' }}>
        ⚔️ Attack Skills Planner
      </h1>
      <p style={{ margin: 0, marginBottom: 24, color: '#888', fontSize: '0.9rem' }}>
        Select an attack skill and weapon to see damage with different mod combinations
      </p>

      <div style={{ display: 'flex', gap: 24, flexWrap: 'wrap' }}>
        {/* Selection Panel */}
        <div style={{ flex: '1 1 350px', maxWidth: 450 }}>
          {/* Skill Selection */}
          <div style={{ marginBottom: 20 }}>
            <label style={{ display: 'block', marginBottom: 8, color: '#c58602', fontWeight: 'bold' }}>
              Attack Skill ({attackSkills.length} skills)
            </label>
            <input
              type="text"
              placeholder="Search attack skills..."
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
            <div style={{ maxHeight: 200, overflowY: 'auto', background: '#1a1a1a', borderRadius: 4, border: '1px solid #333' }}>
              {filteredSkills.slice(0, 50).map(skill => (
                <div
                  key={skill.id}
                  onClick={() => {
                    setSelectedSkill(skill);
                    setSelectedWeapon(null);
                  }}
                  style={{
                    padding: '8px 12px',
                    cursor: 'pointer',
                    background: selectedSkill?.id === skill.id ? '#3a2510' : 'transparent',
                    borderBottom: '1px solid #333',
                    display: 'flex',
                    justifyContent: 'space-between'
                  }}
                >
                  <span style={{ color: selectedSkill?.id === skill.id ? '#c58602' : '#fff' }}>
                    {skill.name}
                  </span>
                  <span style={{ color: '#4CAF50', fontSize: '0.8rem' }}>
                    {(getSkillBaseDamageMultiplier(skill) * 100).toFixed(0)}%
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* Weapon Selection */}
          <div style={{ marginBottom: 20 }}>
            <label style={{ display: 'block', marginBottom: 8, color: '#c58602', fontWeight: 'bold' }}>
              Weapon ({compatibleWeapons.length} compatible)
            </label>
            <input
              type="text"
              placeholder="Search weapons..."
              value={searchWeapon}
              onChange={(e) => setSearchWeapon(e.target.value)}
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
            <div style={{ maxHeight: 250, overflowY: 'auto', background: '#1a1a1a', borderRadius: 4, border: '1px solid #333' }}>
              {filteredWeapons.slice(0, 50).map(weapon => (
                <div
                  key={weapon.id}
                  onClick={() => setSelectedWeapon(weapon)}
                  style={{
                    padding: '8px 12px',
                    cursor: 'pointer',
                    background: selectedWeapon?.id === weapon.id ? '#102a3a' : 'transparent',
                    borderBottom: '1px solid #333',
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                    <span style={{ color: selectedWeapon?.id === weapon.id ? '#3498DB' : '#fff', fontWeight: 'bold' }}>
                      {weapon.name}
                    </span>
                    <span style={{ color: '#4CAF50', fontSize: '0.8rem', fontWeight: 'bold' }}>
                      {weapon.dps.total.toFixed(0)} DPS
                    </span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem' }}>
                    <span style={{ color: '#888' }}>{weapon.type}</span>
                    <div style={{ display: 'flex', gap: 12 }}>
                      <span style={{ color: '#ccc' }}>
                        ⚔️ {weapon.damage.physical.min}-{weapon.damage.physical.max}
                      </span>
                      <span style={{ color: '#E91E63' }}>
                        💥 {weapon.critChance}%
                      </span>
                      <span style={{ color: '#3498DB' }}>
                        ⚡ {weapon.attackRate.toFixed(2)}/s
                      </span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Selected Info */}
          {selectedSkill && selectedWeapon && (
            <div style={{ background: '#1a1a1a', borderRadius: 8, padding: 16, border: '1px solid #333' }}>
              <h3 style={{ margin: 0, marginBottom: 12, color: '#c58602' }}>Selection</h3>
              <div style={{ marginBottom: 8 }}>
                <span style={{ color: '#888' }}>Skill: </span>
                <span style={{ color: '#fff' }}>{selectedSkill.name}</span>
                <span style={{ color: '#4CAF50', marginLeft: 8 }}>
                  ({(getSkillBaseDamageMultiplier(selectedSkill) * 100).toFixed(0)}% of weapon damage)
                </span>
              </div>
              <div style={{ marginBottom: 8 }}>
                <span style={{ color: '#888' }}>Weapon: </span>
                <span style={{ color: '#fff' }}>{selectedWeapon.name}</span>
                <span style={{ color: '#666', marginLeft: 8, fontSize: '0.85rem' }}>
                  ({selectedWeapon.type})
                </span>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 8, marginTop: 12, padding: 10, background: '#222', borderRadius: 6 }}>
                <div>
                  <div style={{ color: '#888', fontSize: '0.7rem' }}>Physical Damage</div>
                  <div style={{ color: '#ccc', fontWeight: 'bold' }}>
                    {selectedWeapon.damage.physical.min} - {selectedWeapon.damage.physical.max}
                  </div>
                </div>
                <div>
                  <div style={{ color: '#888', fontSize: '0.7rem' }}>Base DPS</div>
                  <div style={{ color: '#4CAF50', fontWeight: 'bold' }}>
                    {selectedWeapon.dps.total.toFixed(1)}
                  </div>
                </div>
                <div>
                  <div style={{ color: '#888', fontSize: '0.7rem' }}>Critical Chance</div>
                  <div style={{ color: '#E91E63', fontWeight: 'bold' }}>
                    {selectedWeapon.critChance}%
                  </div>
                </div>
                <div>
                  <div style={{ color: '#888', fontSize: '0.7rem' }}>Attack Speed</div>
                  <div style={{ color: '#3498DB', fontWeight: 'bold' }}>
                    {selectedWeapon.attackRate.toFixed(2)}/s
                  </div>
                </div>
                {(selectedWeapon.damage.fire.max > 0 || selectedWeapon.damage.cold.max > 0 ||
                  selectedWeapon.damage.lightning.max > 0 || selectedWeapon.damage.chaos.max > 0) && (
                  <div style={{ gridColumn: 'span 2' }}>
                    <div style={{ color: '#888', fontSize: '0.7rem' }}>Elemental Damage</div>
                    <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
                      {selectedWeapon.damage.fire.max > 0 && (
                        <span style={{ color: '#E25822' }}>🔥 {selectedWeapon.damage.fire.min}-{selectedWeapon.damage.fire.max}</span>
                      )}
                      {selectedWeapon.damage.cold.max > 0 && (
                        <span style={{ color: '#5DADE2' }}>❄️ {selectedWeapon.damage.cold.min}-{selectedWeapon.damage.cold.max}</span>
                      )}
                      {selectedWeapon.damage.lightning.max > 0 && (
                        <span style={{ color: '#F4D03F' }}>⚡ {selectedWeapon.damage.lightning.min}-{selectedWeapon.damage.lightning.max}</span>
                      )}
                      {selectedWeapon.damage.chaos.max > 0 && (
                        <span style={{ color: '#9B59B6' }}>💀 {selectedWeapon.damage.chaos.min}-{selectedWeapon.damage.chaos.max}</span>
                      )}
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Best Weapon Mods - Auto Generated */}
          {selectedSkill && selectedWeapon && (bestMods.prefixes.length > 0 || bestMods.suffixes.length > 0) && (
            <div style={{ background: '#1a1a1a', borderRadius: 8, padding: 16, border: '1px solid #4CAF50', marginTop: 16 }}>
              <h3 style={{ margin: 0, marginBottom: 4, color: '#4CAF50' }}>
                🎯 Best Weapon Mods (Auto-Selected)
              </h3>
              <p style={{ margin: 0, marginBottom: 12, color: '#666', fontSize: '0.75rem' }}>
                Top mods for maximum DPS based on your skill and weapon
              </p>

              {/* Best Prefixes */}
              <div style={{ marginBottom: 12 }}>
                <h4 style={{ margin: 0, marginBottom: 8, color: '#E74C3C', fontSize: '0.85rem' }}>
                  🔴 Best Prefixes ({bestMods.prefixes.length}/3)
                </h4>
                {bestMods.prefixes.length === 0 ? (
                  <div style={{ color: '#666', fontSize: '0.8rem', fontStyle: 'italic' }}>No applicable prefixes found</div>
                ) : (
                  bestMods.prefixes.map((mod, i) => (
                    <div key={mod.id} style={{
                      padding: '6px 10px',
                      background: '#222',
                      borderRadius: 4,
                      marginBottom: 4,
                      borderLeft: `3px solid ${i === 0 ? '#FFD700' : i === 1 ? '#C0C0C0' : '#CD7F32'}`
                    }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <span style={{ color: '#c58602', fontWeight: 'bold', fontSize: '0.8rem' }}>
                          #{i + 1} {mod.affix}
                        </span>
                        <span style={{ color: '#666', fontSize: '0.7rem' }}>Lvl {mod.level}</span>
                      </div>
                      {mod.stats.map((stat, j) => (
                        <div key={j} style={{ color: '#4CAF50', fontSize: '0.75rem' }}>{stat}</div>
                      ))}
                    </div>
                  ))
                )}
              </div>

              {/* Best Suffixes */}
              <div>
                <h4 style={{ margin: 0, marginBottom: 8, color: '#3498DB', fontSize: '0.85rem' }}>
                  🔵 Best Suffixes ({bestMods.suffixes.length}/3)
                </h4>
                {bestMods.suffixes.length === 0 ? (
                  <div style={{ color: '#666', fontSize: '0.8rem', fontStyle: 'italic' }}>No applicable suffixes found</div>
                ) : (
                  bestMods.suffixes.map((mod, i) => (
                    <div key={mod.id} style={{
                      padding: '6px 10px',
                      background: '#222',
                      borderRadius: 4,
                      marginBottom: 4,
                      borderLeft: `3px solid ${i === 0 ? '#FFD700' : i === 1 ? '#C0C0C0' : '#CD7F32'}`
                    }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <span style={{ color: '#3498DB', fontWeight: 'bold', fontSize: '0.8rem' }}>
                          #{i + 1} {mod.affix}
                        </span>
                        <span style={{ color: '#666', fontSize: '0.7rem' }}>Lvl {mod.level}</span>
                      </div>
                      {mod.stats.map((stat, j) => (
                        <div key={j} style={{ color: '#4CAF50', fontSize: '0.75rem' }}>{stat}</div>
                      ))}
                    </div>
                  ))
                )}
              </div>
            </div>
          )}

          {/* Manual Bonus Inputs */}
          <div style={{ background: '#1a1a1a', borderRadius: 8, padding: 16, border: '1px solid #333', marginTop: 16 }}>
            <h4 style={{ margin: 0, marginBottom: 12, color: '#c58602', fontSize: '0.9rem' }}>
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
                  Bonus Attack Speed (%)
                </label>
                <input
                  type="number"
                  value={bonusAttackSpeed}
                  onChange={(e) => setBonusAttackSpeed(Number(e.target.value) || 0)}
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
              Select up to 5 support gems to link with your attack. Sorted by damage contribution.
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
                Trigger skills activate based on conditions (e.g., on hit, on kill). They work alongside your active attack.
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
          <div style={{
            background: '#1a1a1a',
            borderRadius: 8,
            padding: 16,
            border: '1px solid #333'
          }}>
            <h3 style={{ margin: 0, marginBottom: 16, color: '#c58602' }}>
              DPS with Top-Tier Mod Combinations
            </h3>

            {!selectedSkill || !selectedWeapon ? (
              <div style={{ height: 400, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#666' }}>
                Select a skill and weapon to see damage chart
              </div>
            ) : (
              <>
                <div ref={chartRef} style={{ height: 350, width: '100%' }} />

                {/* Mod combinations legend */}
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
                              background: isSelected ? '#3a2510' : 'transparent'
                            }}
                          >
                            <td style={{ padding: 8, color: '#666' }}>{i + 1}</td>
                            <td style={{ padding: 8, color: '#c58602' }}>{combo.name}</td>
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
          {selectedSkill && selectedWeapon && selectedCombination && (
            <div style={{
              background: '#1a1a1a',
              borderRadius: 8,
              padding: 16,
              border: '1px solid #c58602',
              marginTop: 16
            }}>
              <h3 style={{ margin: 0, marginBottom: 16, color: '#c58602' }}>
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
                const breakdown = getAttackDpsBreakdown(selectedWeapon, selectedSkill, selectedCombination.prefixes, selectedCombination.suffixes, bonusCritMultiplier, bonusCritChance, bonusAttackSpeed, supportMultipliers.totalMoreDamage, supportMultipliers.totalMoreSpeed);

                // Calculate skill damage (this is what the skill actually hits for)
                const skillDamageMin = breakdown.newPhysMin * breakdown.skillMult;
                const skillDamageMax = breakdown.newPhysMax * breakdown.skillMult;
                const skillDamageAvg = breakdown.totalAvgDamage * breakdown.skillMult;

                return (
                  <div style={{ borderTop: '1px solid #333', paddingTop: 16 }}>
                    <h4 style={{ margin: 0, marginBottom: 12, color: '#888', fontSize: '0.9rem' }}>
                      Damage Calculation Flow
                    </h4>

                    {/* Step 1: Weapon Base Damage */}
                    <div style={{ marginBottom: 16, padding: 12, background: '#222', borderRadius: 6, borderLeft: '3px solid #666' }}>
                      <div style={{ color: '#888', fontSize: '0.75rem', marginBottom: 4, fontWeight: 'bold' }}>
                        STEP 1: WEAPON BASE DAMAGE
                      </div>
                      <div style={{ display: 'grid', gap: 4, fontSize: '0.8rem' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                          <span style={{ color: '#888' }}>Physical</span>
                          <span style={{ color: '#fff' }}>{breakdown.basePhysMin} - {breakdown.basePhysMax}</span>
                        </div>
                        {(selectedWeapon.damage.fire.max > 0 || selectedWeapon.damage.cold.max > 0 ||
                          selectedWeapon.damage.lightning.max > 0 || selectedWeapon.damage.chaos.max > 0) && (
                          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                            <span style={{ color: '#888' }}>Elemental (base)</span>
                            <span style={{ color: '#FF9800' }}>
                              {(
                                (selectedWeapon.damage.fire.min + selectedWeapon.damage.fire.max) / 2 +
                                (selectedWeapon.damage.cold.min + selectedWeapon.damage.cold.max) / 2 +
                                (selectedWeapon.damage.lightning.min + selectedWeapon.damage.lightning.max) / 2 +
                                (selectedWeapon.damage.chaos.min + selectedWeapon.damage.chaos.max) / 2
                              ).toFixed(0)} avg
                            </span>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Step 2: Apply Weapon Mods (Prefixes & Suffixes) */}
                    <div style={{ marginBottom: 16, padding: 12, background: '#222', borderRadius: 6, borderLeft: '3px solid #c58602' }}>
                      <div style={{ color: '#c58602', fontSize: '0.75rem', marginBottom: 4, fontWeight: 'bold' }}>
                        STEP 2: APPLY WEAPON MODS (Prefixes + Suffixes)
                      </div>
                      <div style={{ display: 'grid', gap: 4, fontSize: '0.8rem' }}>
                        {(breakdown.physFlatMin > 0 || breakdown.physFlatMax > 0) && (
                          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                            <span style={{ color: '#888' }}>+ Flat Physical</span>
                            <span style={{ color: '#4CAF50' }}>+{breakdown.physFlatMin} - {breakdown.physFlatMax}</span>
                          </div>
                        )}
                        {breakdown.physPercent > 0 && (
                          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                            <span style={{ color: '#888' }}>× Increased Physical</span>
                            <span style={{ color: '#4CAF50' }}>+{breakdown.physPercent.toFixed(0)}% → ×{(1 + breakdown.physPercent / 100).toFixed(2)}</span>
                          </div>
                        )}
                        {breakdown.elemental > 0 && (
                          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                            <span style={{ color: '#888' }}>+ Added Elemental</span>
                            <span style={{ color: '#FF9800' }}>+{breakdown.elemental.toFixed(0)} avg</span>
                          </div>
                        )}
                        {breakdown.attackSpeedPercent > 0 && (
                          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                            <span style={{ color: '#888' }}>+ Attack Speed</span>
                            <span style={{ color: '#3498DB' }}>+{breakdown.attackSpeedPercent.toFixed(0)}%</span>
                          </div>
                        )}
                        {breakdown.critChanceAdd > 0 && (
                          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                            <span style={{ color: '#888' }}>+ Critical Chance</span>
                            <span style={{ color: '#E91E63' }}>+{breakdown.critChanceAdd.toFixed(0)}%</span>
                          </div>
                        )}
                        <div style={{ display: 'flex', justifyContent: 'space-between', borderTop: '1px solid #444', paddingTop: 8, marginTop: 4 }}>
                          <span style={{ color: '#c58602', fontWeight: 'bold' }}>Modified Weapon Damage</span>
                          <span style={{ color: '#fff', fontWeight: 'bold' }}>{breakdown.newPhysMin.toFixed(0)} - {breakdown.newPhysMax.toFixed(0)} phys</span>
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                          <span style={{ color: '#888' }}>Total Average (phys + ele)</span>
                          <span style={{ color: '#fff' }}>{breakdown.totalAvgDamage.toFixed(1)}</span>
                        </div>
                      </div>
                    </div>

                    {/* Step 3: Apply Skill Multiplier */}
                    <div style={{ marginBottom: 16, padding: 12, background: '#1a3620', borderRadius: 6, borderLeft: '3px solid #4CAF50' }}>
                      <div style={{ color: '#4CAF50', fontSize: '0.75rem', marginBottom: 4, fontWeight: 'bold' }}>
                        STEP 3: SKILL DAMAGE = Weapon × Skill Multiplier
                      </div>
                      <div style={{ display: 'grid', gap: 4, fontSize: '0.8rem' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                          <span style={{ color: '#888' }}>Skill: {selectedSkill.name}</span>
                          <span style={{ color: '#c58602' }}>×{(breakdown.skillMult * 100).toFixed(0)}% of weapon damage</span>
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', borderTop: '1px solid #2a5630', paddingTop: 8, marginTop: 4 }}>
                          <span style={{ color: '#4CAF50', fontWeight: 'bold' }}>Skill Hit Damage</span>
                          <span style={{ color: '#fff', fontWeight: 'bold', fontSize: '1rem' }}>
                            {skillDamageMin.toFixed(0)} - {skillDamageMax.toFixed(0)}
                          </span>
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                          <span style={{ color: '#888' }}>Average Hit</span>
                          <span style={{ color: '#4CAF50', fontWeight: 'bold' }}>{skillDamageAvg.toFixed(1)}</span>
                        </div>
                      </div>
                    </div>

                    {/* Step 4: Calculate DPS */}
                    <div style={{ marginBottom: 16, padding: 12, background: '#222', borderRadius: 6, borderLeft: '3px solid #3498DB' }}>
                      <div style={{ color: '#3498DB', fontSize: '0.75rem', marginBottom: 4, fontWeight: 'bold' }}>
                        STEP 4: DPS = Skill Damage × Attack Speed × Crit
                      </div>
                      <div style={{ display: 'grid', gap: 4, fontSize: '0.8rem' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                          <span style={{ color: '#888' }}>Attack Speed</span>
                          <span style={{ color: '#fff' }}>{breakdown.baseAttackSpeed.toFixed(2)}/s → {breakdown.newAttackSpeed.toFixed(2)}/s</span>
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                          <span style={{ color: '#888' }}>Critical Chance</span>
                          <span style={{ color: '#fff' }}>{breakdown.baseCritChance.toFixed(0)}%{breakdown.critChanceAdd > 0 ? ` + ${breakdown.critChanceAdd.toFixed(0)}%` : ''}</span>
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                          <span style={{ color: '#888' }}>Effective Crit Multiplier</span>
                          <span style={{ color: '#E91E63' }}>×{breakdown.effectiveCritMult.toFixed(3)}</span>
                        </div>
                      </div>
                    </div>

                    {/* Support Skills Multipliers */}
                    {(breakdown.supportMoreDamage !== 0 || breakdown.supportMoreSpeed !== 0) && (
                      <div style={{ marginBottom: 16, padding: 12, background: '#222', borderRadius: 6, borderLeft: '3px solid #2ECC71' }}>
                        <div style={{ color: '#2ECC71', fontSize: '0.75rem', marginBottom: 4, fontWeight: 'bold' }}>
                          STEP 5: SUPPORT SKILL MULTIPLIERS (More Damage)
                        </div>
                        <div style={{ display: 'grid', gap: 4, fontSize: '0.8rem' }}>
                          {breakdown.supportMoreDamage !== 0 && (
                            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                              <span style={{ color: '#888' }}>More Damage</span>
                              <span style={{ color: breakdown.supportMoreDamage > 0 ? '#2ECC71' : '#E74C3C' }}>
                                {breakdown.supportMoreDamage > 0 ? '+' : ''}{breakdown.supportMoreDamage}% → ×{breakdown.supportDamageMultiplier.toFixed(2)}
                              </span>
                            </div>
                          )}
                          {breakdown.supportMoreSpeed !== 0 && (
                            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                              <span style={{ color: '#888' }}>More Attack Speed</span>
                              <span style={{ color: breakdown.supportMoreSpeed > 0 ? '#3498DB' : '#E74C3C' }}>
                                {breakdown.supportMoreSpeed > 0 ? '+' : ''}{breakdown.supportMoreSpeed}% → ×{breakdown.supportSpeedMultiplier.toFixed(2)}
                              </span>
                            </div>
                          )}
                        </div>
                      </div>
                    )}

                    {/* Final DPS Box */}
                    <div style={{
                      background: 'linear-gradient(135deg, #1a3620 0%, #2a4530 100%)',
                      padding: 16,
                      borderRadius: 8,
                      border: '2px solid #4CAF50'
                    }}>
                      <div style={{ color: '#888', fontSize: '0.75rem', marginBottom: 8 }}>FINAL CALCULATION</div>
                      <div style={{ fontSize: '0.75rem', color: '#888', marginBottom: 8 }}>
                        <span style={{ color: '#4CAF50' }}>{skillDamageAvg.toFixed(0)}</span>
                        <span> × </span>
                        <span style={{ color: '#3498DB' }}>{breakdown.newAttackSpeed.toFixed(2)}</span>
                        <span> × </span>
                        <span style={{ color: '#E91E63' }}>{breakdown.effectiveCritMult.toFixed(3)}</span>
                        {breakdown.supportDamageMultiplier !== 1 && (
                          <>
                            <span> × </span>
                            <span style={{ color: '#2ECC71' }}>{breakdown.supportDamageMultiplier.toFixed(2)}</span>
                          </>
                        )}
                        {breakdown.supportSpeedMultiplier !== 1 && (
                          <>
                            <span> × </span>
                            <span style={{ color: '#3498DB' }}>{breakdown.supportSpeedMultiplier.toFixed(2)}</span>
                          </>
                        )}
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <span style={{ color: '#4CAF50', fontWeight: 'bold', fontSize: '1rem' }}>
                          FINAL DPS
                        </span>
                        <span style={{ color: '#4CAF50', fontWeight: 'bold', fontSize: '1.5rem' }}>
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
    </div>
  );
};

export default AttackSkillsPlanner;

