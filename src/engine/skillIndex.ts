// "What affects this skill?" — the question the platform exists to answer.
//
// For one skill, walk every normalised source, test each of its effects for
// applicability, score the ones that apply, and rank the results per bucket
// and per unit of cost. Nothing is filtered out silently: a source that does
// not apply keeps its reason, which is what makes the output auditable.

import { applies, SkillContext } from './applicability';
import { bucketOf, statLabel } from './parseMod';
import { addVectors, BuildContext, DEFAULT_CONTEXT, ScoreVector, scoreEffect } from './scoring';
import {
  Applicability, Bucket, Effect, EffectSource, RawSkill, SkillProfile,
} from './types';
import { buildSkillProfile, skillCapabilities } from './skillProfile';
import { WEAPON_SLOTS } from './sources';

export interface EffectMatch {
  effect: Effect;
  applicability: Applicability;
  score: ScoreVector;
  bucket: Bucket;
  label: string;
}

export interface SourceMatch {
  source: EffectSource;
  matches: EffectMatch[];
  total: ScoreVector;
  /** Dominant bucket, used to file the source under one heading. */
  bucket: Bucket;
  strength: Applicability['strength'];
  /** The gain on the axis this source is filed under. This is the number the
   *  UI shows, so ranking and display can never disagree. */
  bucketGain: number;
  /** `bucketGain` per unit of cost — what actually ranks build choices. */
  efficiency: number;
  costLabel: string;
  /** Lowest parse confidence among the matched effects. */
  confidence: number;
}

export interface SkillAnalysis {
  skill: SkillProfile;
  context: BuildContext;
  buckets: Record<Bucket, SourceMatch[]>;
  /** Highest-value sources across all buckets, by efficiency. */
  best: SourceMatch[];
  counts: Record<Bucket, number>;
}

/** PoB stores a support gem's skill-type requirements as a postfix boolean
 *  expression, not a flat list: `["Attack", "Area", "AND"]` means Attack AND
 *  Area, while `["Area", "MinionsCanExplode"]` (no operator) means either.
 *  Reading it as a flat "any of" puts melee-only gems on spells. */
export function evalSkillTypeExpression(
  tokens: string[],
  has: (type: string) => boolean,
): boolean | undefined {
  if (!tokens.length) return undefined;
  const stack: boolean[] = [];
  for (const token of tokens) {
    if (token === 'AND') {
      const a = stack.pop() ?? true;
      const b = stack.pop() ?? true;
      stack.push(a && b);
    } else if (token === 'OR') {
      const a = stack.pop() ?? false;
      const b = stack.pop() ?? false;
      stack.push(a || b);
    } else if (token === 'NOT') {
      stack.push(!(stack.pop() ?? false));
    } else {
      stack.push(has(token));
    }
  }
  // Anything left unconsumed is an alternative, so they OR together.
  return stack.some(Boolean);
}

/** PoB support-gem gating, with the two flags PoB computes at runtime rather
 *  than storing on the gem — without `Cooldown`, every "cannot support skills
 *  with a cooldown" gem shows up on skills that have one. */
export function supportApplies(source: EffectSource, skill: SkillProfile): boolean {
  const types = new Set(skill.skillTypes);
  if (skill.cooldown !== undefined) types.add('Cooldown');
  if (types.has('InbuiltTrigger')) types.add('Triggered');
  const has = (type: string) => types.has(type);

  const required = evalSkillTypeExpression(source.requireSkillTypes ?? [], has);
  if (required === false) return false;
  const excluded = evalSkillTypeExpression(source.excludeSkillTypes ?? [], has);
  return excluded !== true;
}

function dominantBucket(matches: EffectMatch[]): Bucket {
  const totals: Record<Bucket, number> = { damage: 0, aoe: 0, speed: 0, utility: 0 };
  for (const m of matches) {
    const v = m.score;
    // `rate` is the part of `dps` that came from speed, so counting both would
    // file a weapon whose real value is +100% local damage under "speed".
    totals[m.bucket] += Math.abs(v.dps) + Math.abs(v.aoe) + Math.abs(v.utility) + 0.001;
  }
  return (Object.keys(totals) as Bucket[]).reduce((a, b) => (totals[b] > totals[a] ? b : a), 'damage');
}

