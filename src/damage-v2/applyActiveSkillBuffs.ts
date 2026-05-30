// Applies stats from non-support ACTIVE skills the build runs as buffs on
// the player. Examples:
//   - The active skill's own constantStats (Ice Shot's freeze multiplier,
//     skill conversion).
//   - Other active skills that act as buffs/marks (Freezing Mark adds
//     "damage gained as cold" against the marked target).
//   - Auras (Wind Dancer, Mana Tempest — for builds that run them).
//
// We reuse the same key-pattern matching scheme as `applySupportMods.ts`,
// extended with a few extra patterns that show up on active skills but not
// supports.

import { GlobalMods, AilmentKind, emptyMods } from './aggregateMods';
import { ParsedBuild } from '../validation/types';
import skillsJson from '../data/generated/skills.json';
import { computeMaxMana } from './maxMana';

interface SkillRecord {
  id: string;
  name: string;
  isSupport: boolean;
  skillTypes: string[];
  constantStats: [string, number][];
  perLevelStats?: { level: number; stats: Record<string, number> }[];
}

const skillsById: Record<string, SkillRecord> = {};
for (const s of skillsJson as SkillRecord[]) skillsById[s.id] = s;

interface BuffCtx {
  maxMana: number;
  isSpell: boolean;
  isChannelled: boolean;
}

/**
 * Try to bucket a stat key/value into GlobalMods. Returns true if applied
 * (so the caller can track skipped patterns).
 */
function applyKey(key: string, value: number, out: GlobalMods, ctx: BuffCtx): boolean {
  // --- Mark-style "enemy additional critical strike multiplier" ---
  // e.g. Sniper's Mark: "enemy_additional_critical_strike_multiplier_against_self"
  // The enemy-side debuff functions as +X% crit multi for player attacks
  // hitting the marked target.
  if (/^enemy_additional_critical_strike_multiplier/.test(key)) {
    out.addedCritMultiplierPct += value;
    return true;
  }

  // --- Archmage: gain-as-lightning scaled by max mana ---
  // archmage_all_damage_%_to_gain_as_lightning_to_grant_to_non_channelling_spells_per_100_max_mana
  // value=4 means "+4% damage gained as lightning per 100 max mana", granted
  // to non-channelling spells only. We multiply the per-100 value by
  // (maxMana / 100) to get the total extra-as-lightning percentage.
  if (/^archmage_.+_to_gain_as_lightning_to_grant_to_non_channelling_spells_per_100_max_mana$/.test(key)) {
    if (!ctx.isSpell || ctx.isChannelled) return true; // recognised, but doesn't apply
    const extra = value * (ctx.maxMana / 100);
    out.extraDamagePct += extra;
    return true;
  }

  // --- Gain-as-cold/extra style ---
  // "freezing_mark_damage_buff_damage_%_to_gain_as_cold" = 30
  if (/_damage_%_to_gain_as_(?:cold|fire|lightning|chaos|physical)(?:_|$)/.test(key)) {
    out.extraDamagePct += value;
    return true;
  }

  // --- Skill self-modifier: ailment-conditional trigger multipliers ---
  // "active_skill_hit_damage_freeze_multiplier_+%_final" = 25 (Ice Shot)
  // "freezing_mark_hit_damage_freeze_multiplier_+%_final" = 35 (Freezing Mark)
  // "thaumaturgist_mark_hit_damage_electrocute_multiplier_+%" = 35 (Voltaic Mark)
  // These only apply WHEN the target carries the ailment — and how reliably
  // you apply it depends on the TARGET (a white mob freezes instantly, a boss
  // may never freeze). So route them to the ailment-conditional bucket with
  // the ailment tagged; the composer applies a per-ailment, per-target
  // reliability factor instead of assuming always-on.
  const ailM = key.match(/_hit_damage_(freeze|shock|ignite|chill|poison|bleed|electrocute)_multiplier_\+%(?:_final)?$/);
  if (ailM) {
    out.ailmentConditionalMore.push({ ailment: ailM[1] as AilmentKind, value });
    return true;
  }

  // --- Generic damage scaling ---
  if (/(?:^|_)damage_\+%_final$/.test(key)) {
    out.moreDamageList.push(value);
    return true;
  }
  if (/(?:^|_)damage_\+%$/.test(key)) {
    out.increasedDamagePct += value;
    return true;
  }

  // --- Attack/cast speed ---
  if (/(?:^|_)(?:attack|cast)_speed_\+%_final$/.test(key)) {
    out.moreAttackSpeedList.push(value);
    return true;
  }
  if (/(?:^|_)(?:attack|cast)_speed_\+%$/.test(key)) {
    out.increasedAttackSpeedPct += value;
    return true;
  }

  // --- Crit ---
  // 0.5 display rename "Critical Strike Multiplier" → "Critical Damage Bonus";
  // accept both stat-key spellings (see applySupportMods.ts).
  if (/(?:critical_strike_multiplier|critical_damage_bonus)_\+%(?:_final)?$/.test(key)) {
    out.addedCritMultiplierPct += value;
    return true;
  }
  if (/critical_strike_chance_\+%(?:_final)?$/.test(key)) {
    out.increasedCritChancePct += value;
    return true;
  }

  // Skipped — surfaced by composer.
  return false;
}

