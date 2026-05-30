// Applies default per-charge bonuses to a GlobalMods bundle.
//
// PoE2 baseline charge effects (from in-game tooltips, no Ascendancy
// modifications):
//   - Frenzy charge:    +4% more Attack Speed and +4% more Cast Speed per charge
//   - Power charge:     +40% increased Critical Hit Chance per charge
//   - Endurance charge: defensive only (no DPS effect)
//
// poe.ninja shows charges as "X / Y / Z" representing current Power/Frenzy/
// Endurance. We assume max stacks (3 for each) for sustained-DPS scenarios,
// which is conservative — many builds maintain max charges in combat.
//
// Ascendancies can MODIFY these per-charge effects (e.g. Inquisitor's Power
// charges grant different bonuses in PoE1). We don't yet model ascendancy
// charge changes — TODO when we encounter a fixture that disagrees with
// the defaults.

import { GlobalMods, mergeMods, emptyMods } from './aggregateMods';

const DEFAULT_FRENZY_STACKS = 3;
const DEFAULT_POWER_STACKS = 3;

const FRENZY_ATTACK_SPEED_PER_STACK_MORE = 4;     // % more
const POWER_CRIT_CHANCE_PER_STACK_INC = 40;       // % increased

export function applyMaxCharges(base: GlobalMods, skill: { skillTypes: string[] }): GlobalMods {
  const charged: GlobalMods = emptyMods();

  // Frenzy → more attack/cast speed. Both attacks and spells use the same
  // hit-rate bucket in our composer, so a single push covers both profiles.
  for (let i = 0; i < DEFAULT_FRENZY_STACKS; i++) {
    charged.moreAttackSpeedList.push(FRENZY_ATTACK_SPEED_PER_STACK_MORE);
  }

  // Power → increased crit chance.
  charged.increasedCritChancePct += POWER_CRIT_CHANCE_PER_STACK_INC * DEFAULT_POWER_STACKS;

  return mergeMods(base, charged);
}
