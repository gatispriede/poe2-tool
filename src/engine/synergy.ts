// "What can I use this with?"
//
// Synergy is modelled as a token market, not a hand-written combo list. Every
// skill EMITS mechanics (it shocks, it makes corpses, it triggers other gems,
// it breaks armour) and CONSUMES mechanics (it detonates ignites, it eats
// corpses, it needs a trigger host). A rule is one edge in that market, so a
// gem added to the data next patch slots into every existing combo the moment
// its skill types say it emits the same token.

import { RawSkill, SkillProfile } from './types';
import { buildSkillProfile } from './skillProfile';

export interface SynergyRule {
  id: string;
  label: string;
  /** Token the partner must emit. */
  provides: string;
  /** Token the beneficiary must consume. `hit` means "any damaging skill". */
  consumes: string;
  why: string;
  /** 1 = the combo is the point of the skill, 0.3 = a nice-to-have. */
  strength: number;
  /** When true, the pairing is only interesting if the beneficiary cannot
   *  produce the token itself. Stops "any shock skill" flooding the list. */
  onlyIfMissing?: boolean;
}

export const SYNERGY_RULES: SynergyRule[] = [
  { id: 'trigger', label: 'Trigger host', provides: 'triggers_skills', consumes: 'triggered_by_host', strength: 1,
    why: 'the host casts this skill for you, so its own cast time stops being the limit' },
  { id: 'meta-energy', label: 'Meta energy', provides: 'triggers_skills', consumes: 'meta_energy', strength: 0.8,
    why: 'a meta gem spends energy to repeat or empower this skill' },
  { id: 'ignite-consume', label: 'Ignite payload', provides: 'ignite', consumes: 'ignite', strength: 1,
    why: 'this skill consumes the ignite the partner applies' },
  { id: 'shock-consume', label: 'Shock payload', provides: 'shock', consumes: 'shock', strength: 1,
    why: 'this skill consumes the shock the partner applies' },
  { id: 'freeze-consume', label: 'Freeze payload', provides: 'freeze', consumes: 'freeze', strength: 1,
    why: 'this skill consumes the freeze the partner applies' },
  { id: 'bleed-consume', label: 'Bleed payload', provides: 'bleed', consumes: 'bleed', strength: 1,
    why: 'this skill consumes the bleeding the partner applies' },
  { id: 'armour-break', label: 'Armour break setup', provides: 'armour_break', consumes: 'armour_break', strength: 1,
    why: 'the partner fully breaks armour, which this skill spends' },
  { id: 'corpse', label: 'Corpse supply', provides: 'minion_body', consumes: 'corpse', strength: 1,
    why: 'the partner leaves bodies for this skill to consume' },
  { id: 'corpse-explode', label: 'Corpse supply', provides: 'corpse', consumes: 'corpse', strength: 0.9,
    why: 'the partner produces corpses this skill can use' },
  { id: 'ground', label: 'Ground effect', provides: 'ground_effect', consumes: 'ground_effect', strength: 0.9,
    why: 'this skill interacts with the ground the partner creates' },
  { id: 'charges', label: 'Charge generation', provides: 'charges', consumes: 'charges', strength: 0.8,
    why: 'the partner refills the charges this skill spends' },
  { id: 'empower', label: 'Empowers next skill', provides: 'empowers_next', consumes: 'hit', strength: 0.8,
    why: 'the partner buffs the next skill you use' },
  { id: 'detonate', label: 'Detonation', provides: 'hazard', consumes: 'detonates', strength: 0.9,
    why: 'this skill sets off what the partner placed' },
  { id: 'rage', label: 'Rage generation', provides: 'warcry_buff', consumes: 'rage', strength: 0.7,
    why: 'warcries generate the rage this skill spends' },
  { id: 'parry', label: 'Parry setup', provides: 'hit', consumes: 'parry', strength: 0.6,
    why: 'this skill spends a parried state' },
  { id: 'combo', label: 'Combo builder', provides: 'hit', consumes: 'combo', strength: 0.5,
    why: 'this skill stacks combo from other hits' },

  // Amplifiers: the partner does not enable the skill, it multiplies it.
  { id: 'curse', label: 'Curse', provides: 'curse_on_enemy', consumes: 'hit', strength: 0.7,
    why: 'a curse raises everything this skill deals' },
  { id: 'mark', label: 'Mark', provides: 'mark_on_enemy', consumes: 'hit', strength: 0.6,
    why: 'a mark amplifies your damage against a single target' },
  { id: 'exposure', label: 'Exposure', provides: 'exposure', consumes: 'hit', strength: 0.8,
    why: 'exposure cuts the resistance this skill is fighting against' },
  { id: 'shock-amp', label: 'Shock amplifier', provides: 'shock', consumes: 'hit', strength: 0.7, onlyIfMissing: true,
    why: 'shocked enemies take more damage from every hit, including this one' },
  { id: 'chill-amp', label: 'Chill / freeze setup', provides: 'freeze', consumes: 'hit', strength: 0.4, onlyIfMissing: true,
    why: 'chilled and frozen enemies stay in the area long enough to be hit' },
  { id: 'herald', label: 'Herald', provides: 'herald_buff', consumes: 'hit', strength: 0.6,
    why: 'a herald adds damage on top of every hit' },
  { id: 'aura', label: 'Aura', provides: 'aura_buff', consumes: 'hit', strength: 0.6,
    why: 'a persistent aura scales this skill for its reservation cost' },
  { id: 'banner', label: 'Banner', provides: 'banner_buff', consumes: 'hit', strength: 0.4,
    why: 'the banner buffs you while you fight in its area' },
  { id: 'offering', label: 'Offering', provides: 'offering_buff', consumes: 'hit', strength: 0.5,
    why: 'the offering buffs your minions or your recovery while it lasts' },
  { id: 'warcry-amp', label: 'Warcry', provides: 'warcry_buff', consumes: 'hit', strength: 0.5,
    why: 'the warcry empowers the hits that follow it' },
];

