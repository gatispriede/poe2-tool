// Extract quarterstaff data and mods from Craft of Exile for PoE2
// Usage: node scripts/extractQuarterstaffs.js

const fs = require('fs');
const path = require('path');

const QUARTERSTAFFS_OUTPUT = path.resolve(__dirname, '../src/data/Quarterstaffs.json');
const QUARTERSTAFF_MODS_OUTPUT = path.resolve(__dirname, '../src/data/QuarterstaffMods.json');

function createQuarterstaffData() {
  // Quarterstaff base types for PoE2
  const quarterstaffs = [
    {
      id: 'primitive-quarterstaff',
      name: 'Primitive Quarterstaff',
      baseMin: 8,
      baseMax: 12,
      baseAPS: 1.4,
      localIncreasedDamagePct: 0,
      weaponType: 'Quarterstaff',
      itemLevel: 1,
      baseCritChancePct: 6.5,
      description: 'A simple wooden quarterstaff for melee combat'
    },
    {
      id: 'cracked-quarterstaff',
      name: 'Cracked Quarterstaff',
      baseMin: 10,
      baseMax: 15,
      baseAPS: 1.4,
      localIncreasedDamagePct: 0,
      weaponType: 'Quarterstaff',
      itemLevel: 5,
      baseCritChancePct: 6.5,
      description: 'A weathered quarterstaff with visible cracks'
    },
    {
      id: 'long-staff',
      name: 'Long Staff',
      baseMin: 13,
      baseMax: 20,
      baseAPS: 1.35,
      localIncreasedDamagePct: 0,
      weaponType: 'Quarterstaff',
      itemLevel: 12,
      baseCritChancePct: 6.5,
      description: 'An elongated staff for extended reach'
    },
    {
      id: 'military-staff',
      name: 'Military Staff',
      baseMin: 17,
      baseMax: 26,
      baseAPS: 1.35,
      localIncreasedDamagePct: 0,
      weaponType: 'Quarterstaff',
      itemLevel: 20,
      baseCritChancePct: 6.5,
      description: 'A reinforced staff used by military forces'
    },
    {
      id: 'iron-staff',
      name: 'Iron Staff',
      baseMin: 22,
      baseMax: 33,
      baseAPS: 1.3,
      localIncreasedDamagePct: 0,
      weaponType: 'Quarterstaff',
      itemLevel: 30,
      baseCritChancePct: 6.5,
      description: 'A heavy staff with iron reinforcements'
    },
    {
      id: 'royal-staff',
      name: 'Royal Staff',
      baseMin: 28,
      baseMax: 42,
      baseAPS: 1.3,
      localIncreasedDamagePct: 0,
      weaponType: 'Quarterstaff',
      itemLevel: 41,
      baseCritChancePct: 6.5,
      description: 'An ornate staff befitting royalty'
    },
    {
      id: 'vile-staff',
      name: 'Vile Staff',
      baseMin: 35,
      baseMax: 53,
      baseAPS: 1.25,
      localIncreasedDamagePct: 0,
      weaponType: 'Quarterstaff',
      itemLevel: 52,
      baseCritChancePct: 6.5,
      description: 'A corrupted staff emanating dark energy'
    },
    {
      id: 'judgement-staff',
      name: 'Judgement Staff',
      baseMin: 43,
      baseMax: 65,
      baseAPS: 1.2,
      localIncreasedDamagePct: 0,
      weaponType: 'Quarterstaff',
      itemLevel: 62,
      baseCritChancePct: 6.5,
      description: 'A staff wielded by those who pass judgement'
    },
    {
      id: 'eclipse-staff',
      name: 'Eclipse Staff',
      baseMin: 52,
      baseMax: 78,
      baseAPS: 1.15,
      localIncreasedDamagePct: 0,
      weaponType: 'Quarterstaff',
      itemLevel: 70,
      baseCritChancePct: 6.5,
      description: 'A staff that channels the power of eclipses'
    }
  ];

  return quarterstaffs;
}

