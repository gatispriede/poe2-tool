// Mock passive tree data for PoE2 with spell damage nodes
// This represents a simplified version of the passive tree with spell-focused nodes

import { PassiveTreeNode } from './passiveTreeOptimizer';

export const MOCK_PASSIVE_TREE: PassiveTreeNode[] = [
  // Generic Spell Damage Nodes
  { id: 'spell_dmg_1', name: 'Spell Damage I', type: 'small', stats: { increasedSpellDamagePct: 10 }, description: '10% increased Spell Damage', damageTypes: ['spell', 'generic'] },
  { id: 'spell_dmg_2', name: 'Spell Damage II', type: 'small', stats: { increasedSpellDamagePct: 10 }, description: '10% increased Spell Damage', damageTypes: ['spell', 'generic'] },
  { id: 'spell_dmg_3', name: 'Spell Damage III', type: 'small', stats: { increasedSpellDamagePct: 12 }, description: '12% increased Spell Damage', damageTypes: ['spell', 'generic'] },
  { id: 'spell_dmg_4', name: 'Spell Damage IV', type: 'small', stats: { increasedSpellDamagePct: 12 }, description: '12% increased Spell Damage', damageTypes: ['spell', 'generic'] },
  { id: 'spell_dmg_5', name: 'Spell Damage V', type: 'small', stats: { increasedSpellDamagePct: 14 }, description: '14% increased Spell Damage', damageTypes: ['spell', 'generic'] },

  // Cast Speed
  { id: 'cast_speed_1', name: 'Cast Speed I', type: 'small', stats: { increasedCastSpeedPct: 5 }, description: '5% increased Cast Speed', damageTypes: ['spell', 'speed'] },
  { id: 'cast_speed_2', name: 'Cast Speed II', type: 'small', stats: { increasedCastSpeedPct: 6 }, description: '6% increased Cast Speed', damageTypes: ['spell', 'speed'] },
  { id: 'cast_speed_3', name: 'Cast Speed III', type: 'small', stats: { increasedCastSpeedPct: 7 }, description: '7% increased Cast Speed', damageTypes: ['spell', 'speed'] },
  { id: 'cast_speed_4', name: 'Cast Speed IV', type: 'small', stats: { increasedCastSpeedPct: 8 }, description: '8% increased Cast Speed', damageTypes: ['spell', 'speed'] },

  // Elemental Damage
  { id: 'ele_dmg_1', name: 'Elemental Damage I', type: 'small', stats: { increasedElementalDamagePct: 12 }, description: '12% increased Elemental Damage', damageTypes: ['elemental', 'fire', 'cold', 'lightning'] },
  { id: 'ele_dmg_2', name: 'Elemental Damage II', type: 'small', stats: { increasedElementalDamagePct: 14 }, description: '14% increased Elemental Damage', damageTypes: ['elemental', 'fire', 'cold', 'lightning'] },
  { id: 'ele_dmg_3', name: 'Elemental Damage III', type: 'small', stats: { increasedElementalDamagePct: 16 }, description: '16% increased Elemental Damage', damageTypes: ['elemental', 'fire', 'cold', 'lightning'] },

  // Fire Damage
  { id: 'fire_dmg_1', name: 'Fire Damage I', type: 'small', stats: { increasedFireDamagePct: 14 }, description: '14% increased Fire Damage', damageTypes: ['fire', 'elemental'] },
  { id: 'fire_dmg_2', name: 'Fire Damage II', type: 'small', stats: { increasedFireDamagePct: 16 }, description: '16% increased Fire Damage', damageTypes: ['fire', 'elemental'] },
  { id: 'fire_dmg_3', name: 'Fire Damage III', type: 'small', stats: { increasedFireDamagePct: 18 }, description: '18% increased Fire Damage', damageTypes: ['fire', 'elemental'] },
  { id: 'fire_dmg_4', name: 'Fire Damage IV', type: 'small', stats: { increasedFireDamagePct: 20 }, description: '20% increased Fire Damage', damageTypes: ['fire', 'elemental'] },

  // Cold Damage
  { id: 'cold_dmg_1', name: 'Cold Damage I', type: 'small', stats: { increasedColdDamagePct: 14 }, description: '14% increased Cold Damage', damageTypes: ['cold', 'elemental'] },
  { id: 'cold_dmg_2', name: 'Cold Damage II', type: 'small', stats: { increasedColdDamagePct: 16 }, description: '16% increased Cold Damage', damageTypes: ['cold', 'elemental'] },
  { id: 'cold_dmg_3', name: 'Cold Damage III', type: 'small', stats: { increasedColdDamagePct: 18 }, description: '18% increased Cold Damage', damageTypes: ['cold', 'elemental'] },
  { id: 'cold_dmg_4', name: 'Cold Damage IV', type: 'small', stats: { increasedColdDamagePct: 20 }, description: '20% increased Cold Damage', damageTypes: ['cold', 'elemental'] },

  // Lightning Damage
  { id: 'light_dmg_1', name: 'Lightning Damage I', type: 'small', stats: { increasedLightningDamagePct: 14 }, description: '14% increased Lightning Damage', damageTypes: ['lightning', 'elemental'] },
  { id: 'light_dmg_2', name: 'Lightning Damage II', type: 'small', stats: { increasedLightningDamagePct: 16 }, description: '16% increased Lightning Damage', damageTypes: ['lightning', 'elemental'] },
  { id: 'light_dmg_3', name: 'Lightning Damage III', type: 'small', stats: { increasedLightningDamagePct: 18 }, description: '18% increased Lightning Damage', damageTypes: ['lightning', 'elemental'] },
  { id: 'light_dmg_4', name: 'Lightning Damage IV', type: 'small', stats: { increasedLightningDamagePct: 20 }, description: '20% increased Lightning Damage', damageTypes: ['lightning', 'elemental'] },

  // Chaos Damage
  { id: 'chaos_dmg_1', name: 'Chaos Damage I', type: 'small', stats: { increasedChaosDamagePct: 14 }, description: '14% increased Chaos Damage', damageTypes: ['chaos'] },
  { id: 'chaos_dmg_2', name: 'Chaos Damage II', type: 'small', stats: { increasedChaosDamagePct: 16 }, description: '16% increased Chaos Damage', damageTypes: ['chaos'] },
  { id: 'chaos_dmg_3', name: 'Chaos Damage III', type: 'small', stats: { increasedChaosDamagePct: 18 }, description: '18% increased Chaos Damage', damageTypes: ['chaos'] },

  // Critical Strike
  { id: 'crit_chance_1', name: 'Spell Critical I', type: 'small', stats: { increasedSpellCritChancePct: 25 }, description: '25% increased Spell Critical Strike Chance', damageTypes: ['spell', 'critical'] },
  { id: 'crit_chance_2', name: 'Spell Critical II', type: 'small', stats: { increasedSpellCritChancePct: 30 }, description: '30% increased Spell Critical Strike Chance', damageTypes: ['spell', 'critical'] },
  { id: 'crit_chance_3', name: 'Spell Critical III', type: 'small', stats: { increasedSpellCritChancePct: 35 }, description: '35% increased Spell Critical Strike Chance', damageTypes: ['spell', 'critical'] },
  { id: 'crit_multi_1', name: 'Critical Multiplier I', type: 'small', stats: { increasedSpellCritMultiplierPct: 15 }, description: '+15% to Spell Critical Strike Multiplier', damageTypes: ['spell', 'critical'] },
  { id: 'crit_multi_2', name: 'Critical Multiplier II', type: 'small', stats: { increasedSpellCritMultiplierPct: 18 }, description: '+18% to Spell Critical Strike Multiplier', damageTypes: ['spell', 'critical'] },
  { id: 'crit_multi_3', name: 'Critical Multiplier III', type: 'small', stats: { increasedSpellCritMultiplierPct: 20 }, description: '+20% to Spell Critical Strike Multiplier', damageTypes: ['spell', 'critical'] },

  // Area and Projectile
  { id: 'area_dmg_1', name: 'Area Damage I', type: 'small', stats: { increasedAreaDamagePct: 10 }, description: '10% increased Area Damage', damageTypes: ['area'] },
  { id: 'area_dmg_2', name: 'Area Damage II', type: 'small', stats: { increasedAreaDamagePct: 12 }, description: '12% increased Area Damage', damageTypes: ['area'] },
  { id: 'proj_dmg_1', name: 'Projectile Damage I', type: 'small', stats: { increasedProjectileDamagePct: 10 }, description: '10% increased Projectile Damage', damageTypes: ['projectile'] },
  { id: 'proj_dmg_2', name: 'Projectile Damage II', type: 'small', stats: { increasedProjectileDamagePct: 12 }, description: '12% increased Projectile Damage', damageTypes: ['projectile'] },

  // Notable Nodes - More powerful combined effects
  { id: 'notable_spell_mastery', name: 'Spell Mastery', type: 'notable',
    stats: { increasedSpellDamagePct: 25, increasedCastSpeedPct: 8 },
    description: '25% increased Spell Damage\n8% increased Cast Speed', damageTypes: ['spell', 'speed', 'generic'] },

  { id: 'notable_fire_mastery', name: 'Conflagration', type: 'notable',
    stats: { increasedFireDamagePct: 35, increasedElementalDamagePct: 15 },
    description: '35% increased Fire Damage\n15% increased Elemental Damage', damageTypes: ['fire', 'elemental'] },

  { id: 'notable_cold_mastery', name: 'Deep Freeze', type: 'notable',
    stats: { increasedColdDamagePct: 35, increasedElementalDamagePct: 15 },
    description: '35% increased Cold Damage\n15% increased Elemental Damage', damageTypes: ['cold', 'elemental'] },

  { id: 'notable_lightning_mastery', name: 'Thunderstruck', type: 'notable',
    stats: { increasedLightningDamagePct: 35, increasedElementalDamagePct: 15 },
    description: '35% increased Lightning Damage\n15% increased Elemental Damage', damageTypes: ['lightning', 'elemental'] },

  { id: 'notable_chaos_mastery', name: 'Dark Arts', type: 'notable',
    stats: { increasedChaosDamagePct: 40, increasedSpellDamagePct: 20 },
    description: '40% increased Chaos Damage\n20% increased Spell Damage', damageTypes: ['chaos', 'spell'] },

  { id: 'notable_crit_mastery', name: 'Spell Critical Mastery', type: 'notable',
    stats: { increasedSpellCritChancePct: 60, increasedSpellCritMultiplierPct: 30 },
    description: '60% increased Spell Critical Strike Chance\n+30% to Spell Critical Strike Multiplier', damageTypes: ['spell', 'critical'] },

  { id: 'notable_elemental_focus', name: 'Elemental Focus', type: 'notable',
    stats: { increasedElementalDamagePct: 30, increasedSpellDamagePct: 20 },
    description: '30% increased Elemental Damage\n20% increased Spell Damage', damageTypes: ['elemental', 'spell', 'fire', 'cold', 'lightning'] },

  { id: 'notable_swift_casting', name: 'Swift Casting', type: 'notable',
    stats: { increasedCastSpeedPct: 15, increasedSpellDamagePct: 20 },
    description: '15% increased Cast Speed\n20% increased Spell Damage', damageTypes: ['spell', 'speed'] },

  { id: 'notable_arcane_power', name: 'Arcane Power', type: 'notable',
    stats: { increasedSpellDamagePct: 40, increasedCastSpeedPct: 10 },
    description: '40% increased Spell Damage\n10% increased Cast Speed', damageTypes: ['spell', 'speed', 'generic'] },

  { id: 'notable_area_control', name: 'Area Control', type: 'notable',
    stats: { increasedAreaDamagePct: 25, increasedSpellDamagePct: 20 },
    description: '25% increased Area Damage\n20% increased Spell Damage', damageTypes: ['area', 'spell'] },

  { id: 'notable_proj_mastery', name: 'Projectile Mastery', type: 'notable',
    stats: { increasedProjectileDamagePct: 25, increasedSpellDamagePct: 20 },
    description: '25% increased Projectile Damage\n20% increased Spell Damage', damageTypes: ['projectile', 'spell'] },

  { id: 'notable_spell_crit_dmg', name: 'Deadly Spells', type: 'notable',
    stats: { increasedSpellCritChancePct: 40, increasedSpellCritMultiplierPct: 25, increasedSpellDamagePct: 15 },
    description: '40% increased Spell Critical Strike Chance\n+25% to Spell Critical Strike Multiplier\n15% increased Spell Damage', damageTypes: ['spell', 'critical'] },

  // Keystone-like powerful nodes
  { id: 'keystone_elemental_overload', name: 'Elemental Equilibrium', type: 'keystone',
    stats: { increasedElementalDamagePct: 50, increasedSpellDamagePct: 30 },
    description: '50% increased Elemental Damage\n30% increased Spell Damage', damageTypes: ['elemental', 'spell', 'fire', 'cold', 'lightning'] },

  { id: 'keystone_pain_attunement', name: 'Pain Attunement', type: 'keystone',
    stats: { increasedSpellDamagePct: 60, increasedCastSpeedPct: 20 },
    description: '60% increased Spell Damage\n20% increased Cast Speed', damageTypes: ['spell', 'speed', 'generic'] },

  // More combined effect nodes
  { id: 'spell_cast_1', name: 'Spell & Cast I', type: 'small', stats: { increasedSpellDamagePct: 8, increasedCastSpeedPct: 4 }, description: '8% increased Spell Damage\n4% increased Cast Speed', damageTypes: ['spell', 'speed'] },
  { id: 'spell_cast_2', name: 'Spell & Cast II', type: 'small', stats: { increasedSpellDamagePct: 10, increasedCastSpeedPct: 5 }, description: '10% increased Spell Damage\n5% increased Cast Speed', damageTypes: ['spell', 'speed'] },
  { id: 'spell_crit_1', name: 'Spell & Crit I', type: 'small', stats: { increasedSpellDamagePct: 8, increasedSpellCritChancePct: 15 }, description: '8% increased Spell Damage\n15% increased Spell Critical Strike Chance', damageTypes: ['spell', 'critical'] },
  { id: 'spell_crit_2', name: 'Spell & Crit II', type: 'small', stats: { increasedSpellDamagePct: 10, increasedSpellCritChancePct: 20 }, description: '10% increased Spell Damage\n20% increased Spell Critical Strike Chance', damageTypes: ['spell', 'critical'] },

  { id: 'fire_cast_1', name: 'Fire & Cast I', type: 'small', stats: { increasedFireDamagePct: 12, increasedCastSpeedPct: 4 }, description: '12% increased Fire Damage\n4% increased Cast Speed', damageTypes: ['fire', 'speed'] },
  { id: 'fire_cast_2', name: 'Fire & Cast II', type: 'small', stats: { increasedFireDamagePct: 14, increasedCastSpeedPct: 5 }, description: '14% increased Fire Damage\n5% increased Cast Speed', damageTypes: ['fire', 'speed'] },

  { id: 'cold_cast_1', name: 'Cold & Cast I', type: 'small', stats: { increasedColdDamagePct: 12, increasedCastSpeedPct: 4 }, description: '12% increased Cold Damage\n4% increased Cast Speed', damageTypes: ['cold', 'speed'] },
  { id: 'cold_cast_2', name: 'Cold & Cast II', type: 'small', stats: { increasedColdDamagePct: 14, increasedCastSpeedPct: 5 }, description: '14% increased Cold Damage\n5% increased Cast Speed', damageTypes: ['cold', 'speed'] },

  { id: 'light_cast_1', name: 'Lightning & Cast I', type: 'small', stats: { increasedLightningDamagePct: 12, increasedCastSpeedPct: 4 }, description: '12% increased Lightning Damage\n4% increased Cast Speed', damageTypes: ['lightning', 'speed'] },
  { id: 'light_cast_2', name: 'Lightning & Cast II', type: 'small', stats: { increasedLightningDamagePct: 14, increasedCastSpeedPct: 5 }, description: '14% increased Lightning Damage\n5% increased Cast Speed', damageTypes: ['lightning', 'speed'] },

  { id: 'ele_crit_1', name: 'Elemental & Crit I', type: 'small', stats: { increasedElementalDamagePct: 10, increasedSpellCritChancePct: 15 }, description: '10% increased Elemental Damage\n15% increased Spell Critical Strike Chance', damageTypes: ['elemental', 'critical'] },
  { id: 'ele_crit_2', name: 'Elemental & Crit II', type: 'small', stats: { increasedElementalDamagePct: 12, increasedSpellCritChancePct: 20 }, description: '12% increased Elemental Damage\n20% increased Spell Critical Strike Chance', damageTypes: ['elemental', 'critical'] },

  { id: 'area_spell_1', name: 'Area & Spell I', type: 'small', stats: { increasedAreaDamagePct: 8, increasedSpellDamagePct: 8 }, description: '8% increased Area Damage\n8% increased Spell Damage', damageTypes: ['area', 'spell'] },
  { id: 'area_spell_2', name: 'Area & Spell II', type: 'small', stats: { increasedAreaDamagePct: 10, increasedSpellDamagePct: 10 }, description: '10% increased Area Damage\n10% increased Spell Damage', damageTypes: ['area', 'spell'] },

  { id: 'proj_spell_1', name: 'Projectile & Spell I', type: 'small', stats: { increasedProjectileDamagePct: 8, increasedSpellDamagePct: 8 }, description: '8% increased Projectile Damage\n8% increased Spell Damage', damageTypes: ['projectile', 'spell'] },
  { id: 'proj_spell_2', name: 'Projectile & Spell II', type: 'small', stats: { increasedProjectileDamagePct: 10, increasedSpellDamagePct: 10 }, description: '10% increased Projectile Damage\n10% increased Spell Damage', damageTypes: ['projectile', 'spell'] },

  // More elemental combined nodes
  { id: 'fire_ele_1', name: 'Fire & Elemental I', type: 'small', stats: { increasedFireDamagePct: 10, increasedElementalDamagePct: 8 }, description: '10% increased Fire Damage\n8% increased Elemental Damage', damageTypes: ['fire', 'elemental'] },
  { id: 'fire_ele_2', name: 'Fire & Elemental II', type: 'small', stats: { increasedFireDamagePct: 12, increasedElementalDamagePct: 10 }, description: '12% increased Fire Damage\n10% increased Elemental Damage', damageTypes: ['fire', 'elemental'] },

  { id: 'cold_ele_1', name: 'Cold & Elemental I', type: 'small', stats: { increasedColdDamagePct: 10, increasedElementalDamagePct: 8 }, description: '10% increased Cold Damage\n8% increased Elemental Damage', damageTypes: ['cold', 'elemental'] },
  { id: 'cold_ele_2', name: 'Cold & Elemental II', type: 'small', stats: { increasedColdDamagePct: 12, increasedElementalDamagePct: 10 }, description: '12% increased Cold Damage\n10% increased Elemental Damage', damageTypes: ['cold', 'elemental'] },

  { id: 'light_ele_1', name: 'Lightning & Elemental I', type: 'small', stats: { increasedLightningDamagePct: 10, increasedElementalDamagePct: 8 }, description: '10% increased Lightning Damage\n8% increased Elemental Damage', damageTypes: ['lightning', 'elemental'] },
  { id: 'light_ele_2', name: 'Lightning & Elemental II', type: 'small', stats: { increasedLightningDamagePct: 12, increasedElementalDamagePct: 10 }, description: '12% increased Lightning Damage\n10% increased Elemental Damage', damageTypes: ['lightning', 'elemental'] },
];

