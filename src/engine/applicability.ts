// The verb: does this Effect touch this SkillProfile?
//
// Applicability is a set operation over the shared tag alphabet, with four
// deliberate exceptions that a naive set test would get wrong:
//
//   proxy tags   — Totem/Trap/Mine mods only pay off if you CHOOSE to deliver
//                  the skill that way, so they resolve to 'setup', not 'no'.
//   weapon tags  — a "with Bows" mod is dead on a spell, but on an attack with
//                  no weapon restriction it depends on what you equip.
//   damage types — an attack deals whatever its weapon and added damage deal,
//                  so elemental scaling is 'conditional' rather than absent.
//   conditions   — "while channelling" does not stop the mod applying, it
//                  lowers the fraction of the time it is live.

import { Applicability, Effect, SkillProfile, Tag } from './types';
import { ELEMENTAL_TAGS, PROXY_TAGS, WEAPON_TAGS } from './vocab';
import { effectUptime } from './parseMod';

export interface SkillContext {
  /** Delivery the build actually uses, when the skill supports it. */
  delivery?: 'self' | 'totem' | 'trap' | 'mine';
  capabilities?: { totem: boolean; trap: boolean; mine: boolean };
  /** Weapon the build uses, for attacks with no innate restriction. */
  weaponTags?: Tag[];
}

const no = (reason: string): Applicability =>
  ({ applies: false, strength: 'no', reasons: [reason], uptime: 0 });

function skillDealsType(skill: SkillProfile, type: Tag): 'yes' | 'maybe' | 'no' {
  if (type === 'elemental') {
    if (ELEMENTAL_TAGS.some((t) => skill.damageTypes.includes(t))) return 'yes';
    return skill.tags.has('attack') ? 'maybe' : 'no';
  }
  if (skill.damageTypes.includes(type)) return 'yes';
  // Attacks inherit their damage from the weapon: physical is the default and
  // any element can be added, so neither is knowable from the gem alone.
  if (skill.tags.has('attack')) return type === 'physical' ? 'yes' : 'maybe';
  return 'no';
}

export function applies(
  effect: Effect,
  skill: SkillProfile,
  ctx: SkillContext = {},
): Applicability {
  const reasons: string[] = [];
  let strength: Applicability['strength'] = 'direct';
  let uptime = effectUptime(effect);

  // --- who the modifier is for -------------------------------------------
  if (effect.target === 'ally') return no('affects allies, not your skill');
  if (effect.target === 'minion' && !skill.tags.has('minion') && !skill.tags.has('companion')) {
    return no('minion modifier, and this is not a minion skill');
  }
  if (effect.target === 'enemy' && effect.stat !== 'exposure') {
    return no('applies to enemies, not to your skill');
  }

  // --- tag requirements ---------------------------------------------------
  for (const tag of effect.requires) {
    if (skill.tags.has(tag)) continue;

    if (PROXY_TAGS.includes(tag)) {
      const caps = ctx.capabilities;
      const supported =
        (tag === 'totem' && caps?.totem) ||
        (tag === 'trap' && caps?.trap) ||
        (tag === 'mine' && caps?.mine);
      if (!supported) return no(`requires ${tag}, which this skill cannot use`);
      if (ctx.delivery === tag) {
        reasons.push(`applies because you deliver this skill via ${tag}`);
        continue;
      }
      strength = 'setup';
      reasons.push(`only if you deliver this skill via ${tag}`);
      continue;
    }

    if (WEAPON_TAGS.includes(tag)) {
      const equipped = ctx.weaponTags ?? [];
      if (equipped.includes(tag)) { reasons.push(`your weapon satisfies "${tag}"`); continue; }
      if (!skill.tags.has('attack')) return no(`requires ${tag}, and this is not a weapon skill`);
      if (skill.weaponTypes.length && !skill.tags.has(tag)) {
        return no(`this skill cannot be used with ${tag}`);
      }
      if (strength === 'direct') strength = 'conditional';
      reasons.push(`requires wielding ${tag}`);
      continue;
    }

    if (tag === 'duration') {
      if (!skill.tags.has('duration')) return no('this skill has no duration to scale');
      continue;
    }

    return no(`requires ${tag}`);
  }

  // --- damage type restrictions -------------------------------------------
  if (effect.damageTypes.length) {
    const verdicts = effect.damageTypes.map((t) => ({ t, v: skillDealsType(skill, t) }));
    if (verdicts.every((x) => x.v === 'no')) {
      return no(`only scales ${effect.damageTypes.join('/')} damage`);
    }
    if (!verdicts.some((x) => x.v === 'yes')) {
      if (strength === 'direct') strength = 'conditional';
      reasons.push(`applies only if your ${skill.tags.has('attack') ? 'weapon or added damage' : 'skill'} deals ${effect.damageTypes.join('/')}`);
    }
  }

  // --- damage-over-time only stats -----------------------------------------
  const DOT_STATS = ['dotMultiplier', 'dotDamage', 'dotFaster', 'ailmentDuration'];
  if (DOT_STATS.includes(effect.stat)) {
    const ailmentSource = ['ignite', 'poison', 'bleed', 'shock', 'freeze', 'chill', 'electrocute']
      .some((a) => skill.emits.has(a));
    if (!skill.tags.has('damageOverTime') && !ailmentSource) {
      return no('this skill deals no damage over time');
    }
    if (!skill.tags.has('damageOverTime')) {
      if (strength === 'direct') strength = 'conditional';
      reasons.push('scales the ailments this skill inflicts, not its hit');
    }
  }

  // --- stat-specific sanity ------------------------------------------------
  if (effect.stat === 'cooldownRecovery' && skill.cooldown === undefined) {
    return no('this skill has no cooldown');
  }
  if (effect.stat === 'projectileCount' && !skill.tags.has('projectile')) {
    return no('this skill fires no projectiles');
  }
  if ((effect.stat === 'areaOfEffect' || effect.stat === 'areaDamage') && !skill.tags.has('area')) {
    return no('this skill has no area of effect');
  }
  if (effect.stat === 'presenceArea') {
    const presence = skill.skillTypes.includes('AffectsPresence')
      || ['aura', 'herald', 'buff', 'persistent', 'banner'].some((t) => skill.tags.has(t as Tag));
    if (!presence) return no('this skill does not act through your Presence');
  }
  if (effect.stat === 'skillEffectDuration' && !skill.tags.has('duration')) {
    return no('this skill has no duration');
  }
  if (effect.stat === 'chainCount' && !skill.tags.has('projectile') && !skill.tags.has('chaining')) {
    return no('this skill cannot chain');
  }

  if (effect.conditions.length && strength === 'direct') {
    strength = 'conditional';
    reasons.push(...effect.conditions.map((c) => c.text));
  }
  if (strength === 'direct') uptime = 1;

  return { applies: true, strength, reasons, uptime };
}
