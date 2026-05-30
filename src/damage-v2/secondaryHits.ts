// Secondary on-hit damage (curated, calibrated).
//
// Some skills deal a SIMULTANEOUS second hit that PoB folds into its headline
// DPS but our per-hit composer doesn't model: Ice Shot fires an arrow AND
// sprays a cone of ice shards, Lightning Spear throws AND detonates, etc.
//
// We DON'T auto-detect this from "skill has 2 statSets" — that false-positives
// on alternate-mode skills (Comet's Fire-Infused is an either/or variant, not
// an extra hit). Instead this is a curated map, the same way PoB special-cases
// them, with the single-target contribution calibrated against real builds:
//   - Both real Ice Shot builds (4ZLffDTQxYAj, DLtydZs_Mos6) composed to
//     exactly 0.50× of PoB's Total DPS with arrow-only. The shard cone
//     contributes ~1× on single target → fraction 1.0 lands them at ~1×.
//
// `singleTargetFraction` = extra hit damage as a fraction of the primary hit,
// for a single (boss) target. The cone's full multi-projectile value is a
// CLEAR-speed effect, already represented by coverage.ts.

export interface SecondaryHit {
  singleTargetFraction: number;
  note: string;
}

export const SECONDARY_HITS: Record<string, SecondaryHit> = {
  // Ice Shot — arrow + ice-shard cone. Calibrated to the two real Ice Shot
  // builds (each composed to 0.50× of PoB before this).
  IceShotPlayer: { singleTargetFraction: 1.0, note: 'ice shard cone (statSets[2] "Shards")' },
};

export function secondaryHitFraction(skillId: string): number {
  return SECONDARY_HITS[skillId]?.singleTargetFraction ?? 0;
}
