# Project docs

Single source of accumulated knowledge for this repo. Update as you learn
things that are non-obvious or that would otherwise have to be rediscovered.

## Index

- **[validity-model.md](validity-model.md)** — **Read this first.** The five
  layers (valid weapon → skill → support → tree → damage composition) that
  every feature must respect. Everything else is downstream.
- **[damage-calc-coverage.md](damage-calc-coverage.md)** — Tickbox map of
  what `composeDamage` currently models against the 8-step Mobalytics
  pipeline. Reference when picking the next iteration.
- **[composer-evolution.md](composer-evolution.md)** — How the damage calc
  reached 1.12M DPS on zeolet's Ice Shot in seven iterations, what each
  one taught us, and which bugs surfaced after each. Read before resuming
  damage-calc work.
- **`src/optimizer/README.md`** — The discovery tool. Ranks support-gem
  swaps for a given build, with composer-blind-spot warnings. Useful as
  a fuzzing tool for the composer too — building it found 2 composer
  bugs that the per-fixture tests didn't surface.
- **`src/generator/README.md`** — End-to-end build generator. Pick a
  class, get the top-N highest-DPS builds the tool can produce, with
  hard verification that every output is in-game reproducible (real
  bases, real mods, real skills). v1 supports Huntress / bow-attack.
- **[data-pipeline.md](data-pipeline.md)** — How `npm run sync-data` works, what
  it produces, how to roll forward when PoE2 patches.
- **[pob-data-reference.md](pob-data-reference.md)** — Structure of the PoB-PoE2
  Lua files. Field meanings, gotchas, the mod eligibility rule.
- **[poe2-mechanics.md](poe2-mechanics.md)** — Game mechanics our damage model
  has to handle: Leagues, trigger skills, "main skill" ≠ "main damage skill".
- **[external-sources.md](external-sources.md)** — Reference builds (poe.ninja),
  what their URLs encode, what data is exposed.
- **[known-pitfalls.md](known-pitfalls.md)** — Mistakes already made in this
  codebase. Read before touching the data layer.

## Conventions

- No emojis in docs.
- Each doc earns its place. If a doc would just be "TODO: write later", don't
  create it yet.
- When a doc's claim becomes false (game patches, code changes), fix or delete
  it. Stale docs are worse than no docs.