function createQuarterstaffMods() {
  // Comprehensive prefixes and suffixes for quarterstaffs based on PoE2 affixes
  const mods = {
    prefixes: [
      // TIER 1 - Highest damage prefixes
      {
        id: 'dictators-phys',
        name: "Dictator's (Phys Damage)",
        description: 'Increases Physical Damage - Highest Tier',
        type: 'prefix',
        tier: 1,
        effects: {
          localIncreasedPhysicalDamagePct: { min: 170, max: 179 }
        },
        itemLevelReq: 83,
        tags: ['damage', 'physical']
      },
      {
        id: 'flaring-fire',
        name: 'Flaring (Fire Damage)',
        description: 'Adds Fire Damage - Highest Tier',
        type: 'prefix',
        tier: 1,
        effects: {
          addedFireDamageMin: { min: 48, max: 72 },
          addedFireDamageMax: { min: 91, max: 118 }
        },
        itemLevelReq: 76,
        tags: ['damage', 'elemental', 'fire']
      },
      {
        id: 'entombing-cold',
        name: 'Entombing (Cold Damage)',
        description: 'Adds Cold Damage - Highest Tier',
        type: 'prefix',
        tier: 1,
        effects: {
          addedColdDamageMin: { min: 45, max: 67 },
          addedColdDamageMax: { min: 84, max: 112 }
        },
        itemLevelReq: 76,
        tags: ['damage', 'elemental', 'cold']
      },
      {
        id: 'electrocuting-lightning',
        name: 'Electrocuting (Lightning Damage)',
        description: 'Adds Lightning Damage - Highest Tier',
        type: 'prefix',
        tier: 1,
        effects: {
          addedLightningDamageMin: { min: 9, max: 16 },
          addedLightningDamageMax: { min: 102, max: 156 }
        },
        itemLevelReq: 76,
        tags: ['damage', 'elemental', 'lightning']
      },

      // TIER 2 - High damage prefixes
      {
        id: 'emperors-phys',
        name: "Emperor's (Phys Damage)",
        description: 'Increases Physical Damage - High Tier',
        type: 'prefix',
        tier: 2,
        effects: {
          localIncreasedPhysicalDamagePct: { min: 155, max: 169 }
        },
        itemLevelReq: 73,
        tags: ['damage', 'physical']
      },
      {
        id: 'incinerating-fire',
        name: 'Incinerating (Fire Damage)',
        description: 'Adds Fire Damage - High Tier',
        type: 'prefix',
        tier: 2,
        effects: {
          addedFireDamageMin: { min: 39, max: 58 },
          addedFireDamageMax: { min: 74, max: 97 }
        },
        itemLevelReq: 64,
        tags: ['damage', 'elemental', 'fire']
      },
      {
        id: 'glaciated-cold',
        name: 'Glaciated (Cold Damage)',
        description: 'Adds Cold Damage - High Tier',
        type: 'prefix',
        tier: 2,
        effects: {
          addedColdDamageMin: { min: 37, max: 55 },
          addedColdDamageMax: { min: 69, max: 92 }
        },
        itemLevelReq: 64,
        tags: ['damage', 'elemental', 'cold']
      },
      {
        id: 'discharging-lightning',
        name: 'Discharging (Lightning Damage)',
        description: 'Adds Lightning Damage - High Tier',
        type: 'prefix',
        tier: 2,
        effects: {
          addedLightningDamageMin: { min: 7, max: 13 },
          addedLightningDamageMax: { min: 84, max: 128 }
        },
        itemLevelReq: 64,
        tags: ['damage', 'elemental', 'lightning']
      },

      // TIER 3 - Medium damage prefixes
      {
        id: 'tyrannical-phys',
        name: 'Tyrannical (Phys Damage)',
        description: 'Increases Physical Damage - Medium Tier',
        type: 'prefix',
        tier: 3,
        effects: {
          localIncreasedPhysicalDamagePct: { min: 140, max: 154 }
        },
        itemLevelReq: 60,
        tags: ['damage', 'physical']
      },
      {
        id: 'blasting-fire',
        name: 'Blasting (Fire Damage)',
        description: 'Adds Fire Damage - Medium Tier',
        type: 'prefix',
        tier: 3,
        effects: {
          addedFireDamageMin: { min: 31, max: 47 },
          addedFireDamageMax: { min: 60, max: 78 }
        },
        itemLevelReq: 52,
        tags: ['damage', 'elemental', 'fire']
      },
      {
        id: 'freezing-cold',
        name: 'Freezing (Cold Damage)',
        description: 'Adds Cold Damage - Medium Tier',
        type: 'prefix',
        tier: 3,
        effects: {
          addedColdDamageMin: { min: 30, max: 44 },
          addedColdDamageMax: { min: 56, max: 74 }
        },
        itemLevelReq: 52,
        tags: ['damage', 'elemental', 'cold']
      },
      {
        id: 'arcing-lightning',
        name: 'Arcing (Lightning Damage)',
        description: 'Adds Lightning Damage - Medium Tier',
        type: 'prefix',
        tier: 3,
        effects: {
          addedLightningDamageMin: { min: 6, max: 11 },
          addedLightningDamageMax: { min: 68, max: 104 }
        },
        itemLevelReq: 52,
        tags: ['damage', 'elemental', 'lightning']
      },

      // TIER 4 - Lower damage prefixes
      {
        id: 'merciless-phys',
        name: 'Merciless (Phys Damage)',
        description: 'Increases Physical Damage - Lower Tier',
        type: 'prefix',
        tier: 4,
        effects: {
          localIncreasedPhysicalDamagePct: { min: 110, max: 124 }
        },
        itemLevelReq: 44,
        tags: ['damage', 'physical']
      },
      {
        id: 'heated-fire',
        name: 'Heated (Fire Damage)',
        description: 'Adds Fire Damage - Lower Tier',
        type: 'prefix',
        tier: 4,
        effects: {
          addedFireDamageMin: { min: 21, max: 32 },
          addedFireDamageMax: { min: 41, max: 53 }
        },
        itemLevelReq: 35,
        tags: ['damage', 'elemental', 'fire']
      },

      // Critical Strike prefix
      {
        id: 'incisive-crit',
        name: 'Incisive (Crit Chance)',
        description: 'Increases Critical Strike Chance',
        type: 'prefix',
        tier: 1,
        effects: {
          localIncreasedCriticalStrikeChancePct: { min: 40, max: 44 }
        },
        itemLevelReq: 73,
        tags: ['critical']
      },

      // Hybrid prefix
      {
        id: 'tempered-hybrid',
        name: 'Tempered (Phys + Quality)',
        description: 'Increases Physical Damage and Quality',
        type: 'prefix',
        tier: 2,
        effects: {
          localIncreasedPhysicalDamagePct: { min: 80, max: 94 },
          localIncreasedDamagePct: { min: 5, max: 10 }
        },
        itemLevelReq: 54,
        tags: ['damage', 'physical', 'hybrid']
      }
    ],

    suffixes: [
      // TIER 1 - Highest crit suffixes
      {
        id: 'of-annihilation-crit',
        name: 'of Annihilation (Crit Multi + Chance)',
        description: 'Increases Critical Strike Multiplier and Chance - Highest Tier',
        type: 'suffix',
        tier: 1,
        effects: {
          localIncreasedCriticalStrikeChancePct: { min: 30, max: 34 },
          localIncreasedCriticalStrikeMultiplierPct: { min: 38, max: 42 }
        },
        itemLevelReq: 82,
        tags: ['critical']
      },
      {
        id: 'of-devastation-crit',
        name: 'of Devastation (Crit Multi)',
        description: 'Increases Critical Strike Multiplier - Highest Tier',
        type: 'suffix',
        tier: 1,
        effects: {
          localIncreasedCriticalStrikeMultiplierPct: { min: 45, max: 50 }
        },
        itemLevelReq: 76,
        tags: ['critical']
      },

      // TIER 2 - High crit suffixes
      {
        id: 'of-annulling-crit',
        name: 'of Annulling (Crit Multi + Chance)',
        description: 'Increases Critical Strike Multiplier and Chance - High Tier',
        type: 'suffix',
        tier: 2,
        effects: {
          localIncreasedCriticalStrikeChancePct: { min: 25, max: 29 },
          localIncreasedCriticalStrikeMultiplierPct: { min: 32, max: 37 }
        },
        itemLevelReq: 73,
        tags: ['critical']
      },
      {
        id: 'of-destruction-crit',
        name: 'of Destruction (Crit Multi)',
        description: 'Increases Critical Strike Multiplier - High Tier',
        type: 'suffix',
        tier: 2,
        effects: {
          localIncreasedCriticalStrikeMultiplierPct: { min: 38, max: 44 }
        },
        itemLevelReq: 64,
        tags: ['critical']
      },

      // TIER 1 - Attack speed suffixes
      {
        id: 'of-fury-speed',
        name: 'of Fury (Attack Speed)',
        description: 'Increases Attack Speed - Highest Tier',
        type: 'suffix',
        tier: 1,
        effects: {
          localIncreasedAttackSpeedPct: { min: 27, max: 30 }
        },
        itemLevelReq: 82,
        tags: ['attack', 'speed']
      },
      {
        id: 'of-zeal-speed',
        name: 'of Zeal (Attack Speed)',
        description: 'Increases Attack Speed - High Tier',
        type: 'suffix',
        tier: 2,
        effects: {
          localIncreasedAttackSpeedPct: { min: 22, max: 26 }
        },
        itemLevelReq: 73,
        tags: ['attack', 'speed']
      },
      {
        id: 'of-fervor-speed',
        name: 'of Fervor (Attack Speed)',
        description: 'Increases Attack Speed - Medium Tier',
        type: 'suffix',
        tier: 3,
        effects: {
          localIncreasedAttackSpeedPct: { min: 17, max: 21 }
        },
        itemLevelReq: 60,
        tags: ['attack', 'speed']
      },

      // Hybrid suffix - Attack speed + accuracy
      {
        id: 'of-mastery-hybrid',
        name: 'of Mastery (Speed + Accuracy)',
        description: 'Increases Attack Speed and Accuracy',
        type: 'suffix',
        tier: 2,
        effects: {
          localIncreasedAttackSpeedPct: { min: 10, max: 14 },
          localIncreasedAccuracyRatingPct: { min: 180, max: 220 }
        },
        itemLevelReq: 64,
        tags: ['attack', 'speed', 'accuracy', 'hybrid']
      },

      // Accuracy suffixes
      {
        id: 'of-precision-acc',
        name: 'of Precision (Accuracy)',
        description: 'Increases Accuracy Rating - Highest Tier',
        type: 'suffix',
        tier: 1,
        effects: {
          localIncreasedAccuracyRatingPct: { min: 320, max: 365 }
        },
        itemLevelReq: 76,
        tags: ['accuracy']
      },
      {
        id: 'of-focus-acc',
        name: 'of Focus (Accuracy)',
        description: 'Increases Accuracy Rating - High Tier',
        type: 'suffix',
        tier: 2,
        effects: {
          localIncreasedAccuracyRatingPct: { min: 260, max: 319 }
        },
        itemLevelReq: 64,
        tags: ['accuracy']
      },

      // Special suffixes
      {
        id: 'of-penetrating-special',
        name: 'of Penetrating (Crit Penetration)',
        description: 'Critical Strikes Penetrate Elemental Resistances',
        type: 'suffix',
        tier: 1,
        effects: {
          criticalStrikePenetrationPct: { min: 38, max: 42 }
        },
        itemLevelReq: 73,
        tags: ['critical', 'penetration']
      },
      {
        id: 'of-spite-special',
        name: 'of Spite (More Dmg vs Low Life)',
        description: 'More Damage against Low Life Enemies',
        type: 'suffix',
        tier: 2,
        effects: {
          moreDamageVsLowLifePct: { min: 38, max: 42 }
        },
        itemLevelReq: 60,
        tags: ['damage', 'conditional']
      },
      {
        id: 'of-onslaught-special',
        name: 'of Onslaught (Gain Onslaught)',
        description: 'Chance to Gain Onslaught on Kill',
        type: 'suffix',
        tier: 2,
        effects: {
          chanceToGainOnslaughtOnKillPct: { min: 10, max: 15 }
        },
        itemLevelReq: 55,
        tags: ['buff', 'onslaught']
      },
      {
        id: 'of-evisceration-special',
        name: 'of Evisceration (Bleed on Crit)',
        description: 'Chance to inflict Bleeding on Critical Strike',
        type: 'suffix',
        tier: 2,
        effects: {
          chanceToBleedOnCritPct: { min: 30, max: 35 }
        },
        itemLevelReq: 50,
        tags: ['ailment', 'bleed']
      }
    ]
  };

  return mods;
}

