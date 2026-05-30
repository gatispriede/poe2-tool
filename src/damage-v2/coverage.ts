// Clear-speed coverage scoring.
//
// Single-target DPS and clear speed are different axes. Clear speed is driven
// by how many enemies one use of the skill realistically hits — its AoE
// radius, projectile count, and chain/pierce/fork behaviour. A 2.4m blast that
// hits one spot (Escape Shot) covers far less than a chaining multi-projectile
// that blankets a pack (Lightning Arrow).
//
// `coverageScore` returns an estimated "effective targets hit per use" for a
// dense white-mob pack. Multiply single-target (white-tier) DPS by it to rank
// clear speed.
//
// DATA CAVEAT: some skills get their coverage from SECONDARY effects we don't
// extract yet (Ice Shot's on-hit cone of ice shards, Galvanic's beams). Those
// are under-counted until secondary-hit data is wired in — see
// `coverageDataConfidence`.

interface SkillLike {
  id: string;
  name: string;
  skillTypes: string[];
  constantStats?: [string, number][];
}

// PoB AoE radius units → metres. Escape Shot's 24 units reads as 2.4m in the
// in-game tooltip, so 10 units ≈ 1 metre.
const AOE_UNITS_PER_METRE = 10;
// Rough pack model: how many extra targets a metre of blast radius sweeps up.
const TARGETS_PER_METRE_RADIUS = 1.4;

function statVal(s: SkillLike, re: RegExp): number | null {
  for (const [k, v] of s.constantStats ?? []) if (re.test(k)) return v;
  return null;
}

export interface CoverageResult {
  targets: number;        // estimated effective enemies hit per use
  label: string;          // short human description
  confidence: 'high' | 'low'; // low = coverage likely from un-modelled secondary hits
  factors: string[];
}

export function coverageScore(skill: SkillLike): CoverageResult {
  const tags = new Set(skill.skillTypes);
  const factors: string[] = [];
  let targets = 1;

  // --- Area of effect ---
  const aoeUnits = statVal(skill, /active_skill_base_area_of_effect_radius/);
  if (aoeUnits && aoeUnits > 0) {
    const radiusM = aoeUnits / AOE_UNITS_PER_METRE;
    const add = radiusM * TARGETS_PER_METRE_RADIUS;
    targets += add;
    factors.push(`${radiusM.toFixed(1)}m AoE (+${add.toFixed(1)})`);
  }

  // --- Chain (hits several enemies in sequence) ---
  if (tags.has('Chains') && !tags.has('CannotChain')) {
    targets *= 3;
    factors.push('chains ×3');
  }
  // --- Pierce / Fork (extra enemies along the line) ---
  if (tags.has('Pierces') || tags.has('Pierce')) {
    targets *= 2;
    factors.push('pierce ×2');
  }
  if (tags.has('Forks') || tags.has('Fork')) {
    targets *= 1.8;
    factors.push('fork ×1.8');
  }

  // --- Multiple projectiles (spread coverage; overlapping so sub-linear) ---
  // Base projectile counts aren't always in our data; treat the presence of
  // ProjectileNumber as "fires several" with a modest bump.
  if (tags.has('ProjectileNumber')) {
    targets *= 1.6;
    factors.push('multi-projectile ×1.6');
  }

  // --- Pure single-target melee strike with no area ---
  if (tags.has('Strike') && !aoeUnits && !tags.has('Chains')) {
    factors.push('single-target strike');
  }

  // Confidence: projectile skills whose coverage comes from a secondary on-hit
  // area (Ice Shot shards) but which expose no AoE radius in our data are
  // under-counted. Flag low confidence so the UI can caveat.
  const isProjectile = tags.has('Projectile') || tags.has('ProjectilesFromUser');
  const confidence: 'high' | 'low' =
    isProjectile && !aoeUnits && !tags.has('Chains') ? 'low' : 'high';

  return {
    targets: Math.max(1, targets),
    label: factors.join(', ') || 'single target',
    confidence,
    factors,
  };
}
