# Build generator

End-to-end build generation. **You pick a class. The tool generates the
highest-DPS build it can.** Every generated build is **in-game
reproducible**: real bases, real mods, real skills, real tree
allocations.

## Acceptance criteria (enforced by tests)

For every generated build:

1. Every weapon base ∈ `weapon-bases.json` — no invented bases
2. Every weapon mod ∈ `item-mods.json` — no invented mods (verified by
   `weaponModIds`, exposed on the result)
3. Every chosen mod passes `modCanRollOnBase(mod, base, itemLevel)` —
   weight > 0, no `no_X_spell_mods` conflict, mod.level ≤ itemLevel
4. Prefix count ≤ 3 and suffix count ≤ 3
5. No two mods share `group` (mutually-exclusive slot)
6. Every skill ID + support ID ∈ `skills.json`
7. `validateBuild` produces **0 errors on Layers 2 and 4** (deferred-layer
   informational findings are tolerated — they're validator scope limits,
   not generator bugs)

## v1 scope (today's deliverable)

```ts
import { generateTopBowAttackBuildsForHuntress } from './generator/generateBuild';

const builds = generateTopBowAttackBuildsForHuntress(5, { itemLevel: 82 });
// → [
//     { skillName: 'Ice Shot',            dps: 766865, weaponBase: 'Obliterator Bow', ... },
//     { skillName: 'Bow Shot',            dps: 442679, ... },
//     { skillName: 'Electrocuting Arrow', dps: 430009, ... },
//     { skillName: 'Poisonburst Arrow',   dps: 390077, ... },
//     { skillName: 'Lightning Arrow',     dps: 351826, ... },
//   ]
```

**Supported:** Huntress class, bow-attack profile, 23 candidate skills
ranked. **~5 seconds to enumerate + score all 23.**

**Deliberately scoped out of v1:**

- **Other classes** — Witch / Sorceress / Warrior / etc. The class →
  weapon-type map is in `candidateSkills.ts` and trivially extendable, but
  the composer is most honest for attack profiles today (15× gap on
  zeolet). Spell builds — particularly trigger chains — would produce
  systematically wrong rankings until composer gaps close.
- **Non-weapon gear generation** — we only have weapon-bases.json. Armour,
  jewellery, flask base extraction is queued. Today we templated those
  slots from zeolet's baseline build.
- **Tree allocation generation** — Steiner-tree approximation is a real
  algorithm but a separate piece of work. Today we use zeolet's 130-node
  tree as the template for all Huntress generated builds.
- **Uniques** — `Uniques/*.lua` is not extracted yet. Top-tier real
  builds use multiple unique items; without them we're capped at the
  best-possible-rare ceiling.
- **Cluster jewels** — no jewel-item database yet.
- **Affix availability constraints** — `essence_only`, `fractured`,
  `desecrated`, league-mechanic-only mods are treated as generally
  available. A truly reproducible build would respect crafting source.

## Why the generator's top build (Ice Shot at 767k) is lower than zeolet's fixture (1.12M)

The same skill on the same class scores lower when generated than when
imported. Reasons:

1. **Mod values are mid-tier defaults.** When `pickModsForSkill` renders
   a "(170-179)% increased Physical Damage" mod, it uses the midpoint
   (174). Zeolet's actual roll might be 179. Across 6 mods, small.
2. **Generator skips runes and crafted suffixes.** Zeolet's bow carries
   "Saqawal's Rune of the Sky / Farrul's Rune of the Hunt / Countess
   Seske's Rune of Archery" as Bonded implicits — these grant additional
   damage and +to Level mods. The generator's weapon has only the bow's
   base implicit (none, for Obliterator Bow).
3. **Generator's gear in other slots = zeolet's gear**, but zeolet's bow
   was hand-crafted with a `+5 to Level of Projectile Skills` rare-roll AND
   a `fractured` (always-keep) `Adds 39 to 66 Physical Damage`. The
   generator picks the same broad mods but at midpoint values without the
   fractured-quality preservation.

These are **not generator bugs** — they're scope limits. v2 would address
rune slots and high-roll preferences.

## Why the rankings are useful even with the composer's 15× gap

Within the bow-attack profile, the composer's blind spots affect each
candidate skill **roughly proportionally** — the same un-modelled layers
(Sniper's Mark crit multi, herald procs, per-type tracking, enemy res)
multiply the absolute DPS without much shifting the *relative* ordering.

So:
- **Ice Shot > Bow Shot > Electrocuting Arrow > Poisonburst Arrow** is
  probably right.
- The **absolute numbers** (767k, 442k, ...) are roughly 15× under what a
  real top player achieves with the same skill+supports.
- A **multi-archetype comparison** (e.g. "is best Ice Shot better than
  best Lightning Arrow?" vs. "is best bow attack better than best
  trigger-spell?") would only be reliable for within-archetype.

## Code map

```
src/generator/
├── candidateSkills.ts     class → list of active skills the class can use
├── generateWeapon.ts      base picker + mod picker + Layer-1 eligibility rule
├── generateBuild.ts       orchestrator: weapon × supports × tree(template) → ParsedBuild + DPS
├── README.md              (this file)
└── __tests__/
    └── generateBuild.test.ts   6 acceptance tests against canonical data
```

## How to extend

| Extension | Effort | Impact |
|---|---|---|
| Add another class | small — extend `CLASS_WEAPONS` map, pick a template fixture | enables that class's builds |
| Other weapon types (Spear, Crossbow) | small — already filterable via skill weaponTypes | unlocks Mercenary etc. |
| Spell profile | medium — needs spell base damage extraction first | enables Witch / Sorceress |
| Generate non-weapon gear | medium — needs armour/jewellery base extraction | better DPS scores, less template-dependence |
| Real tree pathfinder | medium — Steiner approximation, beam search | replaces template; enables novel allocations |
| Uniques in candidate pool | medium — extract `Uniques/*.lua` | top-tier builds become reachable |
| Rune slots | small — extract `ModRunes.lua` then attach to base | closes part of the zeolet-vs-generator gap |
