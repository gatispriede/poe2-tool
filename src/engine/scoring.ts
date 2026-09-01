// Turning "this modifier applies" into "this modifier is worth N%".
//
// Ranking needs a common currency. Every applicable effect is evaluated as a
// MARGINAL gain against a stated baseline build — a 10% increased-damage node
// is worth a lot at 100% increased and very little at 400%, and any honest
// ranking has to say which of those it assumed. The baseline is an explicit,
// editable input (BuildContext), never a hidden constant.
//
// The vector separates what the user asked to see separately:
//   dps     total multiplicative gain to sustained damage (rate included)
//   rate    the part of `dps` that comes from applying damage more often
//   aoe     gain to area / coverage, which is not damage but is throughput
//   utility everything that keeps you alive or casting

import { Applicability, Effect, SkillProfile } from './types';

export interface BuildContext {
  /** Sum of increased damage already on the build, in %. */
  increasedDamage: number;
  /** Sum of increased attack/cast speed already on the build, in %. */
  increasedSpeed: number;
  /** Sum of increased area of effect already on the build, in %. */
  increasedArea: number;
  /** Sum of increased crit chance already on the build, in %. */
  increasedCritChance: number;
  /** Effective crit chance, 0..1. */
  critChance: number;
  /** Crit damage bonus as a multiplier over a normal hit (1.5 = +50%). */
  critMultiplier: number;
  /** Enemy elemental resistance assumed when valuing penetration, 0..1. */
  enemyResistance: number;
  /** How much of the skill's damage is expected to come from ailments, 0..1.
   *  Overridden per skill when the skill is a pure damage-over-time skill. */
  ailmentReliance: number;
  /** Average base hit used to value flat added damage. */
  referenceHit: number;
  /** Cooldown recovery already on the build, in %. */
  increasedCooldownRecovery: number;
  /** Increased damage already rolled ON THE WEAPON. Weapon-local damage is a
   *  separate additive bucket from your global increases, so it dilutes
   *  against a much smaller pool and is worth far more per point. */
  localIncreasedDamage: number;
}

export const DEFAULT_CONTEXT: BuildContext = {
  increasedDamage: 250,
  increasedSpeed: 60,
  increasedArea: 30,
  increasedCritChance: 150,
  critChance: 0.35,
  critMultiplier: 1.5,
  enemyResistance: 0.3,
  ailmentReliance: 0.25,
  referenceHit: 400,
  increasedCooldownRecovery: 0,
  localIncreasedDamage: 100,
};

export interface ScoreVector {
  dps: number;
  rate: number;
  aoe: number;
  utility: number;
  /** Human-readable explanation of how the number was produced. */
  note: string;
}

const ZERO: ScoreVector = { dps: 0, rate: 0, aoe: 0, utility: 0, note: '' };

/** Additive buckets dilute: the marginal worth of +X% is X/(100+existing). */
const marginalIncreased = (value: number, existing: number) => value / (100 + existing);

function critGain(effect: Effect, ctx: BuildContext): number {
  const effectiveMultiplier = 1 + ctx.critChance * (ctx.critMultiplier - 1);
  if (effect.stat === 'critChance') {
    const newCrit = Math.min(1, ctx.critChance * (1 + marginalIncreased(effect.value, ctx.increasedCritChance)));
    return (1 + newCrit * (ctx.critMultiplier - 1)) / effectiveMultiplier - 1;
  }
  // critDamage arrives as "+X% to Critical Damage Bonus" (flat) or increased.
  const delta = effect.form === 'flat' ? effect.value / 100
    : (ctx.critMultiplier - 1) * (effect.value / 100);
  return (1 + ctx.critChance * (ctx.critMultiplier - 1 + delta)) / effectiveMultiplier - 1;
}

function penetrationGain(value: number, ctx: BuildContext): number {
  const before = 1 - ctx.enemyResistance;
  const after = 1 - Math.max(-0.5, ctx.enemyResistance - value / 100);
  return after / before - 1;
}