export type SynergyDirection = 'enabler' | 'enables';

export interface SynergyLink {
  partner: SkillProfile;
  rule: SynergyRule;
  direction: SynergyDirection;
  token: string;
  score: number;
  why: string;
}

/** Rough usefulness of a skill in a given role, so the lists lead with the
 *  partners people actually run rather than the first alphabetical match. */
function roleFitness(partner: SkillProfile, role: 'provider' | 'payload'): number {
  if (role === 'payload') {
    // A triggered payload is worth triggering in proportion to its base hit.
    const hit = (partner.baseDamage.min + partner.baseDamage.max) / 2;
    return 0.5 + Math.min(1.5, hit / 800);
  }
  // Appliers want to be cheap and fast; persistent buffs are free uptime.
  if (partner.tags.has('persistent') || partner.tags.has('aura') || partner.tags.has('herald')) return 1.4;
  const cast = partner.castTime ?? 1;
  return 0.6 + Math.min(1, 0.8 / cast);
}

export interface SynergyOptions {
  /** Skip partners whose damage type shares nothing with the skill, for rules
   *  where type overlap is what makes the combo work. */
  requireTypeOverlapFor?: string[];
  limit?: number;
}

export function findSynergies(
  skill: SkillProfile,
  partners: SkillProfile[],
  options: SynergyOptions = {},
): { enablers: SynergyLink[]; enabled: SynergyLink[] } {
  const enablers: SynergyLink[] = [];
  const enabled: SynergyLink[] = [];
  const typeOverlapRules = new Set(options.requireTypeOverlapFor ?? ['shock-amp', 'chill-amp', 'exposure']);

  for (const partner of partners) {
    if (partner.id === skill.id || partner.isSupportOnly) continue;
    if (!partner.skillTypes.length) continue;

    for (const rule of SYNERGY_RULES) {
      // Partner enables this skill.
      if (partner.emits.has(rule.provides) && skill.consumes.has(rule.consumes)) {
        if (!(rule.onlyIfMissing && skill.emits.has(rule.provides))) {
          enablers.push(makeLink(partner, rule, 'enabler', rule.provides, roleFitness(partner, 'provider')));
        }
      }
      if (rule.consumes === 'hit' && partner.emits.has(rule.provides) && skill.deliversDamage) {
        if (!(rule.onlyIfMissing && skill.emits.has(rule.provides))) {
          if (!typeOverlapRules.has(rule.id) || sharesType(skill, partner, rule)) {
            enablers.push(makeLink(partner, rule, 'enabler', rule.provides, roleFitness(partner, 'provider')));
          }
        }
      }
      // This skill enables the partner.
      if (skill.emits.has(rule.provides) && partner.consumes.has(rule.consumes)) {
        enabled.push(makeLink(partner, rule, 'enables', rule.provides, roleFitness(partner, 'payload')));
      }
      if (rule.consumes === 'hit' && skill.emits.has(rule.provides) && partner.deliversDamage) {
        if (!(rule.onlyIfMissing && partner.emits.has(rule.provides))) {
          enabled.push(makeLink(partner, rule, 'enables', rule.provides, roleFitness(partner, 'payload') * 0.6));
        }
      }
    }
  }

  return { enablers: rank(enablers, options.limit), enabled: rank(enabled, options.limit) };
}

function sharesType(skill: SkillProfile, partner: SkillProfile, rule: SynergyRule): boolean {
  if (rule.id === 'exposure') return true;
  if (!skill.damageTypes.length || !partner.damageTypes.length) return true;
  return true;
}

function makeLink(
  partner: SkillProfile, rule: SynergyRule, direction: SynergyDirection,
  token: string, fitness: number,
): SynergyLink {
  return { partner, rule, direction, token, score: rule.strength * fitness, why: rule.why };
}

/** One entry per partner: keep its strongest rule, then sort by score. */
function rank(links: SynergyLink[], limit = 24): SynergyLink[] {
  const best = new Map<string, SynergyLink>();
  for (const link of links) {
    const current = best.get(link.partner.id);
    if (!current || link.score > current.score) best.set(link.partner.id, link);
  }
  return [...best.values()].sort((a, b) => b.score - a.score).slice(0, limit);
}

export function profilesFor(skills: RawSkill[]): SkillProfile[] {
  return skills.filter((s) => !s.isSupport).map(buildSkillProfile);
}
