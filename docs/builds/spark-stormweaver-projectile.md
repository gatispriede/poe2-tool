# Spark Stormweaver — screen-filling projectile build

> **Status: engine-derived, not ground truth.** This build was synthesized from
> our own dataset and the Skill Lab engine, *not* scraped from a real ladder
> character. It deliberately does not live in `docs/baseline-builds/`, which is
> reserved for real poe.ninja builds used as calibration fixtures. Do not use
> this file to validate the damage model — that would be circular.

**Brief:** a projectile build that fills the screen, self-cast allowed, must
support a lot of movement. Two starting hypotheses were given: (a) Contagion +
Essence Drain chaos DoT, (b) stack elemental and convert to chaos via a ring.

**Data:** PoB commit `9c2bf031` (2026-05-30) — two patches stale as of writing.
**Verification gap:** poe.ninja is unreachable from the build container
(egress-blocked), so this was never cross-checked against what people actually
play. That check is still outstanding.

---

## Verdict on the two hypotheses

### (a) Contagion + Essence Drain — fails the brief

Both skills exist in the dataset and Essence Drain is a 0.8s cast usable while
moving, but ED fires **one** projectile that plants a damage-over-time debuff,
and Contagion is an AoE spread. This is a DoT build with a proliferation
mechanic. It does not fill the screen with projectiles.

### (b) Elemental → chaos conversion — the ring exists, and it is a trap

The item is real:

> **Original Sin** (Amethyst Ring) — *100% of Elemental Damage Converted to
> Chaos Damage*

The reasoning is sound in isolation. Our PoB ground truth
(`src/damage-v2/enemyDefense.ts`) puts a pinnacle boss at **50% elemental / 0%
chaos** resistance, so conversion is a straight doubling.

But 100% conversion makes every lightning-penetration node on the tree inert,
and the tree carries **9 lightning-pen notables totalling 129%**. Penetration
keeps scaling *past* 0% resistance; chaos merely starts there.

| Path | Multiplier vs pinnacle | vs no-pen baseline |
|---|---|---|
| Lightning, no penetration | 0.50 | 1.00x |
| **Original Sin chaos** (penetration dead) | 1.00 | **2.00x** |
| Lightning + 2 pen notables (~33%) | 0.83 | 1.66x |
| Lightning + 4 pen notables (~63%) | 1.13 | **2.26x** |
| Lightning + 5 pen notables (~78%) | 1.28 | 2.56x |

**Lightning overtakes Original Sin at roughly the third penetration notable**,
keeps shock, and leaves the ring slot free. Conversion is a Path of Exile 1
instinct that the PoE2 Sorceress tree punishes.

---

## The build

### Why Spark

Filtered all 184 projectile damage skills in the dataset. Spark is the only
self-cast spell that satisfies every part of the brief:

| Property | Value |
|---|---|
| Projectiles | **13** at max gem level (9 at level 20) |
| Cast time | **0.7s** — Ruzhan's Fury has 20 projectiles but a 2.3s cast |
| `UsableWhileMoving` | **yes** — the movement requirement solved at gem level |
| `Duration` | projectiles persist, travelling erratically along the ground |

The screen fills because projectiles *accumulate* while you move, not because
any single cast is large.

### Ascendancy — Stormweaver (Sorceress)

| Notable | Effect |
|---|---|
| **Shaper of Storms** | All Damage from Hits Contributes to Shock Chance |
| **Strike Twice** | Two shocks on one target simultaneously |
| **Force of Will** | 20% of damage taken from mana before life |
| **Constant Gale** | Permanent Arcane Surge |

*Deadeye* was the other candidate — **Endless Munitions** (*Skills* fire an
additional Projectile, not attack-locked) and **Gathering Winds** (Tailwind on
skill use) both fit — but it starts in the dexterity corner, far from every
lightning and spell cluster. The travel cost is not worth one projectile.

### Skills

| Slot | Gem | Effect (from dataset) |
|---|---|---|
| Main | **Spark** | 13 projectiles, 0.7s, cast while moving |
| | **Multishot** | `+2 projectiles`, `-35% damage` |
| | **Nova Projectiles** | fires the volley in a circle — the 360° fill |
| | **Chain** | `+1 chain`, `-30% damage` |
| | **Rapid Casting** | `+15% cast speed` |
| | **Projectile Acceleration** | `+40% projectile speed` |
| Single-target swap | **Considered Casting** | `+35% spell damage`, `-15% cast speed` (drop Multishot) |
| Utility | **Unleash** | seals casts for burst; `-50%` damage per repeat |

