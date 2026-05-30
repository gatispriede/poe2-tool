// Applies support gem effects to GlobalMods. Each support's effect is
// represented as PoB-extracted `constantStats` — an array of [stat_id, value]
// pairs. We pattern-match stat IDs into damage buckets.
//
// Coverage today is intentionally limited to the most common support effect
// shapes: more/increased damage, attack speed, crit multi/chance, plus
// weapon-set conditional filtering. Effects we don't yet handle (enemy
// resistance negation, conditional triggers, daze on crit, etc.) are
// silently skipped and listed in notes by the composer.

import { GlobalMods, AilmentKind, emptyMods } from './aggregateMods';
import { ParsedBuild } from '../validation/types';
import skillsJson from '../data/generated/skills.json';

interface SkillRecord {
  id: string;
  isSupport: boolean;
  skillTypes: string[];
  constantStats: [string, number][];
}

const skillsById: Record<string, SkillRecord> = {};
for (const s of skillsJson as SkillRecord[]) skillsById[s.id] = s;

interface ApplyContext {
  useSecondWeaponSet: boolean;
  skillTags: Set<string>;   // active skill's tags — for type-filter on stat keys
}

// Damage-type tokens that may appear in stat keys. If a key contains
// `_melee_damage_` we should only apply it to Melee skills; same for the
// other types. Order matters: we strip from longest first to avoid
// `_lightning_` matching inside `_lightning_damage_`.
const KEY_TYPE_GUARDS: { token: string; tag: string }[] = [
  { token: '_melee_damage',      tag: 'Melee' },
  { token: '_spell_damage',      tag: 'Spell' },
  { token: '_attack_damage',     tag: 'Attack' },
  { token: '_projectile_damage', tag: 'Projectile' },
  { token: '_area_damage',       tag: 'Area' },
  { token: '_minion_damage',     tag: 'Minion' },
  { token: '_bow_damage',        tag: 'Bow' },
  { token: '_fire_damage',       tag: 'Fire' },
  { token: '_cold_damage',       tag: 'Cold' },
  { token: '_lightning_damage',  tag: 'Lightning' },
  { token: '_chaos_damage',      tag: 'Chaos' },
  { token: '_physical_damage',   tag: 'Physical' },
];

