# Roadmap

Living tracker for poe2 build-discovery project. Update when an item lands
or scope changes. Anchored on the original goal: **pick a class, get the
top-N highest-DPS builds, every output in-game reproducible.**

## Current state (v9.5)

- **4 classes** generating end-to-end: Huntress, Warrior, Witch, Sorceress.
- **All outputs in-game reproducible** — enforced by 21 acceptance tests.
- **Composer at ~11× gap** vs poe.ninja's top reference (zeolet's Ice Shot
  composes to 1.49M; player-reported 17M). Each composer iteration auto-lifts
  generator outputs.
- **Generator per-build picks**:
  - Weapon: rare-generated vs each viable unique (scored by composer)
  - Non-weapon slots: template (zeolet) vs generated rare (class-attribute-themed) vs each viable unique
  - Tree: greedy + Steiner strategies, composer arbitrates
  - Trigger mode for spell skills: direct cast vs Cast on Critical (Spark-source)

## Recent landings

| Version | Headline change | Impact |
|---|---|---|
| v9.6 | CoC intrinsic `-20% more damage` penalty applied (from exploration agent finding) | Witch DPS adjusted down 20%; more honest |
| v9.5 | Real trigger source simulation (Spark cast×crit×projectile vs cap) + Sorceress class | More honest Witch CoC numbers; 4th class enabled |
| v9 | Trigger mode in composer (`'direct'` / `'cast_on_crit'`) + spell base damage extraction + Witch class | Witch top builds 2-3× direct via CoC |
| v8 + agent | Armour/jewellery/offhand base extraction (647 bases) + rare-armour generation per slot | Huntress +63%, Warrior +65%, Witch +78% |
| v8 | Sniper's Mark per-level crit multi (statSets[].levels[]) + `total_attack_time_+_ms` | Composer gap closed to 11.4× |
| v7 | Active-skill buffs (Ice Shot freeze multi, Freezing Mark cold gain-as-extra) | Composer crossed 1M for zeolet |
| v6 | While-conditional buffs + vs Rare/Unique + Power/Frenzy charges | Composer +59% |
| v2–v5 | Tree-node stats, gear globals, support effects, gain-as-extra | First non-trivial DPS scores |
| v1 | Generator scaffold + 5-layer validity model | Foundation |

Full per-iteration history in [composer-evolution.md](composer-evolution.md).

## Queued — bounded items (high impact, single-iteration)

| Priority | Item | Why | Expected effort | Expected impact |
|---|---|---|---|---|
| 1 | Per-type damage tracking | Currently "increased Cold" scales the phys portion of a hit too (over-counts); fixing yields cleaner numbers in both directions | medium — composer refactor: track damage per element, scale each independently | mostly correctness; net DPS effect varies per build |
| 2 | Conditional ailment multipliers respect their condition | Escape Shot's `+600% on freeze` is treated as always-on; should require freeze buildup | small — gate `_<ailment>_multiplier_+%_final` keys behind a probability factor | reduces Escape Shot overestimate |
| 3 | Spellslinger trigger | Gaobin's Mind Goad bow uses Spellslinger ("Grants Skill: Level 18 Spellslinger"); same shape as CoC but triggered by ATTACK, not crit | small — add `triggerMode: 'spellslinger'` with attack-rate-based trigger rate | unlocks Spellslinger-style builds in generator |
| 4 | Herald direct proc damage | Herald of Ice deals damage on enemy shatter; Herald of Thunder on shock. Parallel damage source | medium — composer needs to model multiple damage instances per attack | meaningful for ailment-stacking builds |
| 5 | Marks: more than just Sniper's Mark | Freezing Mark's gain-as-cold caught at v7; Sniper's Mark crit-multi caught at v8. Other marks (Voltaic Mark, Mana Tempest's mark variant) likely have similar effects | small — same pattern: read per-level stats, match keys | adds 1-3 more marks to the pattern matcher |
| 6 | Optimiser improvements: `optimizeGearSlot` accepting user-pasted items | "I found this drop in-game, would it be an upgrade?" workflow | small — same shape as `optimizeSupports` but for items | user-facing |
| 7 | Generator: ascendancy-specific tree shaping | Each ascendancy has its own ascendancy passive tree; we currently allocate generically | small — read ascendancy nodes' stats, prefer high-impact ones in synthesizeTree | per-class output refinement |

## Queued — exploration (results inform future work)