export function scoreEffect(
  effect: Effect,
  skill: SkillProfile,
  applicability: Applicability,
  ctx: BuildContext = DEFAULT_CONTEXT,
): ScoreVector {
  if (!applicability.applies) return ZERO;
  const uptime = applicability.uptime;
  const scale = (v: number) => v * uptime;
  const ailment = skill.tags.has('damageOverTime') ? 1 : ctx.ailmentReliance;

  const out = (partial: Partial<ScoreVector>, note: string): ScoreVector =>
    ({ ...ZERO, ...partial, note });

  switch (effect.stat) {
    case 'damage':
    case 'dotDamage': {
      const dotFactor = effect.stat === 'dotDamage' ? ailment : 1;
      if (effect.form === 'more') {
        return out({ dps: scale((effect.value / 100) * dotFactor) }, `${effect.value}% more damage`);
      }
      if (effect.form === 'conversion' || effect.form === 'gainAs') {
        // Conversion is worth whatever extra scaling the new type opens up; the
        // engine cannot know your gear, so it books a conservative placeholder
        // and flags it for review rather than inventing a number.
        return out({ dps: scale(effect.form === 'gainAs' ? effect.value / 200 : 0) },
          `${effect.form === 'gainAs' ? 'extra damage as' : 'converts to'} ${effect.to ?? 'another type'} — value depends on your ${effect.to ?? 'element'} scaling`);
      }
      return out({ dps: scale(marginalIncreased(effect.value, ctx.increasedDamage) * dotFactor) },
        `${effect.value}% increased damage against a ${ctx.increasedDamage}% baseline`);
    }
    case 'addedDamage': {
      const avg = ((effect.value ?? 0) + (effect.valueMax ?? effect.value ?? 0)) / 2;
      return out({ dps: scale(avg / ctx.referenceHit) },
        `adds ~${avg.toFixed(0)} to a ${ctx.referenceHit} reference hit`);
    }
    case 'dotMultiplier':
      return out({ dps: scale((effect.value / 100) * ailment) },
        `${effect.value}% damage-over-time multiplier`);
    case 'critChance':
    case 'critDamage':
      return out({ dps: scale(critGain(effect, ctx)) },
        `crit scaling at ${(ctx.critChance * 100).toFixed(0)}% crit / ${ctx.critMultiplier}x`);
    case 'penetration':
    case 'exposure':
      return out({ dps: scale(penetrationGain(Math.abs(effect.value), ctx)) },
        `vs ${(ctx.enemyResistance * 100).toFixed(0)}% enemy resistance`);
    case 'ailmentMagnitude':
    case 'ailmentDuration':
      return out({ dps: scale(marginalIncreased(effect.value, 100) * ailment) },
        `scales ailment damage (${(ailment * 100).toFixed(0)}% of this skill's output assumed)`);
    case 'ailmentChance':
      return out({ dps: scale((effect.value / 100) * 0.25 * ailment) },
        'more consistent ailment application');
    case 'ailmentBuildup':
    case 'stunBuildup':
      return out({ rate: scale(marginalIncreased(effect.value, 0) * 0.5), dps: 0 },
        'reaches the ailment/stun threshold sooner');
    case 'armourBreak':
      return out({ dps: scale(marginalIncreased(effect.value, 100) * 0.3) },
        'armour break raises the physical damage that lands');
    case 'gemLevel':
      return out({ dps: scale(effect.value * 0.08) }, `~8% per gem level (${effect.value} levels)`);
    case 'curseEffect':
    case 'auraEffect':
      return out({ dps: scale(marginalIncreased(effect.value, 100) * 0.4) },
        'stronger curse/buff effect, partial pass-through to damage');
    case 'accuracy':
      return out({ dps: scale(marginalIncreased(effect.value, 200) * 0.3) },
        'accuracy converts to hit chance, with diminishing returns');

    // ---- rate of application ------------------------------------------
    case 'attackSpeed':
    case 'castSpeed':
    case 'skillSpeed':
    case 'warcrySpeed':
    case 'reloadSpeed': {
      const gain = scale(marginalIncreased(effect.value, ctx.increasedSpeed));
      return out({ dps: gain, rate: gain }, `${effect.value}% faster use against a ${ctx.increasedSpeed}% baseline`);
    }
    case 'cooldownRecovery': {
      if (skill.cooldown === undefined) return ZERO;
      const gain = scale(marginalIncreased(effect.value, ctx.increasedCooldownRecovery));
      return out({ dps: gain, rate: gain }, `this skill is cooldown-bound (${skill.cooldown}s)`);
    }
    case 'dotFaster': {
      const gain = scale((effect.value / 100) * ailment);
      return out({ dps: gain, rate: gain }, 'damaging ailments tick their total damage sooner');
    }
    case 'totemPlacement':
      return out({ rate: scale(marginalIncreased(effect.value, 0) * 0.5) }, 'totems come online faster');
    case 'skillEffectDuration':
      return out({ rate: scale(marginalIncreased(effect.value, 0) * 0.2) },
        'longer duration: more overlap for lingering skills, slower re-application for others');

    // ---- coverage --------------------------------------------------------
    case 'areaOfEffect':
    case 'presenceArea': {
      const gain = scale(marginalIncreased(effect.value, ctx.increasedArea));
      return out({ aoe: gain }, `${effect.value}% increased area against a ${ctx.increasedArea}% baseline`);
    }
    case 'projectileCount': {
      const current = Math.max(1, skill.projectiles ?? 1);
      // "+1 projectile" adds one; "40% chance for an additional projectile"
      // adds 0.4 of one. Reading the chance as a count inflates it 100x.
      const added = effect.form === 'chance' ? effect.value / 100 : effect.value;
      const gain = scale(added / current);
      return out({ aoe: gain, dps: gain * 0.4 },
        `+${added.toFixed(2)} on ${current} existing projectile(s); overlap decides how much becomes damage`);
    }
    case 'chainCount':
      return out({ aoe: scale(0.15 * Math.max(1, effect.value)) }, 'extra chains extend clear range');
    case 'pierce':
    case 'fork':
      return out({ aoe: scale(0.12) }, 'projectiles hit more targets per shot');
    case 'projectileSpeed':
      return out({ aoe: scale(marginalIncreased(effect.value, 0) * 0.2) }, 'projectiles reach further, faster');
    case 'meleeRange':
      return out({ aoe: scale(marginalIncreased(effect.value, 0) * 0.4) }, 'more reach per swing');

    default: {
      // Utility is not on the damage axis; normalise it so a +1500 life unique
      // cannot outrank every damage source in a sorted list.
      const denominator = effect.form === 'flat' ? 500 : 200;
      return out({ utility: scale(Math.min(1, Math.abs(effect.value) / denominator)) }, 'sustain / defence');
    }
  }
}

export function addVectors(a: ScoreVector, b: ScoreVector): ScoreVector {
  return {
    dps: a.dps + b.dps,
    rate: a.rate + b.rate,
    aoe: a.aoe + b.aoe,
    utility: a.utility + b.utility,
    note: a.note || b.note,
  };
}

export const vectorTotal = (v: ScoreVector) => v.dps + v.aoe * 0.5 + v.utility * 0.15;