/** Map a single support `constantStats` entry into bucket adjustments. */
function applySupportStat(
  rawKey: string, value: number, out: GlobalMods, ctx: ApplyContext,
): void {
  // Weapon-set conditional filter. Stats keyed `_in_weapon_set_one/two`
  // only apply when the player is in that set.
  if (/_in_weapon_set_one\b/.test(rawKey) && ctx.useSecondWeaponSet) return;
  if (/_in_weapon_set_two\b/.test(rawKey) && !ctx.useSecondWeaponSet) return;

  // Conditional-clause guards. PoB encodes conditions as `_if_<condition>`
  // tails. For sustained DPS we accept conditions the build can plausibly
  // satisfy and reject those it can't.
  if (/_if_melee_hit/.test(rawKey) && !ctx.skillTags.has('Melee')) return;
  if (/_if_spell_/.test(rawKey)     && !ctx.skillTags.has('Spell')) return;
  if (/_if_attack_/.test(rawKey)    && !ctx.skillTags.has('Attack')) return;

  // Setup-conditional damage multipliers. These only apply once the build
  // ESTABLISHES a condition we don't model (pin the target, fully break its
  // armour, sacrifice a nearby minion, spend Glory). On a bow/spell build
  // hitting a boss none of them hold, yet crediting them as always-on lets
  // the optimizer stack 4+ "more" multipliers for an ~8× phantom — the single
  // biggest source of DPS over-estimation (calibrated against a real 200k
  // Ice Shot character whose composed value was 8.1× too high). Skip them by
  // default; surfaced in the "support stats skipped" note.
  if (/_damage_\+%(?:_final)?\b/.test(rawKey) &&
      /\bpin\b|broken_armour|consume_enemy|nearby_minion|minion_pact|zerphis_legacy|requires_x_glory|consume_corpse|\bcorpse\b|distance_based/i.test(rawKey)) {
    return;
  }

  // Non-hit damage categories. These look like damage mods to the regex
  // but scale separate game systems (stun threshold, ailment DoT, etc.).
  // Counting them as hit damage MORE multipliers would corrupt DPS — e.g.
  // Ruthless's `support_ruthless_big_hit_stun_damage_+%_final = 500`
  // would otherwise apply as ×6 hit damage.
  if (/_stun_damage_/.test(rawKey))    return; // stun threshold scaling
  if (/_ignite_damage_/.test(rawKey))  return; // ailment DoT, not hit
  if (/_bleed_damage_/.test(rawKey))   return;
  if (/_poison_damage_/.test(rawKey))  return;
  if (/_secondary_damage_/.test(rawKey)) return; // sub-hit; not main hit
  if (/_reflect/.test(rawKey)) return;
  if (/_recoup/.test(rawKey)) return;

  // Type guards: a `_melee_damage_+%_final` stat must only apply to Melee
  // skills, etc. This is the difference between a support meant for one
  // skill type and our composer naively bucketing every "damage_+%_final".
  for (const guard of KEY_TYPE_GUARDS) {
    if (rawKey.includes(guard.token) && !ctx.skillTags.has(guard.tag)) return;
  }

  // Strip conditional suffix so the bucket regexes below can anchor on the
  // semantic shape (e.g. `_damage_+%_final_in_weapon_set_two` → `_damage_+%_final`).
  // Also strip type tokens so the generic `_damage_+%_final$` branch catches
  // patterns like `_melee_damage_+%_final` (already passed the guard above).
  let key = rawKey.replace(/_in_weapon_set_(?:one|two)\b/, '');
  // Strip a leading type token if it sits directly before `_damage_`.
  key = key.replace(/_(?:melee|spell|attack|projectile|area|minion|bow|fire|cold|lightning|chaos|physical)_damage_/, '_damage_');
  // Strip any trailing _if_<...>_seconds or similar conditional suffix.
  key = key.replace(/_if_[a-z_]+(?:_seconds?)?$/, '');

  // Skip clearly-defensive/utility/penalty stats.
  if (/^daze_/.test(key)) return;
  if (/^maximum_critical_strike_chance_is_%/.test(key)) {
    // Garukhan-style crit chance cap — emit nothing here; the composer
    // clamps separately based on this kind of mod (TODO).
    return;
  }

  const isFinal = /_\+%_final$/.test(key);  // MORE bucket
  const isPct   = /_\+%$/.test(key);         // INCREASED bucket

  // --- Ailment-CONDITIONAL damage (route to reliability-gated bucket) ---
  // Supports whose damage requires the target to be frozen / shocked / etc.
  // (Biting Frost "vs frozen", consume-freeze, etc.) are unreliable against
  // bosses. Detect the ailment in the ORIGINAL key (before type-stripping)
  // and route to ailmentConditionalMore so the composer scales them by
  // per-ailment, per-target reliability instead of crediting them always-on.
  const ailCond = rawKey.match(/(?:vs_|consume_enemy_|consume_|against_)?(frozen|freeze|shocked|shock|ignited|ignite|chilled|chill|electrocuted|electrocute)\b/);
  if (ailCond && /_damage_\+%(?:_final)?/.test(rawKey)) {
    const map: Record<string, AilmentKind> = {
      frozen: 'freeze', freeze: 'freeze', shocked: 'shock', shock: 'shock',
      ignited: 'ignite', ignite: 'ignite', chilled: 'chill', chill: 'chill',
      electrocuted: 'electrocute', electrocute: 'electrocute',
    };
    out.ailmentConditionalMore.push({ ailment: map[ailCond[1]], value });
    return;
  }

  // --- Damage scaling ---
  if (/(?:^|_)damage_\+%(?:_final)?$/.test(key)) {
    if (isFinal) out.moreDamageList.push(value);
    else if (isPct) out.increasedDamagePct += value;
    return;
  }

  // --- Attack/Cast speed ---
  if (/(?:^|_)(?:attack|cast)_speed_\+%(?:_final)?$/.test(key)) {
    if (isFinal) out.moreAttackSpeedList.push(value);
    else if (isPct) out.increasedAttackSpeedPct += value;
    return;
  }

  // --- Crit multiplier (PoE's "Critical Strike Multiplier" = Crit Damage Bonus) ---
  // 0.5 renamed the display text to "Critical Damage Bonus"; tolerate both
  // the legacy `critical_strike_multiplier` stat key and a possible
  // `critical_damage_bonus` rename so a PoB stat-id change can't silently
  // drop crit-multi supports.
  if (/(?:critical_strike_multiplier|critical_damage_bonus)_\+%(?:_final)?$/.test(key)) {
    // For v4 we treat MORE crit-multi as additive in our bucket because the
    // single-source case is identical. When two MORE crit-multi stack this
    // under-approximates by a few percent. Refine later.
    out.addedCritMultiplierPct += value;
    return;
  }

  // --- Crit chance ---
  if (/critical_strike_chance_\+%(?:_final)?$/.test(key)) {
    // Same simplification as crit-multi: treat MORE as additive on the
    // increased bucket. Acceptable until we model crit MORE properly.
    out.increasedCritChancePct += value;
    return;
  }

  // --- Cascade / multi-cast supports. The skill fires (2N + 1) times per
  // cast event when this support is linked: N cascades on each side plus the
  // original. PoB encodes N as cascade_number_of_cascades_per_side (1 for
  // Spell Cascade base). The damage_+%_final penalty on the same support is
  // already captured by the generic damage bucket above.
  if (/cascade_number_of_cascades_per_side$/.test(key)) {
    out.castMultiplier *= (2 * value + 1);
    return;
  }

  // Anything else — silently skipped. Composer reports via notes.
}

