# PoB ground truth — enemy stats, damage pipeline, modifier priorities

Captured from Path of Building (PoE2) screenshots of a real Lv97 Amazon Ice
Shot build (PoB Total = **1,128,141 DPS**, the `DLtydZs_Mos6` fixture). These
are the authoritative numbers our composer calibrates against. When our model
disagrees with PoB, our model is wrong.

---

## 1. Skill ↔ weapon eligibility (a VALIDITY rule, enforced before DPS)

PoE2 restricts which weapon a skill can be used with. A build that violates
this can't exist, so it's a layer-1 validity gate (`skillWeaponRules.ts`),
enforced in the composer BEFORE any damage is computed — it throws rather than
emit a fantasy number.

- **Bow skills require a Bow.** Ice Shot / Lightning Arrow carry
  `weaponTypes:["Bow"]` in the data — authoritative. Not usable with anything
  else.
- **Spells cannot be cast with a Bow or Crossbow.** Spells carry empty
  `weaponTypes` (no data restriction) but in game you cannot cast while
  wielding a ranged-attack two-hander. Bow confirmed by the user; Crossbow
  assumed identical (same family) — **verify**.
- Spells work with wands / sceptres / staves / foci, and with melee weapons.
- Generic attacks with no `weaponTypes` are unrestricted.

Caster weapons (wand/sceptre/caster-staff) have NO base attack damage
(`weapon:null`) — correct PoE2 design. A spell's base comes from the gem; the
weapon is a stat-stick (see §3).

---

## 2. Enemy stats — typical endgame boss (PoB defaults)

PoB's default **Guardian/Pinnacle Boss** at **level 82**:

| Stat | Value |
|---|---|
| Fire / Cold / Lightning Resistance | **50%** each |
| Chaos Resistance | **0%** |
| Max resistance cap | **75%** (the CAP, not the value) |
| Armour | 8,063 |
| Evasion | 1,175 |
| Phys. Damage Reduction | (from armour, hit-size dependent) |
| Attack/cast time | 700 ms |
| Crit chance / multi | 5% / 30% |

**Key correction:** boss elemental resistance is **50%, not 75%**. 75% is only
the cap that pen/exposure work against. Our `ENEMY_PROFILES.pinnacle` was
75% — fixed to 50% / 0% chaos. There is also a separate **player**
"Elemental Resistance penalty: Endgame (−60%)" (your own res in maps) — that's
a defence stat, irrelevant to outgoing DPS.

Implication for the damage model (`enemyDefense.ts`):
- **Chaos = full force** (0% res at every tier).
- **Elemental into a pinnacle = ×0.50** before penetration/shock.
- This is why penetration is the top sensitivity lever on elemental builds: a
  smaller hit with pen out-lands a bigger resisted hit.

---

## 3. PoB damage pipeline (panel-by-panel, Ice Shot @ 1.13M)

PoB's "View Skill Details" decomposes the hit exactly as our composer does.
Mapping their panels → our buckets:

### Skill Hit Damage (per damage type, then combined)
- **Added Min/Max** per type — flat added damage, sourced from GEAR not the
  weapon base (see Added-damage sources below). Ice Shot example totals:
  Phys 21–36, Lightning 8–355, Cold 32–50, Fire 131–207.
- **MH Total Increased** — the additive `% increased` bucket, *per type*:
  All 237%, Lightning/Cold/Fire 132% each, Phys 0%. (Our `increasedDamagePct`,
  but PoB tracks it per element — we collapse to one, a known approximation.)
- **MH Total More** — multiplicative: All 20%, elements +25% each.
- **MH Eff. DPS Mod** — **this is where enemy resistance + shock + penetration
  live.** Phys ×0.765 (armour mitigation ≈ 24%), elements ×1.5. The ×1.5 (>1
  despite 50% res!) = base ×0.5 res, pushed to ≈ ×1.15 by penetration, then
  ×1.3 from shock → ≈ ×1.5. **PoB "Effective DPS" already bakes in res, pen,
  exposure, and shock.** (We model res + pen; shock-as-more-damage is a gap.)
- **MH Average Hit** = 527,563. **Skill DPS** = avg hit × rate = 1,128,141.

### Attack/Cast Rate: 2.14/s
- MH Inc. Att. Speed **98%**, MH More 0%, base × (1+0.98) → 2.14/s, attack
  time 0.47s. Confirms our rate model (base APS × (1 + increased) × more).

### Crits: 71.22% × 9.74
- MH Inc. Crit Chance **367%** → MH Crit Chance **71.22%**.
- MH Crit Multiplier **×9.74** (i.e. +874% bonus — far beyond our default
  base. PoE2 crit multi stacks much higher than the +100% base we assume; a
  real crit build reaches ~10×).
- MH Crit Effect Mod **×7.224** = `1 + critChance×(critMul−1)` =
  1 + 0.7122×8.74 = 7.22. **Our `expectedCritMultiplier` formula is exactly
  right** — only the input magnitudes (crit multi ceiling) need widening.

### Ailments
- **Ignite 66% / 15,578 DPS / 4s**, "Effective DPS Mod ×0.5" (ignite deals
  50% of the base hit as fire DoT over time). A separate DoT stream PoB adds to
  Total — we don't model ignite DPS yet.
- Non-damaging: Chill ×2.34, **Shock ×1.3** (enemy takes 30% more — folded into
  the elemental Eff DPS Mod), Freeze Buildup 19.2%.

---

## 4. Added-damage sources (the "base" the user reads first)

For an ATTACK, flat added damage comes from GEAR (rings / amulet / quiver /
gloves / belt), per element, tagged "Attack". PoB lists each source:

