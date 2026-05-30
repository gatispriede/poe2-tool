// Single-axis support-gem optimizer.
//
// Given a build with a chosen active skill, for each of the skill's support
// slots try swapping every Layer-3-compatible support gem in the database
// and rank the resulting DPS deltas. Holds tree, gear, and other skill
// groups constant.
//
// Important caveats — please read before trusting output:
//   - The composer is currently ~15× under poe.ninja's reported DPS for
//     zeolet's Ice Shot (see docs/damage-calc-coverage.md). Relative
//     rankings within a profile are roughly meaningful; absolute DPS
//     numbers are not.
//   - This optimizer trusts the support's `constantStats` patterns we
//     pattern-match in `applySupportMods.ts`. A support whose effect
//     uses an unrecognised stat key will appear to do nothing (DPS delta
//     of 0) — that's a false negative, not a true "no change".
//   - We don't yet model real-world support availability — high-end
//     unique supports rank alongside common ones with no penalty.

import { composeDamage } from '../damage-v2/composeDamage';
import { validateBuild } from '../validation/validate';
import { ParsedBuild, ParsedGem } from '../validation/types';
import skillsJson from '../data/generated/skills.json';

interface SkillRecord {
  id: string;
  name: string;
  isSupport: boolean;
  skillTypes: string[];
  requireSkillTypes: string[];
  addSkillTypes: string[];
  excludeSkillTypes: string[];
  gemFamily: string[];
  constantStats: [string, number][];
}

const skillsById: Record<string, SkillRecord> = {};
const allSupports: SkillRecord[] = [];
for (const s of skillsJson as SkillRecord[]) {
  skillsById[s.id] = s;
  // SupportMeta* IDs are 0.5 standalone trigger gems (Cast on Crit, Cast on
  // Melee Kill, Spellslinger, etc.) that PoB stores with `support = true`
  // for slot-occupancy purposes. They behave fundamentally differently from
  // normal supports — they host a sub-skill and have their own trigger
  // mechanics — so exclude them from the swap pool until we model triggers
  // as first-class gems (task #20).
  if (s.isSupport && !/^SupportMeta/.test(s.id)) allSupports.push(s);
}

export interface SupportSwap {
  slotIndex: number;
  removed: { id: string; name: string };
  added: { id: string; name: string };
  dpsBefore: number;
  dpsAfter: number;
  delta: number;
  deltaPct: number;
  // True if the REMOVED support has stat keys our composer's pattern
  // matcher doesn't bucket today. Such swaps may *look* like upgrades
  // simply because the composer doesn't see the removed support's effect.
  // Example: Rakiata's Flow's enemy-side resistance negation isn't
  // modelled, so replacing it with any real-damage support shows a
  // false-positive improvement.
  warning?: string;
}

export interface OptimizeSupportsResult {
  baseline: number;
  topImprovements: SupportSwap[];
  topRegressions: SupportSwap[];
  evaluated: number;
  rejected: number;
}

/**
 * PoB encodes `requireSkillTypes` / `excludeSkillTypes` as a postfix (RPN)
 * expression with `OR`, `AND`, `NOT` tokens. A list of plain tags with no
 * operators evaluates to "any tag matches" (OR-of-all). See
 * PathOfBuilding-PoE2/src/Modules/CalcTools.lua `doesTypeExpressionMatch`.
 */
function evalTypeExpression(expr: string[], tags: Set<string>): boolean {
  if (!expr.length) return false;
  const stack: boolean[] = [];
  for (const t of expr) {
    if (t === 'OR') {
      const b = stack.pop() ?? false;
      const a = stack.pop() ?? false;
      stack.push(a || b);
    } else if (t === 'AND') {
      const b = stack.pop() ?? false;
      const a = stack.pop() ?? false;
      stack.push(a && b);
    } else if (t === 'NOT') {
      const a = stack.pop() ?? false;
      stack.push(!a);
    } else {
      stack.push(tags.has(t));
    }
  }
  // PoB's final reducer returns true if any value on the stack is true.
  return stack.some(v => v);
}

/**
 * Test whether `support` is Layer-3 compatible with `active`.
 * Empty `requireSkillTypes` means no constraint; otherwise evaluate the
 * expression and the support is compatible iff it returns true. Exclude is
 * the inverse: if the expression matches, the support is BLOCKED.
 */
function compatible(support: SkillRecord, active: SkillRecord): boolean {
  const tags = new Set(active.skillTypes);
  if (support.excludeSkillTypes.length && evalTypeExpression(support.excludeSkillTypes, tags)) return false;
  if (!support.requireSkillTypes.length) return true;
  return evalTypeExpression(support.requireSkillTypes, tags);
}

/**
 * How many of a support's constantStats keys are NOT recognised by our
 * pattern matcher? Used to flag swap suggestions whose comparison may be
 * unfair (we'd be removing effects we don't know how to value).
 *
 * Keep this list in sync with the recognised patterns in
 * `src/damage-v2/applySupportMods.ts` `applySupportStat`.
 */
