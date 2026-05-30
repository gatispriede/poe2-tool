# How composeDamage evolved (v1 → v7)

A reverse-chronological account of how the composer reached 1.12M DPS on
zeolet's Ice Shot from a 7.16k starting point, and what each iteration
taught us. Read this before resuming damage-calc work — most of the
"obvious next ideas" have already been tried, and the failure modes are
non-obvious.

## Headline numbers

| v | DPS | gap (vs 17M) | what we added | what we learned |
|---|------|----|---|---|
| v1 | 7,160 | 2,374× | weapon-local only: base × added × local% × skill multiplier × crit | the "regex anchored at `^`" trap — missed `Bonded: +1 to Level` because the line didn't start with the number |
| v2 | 51,892 | 327× | aggregated stats from 130 allocated tree nodes | most of the tree contribution is crit-multi notables, not raw damage % |
| v3 | 167,401 | 102× | non-weapon gear globals + added-flat-to-attacks from rings/gloves/quiver | "Damage with Bow Skills" / "Damage with Cold Skills" needed its own regex branch — distinct from "Damage with Hits/Attacks/Spells" |
| v4 | 287,626 | 59× | support gem effects via constantStats pattern matching | weapon-set-conditional supports (`_in_weapon_set_one/two`) need the suffix stripped before bucket matching, AND need `useSecondWeaponSet` propagated from the parser |
| v5 | 396,923 | 42.8× | Gain-as-Extra (Hyrri's Ire +23% Cold, bow rune +5% per element) | "global" mods on the weapon (gain-as-extra, +to Skill Level) needed a whitelist — they live on the weapon item but aren't local damage mods |
| v6 | 733,800 | 23.2× | while-conditionals + vs Rare/Unique + Power/Frenzy charges | the negative lookahead `(?!\s+(?:Over\|with\|while))` was rejecting valid herald-buff conditionals; only `Over` and `with` should be excluded |
| **v7** | **1,116,652** | **15.2×** | active-skill self-buffs (Ice Shot freeze multi) + cross-skill marks (Freezing Mark gain-as-cold) | active skills carry damage-relevant `constantStats` too, not just supports; same pattern-matching scheme applies |

## Things that landed as bugs along the way

Each version found a real bug in the previous one. **Trust the breakdown
output, not the headline DPS.** Many "expected" multipliers landed as a
1.0× because of a regex anchor or filter being too strict:

1. **v1 → v2 effective-gem-level miscount.** Computed level 36 but I'd
   expected 36 too — turned out one mod (Bonded rune) wasn't matching the
   `^` anchor. Fixed by removing the anchor since "to Level of" is specific
   enough alone.
2. **v3 added-flat from gear wasn't applying.** I'd written the regex
   but the bucket sum was being added in the wrong place in the per-hit
   formula. Caught by running and seeing per-hit unchanged.
3. **v4 weapon-set-conditional supports.** Rigwald's Ferocity has two
   stat sets keyed by weapon set. The set-2 stats weren't applying because
   my regex required the key to end in `_+%_final`, but the actual key
   ends in `_in_weapon_set_two`. Fix: strip the suffix before matching.
4. **v5 gain-as-extra on the weapon was missed.** Bow's "5% as Extra all
   Elements" implicit was in `aggregateNonWeaponItemMods` which skipped
   the weapon entirely. Fixed with a small `isUnambiguouslyGlobalWeaponLine`
   whitelist — gain-as-extra is unambiguously global even on a weapon.
5. **v5 NaN bug.** Added the new `extraDamagePct` field to GlobalMods but
   forgot to initialize it in `applySupportMods.ts`'s out object. Merge
   propagated `undefined + number = NaN` to per-hit. Caught immediately by
   the test (DPS printed as `NaN`).
6. **v6 "Damage while affected by Herald" rejected.** My damageApplies
   had `(?!\s+(?:Over|with|while))` as a negative lookahead to skip
   "Damage Over Time", "Damage with X", "Damage while standing still"
   patterns. But "Cold Damage while affected by Herald of Ice" is a
   valid buff conditional that the build genuinely has running. Fix:
   removed `while` from the exclude list; we now accept "while X" buff
   conditionals optimistically.

## The compound effect of small filters

Each iteration's headline gain was driven by a single regex / filter fix:

```
v1 → v2: +218% inc, +422% crit-mul, +30% atk speed from tree            → 7×
v2 → v3: +48% inc dmg, +264 added flat from gear                        → 3.2×
v3 → v4: +30% more crit-mul (Overextend), +30% MORE damage (Rigwald)    → 1.7×
v4 → v5: +38% extra damage (Hyrri + bow rune)                           → 1.38×
v5 → v6: +114% inc dmg, +120% inc crit, ×1.125 atk speed                → 1.85×
v6 → v7: +30% extra dmg, +25% MORE damage (freeze multi)                → 1.52×
```

Each iteration **also surfaced bugs in the previous one**. The lesson:
adding a new bucket is rarely the whole story — usually it exposes that
some existing pattern wasn't catching what we thought.

## Patterns the composer matches today

For damage:
- `"% increased X Damage"` (additive bucket)
- `"% more X Damage"` (multiplicative bucket)
- `"% reduced"` / `"% less"` (negative entries in the matching bucket)
- `"Adds N to M <type> Damage"` (added flat)
- `"Adds N to M <type> Damage to Attacks"` (gear-global added flat)
- `"Damage with Hits / Attacks / Spells / Bow Skills / Cold Skills"` (skill-filtered)
- `"Damage against Rare or Unique Enemies"` (target conditional, assumed true)
- `"Damage while affected by Herald X"` (buff conditional, assumed true)
- `"Gain X% of Damage as Extra <type>"` (single + "all Elements" forms)
- `"+N to Level of <X> Skills"` (gem-level shift, filtered by tags)

For attack speed:
- `"% increased Attack Speed"` (local + global)
- `"% more Attack Speed"` (incl. support gems' `_attack_speed_+%_final` and
  charges' per-stack effects)

For crit:
- weapon `CritChanceBase` + local `+X% to Crit Chance`
- `"% increased Critical Hit Chance"` (filtered for-Attacks/for-Spells)
- `"% increased Critical Damage Bonus"` (additive `+%` to multi)
- Support gem `_critical_strike_multiplier_+%_final` (treated as additive
  for v7; one-source case is identical)

For active-skill buffs (v7):
- `_damage_%_to_gain_as_<type>` (mark / aura → extra)
- `_hit_damage_<ailment>_multiplier_+%_final` (ailment-conditional MORE)
- Generic `_damage_+%(?:_final)?$` (damage scaling)

## Patterns the composer doesn't match yet

See [damage-calc-coverage.md](damage-calc-coverage.md) for the full tickbox.
The biggest gaps as of v7:

- **Sniper's Mark per-level crit multi vs marked enemy** — magnitude lives
  in `statSets[].levels[]` which `extractSkills.js` doesn't yet pull.
- **Herald direct proc damage** — needs the composer to model multiple
  damage instances per attack, not just one.
- **Spell base damage tables** — for Comet/Arc, base damage is in
  `statSets[].levels[N].x_y_damage` not in the gem's top-level levels.
  Needed for Gaobin/RsFearless fixtures.
- **Per-type damage tracking** — currently all damage is one number; we
  over-apply "increased Cold Damage" to the phys portion (and vice versa).
- **Trigger chains** — Gaobin's 180M Comet, RsFearless's 1M Arc both
  depend on Spark + Cast on Critical. Composer would need to multiply
  triggered-skill DPS by trigger frequency.
- **Enemy resistances** — currently 0% baseline. For zeolet this happens
  to roughly align because Rakiata's Flow negates elemental resistance,
  but for other builds we'd need a configurable enemy profile.

## Architecture notes

- **`aggregateMods.ts`** holds the GlobalMods bucket type and the
  text-pattern aggregator. Every other module produces GlobalMods bundles
  that get merged before the composer applies them.
- **`applySupportMods.ts`**, **`applyActiveSkillBuffs.ts`**,
  **`applyCharges.ts`** all share the same GlobalMods shape and the
  `mergeMods` join. Adding a new "source of damage modifiers" means
  writing another `apply*` that produces a GlobalMods.
- **The composer (`composeDamage.ts`) is intentionally thin.** It calls
  the aggregators, merges, then applies the modifiers at the right steps
  of the Mobalytics pipeline. The pipeline steps map 1:1 to lines of code.
- **Per-fixture breakdown is logged on every test run.** The test prints
  the global mod bundle alongside per-hit, hits/sec, crit, and DPS. When
  a number changes unexpectedly, the breakdown shows which bucket moved.
  Trust the breakdown; don't trust headline DPS.

## How to add another iteration

1. Survey the missing piece in real data — e.g. find an unscaled mod text
   that should be contributing.
2. Add the pattern to `aggregateMods.ts` (or a new `apply*` module).
3. Run the test, compare the breakdown columns. If `incDmg%` jumps but
   DPS doesn't, the apply-side is broken. If DPS jumps but `incDmg%` is
   unchanged, the bucket is wrong.
4. Update [damage-calc-coverage.md](damage-calc-coverage.md) with the
   new ✅ rows and any new notes.
5. Add a row to the headline table above.

Each iteration should take 10-30 minutes if the pattern is simple.
Iterations that need a new bucket type (e.g. per-type tracking, parallel
damage instances) are bigger and warrant a doc note.