- **Fire added** (Max 207): Rift Gyre (Topaz Ring) 37, Havoc Coil (Breach Ring)
  30, Fate Brand (Visceral Quiver) 29, 79% Quiver Bonus Effect 22, Rune Fingers
  (Blacksteel Gauntlets) 13.

This is why a bow build still scales heavily off elemental added-damage rolls
on jewellery — the converted phys base is only part of the hit. Our composer
aggregates these via `addedFlatToAttacksAvg` (currently collapsed across types).

---

## 5. The user's modifier-priority mental model (drives gear/tree choices)

What the user reads off PoB, in order:
1. **Base damage** — gem base (spell) or weapon→skill % (attack).
2. **Weapon / gear added damage** — flat per type.
3. **Attack/cast speed** — the rate multiplier.
4. **Crit multiplier** — set the ceiling.
5. **Then push crit chance as high as possible** — because Crit Effect Mod
   `= 1 + chance×(multi−1)` scales with chance once multi is high.

This matches our sensitivity analyzer (`sensitivity.ts`): MORE > everything,
then the partner pairs (crit chance↔multi, flat↔increased), and PENETRATION
tops the list on a resisted elemental build.

---

## 6. Calibration reconciliation (DLtydZs Ice Shot)

| Quantity | Value |
|---|---|
| PoB Total (Effective DPS, pinnacle 50% res, w/ pen+shock+ignite) | 1,128,141 |
| Our `rawDps` (no enemy defence, w/ shard cone) | ~652,900 |
| Ratio | ~0.58× |

The remaining gap is now **named**, not mysterious:
- **Shock as "more damage taken" (×1.3)** — not modelled. ~+30%.
- **The build's own penetration** pushing elemental Eff Mod above 1.0 — we have
  the mechanism (`penetration`) but the fixture's pen mods aren't all parsed.
- **Ignite DoT stream** (~15.6k DPS) — folded into PoB Total, not into ours.
- **Per-type increased** — PoB scales each element separately; we collapse.

The core engine (flat → increased → more → crit → rate → resistance) is sound
and matches PoB panel-for-panel. Remaining work is additive layers, not a
rewrite.

---

## 7. Discovery engine — archetype commitment (what blocks new builds)

The generator now explores two axes per skill and keeps the highest composed
DPS: **allocation strategy** (greedy / steiner) × **scaling bias**
(balanced / crit / ailment), in `generateBuild.ts`. The bias makes a build
COMMIT to an archetype — `synthesizeTree`'s `nodeScore` and `generateWeapon`'s
`modScore` both take the bias — so a committed crit or ailment build can beat
the generic one and surface as a new build.

Verified outcome (Huntress, Lv84):
- **Ailment commitment works:** Poisonburst Arrow rose 270k → 302k (+12%) via
  the committed ailment tree + ailment gear. Balanced builds are byte-identical
  to before (no regression — the balanced path adds 0 from any bias).
- **Crit commitment does NOT yet crack crit.** Forcing crit bias leaves crit
  chance stuck at ~156% increased (≈ critX 1.26) on both greedy AND steiner —
  the tree allocator has a crit ceiling. Boosting crit node scores doesn't
  redirect it, because the crit clusters aren't reachable from the class start
  within the damage budget, and the real meta's crit comes heavily from
  **conditional-crit nodes** ("Critical vs Blinded", "Distracted Target") and
  **jewels** we don't allocate/model.

Root cause (the real discovery blocker): **heuristic scoring can't capture
contextual value.** Crit multiplier's worth depends on crit chance;
penetration's on enemy resistance; flat's on the increased pool. A keyword
score table can't know this. The correct tool is the **sensitivity analyzer**
(`sensitivity.ts`) — compose-based marginal value — driving node/mod selection
instead of keyword weights. That's the next unlock:

1. **Sensitivity-driven allocation** — score each candidate node/mod by its
   actual ΔDPS on the current partial build (compose-in-the-loop), not keywords.
   This makes crit chance auto-prioritise until crit multi pays, then crit multi
   — the real crit-build feedback loop.
2. **Jewel + conditional-crit modelling** — allocate jewel sockets and credit
   conditional crit so the allocator can reach the 367%-crit the meta uses.
3. **Cross-archetype trigger discovery** — the archetype map's open questions
   (bow-crit → Cast-on-Crit spell payload) need the generator to try
   trigger-mode combos across skill × weapon, not just same-family skills.

Composer crit math is already correct (verified: ×4.6 on the real imported
build vs PoB ×7.2, within the calibration band) — the gap is purely the
generator not BUILDING crit, which is an allocation/scoring problem, not a
damage-engine one.

## 8. Open modelling gaps (priority order)

1. ~~**Shock as more-damage-taken**~~ — **DONE (v16).** A build that deals
   lightning (or carries "damage can Shock" / Voltaxic's "Chaos … Contributes
   to Shock Chance") now applies +20% shock more-damage on the RAMPED hit,
   scaled by shock reliability per tier (boss 0.8, pinnacle 0.6, white 1.0) via
   the existing ailment-conditional machinery. Verified: Lightning Spear boss
   345k→400k ramped, white 575k→690k. Base 20% is the PoE2 floor; shock-effect
   scaling (PoB showed ×1.3) is the remaining refinement.
2. **Per-type damage tracking** — resist each element of a gain-as-extra hit
   separately; scale increased per type. Currently dominant-type only.
3. **Ignite / DoT streams** as a second DPS contribution.
4. **Crit-multi ceiling** — widen to the ~10× PoB reaches.
5. **Armour-based phys mitigation** (hit-size dependent) instead of a flat
   physReduction fraction.
6. **Accuracy vs enemy evasion** — we assume 100% hit chance.
