// Verifies the Amazon accuracy→crit mechanic (#38, discovered):
// "Gain additional Critical Hit Chance equal to 25% of excess chance to Hit".
// Flag-gated: only active when the Amazon wording is present, so non-Amazon
// builds keep the 100%-hit assumption (no regression).

import { aggregateFromLines } from '../aggregateMods';
import { excessHitPct, hitChancePct, ENEMY_PROFILES } from '../enemyDefense';

describe('Amazon accuracy → crit', () => {
  it('parse: the Amazon wording sets excessHitToCritPct = 25', () => {
    const mods = aggregateFromLines(
      [
        'Chance to Hit with Attacks can exceed 100%',
        'Gain additional Critical Hit Chance equal to 25% of excess chance to Hit with Attacks',
        '+400 to Accuracy Rating',
        '120% increased Accuracy Rating',
      ],
      { skillTypes: ['Attack', 'Bow'] },
    );
    expect(mods.excessHitToCritPct).toBe(25);
    expect(mods.accuracyFlat).toBe(400);
    expect(mods.accuracyIncreasedPct).toBe(120);
  });

  it('parse: a non-Amazon build has excessHitToCritPct = 0 (mechanic absent)', () => {
    const mods = aggregateFromLines(
      ['+400 to Accuracy Rating', '40% increased Critical Hit Chance'],
      { skillTypes: ['Attack', 'Bow'] },
    );
    expect(mods.excessHitToCritPct).toBe(0); // no accuracy→crit interaction
  });

  it('formula: excess hit rises with accuracy beyond the 95%-hit threshold', () => {
    const eva = ENEMY_PROFILES.pinnacle.evasion; // 1175
    // Low accuracy → below threshold → no excess.
    expect(excessHitPct(500, eva)).toBe(0);
    // High accuracy → positive excess, and hit chance approaches 100%.
    const high = excessHitPct(8000, eva);
    expect(high).toBeGreaterThan(0);
    expect(hitChancePct(8000, eva)).toBeGreaterThan(90);
    // More accuracy → more excess (monotonic).
    expect(excessHitPct(12000, eva)).toBeGreaterThan(high);
  });
});