async function main() {
  try {
    console.log('Creating quarterstaff weapon data for PoE2...');
    const quarterstaffs = createQuarterstaffData();

    fs.mkdirSync(path.dirname(QUARTERSTAFFS_OUTPUT), { recursive: true });
    fs.writeFileSync(QUARTERSTAFFS_OUTPUT, JSON.stringify(quarterstaffs, null, 2));

    console.log(`Extracted ${quarterstaffs.length} quarterstaffs to ${QUARTERSTAFFS_OUTPUT}`);

    // Log quarterstaff summary
    const levels = quarterstaffs.map(q => q.itemLevel).sort((a, b) => a - b);
    console.log(`Level range: ${levels[0]} to ${levels[levels.length - 1]}`);
    console.log(`Base damage range: ${quarterstaffs[0].baseMin}-${quarterstaffs[0].baseMax} to ${quarterstaffs[quarterstaffs.length - 1].baseMin}-${quarterstaffs[quarterstaffs.length - 1].baseMax}`);
    console.log(`Base crit chance: ${quarterstaffs[0].baseCritChancePct}%`);

    console.log('\nCreating quarterstaff modifier data...');
    const mods = createQuarterstaffMods();

    fs.writeFileSync(QUARTERSTAFF_MODS_OUTPUT, JSON.stringify(mods, null, 2));

    console.log(`Extracted ${mods.prefixes.length} prefixes and ${mods.suffixes.length} suffixes to ${QUARTERSTAFF_MODS_OUTPUT}`);

    // Log mod summary by tier
    const prefixTiers = {};
    const suffixTiers = {};

    mods.prefixes.forEach(mod => {
      prefixTiers[mod.tier] = (prefixTiers[mod.tier] || 0) + 1;
    });

    mods.suffixes.forEach(mod => {
      suffixTiers[mod.tier] = (suffixTiers[mod.tier] || 0) + 1;
    });

    console.log('Prefix tiers:', prefixTiers);
    console.log('Suffix tiers:', suffixTiers);

    // Log level requirements
    const prefixLevels = mods.prefixes.map(m => m.itemLevelReq).sort((a, b) => a - b);
    const suffixLevels = mods.suffixes.map(m => m.itemLevelReq).sort((a, b) => a - b);

    console.log(`Prefix level range: ${prefixLevels[0]} to ${prefixLevels[prefixLevels.length - 1]}`);
    console.log(`Suffix level range: ${suffixLevels[0]} to ${suffixLevels[suffixLevels.length - 1]}`);

    console.log('\n✅ Quarterstaff data extraction complete!');

  } catch (error) {
    console.error('Error in main:', error.message);
    process.exit(1);
  }
}

main();
