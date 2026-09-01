# Relationship engine

Answers one question, for one skill at a time:

> **What in this game changes what this skill does, and by how much?**

Sources are the passive tree, item affixes, uniques and support gems. The answer
is bucketed the way a build actually thinks about it — bigger hit, wider hit,
faster hit, stay alive — plus which *other skills* pair with it.

## Why it is built this way

Naive versions of this tool enumerate patterns: one regex per mod, one lookup
table per skill. That breaks on the next patch. This engine instead reduces
everything to a shared alphabet and asks a set question:

```
Effect.requires ⊆ SkillProfile.tags   (with four principled exceptions)
```

so a mod line nobody has seen before still lands in the right bucket, against
the right skills, the moment the data is re-synced.

## The pipeline

```
 mod text ─┐
           ├─► parseMod.ts ────┐
 PoB stat ─┘                   ├─► Effect  ─┐
           ├─► parseStatKey.ts ┘            │
 skill  ───► skillProfile.ts ──► SkillProfile
                                            │
                          applicability.ts ◄┘   does it apply, and how strongly?
                                 │
                          scoring.ts             what is it worth, marginally?
                                 │
                          skillIndex.ts          rank per bucket, per cost
                          synergy.ts             which skills pair with it
```

| File | Role |
| --- | --- |
| `types.ts` | The shared vocabulary — `Tag`, `Effect`, `EffectSource`, `SkillProfile` |
| `vocab.ts` | The lexicon: tag words, stat registry, condition clauses. Data, not code |
| `parseMod.ts` | English mod line → `Effect[]`, by grammar rather than per-mod patterns |
| `parseStatKey.ts` | PoB internal stat key (`support_brutality_physical_damage_+%_final`) → `Effect` |
| `skillProfile.ts` | Raw gem → tags, damage types, timing, geometry, emitted/consumed mechanics |
| `applicability.ts` | Effect × skill → applies / conditional / needs-a-build-decision, with reasons |
| `treeGraph.ts` | Passive tree distances, so a node is priced in passive points |
| `sources.ts` | Tree nodes, affixes, uniques and supports normalised to one shape |
| `scoring.ts` | Marginal value of an effect against an explicit baseline build |
| `skillIndex.ts` | The per-skill answer: buckets, ranked by gain per unit of cost |
| `synergy.ts` | Skill ↔ skill pairing as a token market (emits → consumes) |

## The four exceptions to plain tag matching

A pure set test gets these wrong, so `applicability.ts` handles each explicitly:

1. **Proxy tags** — Totem/Trap/Mine mods are not irrelevant to a Totemable
   skill, they are `setup`: they pay off if you *choose* that delivery.
2. **Weapon tags** — "with Bows" is dead on a spell, but on an attack with no
   innate weapon restriction it is `conditional` on what you equip.
3. **Damage types** — an attack deals whatever its weapon and added damage
   deal, so elemental scaling is `conditional`, not absent.
4. **Conditions** — "while channelling" does not stop a mod applying, it lowers
   the fraction of the time it is live (`uptime`), which scoring multiplies in.

Weapon-**local** mods are a fifth case handled in `skillIndex.ts`: PoB marks
them with a `Local` prefix, and they reach a skill only through the weapon it
swings — invisible to spells, and scored against the weapon's own additive
bucket rather than your global one.

## Scoring is an assumption, stated out loud

Every number is a **marginal** gain against `BuildContext` — 10% increased
damage is worth `10/(100 + increasedDamage)`. The baseline is an input, editable
in the UI, never a hidden constant. Where the engine genuinely cannot know a
value (conversion depends on your gear), it books a conservative number and says
so in the effect's `note` instead of inventing precision.

## Extending it

- **New mod wording**: add one entry to `STATS` or `CONDITIONS` in `vocab.ts`.
- **New PoB stat key shape**: add one entry to `KEY_STATS` in `parseStatKey.ts`.
- **New mechanic pairing**: add one row to `SYNERGY_RULES` in `synergy.ts`. Any
  gem whose skill types emit or consume that token joins the combo for free.
- **New data**: `npm run sync-data` regenerates `src/data/generated`; the engine
  reads it through `Dataset`, so nothing else changes.

## Honesty rails

- Lines the parser only half understood keep a low `parseConfidence`; they are
  surfaced, not silently dropped or silently trusted.
- Sources that do *not* apply carry the reason why, so a missing entry can be
  audited instead of guessed at.
- `npm run lab -- --coverage` reports how much of the live data the lexicon
  currently resolves (85% of the 5,556 distinct mod lines, and 496 of the 854
  support stat keys; the residue is one-off utility wording and cosmetic gem
  keys, which land in the sustain bucket or nowhere at all rather than
  distorting a damage number).
