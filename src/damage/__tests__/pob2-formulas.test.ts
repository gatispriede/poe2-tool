import { calculateDamage } from '../formulas';
import { CalculationInput } from '../model';

describe('Path of Building 2 Compatible Calculations', () => {

  describe('Critical Strike Chance (Multiplicative Scaling)', () => {
    test('should calculate crit chance multiplicatively, not additively', () => {
      const input: CalculationInput = {
        weapon: { name: 'Test', baseMin: 10, baseMax: 20, baseAPS: 1.0 },
        skill: { name: 'Test' },
        passives: {
          baseCritChancePct: 5,
          increasedCritChancePct: 150, // 150% increased global
        },
        weaponMods: {
          localIncreasedCriticalStrikeChancePct: 30, // 30% increased local
        }
      };

      const result = calculateDamage(input);

      // PoB2 formula: 5% × (1 + 30%) × (1 + 150%) = 5 × 1.3 × 2.5 = 16.25%
      expect(result.effectiveCritChance).toBeCloseTo(0.1625, 4);

      // OLD (incorrect) formula would be: (5 + 30 + 150) / 100 = 185% → capped at 100%
      expect(result.effectiveCritChance).not.toBeCloseTo(1.0, 1);
    });

    test('should clamp crit chance at 100%', () => {
      const input: CalculationInput = {
        weapon: { name: 'Test', baseMin: 10, baseMax: 20, baseAPS: 1.0 },
        skill: { name: 'Test' },
        passives: {
          baseCritChancePct: 5,
          increasedCritChancePct: 2000, // Extreme value
        },
        weaponMods: {
          localIncreasedCriticalStrikeChancePct: 500,
        }
      };

      const result = calculateDamage(input);
      expect(result.effectiveCritChance).toBeLessThanOrEqual(1.0);
    });
  });

  describe('Critical Strike Multiplier (Additive)', () => {
    test('should add increased crit multiplier to base', () => {
      const input: CalculationInput = {
        weapon: { name: 'Test', baseMin: 10, baseMax: 20, baseAPS: 1.0 },
        skill: { name: 'Test' },
        passives: {
          baseCritMultiplierPct: 150,
          increasedCritMultiplierPct: 50,
        },
        weaponMods: {
          localIncreasedCriticalStrikeMultiplierPct: 30,
        }
      };

      const result = calculateDamage(input);

      // 150% base + 50% global + 30% local = 230% = 2.3× multiplier
      expect(result.effectiveCritMultiplier).toBeCloseTo(2.3, 2);
    });
  });

  describe('Local vs Global Damage Modifiers', () => {
    test('should apply local increased damage before global', () => {
      const input: CalculationInput = {
        weapon: {
          name: 'Test',
          baseMin: 10,
          baseMax: 10,
          baseAPS: 1.0,
          localIncreasedDamagePct: 50, // 50% local (from weapon quality)
        },
        skill: { name: 'Test' },
        passives: {
          increasedPhysicalDamagePct: 100, // 100% global
        },
        weaponMods: {
          localIncreasedPhysicalDamagePct: 50, // 50% local (from mods)
        }
      };

      const result = calculateDamage(input);

      // Local first: 10 × (1 + 50% + 50%) = 10 × 2.0 = 20
      // Then global: 20 × (1 + 100%) = 40
      expect(result.averageBaseWeaponDamage).toBeCloseTo(20, 2);
      expect(result.averagePreCritNonMore).toBeCloseTo(40, 2);
    });
  });

  describe('Elemental Damage Independence', () => {
    test('should not apply local physical increases to elemental damage', () => {
      const input: CalculationInput = {
        weapon: {
          name: 'Test',
          baseMin: 10,
          baseMax: 10,
          baseAPS: 1.0,
        },
        skill: { name: 'Test' },
        passives: {},
        weaponMods: {
          localIncreasedPhysicalDamagePct: 100, // Should NOT affect fire damage
          addedFireDamageMin: 10,
          addedFireDamageMax: 10,
        }
      };

      const result = calculateDamage(input);

      // Physical: 10 × (1 + 100%) = 20
      // Fire: 10 (NOT affected by local physical)
      // Total base: 30
      expect(result.averageBaseWeaponDamage).toBeCloseTo(30, 2);
    });
  });

  describe('More Multipliers (Multiplicative Chain)', () => {
    test('should multiply more modifiers sequentially', () => {
      const input: CalculationInput = {
        weapon: { name: 'Test', baseMin: 100, baseMax: 100, baseAPS: 1.0 },
        skill: {
          name: 'Test',
          moreDamageMultipliersPct: [30, 40], // 30% more, then 40% more
        },
        passives: {},
      };

      const result = calculateDamage(input);

      // 100 × 1.3 × 1.4 = 182
      expect(result.averageHitNonCrit).toBeCloseTo(182, 2);
    });
  });

  describe('Weighted Crit Average (PoB2 Formula)', () => {
    test('should use correct weighted average formula', () => {
      const input: CalculationInput = {
        weapon: { name: 'Test', baseMin: 100, baseMax: 100, baseAPS: 1.0 },
        skill: { name: 'Test' },
        passives: {
          baseCritChancePct: 20, // 20% crit
          baseCritMultiplierPct: 200, // 2.0× multiplier
        },
      };

      const result = calculateDamage(input);

      // Non-crit: 100
      // Crit: 100 × 2.0 = 200
      // Average: 100 × (0.8) + 200 × (0.2) = 80 + 40 = 120
      // Or: 100 × (1 - 0.2 + 0.2 × 2.0) = 100 × 1.2 = 120
      expect(result.averageHitWithCrit).toBeCloseTo(120, 2);
    });
  });

  describe('Attack Speed Calculations', () => {
    test('should add local and global increased AS, then multiply more modifiers', () => {
      const input: CalculationInput = {
        weapon: { name: 'Test', baseMin: 10, baseMax: 10, baseAPS: 1.0 },
        skill: {
          name: 'Test',
          moreAttackSpeedMultipliersPct: [20], // 20% more AS
        },
        passives: {
          increasedAttackSpeedPct: 50, // 50% global increased
        },
        weaponMods: {
          localIncreasedAttackSpeedPct: 30, // 30% local increased
        }
      };

      const result = calculateDamage(input);

      // 1.0 × (1 + 30% + 50%) × 1.2 = 1.0 × 1.8 × 1.2 = 2.16
      expect(result.effectiveAPS).toBeCloseTo(2.16, 2);
    });
  });

  describe('Full Integration Test', () => {
    test('should calculate realistic DPS with all modifiers', () => {
      const input: CalculationInput = {
        weapon: {
          name: 'Carved Wand',
          baseMin: 12,
          baseMax: 22,
          baseAPS: 1.35,
          localIncreasedDamagePct: 8,
        },
        skill: {
          name: 'Fireball',
          moreDamageMultipliersPct: [30],
        },
        passives: {
          baseCritChancePct: 5,
          increasedCritChancePct: 150,
          baseCritMultiplierPct: 150,
          increasedCritMultiplierPct: 50,
          increasedPhysicalDamagePct: 120,
          increasedAttackSpeedPct: 25,
        },
        weaponMods: {
          localIncreasedPhysicalDamagePct: 140, // Merciless prefix
          localIncreasedCriticalStrikeChancePct: 25,
          localIncreasedCriticalStrikeMultiplierPct: 32,
          localIncreasedAttackSpeedPct: 15,
        }
      };

      const result = calculateDamage(input);

      // Verify calculation steps
      expect(result.averageBaseWeaponDamage).toBeGreaterThan(0);
      expect(result.effectiveCritChance).toBeGreaterThan(0);
      expect(result.effectiveCritChance).toBeLessThanOrEqual(1);
      expect(result.effectiveCritMultiplier).toBeGreaterThan(1);
      expect(result.effectiveAPS).toBeGreaterThan(1);
      expect(result.dps).toBeGreaterThan(0);

      // DPS should be in a reasonable range for this setup
      expect(result.dps).toBeGreaterThan(50);
      expect(result.dps).toBeLessThan(500);
    });
  });

  describe('Edge Cases', () => {
    test('should handle zero damage gracefully', () => {
      const input: CalculationInput = {
        weapon: { name: 'Test', baseMin: 0, baseMax: 0, baseAPS: 1.0 },
        skill: { name: 'Test' },
        passives: {},
      };

      const result = calculateDamage(input);
      expect(result.dps).toBe(0);
    });

    test('should handle negative values by clamping to zero', () => {
      const input: CalculationInput = {
        weapon: { name: 'Test', baseMin: -10, baseMax: -5, baseAPS: -1.0 },
        skill: { name: 'Test' },
        passives: {
          baseCritChancePct: -10,
        },
      };

      const result = calculateDamage(input);
      expect(result.averageBaseWeaponDamage).toBeGreaterThanOrEqual(0);
      expect(result.effectiveAPS).toBeGreaterThanOrEqual(0);
    });
  });
});
