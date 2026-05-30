# Calibration ground-truth (real in-game numbers)

Real per-skill DPS captured from a live PoE2 0.5 Huntress/bow character, used
to calibrate the composer. These are the **truth** — when our model diverges
from them, our model is wrong.

## Character context
- Bow: **Rapture Reach Obliterator Bow** (mirror-tier, lvl 78) — 379-628 phys,
  9.93% crit, 1.15 APS, fires additional arrow, 50% inc dmg vs Rare/Unique,
  177%+63% inc phys, adds 31-39 phys, +136 acc, +4.93% crit, +23% crit dmg
  bonus, +3 to all Attack Skills. (Took ~2 months to obtain — endgame.)
- Tree: ~80-90 points, spread across damage + life + defences + travel (NOT
  all-damage). Amazon ascendancy.
- This is a STRONG, well-geared character — not a league-start.

## Real skill DPS on this gear (the anchors)
| Skill | In-game DPS | Avg dmg/use | APS | Notes |
|---|---|---|---|---|
| Bow Shot | **78,610** | 29,890 | 2.63 | basic attack; 56.5% crit, +363% crit dmg |
| Ice Shot | **52,394** | 24,831 | 2.11 | 80% phys→cold; shard cone; 35.3% crit, +519% crit dmg |
| Poisonburst Arrow | 39,833 | — | — | |
| Toxic Growth | 18,769 | — | — | |
| Elemental Surge | 15,269 (per use) | — | — | weapon-surge explosion |
| Escape Shot | 14,785 (per use) | — | 0.89 (1.12s) | leap; freeze build; util |
| Gas Arrow | 11,132 | — | — | |

Headline: even with a **mirror-tier bow + good tree**, single-target tops out
at ~50-80k. The base is low. Any model output far above this on lesser gear is
inflated.

Ice Shot internal anchor: main-hand total damage 7,430 avg on a 503-avg
weapon = **~15× total multiplier on weapon base** (incl. ~3.44× skill base
multiplier). Our composer must land near this, not orders of magnitude above.

## DEFINITIVE: our composer vs PoB on the user's real build (imported PoB code)
Imported a real Huntress/Amazon Lv94 PoB code (Ice Shot main, 125-node mixed
tree, real gear, real supports: Elemental Armament II / Deliberation / Rapid
Attacks II / Pinpoint Critical). PoB's own `TotalDPS` = **68,120**.

