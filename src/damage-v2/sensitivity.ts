// Marginal-value (sensitivity) analysis — which modifier to chase next.
//
// The question "crit chance vs crit multi" and "flat vs increased vs more" has
// no fixed answer: it depends on the build's CURRENT state, because the damage
// pipeline is multiplicative across buckets. The value of one more "% increased"
// shrinks as your increased pool grows; the value of one more "flat" grows as
// your increased/more pools grow; crit chance and crit multi are partners whose
// individual value depends on the other.
//
// So instead of rules of thumb we read the marginal value off the REAL engine:
// take a build, nudge ONE bucket by a defined step (via composeDamage's
// `perturb` hook), recompute, and report the ΔDPS. Two views:
//   - perStep:  ΔDPS for "one realistic modifier" (a typical gear/tree roll) —
//               this is what drives the actual choice.
//   - perUnit:  ΔDPS per +1 of the bucket — the pure derivative, which exposes
//               the multiplicative-partner structure.
//
// Single source of truth: the numbers come from composeDamage itself, not a
// re-derived formula, so they can never silently diverge from the engine.

import { composeDamage, ComposeInput, ModPerturbation } from './composeDamage';

export type Lever =
  | 'flat'
  | 'increased'
  | 'more'
  | 'critChance'
  | 'critMulti'
  | 'attackSpeed'
  | 'penetration';

export interface LeverStep {
  lever: Lever;
  label: string;
  /** The realistic "one modifier" increment used (e.g. +20% increased). */
  step: number;
  stepUnit: string;
  /** ΔDPS from adding one realistic modifier of this lever. */
  deltaPerStep: number;
  /** ΔDPS as a fraction of baseline (one realistic modifier). */
  deltaPctPerStep: number;
  /** ΔDPS per +1 of the bucket's unit — the local derivative. */
  deltaPerUnit: number;
  /** The perturbation that produced it (for transparency / debugging). */
  perturbation: ModPerturbation;
}

export interface SensitivityResult {
  baselineDps: number;
  levers: LeverStep[];           // sorted best→worst by deltaPerStep
  /** Plain-language read of the current balance points. */
  verdict: string[];
}

// Realistic "one modifier" step sizes — sized to a single good gear/tree source
// so the comparison maps onto real choices, not abstract points.
//   flat        : +10 avg added damage   (a small added-damage roll on a ring)
//   increased   : +20% increased         (one notable passive cluster or gear mod)
//   more        : +20% more              (a typical support-gem multiplier)
//   critChance  : +30% increased crit    (a crit passive cluster / good gear mod)
//   critMulti   : +25% crit multiplier   (a good crit-damage mod)
//   attackSpeed : +12% increased speed   (one attack/cast-speed source)
const STEPS: Record<Lever, { step: number; unit: string; perturb: (s: number) => ModPerturbation; label: string }> = {
  flat:        { step: 10, unit: 'avg flat', label: 'Flat added damage',     perturb: (s) => ({ addedFlatToAttacksAvg: s }) },
  increased:   { step: 20, unit: '%',        label: 'Increased damage',      perturb: (s) => ({ increasedDamagePct: s }) },
  more:        { step: 20, unit: '%',        label: 'More damage (support)', perturb: (s) => ({ moreDamagePct: s }) },
  critChance:  { step: 30, unit: '% inc',    label: 'Crit chance',           perturb: (s) => ({ increasedCritChancePct: s }) },
  critMulti:   { step: 25, unit: '%',        label: 'Crit multiplier',       perturb: (s) => ({ addedCritMultiplierPct: s }) },
  attackSpeed: { step: 12, unit: '% inc',    label: 'Attack/cast speed',     perturb: (s) => ({ increasedAttackSpeedPct: s }) },
  penetration: { step: 15, unit: '% pen',    label: 'Elemental penetration', perturb: (s) => ({ penetrationElementalPct: s }) },
};

const ALL_LEVERS: Lever[] = ['flat', 'increased', 'more', 'critChance', 'critMulti', 'attackSpeed', 'penetration'];

/**
 * Compute marginal DPS for each modifier bucket on a given build/skill, by
 * re-running the real composer with each bucket nudged.
 */
