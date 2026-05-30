# Exploration: Triggers, Damage Chains & Conditional Multipliers

**Date:** 2026-05-18
**Status:** Read-only survey. No source code modified.
**Scope:** PoE2 mechanics not yet modelled by the composer (`src/damage-v2/composeDamage.ts`).
**Composer baseline:** `TriggerMode = 'direct' | 'cast_on_crit'`. Heralds are modelled as buff sources (their player-buff portion only), not as parallel damage instances.

---

## Executive summary

PoB-PoE2 ships ~22 distinct **meta-trigger skills** (single source pattern, all using a shared
`generic_ongoing_trigger` energy mechanism) plus ~30 in-built-trigger ability skills (`InbuiltTrigger`
flag). Every one of them maps onto the same composer slot we already built for Cast-on-Critical — they
differ only in the trigger condition (block, dodge, kill, stun, freeze/shock/ignite, ES hit, mana spent,
charm use, melee hit, melee kill, minion death) and the energy generation rate. **Adding a `TriggerMode`
per condition is small work**; the per-condition rate parameters are the variables.

The biggest **unmodelled DPS leak** is **Herald of Ice / Herald of Thunder as a parallel damage source**.
Both Heralds have a full second `statSet` in PoB with `baseMultiplier` scaling to 12.67× at gem level 40,
attack-tagged, area, with 100% phys→cold conversion. We currently apply only their buff statset. On any
crit-shatter / shock-heavy build this is a 20–80% headline-DPS understatement.

The most surprising findings are at the bottom under **Surprises**. The big three:

1. **Cast on Critical in PoE2 is an "energy generator" not a per-crit roll.** It's gem-level-scaled
   energy that fills a pool sized to socketed skills' total cast time — meaning the trigger rate is a
   *function of the triggered spell's cast time*, not a flat % chance. Our current model treats CoC as
   1 spark cast per crit; PoB's data implies it's `energy_generated / max_energy` casts per crit.
2. **CWDT in PoE2 doesn't exist as a meta-gem.** The phrase `cast_when_damage_taken` appears only on
   the Valakos ascendancy charge unique (`valakos_charge.lua`). There's no Cast When Damage Taken meta-gem
   in the gem pool — it's gated to a single ascendancy node.
3. **Mortar Cannon is a meta-skill totem** — it summons a Ballista whose attacks are themselves socketed
   Grenade Skills. It's a totem-as-trigger pattern that no other skill uses. Modelling totem DPS at all
   is a separate gap.

---

## Methodology

| Source | Path | Used for |
|---|---|---|
| PoB-PoE2 skills | `PathOfBuilding-PoE2/src/Data/Skills/*.lua` (~1022 skill entries across 7 files) | Trigger meta-gems, in-built triggers, Heralds |
| PoB-PoE2 stat descriptions | `PathOfBuilding-PoE2/src/Data/StatDescriptions/` | Stat key meaning (e.g. `virtual_cast_when_damage_taken_threshold`) |
| Generated uniques | `src/data/generated/uniques.json` (376 entries) | Item-level triggers and granted-skill chains |
| Generated item-mods | `src/data/generated/item-mods.json` (1720 entries) | Rare/magic mod-level triggers |

Grep patterns used: `trigger`, `_on_kill`, `_on_hit`, `_on_freeze`, `_on_shock`, `_on_ignite`, `_on_stun`,
`_when_`, `cast_on_`, `cast_when_`, `meta_keyword_trigger`, `spellslinger`, `cwdt`, `should_have_*`,
`herald_of_*`, `repeat`, `grant`, `chain`, `propagat`, `proc`, `automatically`, `every Nth`, `on kill`,
`while you`, `if you've recently`.

---

## Category 1 — Meta-Trigger Skills (the "Spark slot")

All 22 of these use the same machinery: a `Meta*Player` skill that holds reservation and accumulates
`generic_ongoing_trigger_energy`, paired with a `SupportMeta*Player` hidden support gem that flags
socketed Triggerable spells as `Triggered`. They are interchangeable from the composer's perspective —
they just differ on **how energy is gained** and **the rate**.

Common stat shape (from `MetaCastOnCritPlayer` at `act_int.lua:2001`):