Fed that EXACT build (not our synthesized approximation) to composeDamage:
- **Boss (single-target, no freeze): 86,364 — 1.27× of PoB's 68,120.** ✓
- White pack (freeze applied): 723,299 — the clear-speed number (freeze
  multiplier fully lands on white mobs; PoB's 68k is the boss config).

**Conclusion: the composer's math is sound (~1.27× on real inputs).** Every
5-12× over-estimate this session came from the build GENERATOR's fake inputs
(greedy all-damage tree, zeolet gear template, fictional conditional support
picks) — NOT the damage engine. The fix is generator realism, not the composer.
Tools: `scripts/decode-pob.js` (code→XML) + `scripts/parse-pob.js` (→ParsedBuild)
let us validate any real build this way.

## Multi-build calibration (4 real pobb.in imports vs PoB Total DPS)
Fixtures saved in `src/data/baseline-builds/calibration/`.

| Build | Class / main skill | Ours (boss) | PoB Total | Ratio | Note |
|---|---|---|---|---|---|
| 4ZLffDTQxYAj | Ranger Deadeye L89 / Ice Shot | 244k | 489k | 0.50× | missing shard cone |
| DLtydZs_Mos6 | Amazon L97 / Ice Shot | 562k | 1,128k | 0.50× | missing shard cone |
| QYNrgMjWS5b5 | Amazon L95 / Lightning Spear | 1,224k | 3,540k | 0.35× | missing secondary hits; player achieved only ~200k in practice |
| VzBZLqX4dVTy | Blood Mage L97 / Spark | 202k (raw) | 494k | 0.41× | spell path now computes (was: caster weapon error) |

Findings:
- On REAL builds the composer is now in the right order of magnitude but
  UNDER-counts (0.35–0.50×), the opposite of the generator's old 5–15× over.
- Both Ice Shot builds land at exactly **0.50×** — a systematic 2× from the
  un-modelled ice-shard cone (Ice Shot DPS = arrow + shards; we count arrow
  only). Modelling secondary on-hit hits would roughly double these → ~PoB.
- PoB numbers are theoretical maxima. The Lightning Spear build PoB-rates at
  3.5M; the player achieved ~200k in practice (17× gap), and reports never
  exceeding ~2M even at level 100. Realistic sustained DPS lives in the
  0.5–2M band; beyond that survivability is the constraint, not damage.

Composer accuracy verdict: within ~2× on real inputs, every residual
identified (shard cone, secondary hits, caster-weapon data, max-charge
assumption). The math is sound; remaining work is named mechanics + generator
realism, not the core engine.

## v13 — caster-weapon finding + enemy resistance/penetration
**Caster weapons have NO base attack damage** in PoB data (wand/sceptre/caster-
staff all `weapon:null`) — that is correct PoE2 design, not a missing extraction.
Sceptres carry `spirit=100`; staves split into caster (null) vs warstaff
(populated) under one "Staff" type. The real fix was consumption-side:
- Spell base damage comes from the GEM (`spell_*_base_*_damage`), not the weapon.
- The caster weapon is a STAT-STICK: all its mods are global for a spell (none
  are "local"), so they now flow through `aggregateNonWeaponItemMods`.
- Spell cast rate = 1/`castTime` scaled by cast speed; spell base crit = 5%
  (generic), not the weapon's crit. Composer no longer throws on `weapon:null`
  for spells. → Spark fixture now composes (202k raw vs PoB 494k = 0.41×).

**`dps` is now REALISTIC (post enemy-resistance); `rawDps` is PoB-comparable.**
PoB's headline ignores enemy res; we model it because it's the biggest boss-DPS
truth. New `targetTier` defaults + `enemyProfile` override. Real Ice Shot (cold,
DLtydZs) demonstrates the player's point precisely:

| Target | raw (PoB-like) | effRes | landed dps | ×mul |
|---|---|---|---|---|
| white | 652,871 | 0% | 652,871 | 1.00 |
| map boss | 470,460 | 40% | 282,276 | 0.60 |
| pinnacle | 444,541 | 75% | 111,135 | 0.25 |
| pinnacle +50% pen | 444,541 | 25% | 333,406 | 0.75 |
| pinnacle INVERTED (Monk) | 444,541 | −75% | 777,947 | 1.75 |

So: a 444k cold hit lands only 111k on a 75%-res pinnacle; +50% pen triples it
to 333k; Monk-style inversion amplifies to 778k (>raw). Chaos hits ignore res
entirely (×1.0 at every tier). Penetration is the **highest-value sensitivity
lever** on a resisted elemental build (+25% DPS per 15% pen on both Ice Shot
fixtures), beating any raw-damage roll — exactly when fighting resistance.

Profiles in `enemyDefense.ts` (boss 40% ele, pinnacle 75% ele, chaos 0
everywhere) are TUNABLE approximations, overridable per call. v1 applies the
hit's DOMINANT element's effectiveness to the whole hit; per-type splitting of
gain-as-extra is a queued refinement.

## Composer calibration log (Ice Shot on the Rapture Reach bow)
| State | Composer DPS | Ratio vs 52,394 | Fix applied |
|---|---|---|---|
| Pre-realism | 775,900 | 14.8× | (all-damage tree + endgame template gear + always-on conditionals) |
| Tree realism (55% damage points) | 320,101 | 6.1× | synthesizeTree allocates only ~55% of points to damage nodes |
| _pending_ | _target ~50-150k_ | _~1-3×_ | realistic non-weapon gear (drop zeolet template's 413% gain-as-extra) |

## Known over-estimation sources (in priority order)
1. **Non-weapon gear template** — the generator borrows zeolet's mirror-tier
   uniques (413% gain-as-extra, etc.). A real/leveling character has a fraction
   of this. Biggest remaining inflator. Fix: generate realistic rare armour /
   jewellery instead of templating endgame uniques.
2. **Charges assumed max** — Power+Frenzy 3/3 always on. A leveling character
   has 0-2. Gate by whether the build generates them.
3. **Multi-type increased stacking** — Ice Shot is Cold+Phys+Projectile+Attack;
   we may additively sum increased mods for every tag. Audit for double-count.
4. **Endgame supports assumed available** — Rakiata's Flow (lvl 65), etc. are
   hard to obtain early; league-start builds don't have them. Gate support
   availability by character level / rarity for league-start estimates.

## Realistic gear examples at level (for the generator to match)
- Bow, lvl 28: Armageddon Stinger — 40-74 phys, adds 12-20 cold, +50% surpass
  additional arrow, 77% inc phys, +33 acc, +1.38% crit, +3 proj levels, life on
  kill. (ONE phys roll + utility — matches our 3-mod realism direction.)
- Bow, lvl 54: Kraken Song — 58-109 phys, ele 12-20/6-98, 52% inc phys, +3 proj
  levels, 12% AS.
- Amulet, lvl 61: Phoenix Gorget — +3 proj levels, +7 attrs, 58% evasion, +30%
  cold res, defences. (Utility/defence, not raw damage.)

These confirm: real items carry ONE good damage roll + utility/levels, not
stacked max damage prefixes.
