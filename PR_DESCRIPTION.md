# Sync to PoE2 0.5 + damage-model, discovery, and planner

Brings the build workbench onto the **live 0.5 "Return of the Ancients"** patch and
adds a calibrated damage engine, a mechanics-discovery layer, and an interactive
planner. Branch: `data-sync-0.5`.

## Data — now on live 0.5
- Re-synced from PathOfBuilding-PoE2 dev (0.16.0 / May-30): **1226 skills**
  (new TriggeredBarbs trigger gems, Thorns), **388 uniques** (Drillneck, Atziri set),
  1720 mods.
- **Parsed the 0.5 `tree.lua`** (PoB dropped `tree.json`): 4844 nodes, 8 classes,
  1165 notables, the new **Abyssal Lich** ascendancy. `extractTree` normalizes the
  Lua 1-indexed arrays into the prior json shape so downstream code is unchanged.

## Composer (damage-v2) — what it models
flat → increased → more → crit → rate, then a type-aware enemy layer:
- **Enemy resistance + penetration** by target tier (pinnacle = 50% ele / 0% chaos,
  ground-truthed against PoB).
- **Chaos-conversion bypass** (source-aware — Voltaxic only converts lightning).
- **Shock** as more-damage-taken; **armour break** (Cut to the Bone / Warbringer).
- **Accuracy → crit** (Amazon); **armour-as-damage** (Smith of Kitava / Doryani's).
- Weapon-local elemental, **spell flat-added ("Adds … to Spells")**, skill↔weapon
  eligibility (bow skills need bows; spells can't use bows/crossbows).
- **Calibrated** against 4 real imported PoB builds; within ~2× on real inputs.

## Discovery
- `scripts/discover-mechanics.js` mines uniques/tree/ascendancy/supports for
  behaviour-changing mechanics (931 distinct); documented in
  `docs/mechanics-discovery.md`.
- Per-class **Archetype Map** + chain finder on the Mechanics page.
- **Sensitivity analyzer** (`sensitivity.ts`): marginal ΔDPS per modifier off the
  real engine — drives "what to chase next".
- Generator **archetype-commitment bias axis** (balanced/crit/ailment/armour).

## Planner
- Wizard: Weapon → Skill → Weapon Mods → Passives (interactive tree) → Equipment.
- **Conditional-header gate** on the passive scorer so condition-gated nodes
  (e.g. Wildsurge's "Storm and Plant Spells:") aren't allocated for skills that
  don't qualify.

## Tests
`damage-v2` suite green (13 suites / 23 tests), calibration intact on 0.5 data;
generator + optimizer pass. Pre-existing failures: `WeaponMods`/`WeaponModSelector`/
`App.test` (unrelated, predate this work).

## Follow-ups
- #15 per-layer data-fidelity audit · #20 standalone trigger gems · #35
  sensitivity-driven tree allocation (so the generator auto-finds crit/armour-break
  notables instead of needing them hand-fed).