```
constantStats = { { "cast_on_crit_gain_X_centienergy_per_monster_power_on_crit", 100 } }
stats = { "energy_generated_+%", "generic_ongoing_trigger_triggers_at_maximum_energy",
          "generic_ongoing_trigger_maximum_energy_is_total_of_socketed_skills",
          "base_deal_no_damage" }
```

Support side (line 2114): `{ "trigger_meta_gem_damage_+%_final", -20 }` — **all triggered spells take a
flat 20% less final damage multiplier.** We do not currently apply this; we only apply the trigger gating.

### Inventory

| Skill | File:line | Trigger condition | Spirit cost | Energy/event stat key |
|---|---|---|---|---|
| Cast on Critical | `act_int.lua:2001` | Crit Hit | 100 | `cast_on_crit_gain_X_centienergy_per_monster_power_on_crit` |
| Cast on Dodge | `act_int.lua:2226` | Dodge roll | 100 | — (energy_generated_+%) |
| Cast on Elemental Ailment | `act_int.lua:2450` | Freeze/Shock/Ignite | 100 | — |
| Cast on Minion Death | `act_int.lua:2676` | Persistent minion dies | 30 | — |
| Curse on Block | `act_int.lua:4265` | Block | item-granted | `cast_on_block_gain_X_centienergy_on_block` (q-stat) |
| Cast on Block | `act_str.lua:2189` | Block | item-granted | `cast_on_block_gain_X_centienergy_on_block` |
| Cast on Melee Kill | `act_str.lua:2416` | Kill with melee | 60 | — |
| Cast on Melee Stun | `act_str.lua:2485` | Stun with melee | 60 | — |
| Cast on Charm Use | `other.lua:1764` | Charm consumed | item-granted | — |
| Cast Fire Spell on Melee Hit (Thunderclap-variant) | `other.lua:3552` | Melee hit | tree-granted | — |
| Cast Lightning Spell on Hit (Thundergod's Wrath) | `act_str.lua:18439` | Melee hit | item-granted | — |
| **Spellslinger** | `act_int.lua:19776` | Cast spell | item-granted (Mind Goad / etc.) | `spellslinger_invocation_gain_X_centienergy_per_10ms_base_cast_time` |
| Barrier Invocation | `act_int.lua:690` | ES damaged by hit | 30 | — |
| Elemental Invocation | `act_int.lua:5445` | Freeze/Shock/Ignite | 60 | — |
| Reaper's Invocation | `act_int.lua:16608` | Kill with melee | 30 | — |
| Feral Invocation | `act_str.lua:4932` | Mana spent | 60 | — |
| Mortar Cannon | `act_str.lua:13730` | (totem auto-uses socketed Grenade skill) | mana cast | n/a — totem behaviour |
| Spell Totem | `act_str.lua:17365` | Consume 3 Power/Endurance charges | mana cast | n/a — totem |
| Called Shots (Deadeye Marks) | `other.lua:1540` | Periodic, applies socketed Mark | tree-granted | n/a — auto-apply |
| Mirage Archer | `act_dex.lua:4777` | Spawns archer mirroring your bow attacks | tree-granted | parallel attacker |
| Elemental Expression | `other.lua:2369` | Cast/attack with element matched to attribute | tree-granted | `InbuiltTrigger` |
| Amazon Elemental Surge | `other.lua:3052` | Non-melee projectile attack consumes a surge | tree-granted | `InbuiltTrigger` |

### Scale (rough, gem-level 20)

- Cast on Critical max energy = `1 per 10ms of socketed skill cast time` → ~50 energy for a 0.5s spell.
  Energy gained = `100 centienergy per "monster power" on crit` = 1 energy per crit (against L1 mob).
  Against high-tier monsters the multiplier scales — endgame this approaches "every crit triggers".
- Spellslinger max energy = `500` (constant). Gain = `20 centienergy per 10ms base cast time` per cast.
  So a 0.5s spell cast at 1 cps yields `20 × 50 = 1000 centienergy/sec = 10 energy/sec` → 500 max =
  **fills in 50 seconds**? This is suspicious; the description says "can trigger multiple times if it
  has enough Energy". Likely the energy is consumed-per-cast at a much higher rate and the displayed
  500 is a hidden balance lever. Validation against a known build needed.
- All trigger meta-gems apply `trigger_meta_gem_damage_+%_final = -20` to socketed skills — a flat
  **20% less damage multiplier we are not modelling**.

### How to model

- (a) **New `TriggerMode` per condition** — straightforward; the composer already has the slot.
  Each mode needs: trigger rate (events/sec from build conditions like crit rate, cast rate, kill rate),
  energy per event, max energy. Triggered cps = `eventsPerSec × energyPerEvent / maxEnergy`.
- The `-20% final` multiplier should land in `GlobalMods` as a `triggeredDamageMoreMul = 0.8` applied
  whenever `triggerMode !== 'direct'`. **Implementation cost: small** for the bookkeeping;
  **medium** for getting the trigger rate right per condition (each has its own pacing model).

---

## Category 2 — In-built Trigger Skills (`InbuiltTrigger` flag)

These have `[SkillType.Triggered] = true` and `[SkillType.InbuiltTrigger] = true` baked into the gem.
They fire automatically when their condition is met — no socket needed. Each one is its own parallel
damage source.

Notable ones (extracted from `^skills\["Triggered..."` grep, total ~40 entries):

| Skill | File | Source | Trigger |
|---|---|---|---|
| `TriggeredWindDancerPlayer` | `act_dex.lua:10830` | Deadeye ascendancy | Evasion-related |
| `TriggeredTrailOfCaltropsPlayer` | `act_dex.lua:9651` | Pathfinder | Movement |
| `TriggeredCaltropsPlayer` | `sup_dex.lua:788` | Support gem | Hit |
| `TriggeredFanTheFlamesPlayer` | `sup_str.lua:2968` | Support gem | Ignite-related |
| `TriggeredQuillburstPlayer` | `sup_str.lua:5216` | Support gem | Hit |
| `TriggeredFlamePillarPlayer` | `sup_str.lua:3555` | Support gem | Ignite |
| `TriggeredHaemocrystalsPlayer` | `sup_str.lua:3762` | Support gem | Blood |
| `TriggeredCraterPlayer` | `sup_str.lua:1767` | Support gem | Hit (impact) |
| `TriggeredBattershoutExplosionPlayer` | `sup_str.lua:648` | Support gem | Warcry |
| `TriggeredVolcanicEruptionPlayer` | `sup_str.lua:7791` | Support gem | Ignite |
| `TriggeredSkitteringStonePlayer` (+Two) | `sup_str.lua:6279` | Support gem | Hit |
| `TriggeredSplinterExplosionHardyTotems` | `sup_str.lua:6876` | Support gem | Totem |
| `TriggeredBrambleslamPlayer` | `sup_str.lua:938` | Support gem | — |
| `TriggeredExplosiveGrowthPlayer` (+Two) | `sup_int.lua:216` | Support gem | Spell |
| `TriggeredBoneShrapnelPlayer` | `sup_int.lua:959` | Support gem | Spell |
| `TriggeredBurningRunesPlayer` | `sup_int.lua:1190` | Support gem | Ignite |
| `TriggeredCatalysingDischargePlayer` | `sup_int.lua:1340` | Support gem | Element |
| `TriggeredDeadlyCurrentPlayer` | `sup_int.lua:2220` | Support gem | Lightning hit |
| `TriggeredCreepingChillPlayer` | `sup_int.lua:2430` | Support gem | Cold/freeze |
| `TriggeredCurseZoneHazardExplosionPlayer` | `sup_int.lua:2935` | Support gem | Curse |
| `TriggeredShockingRiftPlayer` | `sup_int.lua:3119` | Support gem | Shock |
| `TriggeredElementalDischargePlayer` | `sup_int.lua:3371` | Support gem | Element |
| `TriggeredFieryDeathPlayer` | `sup_int.lua:3971` | Support gem | Ignite kill |
| `TriggeredLivingLightningPlayer` (+Two) | `sup_int.lua:5472` | Support gem | Lightning |
| `TriggeredManaFlarePlayer` | `sup_int.lua:5851` | Support gem | Mana spend |
| `TriggeredStaticShocksPlayer` | `sup_int.lua:7172` | Support gem | Shock |
| `TriggeredXibaquasRendingPlayer` | `sup_int.lua:7950` | Support gem | Bleed |
| `TriggeredPoisonSporesPustule` | `sup_dex.lua:4016` | Support gem | Poison |
| `TriggeredChargedMarkPlayer` | `sup_dex.lua:1030` | Support gem | Mark |
| `TriggeredSupportFrozenSpiteIceFragmentPlayer` | `sup_dex.lua:2309` | Support gem | Freeze shatter |
| `SupportTriggeredAnnihilationPlayer` | `sup_int.lua:4550` | Support gem | Hit |
| `AmazonTriggerElementalSurgePlayer` | `other.lua:3052` | Tree notable | Projectile attack |
| `ElementalExpressionTriggeredPlayer` | `other.lua:2369` | Tree notable | Cast/attack |
| `TriggeredHisWinnowingFlamePillarPlayer` | `act_int.lua:12282` | — | Ignite |
| `PassiveTriggeredManaWaveWaterDjinn` | `minion.lua:1683` | Spirit/minion | — |

### How to model

- (c) **Parallel damage-source instance** — each one is effectively a separate skill firing at its own
  cadence. Need to: (1) compute its trigger rate from parent skill events, (2) run it through the
  damage composer as its own skill, (3) sum into the build's headline DPS.
- **Implementation cost: medium per skill** because each has its own trigger pacing semantics; but
  the *infrastructure* to support parallel damage instances is the costly part — once built, adding
  more in-built triggers is data-only.

---

## Category 3 — Heralds as parallel damage instances (already partially modelled)

| Herald | File:line | Buff side | Damage side |
|---|---|---|---|
| Herald of Ice | `act_int.lua:11360` | `Buff` statset (`base_deal_no_damage`) | `Explosion` statset, area attack, 100% phys→cold convert, baseMultiplier 0.7→12.67 across gem L1→L40 |
| Herald of Thunder | `act_dex.lua:3403` | `Buff` | Bolts on shocking enemy (`create_herald_of_thunder_storm_on_shocking_enemy`, base frequency stat) |
| Herald of Ash | `act_str.lua:7065` | `Buff` | Overkill burning (`herald_of_ash_burning_%_overkill_damage_per_minute = 15`) |
| Herald of Blood | `act_str.lua:7255` | — | Blood-related effect on kill |
| Herald of Plague | `act_dex.lua:3273` | — | Poison-related |

### Trigger conditions

- **Herald of Ice** triggers on `Shatter with non-Herald Attack Hit`. Shatter = killing a frozen
  enemy. Trigger rate = `freeze rate × kill rate` (approximated for endgame as "every kill while
  freezing", ~all kills on a cold build).
- **Herald of Thunder** spawns persistent storms on shocking enemies; storms then hit at
  `herald_of_thunder_bolt_base_frequency`. Effectively a passive DoT-like.
- **Herald of Ash** burns from overkill — 15% of overkill damage as fire DoT per minute. Only
  matters on bursty-overkill builds.

### Scale

- Herald of Ice explosion baseMultiplier 6.02 at gem L30 (level 90 character). 100% phys→cold convert
  means it inherits the parent attack's phys damage, then re-rolls it through cold-scaling globals.
  On a crit-shatter Ice Shot / Lightning Arrow build this can easily be **30–60% of total DPS**.
- Herald of Thunder bolt frequency varies by storm count and stat. PoB scales it per-character-level.
  Estimate: 15–30% added DPS on a shock-heavy build.

### How to model

- (c) **Parallel damage source** — same composer pipeline, with parent skill's converted damage as
  input. Herald of Ice is the highest-impact omission. **Implementation cost: medium** — needs
  damage-derivation from parent attack, not just a flat addition.

---

## Category 4 — Skill-grants-skill chains via uniques

67 of 376 uniques (~18%) grant a skill via `Grants Skill: Level (1-20) X`. Most are just access — the
granted skill is then cast normally. The **trigger-bearing** subset is small but high-impact:

| Unique | Granted | Trigger phrasing |
|---|---|---|
| **Choir of the Storm** (Jade Amulet) | Lightning Bolt | `Trigger Lightning Bolt Skill on Critical Hit` — flat per-crit trigger, no energy gate |
| **Corpsewade** (Iron Greaves) | Decompose | `Trigger Decompose every 1.2 metres travelled` — movement-pace trigger |
| **Double Vision** (Dyad Crossbow) | Gemini Surge | `When you reload, triggers Gemini Surge to alternately gain (2-6) Cold/Fire Surges` — reload-rate trigger that *generates buffs* (surges), not damage |
| **Spire of Ire** (Helix Spear) | Chaotic Infusion | `When you Consume a Charge Trigger Chaotic Surge to gain 2 Chaos Surges` — buff generator on charge consume |
| **Svalinn** (Crucible Tower Shield) | Cast on Block (meta-gem) | grants the meta-gem itself |
| **The Coming Calamity** | Herald of Ash | grants the herald |
| **Spirit Minion Essence (rare-mod)** | Spectral Spirits | `Triggers Level 20 Spectral Spirits when Equipped` — permanent summon |

### How to model

- **Choir of the Storm = direct precedent for our cast_on_crit composer mode** but *bypasses* the meta-gem
  energy system: it's a true per-crit roll. Modelling: same `triggerMode = 'cast_on_crit'` but with
  `gateMode = 'per_hit'` instead of `gateMode = 'energy_pool'`. **Implementation cost: small.**
- **Corpsewade / movement-paced** is a "distance travelled" trigger — needs a movement-speed integration.
  Real-world rate ≈ `movementSpeed / 1.2 m × cps`. **Implementation cost: small** but niche.
- **Double Vision / Spire of Ire** are **buff-generators not damage-generators** — these belong in
  GlobalMods bucket (b), not as parallel damage. The composer already handles charge-based conditionals;
  Surges would be a new charge type.

---

## Category 5 — On-kill / cascade triggers

| Source | Where | Effect |
|---|---|---|
| **Headhunter** belt | unique | "When you kill a Rare, gain its Modifiers for 60s" — temporary stat-stacking buff. Not a damage instance per se; a massive conditional multiplier source for mapping but ~0 for boss DPS. |
| **Quecholli** maul | unique | "Causes Enemies to Explode on Critical kill for 10% of their Life as Phys" — corpse-explosion damage chain. Doesn't help on bosses; on map clear it adds **chain-clear** but not boss DPS. |
| **Deidbell** helm | unique | "Warcries Explode Corpses for 10% Life as Phys" — warcry-paced corpse explosion. |
| **The Last Lament** | unique | "(10-20)% chance to load a bolt into all Crossbow skills on Kill" — reload-cost reduction effectively, not direct damage. |
| **Beira's Anguish / Nascent Hope** | unique | "(20-25)% chance to gain a Charge when you kill" — charge generators. |
| **`SupportEnergyShieldOnShockKillPlayer`** | `sup_int.lua:6992` | ES recovery on shock-kill; defensive. |
| **Headhunter-style "soul eater"** | not found in PoE2 uniques.json | Doesn't appear to exist in the current PoE2 data set we have. |

### How to model

- On-kill effects are **clear-speed multipliers** but rarely meaningful for the boss-DPS metric we
  optimise. Skip until the optimiser tracks clear-speed separately.
- Quecholli/Deidbell corpse-explosion is a parallel damage source on map clear; **implementation cost:
  large** because it needs a "mob density / cascade" model the composer doesn't have.

---

## Category 6 — Conditional always-on multipliers (the buffs-vs-conditions question)

The composer currently treats "while X" mods as always-on. Searching for the actual condition shape:

- **`while you have N charges`** — Power/Frenzy/Endurance charges are already modelled. Surges (Cold,
  Fire, Chaos) appear in PoE2 uniques (Double Vision, Spire of Ire) as a charge type **we don't model**.
- **`if you've recently Y`** — found in stat descriptions (`recently` is a key string in
  `gem_stat_descriptions.lua`). Examples: "recently killed", "recently used a skill",
  "recently been hit". Treated as always-on by us = upper-bound DPS. Acceptable for now.
- **`during effect of X`** — flask/charm/herald effect conditionals. Already partially modelled
  via herald-buffs; flasks not modelled.
- **`while X is active`** — usually a buff statset; always-on assumption is correct.

### How to model

- **(b) GlobalMods bucket** with a `conditionFlags` set. Mods read those flags; composer can flip
  per-build-mode (DPS-vs-boss assumes "recently killed = false"; DPS-vs-clear assumes it = true).
  **Implementation cost: small** to add the flag infrastructure, **medium** to backfill the parser
  with condition keys.

---

## Category 7 — Surprises (mechanics we hadn't catalogued)

### 7a. There is no Cast When Damage Taken meta-gem

The phrase `cast_when_damage_taken` exists only in:

- `gem_stat_descriptions.lua:8621` — references `cast_when_damage_taken_trigger_threshold_+%` (a modifier
  to a threshold that no actual gem owns)
- `StatDescriptions/Specific_Skill_Stat_Descriptions/valakos_charge.lua` and `valakos_luck.lua` — the
  **Valakos ascendancy** charge unique uses `virtual_cast_when_damage_taken_threshold`. So PoE2's CWDT
  is ascendancy-gated, not a meta-gem you socket. **This is a significant deviation from PoE1 muscle
  memory and should be documented in `docs/poe2-mechanics.md`.**

### 7b. The energy-pool model means trigger rate is a function of cast time

`generic_ongoing_trigger_maximum_energy_is_total_of_socketed_skills` + `1 maximum_energy_per_Xms_total_cast_time` (=10) means the pool size scales with **the sum of socketed
spells' cast times**. A 0.4s Spark socketed in Cast on Crit needs **40 energy** to fill, not a fixed N.
This is **substantively different from our 1:1 spark-per-crit model**. Recommend re-deriving CoC
spark cps from this formula and comparing against the gaobin-comet-trigger baseline before adding new
trigger modes.

### 7c. `trigger_meta_gem_damage_+%_final = -20` is universal across all meta-trigger supports

Every `Support*MetaCastOn*Player` carries this. **All triggered spells take 20% less final damage by
design.** We do not currently apply this; our spark-on-crit headline DPS is therefore overstated by
~25% (1/0.8 - 1).

### 7d. Mortar Cannon (`act_str.lua:13730`) is a totem that uses Grenade skills

This is the only "meta totem that re-uses a different gem family" we found. It implies a general pattern
of meta-skills that re-host other skill types. None of the current composer logic supports totems at all.

### 7e. Mind Goad / Spellslinger is fromItem-granted, not in our uniques data

`MetaSpellslingerPlayer` has `fromItem = true` but the item is not in `uniques.json` — likely a
new-league weapon mod that lives in `item-mods.json` under a name we haven't grepped for, or it's a
runeword/charm. Worth pulling fresh data.

### 7f. Mark consumption damage spike is *not* in skill data we found

The user's question about "Sniper's Mark next-crit-consumes-the-mark for extra damage" doesn't show up
as a distinct skill-data stat key. It is likely encoded inside the mark skill itself as a per-cast
self-buff (one-shot). **This needs a follow-up search on `MarkSnipers*` skill files.**

### 7g. `trigger_frozen_vortex_on_shattering_enemy` exists as a stat key

`gem_stat_descriptions.lua:30762` — there's a hidden "Frozen Vortex on shatter" trigger somewhere, probably
attached to a notable or unique we haven't isolated. Worth chasing.

### 7h. Mirage Archer is a parallel-attacker meta-skill

`MetaMirageArcherPlayer` (`act_dex.lua:4777`) is a tree-granted skill that **spawns a separate attacker
mirroring your bow attacks**. From the composer's perspective this is equivalent to "+100% attacks per
parent attack" against a single target, but the mirage has its own positioning and damage stats.
Effectively a Deadeye-ascendancy DPS multiplier we'd otherwise miss.

---

## Top 5 mechanics ranked by likely DPS impact

For an endgame (lvl 90+, boss-DPS-metric) build context:

### 1. Herald of Ice explosion as parallel damage source — **+20–60% DPS missing**

- **Cost of ignoring:** Anywhere cold-conversion + freeze/shatter pipeline applies (Ice Shot baseline,
  many crit builds), we are off by ~20–60%.
- **Modelling:** (c) parallel damage instance with input = parent attack converted damage, gem-level-scaled
  baseMultiplier, area attack tag.
- **Implementation cost:** medium (~1 day). Composer change is small; the bookkeeping for "parent's
  converted-phys is HoI's base" is the work.

### 2. `trigger_meta_gem_damage_+%_final = -20` on all triggered spells — **-20% triggered-skill DPS**

- **Cost of ignoring:** Every cast-on-crit headline number is overstated by ~25%.
- **Modelling:** (b) GlobalMods bucket, single `moreMul` applied when `triggerMode !== 'direct'`.
- **Implementation cost:** small (~30 min). **Do this first; it's free accuracy.**

### 3. Cast-on-Critical energy model correction — **±10–40% triggered cps**

- **Cost of ignoring:** Our spark-cps is computed as crits/sec; PoB's model is
  `(crits/sec × energy_per_crit) / (sum_of_socketed_cast_times × 10)`. The error direction depends on
  the socketed spell's cast time — bigger spell = fewer triggers than we estimate.
- **Modelling:** (a) refine the existing `cast_on_crit` triggerMode; replace the rate computation.
- **Implementation cost:** small (~1 day) but **needs a baseline build to validate against** —
  `docs/baseline-builds/gaobin-comet-trigger.md` is the natural reference.

### 4. Trigger-mode expansion (Cast on Stun / Block / Ailment / etc.) — **enables new build archetypes**

- **Cost of ignoring:** Entire build archetypes (Cast on Block bonkbuilds, Cast on Ailment ele-stack)
  are unreachable for the optimiser.
- **Modelling:** (a) add 6–10 new TriggerMode variants sharing the energy machinery from #3.
- **Implementation cost:** medium (~2–3 days) once #3 is solid. Per-trigger pacing models for kill/stun
  rates require enemy-side assumptions.

### 5. Choir of the Storm + similar item-granted per-event triggers — **+10–30% DPS for crit builds wearing it**

- **Cost of ignoring:** Choir of the Storm is a top-tier crit amulet that adds a free Lightning Bolt
  per crit. Without modelling, the optimiser will undervalue it and similar items.
- **Modelling:** (a) `triggerMode = 'cast_on_crit'` with `gateMode = 'per_event'` instead of
  `gateMode = 'energy_pool'`. Item parser needs to recognise the "Trigger X on Y" mod shape.
- **Implementation cost:** small once #3+#4 land (~half day for parser + composer wiring).

### Honourable mentions

- **Herald of Thunder storms** (~10–25% DPS on shock builds). Same shape as #1.
- **Mark consumption damage spike** — unknown scale, needs source dig.
- **Frozen Vortex on shatter** trigger (item #7g) — unknown scope.
- **Mirage Archer** — large DPS multiplier on bow Deadeye, but only one ascendancy path.

---

## Implementation order recommended

1. (#2) Apply the `-20% final` triggered-skill mul. Free correctness, no rework.
2. (#3) Re-derive Cast on Crit trigger rate from PoB's energy formula. Validate vs baseline.
3. (#1) Add Herald of Ice as parallel damage source. First true parallel-source pattern; the
   architecture decision unlocks #2 in this list (Heralds of Thunder/Ash) and most of Category 2.
4. (#4) Expand TriggerMode taxonomy once Heralds prove the parallel-source model.
5. (#5) Item-granted per-event triggers (Choir of the Storm class).

Layer-1 of the foundation (valid weapon → skill → support → tree → composition) per
`project_optimizer_goal.md` should stay green throughout — none of this requires rewriting the
validity layers; it's all composer + GlobalMods work.

---

## Open questions for next iteration

- Where does **Mind Goad** (the bow that grants Spellslinger) actually live in our data?
  `fromItem = true` on `MetaSpellslingerPlayer` but no matching entry in `uniques.json`. Possibly
  in a generated file we haven't pulled, or a runeword/socket-mod. **Investigate before promising
  Spellslinger modelling.**
- The `virtual_cast_when_damage_taken_threshold` on `valakos_charge` — what's the actual mechanic?
  Reading `valakos_charge.lua` and the surrounding ascendancy data would tell us whether CWDT is
  an ascendancy buff we should encode separately.
- Does PoB-PoE2 actually compute a different DPS for Herald of Ice (parallel source) and does our
  baseline `gaobin-comet-trigger.md` PoB file include it? If so, comparing our number against the
  PoB number gives an exact "how much we're missing" measurement.
- Sniper's Mark consumption: locate `MarkSnipers*` skill in `act_dex.lua` and check whether the
  "next critical hit consumes the mark for extra damage" is encoded as a stat key or only in mod text.