/**
 * Aggregate buffs from:
 *   (a) The active skill itself (its own constantStats — e.g. Ice Shot's
 *       freeze multiplier).
 *   (b) Every OTHER active skill in the build that resembles a buff/mark/aura
 *       (skipping the skill we're computing for, supports, and the
 *       Triggerable/source skill of a trigger chain — to be refined later).
 *
 * Returns the merged GlobalMods plus a list of what got applied and what
 * was skipped so the composer can surface it.
 */
export function aggregateActiveSkillBuffs(
  build: ParsedBuild,
  computingSkillId: string,
): { mods: GlobalMods; appliedFrom: string[]; skippedKeys: string[]; maxMana: number } {
  const computing = skillsById[computingSkillId];
  const types = new Set(computing?.skillTypes ?? []);
  const isSpell = types.has('Spell') && !types.has('Attack');
  // PoE2 marks channelled spells with `Channel`/`ChannelledAttack` skill type.
  const isChannelled = types.has('Channel') || types.has('Channelled');
  const mana = computeMaxMana(build);
  const ctx: BuffCtx = { maxMana: mana.total, isSpell, isChannelled };

  const out: GlobalMods = emptyMods();

  const applied: string[] = [];
  const skipped: string[] = [];

  // Walk every gem in every group. For each ACTIVE skill (incl. the one
  // we're computing for), pull its constantStats AND per-level stats at
  // the gem's actual level. The latter scales effects like Sniper's Mark.
  const seenGems = new Set<string>();
  for (const group of build.skillGroups) {
    for (const gem of group.gems) {
      if (!gem.enabled || !gem.skillId) continue;
      if (seenGems.has(gem.skillId)) continue;
      seenGems.add(gem.skillId);
      const rec = skillsById[gem.skillId];
      if (!rec || rec.isSupport) continue;

      // Build the merged stat list: constantStats (always-on) + per-level
      // stats at the gem's level (or closest available level).
      const effectiveStats: [string, number][] = [];
      if (rec.constantStats) for (const e of rec.constantStats) effectiveStats.push(e);
      if (rec.perLevelStats && rec.perLevelStats.length && gem.level != null) {
        // Find the closest level entry at or below gem.level.
        const target = gem.level;
        let chosen = rec.perLevelStats[0];
        for (const e of rec.perLevelStats) {
          if (e.level <= target) chosen = e;
        }
        for (const [k, v] of Object.entries(chosen.stats)) effectiveStats.push([k, v]);
      }
      if (effectiveStats.length === 0) continue;

      let consumed = 0;
      for (const [key, value] of effectiveStats) {
        if (applyKey(key, value, out, ctx)) consumed++;
        else skipped.push(`${rec.name}: ${key} (${value})`);
      }
      if (consumed > 0) applied.push(`${rec.name} (${consumed})`);
    }
  }

  return { mods: out, appliedFrom: applied, skippedKeys: skipped, maxMana: ctx.maxMana };
}
