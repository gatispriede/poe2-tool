# Damage calc coverage

What `src/damage-v2/composeDamage.ts` currently models and what it doesn't,
mapped against the [Mobalytics 8-step pipeline](https://mobalytics.gg/poe-2/guides/damage-defence-calc-order)
encoded in [validity-model.md](validity-model.md) Layer 5.

Legend: ✅ implemented · ⚠️ partial · ❌ not yet · ⛔ deferred indefinitely

Last updated: **v8** (zeolet Ice Shot → 1,485,000 DPS, gap **11.4×** vs poe.ninja's 17M)

---

## Step 1 — Avoidance (attacker-side roll)

| Item | Status | Notes |
|---|---|---|
| Player attack avoided by enemy evasion/dodge | ❌ | enemy-side; not on the path to DPS output |

---

## Step 2 — Damage calculation

### 2.1 Flat damage

| Item | Status | Notes |
|---|---|---|
| Weapon base damage from `weapon-bases.json` | ✅ | physical only for now; elemental-base weapons untested |
| Weapon-local "Adds N to M Physical Damage" | ✅ | parsed from item explicit text |
| Weapon-local "% increased Physical Damage" | ✅ | summed with quality % into one local bucket |
| Quality % on weapon | ✅ | folded into the local phys-damage bucket |
| Gear-global "Adds N to M <type> Damage to Attacks" | ✅ | rings/gloves/quiver/amulet/jewels |
| Skill's `baseMultiplier` at effective gem level | ✅ | reads `skills.json` per-level table |
| `+N to Level of <X> Skills` gem-level shift | ✅ | filtered by skill tags; handles "all Skills" and tag-specific forms |
| Per-damage-type flat damage tracking | ⚠️ | currently sums all flat into one number; "increased Cold Damage" globally scales the phys portion too — over-counts |
| Spell base damage from gem's own `statSets[].levels[]` table | ❌ | needed for Comet, Arc, Spark — every spell |
| Tree-node added flat (e.g. "+5 to Physical Damage" notables) | ❌ | aggregator skips addedFlat from tree (only counts increased/more there) |

### 2.2 Conversion & Gain-as-Extra

| Item | Status | Notes |
|---|---|---|
| Skill-type conversion (e.g. Ice Shot's phys → cold) | ❌ | first 2.2 step in the pipeline; significant for cold/fire attack skills |
| Secondary conversion from tree/gear/buffs | ❌ | |
| "Gain X% as Extra <type>" (single type) | ✅ | v5; sums into one `extraDamagePct` bucket |
| "Gain X% as Extra Damage of all Elements" | ✅ | v5; counted as 3× X (fire+cold+lightning) |
| Per-type scaling of extra damage | ⚠️ | extras currently scale uniformly with the perHit value, ignoring that "increased Cold" should only scale the cold portion |
| Global gain-as-extra mods that sit on the weapon | ✅ | v5; whitelisted shape — bow rune's "5% as Extra all Elements" was missed in v4 |
| Conversion capping at 100% per source type | ❌ | depends on conversion being implemented |

### 2.3 Multipliers

| Item | Status | Notes |
|---|---|---|
| Sum of "% increased <thing> Damage" (additive) | ✅ | type-filtered against skill tags |
| Sum of "% reduced" | ✅ | negative entries in the same bucket |
| Product of "% more" (multiplicative) | ✅ | kept as a list, multiplied in |
| Product of "% less" | ✅ | negative entries in the more list |
| "Damage with Hits / Attacks / Spells" filter | ✅ | branches on skill profile |
| "Damage with <Tag> Skills" filter (e.g. "with Bow Skills") | ✅ | matches tag against skill.skillTypes |
| "Damage while affected by Herald X" buff conditional | ✅ | v6; "while" no longer in the damage-clause exclude list |
| "Damage against Rare or Unique" target conditional | ✅ | v6; works from gear (via gear aggregator) and from weapon (via global whitelist) |
| Positional/range conditions ("within Nm") | ⚠️ | always rejected — under-counts |
| Time-windowed conditions ("for N seconds after", "during X") | ⚠️ | currently rejected — under-counts |

### 2.4 Crit

| Item | Status | Notes |
|---|---|---|
| Weapon base crit chance | ✅ | |
| Weapon-local "+X% to Critical Hit Chance" | ✅ | |
| Tree/gear "% increased Critical Hit Chance" | ✅ | filtered for-Attacks/for-Spells |
| Tree/gear "% increased Critical Damage Bonus" / "Crit Multi" | ✅ | additive in v4 |
| Support gem "MORE Crit Multi" (e.g. Overextend +30% final) | ⚠️ | currently treated as additive; multi-source case under-approximates |
| Crit chance cap mods (e.g. Garukhan's Resolve sets max 50%) | ❌ | composer doesn't clamp; can over-shoot when chance > cap |
| Defender's crit damage reduction | ⛔ | enemy-side; deferred |
| Crit-conditional damage mods ("on Critical Strike, deal X") | ❌ | |

### 2.5 Damage roll

| Item | Status | Notes |
|---|---|---|
| Average of min/max | ✅ | composer returns average DPS |
| Min/max DPS view | ❌ | needs propagating min/max separately |
| Lucky / Unlucky | ❌ | rare modifiers; small impact |

### 2.6 Double / Triple Damage

| Item | Status | Notes |
|---|---|---|
| Double Damage chance | ❌ | rare modifier; can be 1.2-1.5× when present |
| Triple Damage chance | ❌ | overrides Double per pipeline spec |

---

## Step 3 — Damage Taken As (defender's perspective)

| Item | Status | Notes |
|---|---|---|
| Damage-type shifting on incoming hits | ❌ | enemy-side; not on DPS path |
| Damaging ailment magnitude (pre-mitigation) | ❌ | needed for poison/ignite/bleed DPS |

---

## Step 4 — Mitigation (enemy defences)

| Item | Status | Notes |
|---|---|---|
| Enemy resistances | ❌ | **currently assumes 0% res** — over-estimates by 1.5-4× depending on boss |
| Penetration mods on player side | ❌ | reduces effective enemy res |
| "Resistance negation" supports (e.g. Rakiata's Flow) | ❌ | Rakiata's "100% chance to negate elemental res on hit" = ~3-4× vs typical 75%-res boss |
| Enemy armour (vs phys) | ❌ | |
| Resistance cap (90%) | ❌ | |

---

## Step 5 — Damage Taken Modifiers

| Item | Status | Notes |
|---|---|---|
| Flat damage taken | ❌ | post-mitigation buff/debuff on the defender |
| % increased/reduced damage taken | ❌ | "Marks" do this; very impactful for boss DPS |
| % more/less damage taken | ❌ | |

---

## Step 6 — Stun

⛔ Defensive only; not part of damage-output calc.

---

## Step 7 — Block

⛔ Defensive only; not part of damage-output calc.

---

## Step 8 — Resources & Non-damaging ailment magnitude

| Item | Status | Notes |
|---|---|---|
| ES → mana → life depletion | ❌ | EHP / survivability calculations, separate from DPS |
| Shock magnitude (post-mitigation) | ❌ | affects DPS as a debuff on the enemy |
| Freeze / Chill threshold | ❌ | Ice Shot freezes; matters for clear speed but not raw DPS |

---

## Adjacent mechanics (not in the Mobalytics pipeline but on the DPS path)

### Attack/cast rate

| Item | Status | Notes |
|---|---|---|
| Weapon base APS | ✅ | |
| Weapon-local "% increased Attack Speed" | ✅ | |
| Skill's `attackSpeedMultiplier` (e.g. Ice Shot -10%) | ✅ | |
| Tree/gear "% increased Attack Speed" | ✅ | filtered for Attack |
| Tree/gear "% increased Cast Speed" | ✅ | filtered for Spell |
| Support gem `_attack_speed_+%_final` (MORE attack speed) | ✅ | |
| Frenzy charges (typical: 4% more attack/cast speed per charge) | ❌ | each fixture shows 3/3/3 charges but composer doesn't read |

### Support gem effects (v4)

| Item | Status | Notes |
|---|---|---|
| `_damage_+%_final` (MORE damage) | ✅ | bucketed multiplicatively |
| `_damage_+%` (INCREASED damage) | ✅ | bucketed additively |
| `_attack_speed_+%_final` / `_+%` | ✅ | |
| `_critical_strike_multiplier_+%_final` / `_+%` | ⚠️ | treated as additive — fine for one source, slightly off when multiple |
| `_critical_strike_chance_+%_final` / `_+%` | ⚠️ | same |
| Weapon-set conditional (`_in_weapon_set_one/two`) | ✅ | filtered by `useSecondWeaponSet` from the parsed build |
| Conditional supports (only active in certain states) | ❌ | most skipped — surfaced in `support stats skipped` note |
| Enemy-side effects (Rakiata res-negation, etc.) | ❌ | see Step 4 |
| Cap-setting effects (Garukhan max crit) | ❌ | needs cap logic |

### Charges, marks, heralds, auras

| Item | Status | Notes |
|---|---|---|
| Power charges (typical: +40% increased crit chance per stack) | ✅ | v6; assumes max stacks (3); Ascendancy modifications not yet |
| Frenzy charges (4% more attack/cast speed per stack) | ✅ | v6; assumes max stacks (3) |
| Endurance charges (defensive — phys reduction, elem res) | ⛔ | offence-irrelevant |
| Freezing Mark — "damage gained as cold" against marked enemy | ✅ | v7; applied via active-skill constantStats walker |
| Sniper's Mark — additional crit multi vs marked enemy | ✅ | v8; extracted statSets[].levels[] per-level data, mapped `enemy_additional_critical_strike_multiplier` to crit-multi bucket |
| `total_attack_time_+_ms` (skill-imposed attack-time penalty) | ✅ | v8; converts APS → ms, adds delay, converts back. Catches Escape Shot's 700ms and Leap Slam's leap animation. |
| Skill self-modifiers (Ice Shot's hit-freeze multiplier `+25% final`) | ✅ | v7; conditional on freeze landing, assumed active for sustained DPS |
| Herald procs (Herald of Ice on shatter, Herald of Thunder on shock) | ❌ | adds parallel hit damage |
| Aura effects (Mana Tempest, Wind Dancer) | ❌ | Wind Dancer is mostly defensive; Mana Tempest can boost spell damage |

### Skill sub-mechanics

| Item | Status | Notes |
|---|---|---|
| Ailment damage scaling (poison/ignite/bleed) | ❌ | different optimization profile entirely; see `poe2-mechanics.md` |
| Skill secondary hits (Ice Shot's cone of shards after hit) | ❌ | many skills have a primary + secondary hit; we only model primary |
| Projectile multipliers (additional arrows, pierce, chain, fork) | ❌ | each adds multiplicatively to effective output vs groups |
| Skill duration / repeats / unleashed seals | ❌ | |

### Trigger chains

| Item | Status | Notes |
|---|---|---|
| "Cast on Critical" → triggered skill damage | ⚠️ | v9; `triggerMode: 'cast_on_crit'` in composer replaces hits/sec with a 6-trigger/sec cap. Doesn't yet simulate the trigger source (Spark) to compute actual achievable trigger rate. |
| Trigger frequency = source cast rate × condition probability | ❌ | v9 uses a flat 6/sec cap approximation; real frequency = min(source_cast_rate × crit_chance, cooldown_cap). For tuned-Spark Witch builds 6/sec is close to ceiling, for slower source skills it over-estimates. |
| "Spellslinger" weapon-trigger (Mind Goad bow on Gaobin) | ❌ | similar architecture; not modelled |
| Generator picks best trigger mode per skill | ✅ | v9; Witch generator scores both direct & cast_on_crit modes, picks higher |

---

## Coverage summary

By Mobalytics step (post-v7):

- **Step 1 (avoidance)**: 0/1 — doesn't affect output DPS
- **Step 2.1 (flat)**: 7/10 covered
- **Step 2.2 (conversion + extras)**: 4/6 — extras + skill self-buffs ✅, true per-type conversion still missing
- **Step 2.3 (multipliers)**: 6/7 — most "while" / "vs Rare-Unique" conditionals now counted; active-skill MORE multipliers (freeze multi) also caught
- **Step 2.4 (crit)**: 4/7 — caps + MORE-multi accuracy still partial
- **Step 2.5 (roll)**: 1/3 — average-only
- **Step 2.6 (double/triple)**: 0/2 — not yet
- **Steps 3-8 (enemy/defensive)**: largely deferred for offence calc

Iteration history:

| v | DPS | gap | new in this version |
|---|------|-----|---|
| v1 | 7,160 | 2,374× | weapon-local only |
| v2 | 51,892 | 327× | tree node stats |
| v3 | 167,401 | 102× | gear globals + added flat |
| v4 | 287,626 | 59× | support gem effects |
| v5 | 396,923 | 42.8× | gain-as-extra (Hyrri's Ire + bow rune) |
| v6 | 733,800 | 23.2× | while-conditionals + vs Rare/Unique + Power/Frenzy charges |
| v7 | 1,116,652 | 15.2× | active-skill buffs (Ice Shot freeze multi, Freezing Mark gain-as-cold); crossed 1M |
| v8 | 1,485,000 | 11.4× | Sniper's Mark per-level crit multi (+53% addedCritMultiplierPct) + total_attack_time_+_ms recognition |
| **v9** | _Huntress unchanged_; **Witch direct-cast Comet → CoC mode = 2-3×** | n/a (different fixture) | spell base damage extraction + Witch class + cast_on_crit trigger mode (6 triggers/sec cap). Witch top: His Foul Emergence 1.6M via CoC. |
| **v10** | zeolet 1.496M (unchanged); **Witch Comet 2.88M → 26.43M (9.2×)**; Witch top: His Foul Emergence 36.66M via CoC | zeolet gap unchanged 11.4×; Witch Comet vs Gaobin 180M CoC = 6.8× | Spell Cascade castMultiplier bucket (+2.1× per cascading spell); RPN evaluation of `requireSkillTypes` (unblocks Elemental Focus / Concentrated Area on spells); SupportMeta* exclusion from support pool (eliminates false-positive trigger gems); Archmage + max-mana aggregator (+~15% per 100 mana of gain-as-lightning); Eldritch Battery + ES aggregator (ES→Mana boost ~3× pool); Voltaic Mark electrocute multiplier (+35% increased dmg conditional on electrocuted). Tree synth gained `requiredNodeIds` to anchor EB on spell builds. Generator now injects Archmage + Voltaic Mark groups for non-channelled spells. |

By impact (rough estimates, multiplicative on remaining 15.2× gap):

| Adding | Expected DPS impact |
|--------|---------------------|
| Sniper's Mark per-level crit-multi vs marked enemy | 1.5–2× (sizeable; per-level stat not yet extracted) |
| Herald direct proc damage (Herald of Ice on shatter) | 1.2–1.5× as parallel damage source |
| Wind Dancer / aura player buffs | 1.1–1.3× |
| Skill conversion already mostly counted via "gain-as" approximation | small (often a wash) |
| Per-type tracking refinement | usually a wash |
| Enemy resistance baseline (Rakiata negates it for zeolet) | likely no change for this fixture |

Compounding mid-estimates: ~1.75 × 1.35 × 1.2 = 2.8×. Times current 1.12M = 3.1M. Still under 17M, so either (a) some multipliers are bigger than estimated, (b) PoE2 ailment magnitude (Freeze→Shatter→Herald cascade) compounds bigger than per-skill numbers suggest, or (c) poe.ninja's 17M figure is the "best case vs flat-armour boss" not a sustained-target average. We'll find out as each remaining layer is added.

---

## Where each input is read

| Input | Source file | Code path |
|---|---|---|
| Weapon base damage | `src/data/generated/weapon-bases.json` | `composeDamage.ts` → `weaponBasesByName` |
| Item mods (text) | parsed from PoB build code | `ParsedBuild.equipped[slot].implicits/explicits` |
| Skill per-level table | `src/data/generated/skills.json` | `composeDamage.ts` → `skillsById[id].levels` |
| Skill tags | same | `skillsById[id].skillTypes` |
| Support `constantStats` | same | `applySupportMods.ts` |
| Tree node stats | `src/data/generated/passive-tree.json` | `aggregateMods.ts` → `aggregateTreeMods` |
| Tree node positions (for jewel radii — not used yet) | same | `aggregateMods.ts` (queued) |
| Allocated tree nodes | parsed PoB | `ParsedBuild.trees[0].nodes` |
| `useSecondWeaponSet` (for set-conditional support effects) | parsed PoB | `ParsedBuild.build.useSecondWeaponSet` |