| Item | What we'd explore |
|---|---|
| **Damage chain mechanics** | ✅ Done — see [exploration-damage-chains.md](exploration-damage-chains.md). 22 distinct meta-trigger skills catalogued, 5 top-impact items surfaced. v9.6 already applied the free `-20% MORE` CoC fix; the remaining 4 prioritised below. |
| Build "archetype" classification | Beyond "attack" / "spell" / "trigger", PoE2 has self-cast spell, channelled, totem-summoner, minion-summoner, etc. — each with distinct optimization rules. |
| Real Steiner-tree pathfinder with composer-in-loop scoring | Current dual-strategy heuristic comparison is bounded but not optimal. A real search with composer-as-fitness would produce stronger trees but is much slower per build. |
| Build comparator: "show me why build A beats build B" | Diagnostic output that breaks down DPS contributions by source. |

### From the v9.5 exploration agent — top damage-chain items now in priority queue

Detail: [docs/exploration-damage-chains.md](exploration-damage-chains.md). Ranked by impact on the composer gap:

| Item | Why | Effort | Impact estimate |
|---|---|---|---|
| ~~CoC `-20% MORE damage` penalty~~ | ~~applied v9.6~~ | done | ~25% over-state corrected |
| CoC energy-pool trigger rate (vs our naive cast×crit) | PoB's CoC fires based on accumulated energy from monster-level-scaled hits; our model is structurally simpler | small (validation against gaobin-comet fixture) | ±10–40% on triggered cps |
| Herald of Ice / Herald of Thunder as parallel damage sources | They have full statSets with baseMultiplier scaling to 12.67× at L40 we ignore | medium (first parallel-source pattern; opens 30+ similar) | +20–60% on cold/shatter builds |
| Additional TriggerMode variants (Stun, Block, Ailment-trigger, etc.) | 22 meta-trigger skills share machinery; adding modes is mostly data | small per mode | unlocks new build archetypes |
| Choir-of-the-Storm-class item-granted per-event triggers | Some uniques carry per-event trigger procs we don't model | small | +10–30% on relevant builds |

**Surprise findings worth knowing:**
- **No "Cast When Damage Taken" meta-gem in PoE2.** PoE1 muscle memory wrong. Cast-on-damage-taken behavior lives only on the Valakos ascendancy charge, which is class-locked, not socketable.
- **CoC trigger rate is energy-pool based** (cast time of socketed spell → energy threshold; monster level scales energy gain), not per-crit. Validate composer against gaobin-comet before adding more trigger modes.
- Every meta-trigger support carries the `-20% MORE final damage` penalty — applied in v9.6 for CoC; will need the same fix for each new trigger mode added.

## Deferred — bigger architectural changes

| Item | Why deferred |
|---|---|
| Full enemy resistance / mitigation modelling | Out of scope for the offence calculator; would require an enemy profile system. Currently composer assumes 0% resists which happens to align with Rakiata's Flow effect. |
| Charm/flask uptime modelling | Most flask effects are short-duration; modelling uptime is its own complexity layer. |
| Spirit budget constraints | Auras and triggers reserve spirit; max simultaneous skills is finite. We don't yet enforce. |
| Item generation including crafting paths | We generate ideal rares; in-game players reach them via specific crafting recipes which we don't model. |
| Trade-mod-pool tier weights | We treat all eligible mods as available; real crafting probabilities differ. |
| Multi-build comparison UI | Generator returns top-N; no UI for side-by-side comparison. |

## Composer coverage detail

See [damage-calc-coverage.md](damage-calc-coverage.md) for the ✅/⚠️/❌ tickbox
against the Mobalytics 8-step pipeline. Update after each composer iteration.

## Memory artifacts

Captured for future sessions:
- [Foundation before optimizer](../C/Users/.../memory/project_optimizer_goal.md) — validity layers come first
- [Wording is the spec](../C/Users/.../memory/feedback_wording_is_spec.md) — keyword → bucket mapping
- [Iteration discipline](../C/Users/.../memory/feedback_iteration_breakdown_pattern.md) — trust per-bucket breakdowns, not headline DPS

## How to use this roadmap

When picking the next work item:
1. Default: take the highest-priority queued item from "bounded items"
2. If blocked or low-impact: check exploration items
3. If the composer's gap (Σ_Σ poe.ninja-vs-our-composer ratio) is the bottleneck: prioritise composer-coverage items over generator-feature items

When landing an item, move it from "Queued" to "Recent landings" with a one-line summary of impact.