export function analyzeSensitivity(input: ComposeInput, levers: Lever[] = ALL_LEVERS): SensitivityResult {
  const baseline = composeDamage(input).dps;

  const results: LeverStep[] = levers.map((lever) => {
    const def = STEPS[lever];
    const perturbation = def.perturb(def.step);
    const perturbedDps = composeDamage({ ...input, perturb: perturbation }).dps;
    const deltaPerStep = perturbedDps - baseline;
    return {
      lever,
      label: def.label,
      step: def.step,
      stepUnit: def.unit,
      deltaPerStep,
      deltaPctPerStep: baseline > 0 ? deltaPerStep / baseline : 0,
      deltaPerUnit: deltaPerStep / def.step,
      perturbation,
    };
  });

  results.sort((a, b) => b.deltaPerStep - a.deltaPerStep);
  return { baselineDps: baseline, levers: results, verdict: buildVerdict(input, results) };
}

// Derive the balance-point reads. We compare the partner pairs directly:
//   - crit chance vs crit multi  (multiplicative partners in EV = 1+c(m-1))
//   - flat vs increased          (both feed the pre-more product)
//   - more is reported as the always-full-value reference.
function buildVerdict(input: ComposeInput, levers: LeverStep[]): string[] {
  const by = (l: Lever) => levers.find((x) => x.lever === l)!;
  const out: string[] = [];

  const top = levers[0];
  out.push(`Best next modifier for this build: ${top.label} (+${(top.deltaPctPerStep * 100).toFixed(1)}% DPS per ${top.step}${top.stepUnit}).`);

  // Crit chance vs crit multi — the classic partner pair.
  const cc = by('critChance'); const cm = by('critMulti');
  if (cc.deltaPerStep > cm.deltaPerStep * 1.15) {
    out.push(`Crit: chance is ahead of multi (${fmtPct(cc)} vs ${fmtPct(cm)}). You crit too rarely for multi to pay off — buy crit CHANCE until they converge.`);
  } else if (cm.deltaPerStep > cc.deltaPerStep * 1.15) {
    out.push(`Crit: multi is ahead of chance (${fmtPct(cm)} vs ${fmtPct(cc)}). Your crit chance is high enough that more MULTI pays better — buy crit DAMAGE.`);
  } else {
    out.push(`Crit: chance and multi are balanced (${fmtPct(cc)} vs ${fmtPct(cm)}). Take whichever the source rolls higher / cheaper.`);
  }

  // Flat vs increased — partners before the more-bucket.
  const fl = by('flat'); const inc = by('increased'); const more = by('more');
  if (fl.deltaPerStep > inc.deltaPerStep * 1.15) {
    out.push(`Scaling: FLAT outpaces increased (${fmtPct(fl)} vs ${fmtPct(inc)}) — your % increased pool is already deep, so added flat gets multiplied by all of it. Chase flat + more.`);
  } else if (inc.deltaPerStep > fl.deltaPerStep * 1.15) {
    out.push(`Scaling: INCREASED outpaces flat (${fmtPct(inc)} vs ${fmtPct(fl)}) — your flat base is large relative to your increased pool. Stack % increased (and flat is the partner to revisit later).`);
  } else {
    out.push(`Scaling: flat and increased are balanced (${fmtPct(fl)} vs ${fmtPct(inc)}). Keep them growing together.`);
  }
  out.push(`MORE (${fmtPct(more)}) is never diluted — every multiplicative source is full value. It's scarce (mostly supports/keystones); take it whenever available, it doesn't compete with the additive buckets.`);

  // Penetration only has value against a resisted (elemental) hit on this
  // target tier. If it ranks high, the build is fighting resistance and pen
  // beats raw damage; if ~0 the hit is chaos / unresisted / already inverted.
  const pen = levers.find((x) => x.lever === 'penetration');
  if (pen) {
    if (pen.deltaPerStep <= 0.0001) {
      out.push(`Penetration: ~0 value here — the hit isn't resisted (chaos, or resistance already inverted/negative). Don't invest in pen.`);
    } else if (pen.deltaPerStep > more.deltaPerStep) {
      out.push(`Penetration: HIGHEST-value lever (${fmtPct(pen)}) — you're fighting heavy resistance. ${pen.step}% pen beats a damage roll; chase pen/exposure (or invert resistance) before raw damage.`);
    } else {
      out.push(`Penetration: positive (${fmtPct(pen)}) — the target resists this element, so pen is live. Weigh it against more-damage sources.`);
    }
  }

  return out;
}

function fmtPct(l: LeverStep): string {
  return `+${(l.deltaPctPerStep * 100).toFixed(1)}%/${l.step}${l.stepUnit}`;
}