### Passive tree

Computed as a **contiguous allocation from the Sorceress start** using
`src/engine/treeGraph.ts` BFS — these are real node IDs, not a wishlist.

| Notable | Node ID | Marginal points |
|---|---|---|
| Raw Power | 51184 | 4 |
| Overexposure | 52199 | 5 |
| Branching Bolts | 37806 | 6 |
| Storm Surge | 61921 | 6 |
| Overload | 47635 | 11 |
| Hastening Barrier | 44293 | 11 |
| Breath of Lightning | 61338 | 12 |
| Electric Amplification | 55708 | 13 |
| Split Shot | 42302 | 13 |
| Exposed to the Storm | 40990 | 17 |

**Total: 97 passive points.**

**Branching Bolts** (*60% chance for Lightning Skills to Chain an additional
time*) is the single best node in the build. Note it keys off the **Lightning
skill tag**, not damage type — another reason conversion would have been
awkward.

Allocated node list, ready for a PoB `<Spec nodes="…">`:

```
722,1543,1755,1826,2408,4203,4456,4739,4776,5314,5936,6792,8569,8616,8975,9151,
9485,11604,11736,12253,14096,14363,14658,15356,17088,17420,18407,18651,18815,
18845,21746,22419,22439,24647,24958,25101,25557,25565,26598,27785,29009,29763,
30555,31765,32701,33245,33463,34058,35696,35896,36293,37806,38215,39037,39423,
39886,40990,41029,41877,41965,42302,42736,43691,44293,44871,46034,46157,46819,
47555,47635,49046,49512,49996,51184,51741,52199,53207,53266,53560,53960,55668,
55708,56045,56216,56935,57710,57821,59362,59376,60685,61196,61338,61419,61834,
61921,62677,63863
```

### Jewels

17 jewel sockets exist on the tree. Only 7 unique jewels are in the dataset and
most do not fit, so the honest answer is **rare jewels** rolling increased
Lightning Damage / Spell Damage / Projectile Damage / Cast Speed.

Two worth knowing:
- **Grand Spectrum** (limit 3) — `+6% to all Elemental Resistances` per socketed
  copy. Resistance-capping filler.
- **The Adorned** (limit 1) — `(0-150)% increased Effect of Jewel Socket Passive
  Skills`. Enables a magic-jewel build; expensive.

### Gear

Mods below were all verified present in `src/data/generated/item-mods.json`.

| Slot | Priority |
|---|---|
| **Weapon** (wand / sceptre) | `+7 to Level of all Lightning Spell Skills` (*of Thunder*, ilvl 81) — the largest single damage mod found; `(209-238)% increased Spell Damage` (*Runic*, ilvl 80) |
| **Amulet** | levels to Lightning Spell Skills, cast speed, critical hit chance |
| **Rings ×2** | `(209-238)% increased Lightning Damage` (*Electromancer's*), added lightning to spells, resistances — **not Original Sin** |
| **Body armour** | energy shield + life, spell damage |
| **Boots** | **movement speed is mandatory** at this playstyle — 30%+ |
| **Gloves / Helmet** | cast speed (*of Finesse*, `50-52%`), projectile damage, resistances |
| **Belt** | life, resistances, flask charges |

---

## Open items

1. **Cross-check against poe.ninja.** Never done — the container cannot reach
   it. Compare against top Forbidden Rites Sorceress builds before trusting any
   of this.
2. **Re-sync the dataset.** `npm run sync-data`. The current data predates 0.5.4
   and 0.5.5; Spark's numbers, the penetration notables and Original Sin may all
   have moved.
3. **Emit a PoB code.** `src/components/Explorer/pob2Export.ts` already
   serializes a `GeneratedBuild` to PoB2 import XML and the base64-deflate build
   code. The tree half is done (node list above); what remains is assembling the
   `ParsedBuild` — gem list and item set — and feeding it through
   `buildPob2Xml`.