/** What a source is worth on one axis. Damage and coverage are separate
 *  currencies, so a unique with a big damage line must not outrank a genuine
 *  area source inside the area list. */
export function gainOnAxis(total: ScoreVector, bucket: Bucket): number {
  switch (bucket) {
    case 'damage': return total.dps;
    case 'aoe': return total.aoe;
    case 'speed': return total.rate;
    default: return total.utility;
  }
}

const effectWeight = (m: EffectMatch): number =>
  Math.abs(m.score.dps) + Math.abs(m.score.aoe) * 0.5 + Math.abs(m.score.utility) * 0.15;

/** Weapon spawn-slot name → whether this skill can be used with that weapon. */
function skillUsesWeaponSlot(skill: SkillProfile, slot: string): boolean {
  const map: Record<string, string[]> = {
    axe: ['One Hand Axe', 'Two Hand Axe'],
    sword: ['One Hand Sword', 'Two Hand Sword'],
    mace: ['One Hand Mace', 'Two Hand Mace'],
    bow: ['Bow'],
    crossbow: ['Crossbow'],
    claw: ['Claw'],
    dagger: ['Dagger'],
    flail: ['Flail'],
    spear: ['Spear'],
    sceptre: ['Sceptre'],
    staff: ['Staff'],
    warstaff: ['Staff'],
    wand: ['Wand'],
    weapon: [],
    one_hand_weapon: ['One Hand Axe', 'One Hand Mace', 'One Hand Sword', 'Claw', 'Dagger', 'Flail', 'Spear'],
    two_hand_weapon: ['Two Hand Axe', 'Two Hand Mace', 'Two Hand Sword', 'Bow', 'Crossbow', 'Staff'],
  };
  const allowed = map[slot];
  if (!allowed || !allowed.length) return true;
  return allowed.some((w) => skill.weaponTypes.includes(w));
}

/** Stats that a weapon-local mod expresses through the weapon's own damage. */
const LOCAL_WEAPON_STATS = new Set([
  'damage', 'addedDamage', 'attackSpeed', 'critChance', 'critDamage', 'accuracy',
]);

export function analyzeSource(
  source: EffectSource,
  skill: SkillProfile,
  ctx: BuildContext,
  skillCtx: SkillContext,
): SourceMatch | undefined {
  if (source.kind === 'support' && !supportApplies(source, skill)) return undefined;

  // Weapon items: a skill that cannot swing the weapon never sees anything on
  // it, and even for skills that can, the weapon's own damage stats are local.
  const weaponSlots = (source.itemCategories ?? []).filter((c) => WEAPON_SLOTS.has(c));
  const isWeaponItem = weaponSlots.length > 0
    && weaponSlots.length === (source.itemCategories ?? []).length;
  if (isWeaponItem && skill.tags.has('attack') && skill.weaponTypes.length) {
    const usable = weaponSlots.some((slot) => skillUsesWeaponSlot(skill, slot));
    if (!usable) return undefined;
  }
  const weaponLocal = (source.isLocal || isWeaponItem)
    && weaponSlots.length > 0;
  if (source.isLocal && weaponLocal && !skill.tags.has('attack')) return undefined;

  const matches: EffectMatch[] = [];
  for (const effect of source.effects) {
    // A support gem's own gating already proved it applies; its effect text
    // does not need to re-derive the tags.
    let applicability = source.kind === 'support'
      ? relaxForSupport(effect, skill, skillCtx)
      : applies(effect, skill, skillCtx);
    if (!applicability.applies) continue;
    // On a weapon, these stats modify the weapon itself: an attack swings it,
    // a spell never touches it.
    const localStat = weaponLocal && LOCAL_WEAPON_STATS.has(effect.stat);
    if (localStat && !skill.tags.has('attack')) continue;
    if (source.isLocal && !LOCAL_WEAPON_STATS.has(effect.stat)) continue;
    if (localStat || (isWeaponItem && skill.tags.has('attack'))) {
      applicability = {
        ...applicability,
        strength: applicability.strength === 'direct' ? 'conditional' : applicability.strength,
        reasons: [
          localStat
            ? `local to the weapon — applies while wielding ${weaponSlots.join('/')}`
            : `requires wielding ${weaponSlots.join('/')}`,
          ...applicability.reasons,
        ],
      };
    }
    // Weapon-local increases live in the weapon's own additive bucket.
    const effectCtx = localStat
      ? { ...ctx, increasedDamage: ctx.localIncreasedDamage }
      : ctx;
    const score = scoreEffect(effect, skill, applicability, effectCtx);
    matches.push({
      effect,
      applicability,
      score,
      bucket: bucketOf(effect),
      label: statLabel(effect.stat),
    });
  }
  if (!matches.length) return undefined;

  const total = matches.map((m) => m.score).reduce(addVectors, { dps: 0, rate: 0, aoe: 0, utility: 0, note: '' });
  // The headline strength belongs to the effect that carries the value: a
  // unique whose damage line is conditional is not "direct" because its
  // attribute line happens to be.
  const leading = matches.reduce((a, b) => (effectWeight(b) > effectWeight(a) ? b : a));
  const strength = leading.applicability.strength;
  const cost = Math.max(1, source.cost.amount);
  const bucket = dominantBucket(matches);
  const bucketGain = gainOnAxis(total, bucket);

  return {
    source,
    matches,
    total,
    bucket,
    strength,
    bucketGain,
    efficiency: bucketGain / cost,
    costLabel: describeCost(source),
    confidence: Math.min(...matches.map((m) => m.effect.parseConfidence)),
  };
}