function currentSupportSkipsCount(rec: SkillRecord): number {
  let unrecognised = 0;
  for (const [k] of rec.constantStats) {
    if (RECOGNISED_PATTERN.test(k)) continue;
    unrecognised++;
  }
  return unrecognised;
}
const RECOGNISED_PATTERN = /(?:^|_)(?:damage|attack_speed|cast_speed|critical_strike_(?:multiplier|chance))_\+%(?:_final)?$/;

/** Returns true if `gem` shares a gemFamily with any other gem in `gems`. */
function hasFamilyClash(
  candidate: SkillRecord,
  gems: ParsedGem[],
  excludeIndex: number,
): boolean {
  for (let i = 0; i < gems.length; i++) {
    if (i === excludeIndex) continue;
    const g = gems[i];
    if (!g.skillId) continue;
    const rec = skillsById[g.skillId];
    if (!rec) continue;
    for (const fam of candidate.gemFamily) {
      if (rec.gemFamily.includes(fam)) return true;
    }
  }
  return false;
}

/**
 * Compose DPS for a build variant. Returns 0 if validate or compose throws
 * (treat as a rejected variant).
 */
function tryCompose(build: ParsedBuild, groupIndex: number, skillId: string): number {
  try {
    const v = validateBuild(build);
    // Note: we INTENTIONALLY don't bail on v.valid===false. Many of our
    // baseline fixtures already report informational L3/L5 errors but
    // produce sensible DPS. We only need the compose path to run.
    void v;
    const out = composeDamage({ build, skillGroupIndex: groupIndex, skillId });
    return out.dps;
  } catch (e) {
    // Optimization-time errors are common (e.g. a candidate support that
    // breaks an invariant). Log on first occurrence to aid debugging but
    // continue scoring others as 0.
    if (!(globalThis as { __optWarned?: boolean }).__optWarned) {
      // eslint-disable-next-line no-console
      console.warn('optimizeSupports: compose threw, treating as 0 DPS:', (e as Error).message);
      (globalThis as { __optWarned?: boolean }).__optWarned = true;
    }
    return 0;
  }
}

export function optimizeSupports(
  build: ParsedBuild,
  skillGroupIndex: number,
  skillId: string,
  options: { topK?: number; minDeltaPct?: number } = {},
): OptimizeSupportsResult {
  const { topK = 10, minDeltaPct = 0 } = options;

  const active = skillsById[skillId];
  if (!active || active.isSupport) {
    throw new Error(`Unknown or non-active skill: ${skillId}`);
  }

  const group = build.skillGroups[skillGroupIndex];
  if (!group) throw new Error(`No skill group at index ${skillGroupIndex}`);

  const baseline = tryCompose(build, skillGroupIndex, skillId);

  // Pre-filter candidate supports once.
  const candidates = allSupports.filter(s => compatible(s, active));

  const swaps: SupportSwap[] = [];
  let evaluated = 0;
  let rejected = 0;

  // Identify which gem positions in the group are supports (skip the
  // active skill itself and any non-support gems).
  for (let slotIndex = 0; slotIndex < group.gems.length; slotIndex++) {
    const current = group.gems[slotIndex];
    if (!current.skillId) continue;
    const currentRec = skillsById[current.skillId];
    if (!currentRec || !currentRec.isSupport) continue; // skip the active skill

    for (const candidate of candidates) {
      if (candidate.id === current.skillId) continue;          // no-op swap
      if (hasFamilyClash(candidate, group.gems, slotIndex)) {
        rejected++;
        continue;
      }

      // Replace the gem with a structural copy of the build (only the gems
      // array is mutated; rest of the build is shared by reference). This
      // keeps each evaluation cheap.
      const newGems = group.gems.slice();
      newGems[slotIndex] = {
        ...current,
        skillId: candidate.id,
        nameSpec: candidate.name,
        gemId: null,
        variantId: null,
      };
      const newGroup = { ...group, gems: newGems };
      const newSkillGroups = build.skillGroups.slice();
      newSkillGroups[skillGroupIndex] = newGroup;
      const variant: ParsedBuild = { ...build, skillGroups: newSkillGroups };

      const dpsAfter = tryCompose(variant, skillGroupIndex, skillId);
      evaluated++;
      const delta = dpsAfter - baseline;
      const deltaPct = baseline > 0 ? (delta / baseline) * 100 : 0;
      if (Math.abs(deltaPct) < minDeltaPct) continue;

      // Flag swaps where the removed support's effects aren't fully
      // captured by our pattern matcher. The composer's "skipped keys"
      // list for the current support indicates an under-modelled removal.
      const warning = currentSupportSkipsCount(currentRec) > 0
        ? `removed support "${currentRec.name}" has ${currentSupportSkipsCount(currentRec)} unmodelled stat(s) — improvement may be a composer blind-spot`
        : undefined;

      swaps.push({
        slotIndex,
        removed: { id: current.skillId, name: currentRec.name },
        added: { id: candidate.id, name: candidate.name },
        dpsBefore: baseline,
        dpsAfter,
        delta,
        deltaPct,
        warning,
      });
    }
  }

  swaps.sort((a, b) => b.delta - a.delta);
  const topImprovements = swaps.filter(s => s.delta > 0).slice(0, topK);
  const topRegressions = swaps.filter(s => s.delta < 0).slice(-topK).reverse();

  return {
    baseline,
    topImprovements,
    topRegressions,
    evaluated,
    rejected,
  };
}
