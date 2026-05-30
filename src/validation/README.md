# Build validation

Implements the five validity layers from
[../../docs/validity-model.md](../../docs/validity-model.md). Top-level entry:

```ts
import { validateBuild } from './validation';

const result = validateBuild(parsedBuild);
// result.valid: boolean
// result.errors: Array<{ layer, kind, message, context? }>
```

## What's enforced today

| Layer | What | Status |
|-------|------|--------|
| 1 | Equipped item prefix/suffix counts | **partial** (heuristic cap by rarity; ignores desecrated/enchanted mod categories) |
| 2 | Every gem's `skillId` is in our skill database | **strict** (placeholders surfaced as a distinct kind) |
| 3 | Support gems' require/exclude tags match an active skill in the group + gemFamily uniqueness | **conservative** (no tag accretion yet) |
| 4 | All allocated tree nodes reachable from class start (and from each allocated ascendancy start) | **strict, but does not yet model "select-grant" jewels or item-granted points** |
| 5 | Every stat line on equipped items classifies into a known keyword bucket | **strict, fail-closed** |

## Verified against baseline fixtures

The three poe.ninja fixtures in `docs/baseline-builds/raw/*-build.json`
exercise the validator. Today's hard guarantees against all three:

- **Layer 2**: every gem skillId resolves (one fixture has 2 PoB placeholder
  gems flagged as `placeholder-gem` — separate kind, not failure).
- **Layer 4**: zero orphan nodes. Every allocated point is reachable.

Other layers report findings as informational:

| Fixture | L1 explicit-cap | L3 incompat | L5 unknown-stat | Notes |
|---------|----------------|-------------|-----------------|-------|
| zeolet (Amazon, Ice Shot) | 2 | 18 | 23 | |
| Gaobin (Blood Mage, Comet trigger) | 4 | 9 | 29 | |
| RsFearless (Blood Mage, Arc trigger) | 4 (+2 placeholder gems) | 12 | 20 | |

## Known gaps (deferred, not bugs)

These all surface in the informational logs but are intentional scope limits:

- **Layer 1 — explicit cap heuristic.** PoE2 introduces desecrated /
  fractured / enchanted mod categories that count separately from the
  3-prefix-3-suffix rule. Our cap (6 explicits for rare items) over-reports.
  Fixing requires extracting category info from `ModItemExclusive.lua` /
  `ModCorrupted.lua` and stripping those marker classes from the count.
- **Layer 1 — base-mod eligibility.** Today only weapon bases live in
  `weapon-bases.json`. Armour, jewellery, flasks etc. need their own
  Bases/*.lua extraction before we can run "can this mod actually roll on
  this base?" against non-weapon slots.
- **Layer 3 — tag accretion.** A passive node or another support can grant
  tags to a skill (e.g. an aura-conversion that makes Herald of Thunder
  count as an Area skill, which then makes Magnified Area legal). Our
  Layer 3 check doesn't yet model this and flags such combinations as
  incompatible. Fix requires walking the build's effective tag set, not
  just the skill's base `skillTypes`.
- **Layer 4 — "select-grant" jewels.** Certain unique jewels (Time-Lost
  family, etc.) let you allocate nodes in a local radius without normal
  edge connectivity — you still spend the point, but reachability is
  granted by the jewel acting as a virtual edge source. The validator
  doesn't model these yet, so a build that uses one will produce false
  orphan errors. Fix requires: (a) a small jewel-effect database keyed
  by item name/type that lists each select-grant pattern, (b) reading
  the player's equipped jewel items from each socket, and (c) injecting
  virtual edges into the adjacency map before BFS.
- **Layer 4 — item-granted tree points.** Amulet anointments and
  armour-sacrifice grant extra points beyond level + quest rewards.
  Today we don't enforce a point budget at all (only reachability),
  so this isn't currently a false-error source. When we add the budget
  check, equipped-item point grants must be summed in.
- **Layer 5 — arithmetic.** Today we only verify *coverage*: every stat
  line classifies into a known kind. The actual damage composition (the
  8-step pipeline in `validity-model.md`) lives in `composeDamage.ts`,
  which doesn't exist yet.

## Adding a new check

1. Add a new `validateXxx(build, errors)` function to `validate.ts`.
2. Call it from `validateBuild`.
3. Add an assertion in `__tests__/validate.test.ts` against the three
   baseline fixtures. If the new check fails on a baseline that's a real
   top-tier build, either your check is too strict or the data needs work
   — fix one of those, don't loosen the test silently.

## Why these specific fixtures?

See [../../docs/baseline-builds/README.md](../../docs/baseline-builds/README.md).
The three together span three damage profiles (spell+trigger small,
spell+trigger massive, attack+direct) and two classes (Blood Mage, Amazon).
If a change breaks any of them, it likely breaks a real build in the wild.
