import quarterstaffs from '../Quarterstaffs.json';
import quarterstaffMods from '../QuarterstaffMods.json';

describe('Quarterstaffs Data', () => {
  test('should have at least 9 quarterstaffs', () => {
    expect(quarterstaffs.length).toBeGreaterThanOrEqual(9);
  });

  test('all quarterstaffs have required properties', () => {
    quarterstaffs.forEach(staff => {
      expect(staff).toHaveProperty('id');
      expect(staff).toHaveProperty('name');
      expect(staff).toHaveProperty('baseMin');
      expect(staff).toHaveProperty('baseMax');
      expect(staff).toHaveProperty('baseAPS');
      expect(staff).toHaveProperty('weaponType');
      expect(staff).toHaveProperty('itemLevel');
      expect(staff).toHaveProperty('baseCritChancePct');

      expect(typeof staff.baseMin).toBe('number');
      expect(typeof staff.baseMax).toBe('number');
      expect(typeof staff.baseAPS).toBe('number');
      expect(staff.baseMin).toBeGreaterThan(0);
      expect(staff.baseMax).toBeGreaterThan(staff.baseMin);
      expect(staff.baseAPS).toBeGreaterThan(0);
      expect(staff.weaponType).toBe('Quarterstaff');
      expect(staff.baseCritChancePct).toBe(6.5);
    });
  });

  test('quarterstaffs have progressive damage scaling', () => {
    const sorted = [...quarterstaffs].sort((a, b) => a.itemLevel - b.itemLevel);
    const low = sorted[0];
    const high = sorted[sorted.length - 1];

    expect(high.baseMax).toBeGreaterThan(low.baseMax);
  });

  test('quarterstaffs have unique IDs', () => {
    const ids = quarterstaffs.map(s => s.id);
    const uniqueIds = [...new Set(ids)];
    expect(uniqueIds).toHaveLength(ids.length);
  });

  test('quarterstaffs have 6.5% base crit chance', () => {
    quarterstaffs.forEach(staff => {
      expect(staff.baseCritChancePct).toBe(6.5);
    });
  });
});

describe('Quarterstaff Mods Data', () => {
  test('should have prefixes and suffixes', () => {
    expect(quarterstaffMods).toHaveProperty('prefixes');
    expect(quarterstaffMods).toHaveProperty('suffixes');
    expect(Array.isArray(quarterstaffMods.prefixes)).toBe(true);
    expect(Array.isArray(quarterstaffMods.suffixes)).toBe(true);
  });

  test('should have at least 16 prefixes', () => {
    expect(quarterstaffMods.prefixes.length).toBeGreaterThanOrEqual(16);
  });

  test('should have at least 14 suffixes', () => {
    expect(quarterstaffMods.suffixes.length).toBeGreaterThanOrEqual(14);
  });

  test('all mods have required properties', () => {
    [...quarterstaffMods.prefixes, ...quarterstaffMods.suffixes].forEach(mod => {
      expect(mod).toHaveProperty('id');
      expect(mod).toHaveProperty('name');
      expect(mod).toHaveProperty('description');
      expect(mod).toHaveProperty('type');
      expect(mod).toHaveProperty('tier');
      expect(mod).toHaveProperty('effects');
      expect(mod).toHaveProperty('itemLevelReq');
      expect(mod).toHaveProperty('tags');

      expect(['prefix', 'suffix']).toContain(mod.type);
      expect(typeof mod.tier).toBe('number');
      expect(typeof mod.itemLevelReq).toBe('number');
      expect(Array.isArray(mod.tags)).toBe(true);
    });
  });

  test('all mod effects have valid ranges', () => {
    [...quarterstaffMods.prefixes, ...quarterstaffMods.suffixes].forEach(mod => {
      Object.values(mod.effects).forEach(effect => {
        expect(effect).toHaveProperty('min');
        expect(effect).toHaveProperty('max');
        expect(typeof effect.min).toBe('number');
        expect(typeof effect.max).toBe('number');
        expect(effect.max).toBeGreaterThanOrEqual(effect.min);
      });
    });
  });

  test('mods have unique IDs', () => {
    const allMods = [...quarterstaffMods.prefixes, ...quarterstaffMods.suffixes];
    const ids = allMods.map(mod => mod.id);
    const uniqueIds = [...new Set(ids)];
    expect(uniqueIds).toHaveLength(ids.length);
  });

  test('mods have reasonable tier distribution', () => {
    const prefixTiers = quarterstaffMods.prefixes.map(mod => mod.tier);
    const suffixTiers = quarterstaffMods.suffixes.map(mod => mod.tier);

    // Should have multiple tiers
    expect(new Set(prefixTiers).size).toBeGreaterThan(1);
    expect(new Set(suffixTiers).size).toBeGreaterThan(1);

    // Tiers should be reasonable (1-4 for prefixes, 1-3 for suffixes based on our data)
    expect(Math.max(...prefixTiers)).toBeLessThanOrEqual(4);
    expect(Math.max(...suffixTiers)).toBeLessThanOrEqual(3);
    expect(Math.min(...prefixTiers)).toBeGreaterThanOrEqual(1);
    expect(Math.min(...suffixTiers)).toBeGreaterThanOrEqual(1);
  });

  test('prefixes should have damage-contributing effects', () => {
    const damageEffects = [
      'localIncreasedPhysicalDamagePct',
      'addedFireDamageMin',
      'addedColdDamageMin',
      'addedLightningDamageMin',
      'localIncreasedCriticalStrikeChancePct'
    ];

    quarterstaffMods.prefixes.forEach(mod => {
      const hasApplicableDamageEffect = Object.keys(mod.effects).some(effect =>
        damageEffects.includes(effect) || effect.includes('Damage') || effect.includes('Crit')
      );
      expect(hasApplicableDamageEffect).toBe(true);
    });
  });

  test('suffixes should have crit, speed, or utility effects', () => {
    const utilityEffects = [
      'localIncreasedCriticalStrikeChancePct',
      'localIncreasedCriticalStrikeMultiplierPct',
      'localIncreasedAttackSpeedPct',
      'localIncreasedAccuracyRatingPct',
      'criticalStrikePenetrationPct',
      'moreDamageVsLowLifePct',
      'chanceToGainOnslaughtOnKillPct',
      'chanceToBleedOnCritPct'
    ];

    quarterstaffMods.suffixes.forEach(mod => {
      const hasUtilityEffect = Object.keys(mod.effects).some(effect =>
        utilityEffects.includes(effect)
      );
      expect(hasUtilityEffect).toBe(true);
    });
  });

  test('mod names should indicate their damage contribution', () => {
    quarterstaffMods.prefixes.forEach(mod => {
      // Prefix names should contain damage-related keywords
      const name = mod.name.toLowerCase();
      const desc = mod.description.toLowerCase();
      const hasKeyword =
        name.includes('damage') || name.includes('phys') || name.includes('fire') ||
        name.includes('cold') || name.includes('lightning') || name.includes('crit') ||
        desc.includes('damage') || desc.includes('critical');

      expect(hasKeyword).toBe(true);
    });

    quarterstaffMods.suffixes.forEach(mod => {
      // Suffix names should indicate their contribution
      const name = mod.name.toLowerCase();
      const desc = mod.description.toLowerCase();
      const hasKeyword =
        name.includes('crit') || name.includes('speed') || name.includes('accuracy') ||
        name.includes('penetrat') || name.includes('spite') || name.includes('onslaught') ||
        desc.includes('crit') || desc.includes('speed') || desc.includes('damage');

      expect(hasKeyword).toBe(true);
    });
  });
});