/** Supports are matched by skill type, so tag restrictions inside their stat
 *  keys are descriptive rather than gating — but damage-type and geometry
 *  restrictions still hold (a fire-damage support does nothing for a cold gem). */
function relaxForSupport(effect: Effect, skill: SkillProfile, skillCtx: SkillContext): Applicability {
  const stripped: Effect = { ...effect, requires: [] };
  const verdict = applies(stripped, skill, skillCtx);
  if (verdict.applies) return verdict;
  return { applies: false, strength: 'no', reasons: verdict.reasons, uptime: 0 };
}

function describeCost(source: EffectSource): string {
  const { kind, amount, detail } = source.cost;
  switch (kind) {
    case 'passivePoints':
      return amount >= 999 ? 'unreachable on the tree' : `${amount} passive points`;
    case 'ascendancyPoints':
      return `ascendancy point (${detail ?? 'ascendancy'})`;
    case 'gemSocket':
      return 'support gem socket';
    case 'itemSlot':
      return detail ? `item: ${detail}` : 'item slot';
    default:
      return 'free';
  }
}

export interface AnalyzeOptions {
  context?: BuildContext;
  skillContext?: SkillContext;
  /** Cap per bucket, keeping the output readable. 0 means unlimited. */
  limitPerBucket?: number;
  /** Drop sources whose best effect the parser was unsure about. */
  minConfidence?: number;
}

export function analyzeSkill(
  rawSkill: RawSkill,
  sources: EffectSource[],
  options: AnalyzeOptions = {},
): SkillAnalysis {
  const skill = buildSkillProfile(rawSkill);
  const ctx = options.context ?? DEFAULT_CONTEXT;
  const skillCtx: SkillContext = {
    capabilities: skillCapabilities(rawSkill),
    ...options.skillContext,
  };

  const buckets: Record<Bucket, SourceMatch[]> = { damage: [], aoe: [], speed: [], utility: [] };
  const counts: Record<Bucket, number> = { damage: 0, aoe: 0, speed: 0, utility: 0 };
  const minConfidence = options.minConfidence ?? 0;

  for (const source of sources) {
    const match = analyzeSource(source, skill, ctx, skillCtx);
    if (!match) continue;
    if (match.confidence < minConfidence) continue;
    counts[match.bucket] += 1;
    buckets[match.bucket].push(match);
  }

  const limit = options.limitPerBucket ?? 40;
  for (const bucket of Object.keys(buckets) as Bucket[]) {
    buckets[bucket].sort((a, b) => b.efficiency - a.efficiency);
    if (limit > 0) buckets[bucket] = buckets[bucket].slice(0, limit);
  }

  const best = [...buckets.damage, ...buckets.aoe, ...buckets.speed]
    .sort((a, b) => b.efficiency - a.efficiency)
    .slice(0, 25);

  return { skill, context: ctx, buckets, best, counts };
}