/**
 * Walk every support gem in the active skill group, look up its
 * constantStats, and roll the effects into a GlobalMods bundle.
 */
export function aggregateSupportMods(
  build: ParsedBuild,
  skillGroupIndex: number,
  ctx: { useSecondWeaponSet: boolean; skillTags?: Set<string> },
): { mods: GlobalMods; appliedSupports: string[]; skippedKeys: string[] } {
  // Backfill skillTags by reading the active skill in the group when the
  // caller didn't supply it (preserves older call sites).
  let skillTagsSet: Set<string> = ctx.skillTags ?? new Set<string>();
  if (skillTagsSet.size === 0) {
    const group = build.skillGroups[skillGroupIndex];
    if (group) {
      for (const g of group.gems) {
        if (!g.skillId) continue;
        const rec = skillsById[g.skillId];
        if (rec && !rec.isSupport) {
          skillTagsSet = new Set(rec.skillTypes);
          break;
        }
      }
    }
  }
  const effectiveCtx: ApplyContext = { useSecondWeaponSet: ctx.useSecondWeaponSet, skillTags: skillTagsSet };
  const out: GlobalMods = emptyMods();

  const group = build.skillGroups[skillGroupIndex];
  if (!group) return { mods: out, appliedSupports: [], skippedKeys: [] };

  const applied: string[] = [];
  const skipped: string[] = [];

  for (const gem of group.gems) {
    if (!gem.enabled || !gem.skillId) continue;
    const rec = skillsById[gem.skillId];
    if (!rec || !rec.isSupport) continue;
    if (!rec.constantStats || rec.constantStats.length === 0) continue;

    let consumed = 0;
    for (const [key, value] of rec.constantStats) {
      const before = JSON.stringify(out);
      applySupportStat(key, value, out, effectiveCtx);
      if (JSON.stringify(out) === before) {
        skipped.push(`${gem.nameSpec || rec.id}: ${key} (${value})`);
      } else {
        consumed++;
      }
    }
    if (consumed > 0) applied.push(`${gem.nameSpec || rec.id} (${consumed})`);
  }

  return { mods: out, appliedSupports: applied, skippedKeys: skipped };
}
