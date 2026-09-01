# Skill Lab

A tooling platform that models the relationship between **skills**, the
**passive tree**, and **items**, keyed on the skill.

Pick a skill and it tells you, from the live Path of Building 0.5 data:

- **Damage** — every passive, affix, unique and support gem that makes the hit
  bigger, ranked by marginal gain per passive point / gem socket / item slot.
- **Area & coverage** — what makes one use of the skill reach more enemies.
- **Application speed** — what gets the damage onto the enemy sooner: cast and
  attack speed, cooldown recovery, ailment buildup, ailments that tick faster.
- **Sustain & defence** — kept separate so it can never inflate the damage list.
- **Skills to pair** — which skills produce what this one consumes (trigger
  hosts, corpse suppliers, exposure and curse appliers) and which consume what
  it produces.

## Using it

**In the app** — `npm start`, then the *Skill Lab* tab. The controls set the
baseline build the marginal scoring is measured against, which class the tree is
priced from, and whether the skill is delivered by you, a totem, a trap or a
mine.

**In the terminal** — no build step, same engine:

```bash
npm run lab -- "Spark"                     # all four buckets
npm run lab -- "Spark" --bucket speed      # one bucket
npm run lab -- "Sunder" --class Warrior    # price tree nodes from one class
npm run lab -- "Detonate Dead" --synergy   # what to pair it with
npm run lab -- --list fire                 # find skills by name or tag
npm run lab -- --coverage                  # what the parser understands
```

## Reading the output

Each row is one source, with the mod lines that matched, what it costs, and a
marker for how reliably it applies:

| | meaning |
| --- | --- |
| ● green | applies directly, always on |
| ◐ amber | conditional — a state, an enemy state, or a weapon. Scored at an assumed uptime, with the condition shown |
| ○ purple | needs a build decision — the mod is for totems / traps / mines, and this skill can be delivered that way |

Percentages are **marginal**: what the source adds *on top of the baseline build
you set*, not a raw mod value. That is why a 10% node can outrank a 40% one on a
build that already has 400% increased damage, and why the baseline is an input
rather than a constant.

## What it is not

It is not a damage calculator. It does not simulate a full build, it does not
know your gear, and where a value genuinely depends on gear (conversion, added
damage relative to your real hit) it says so rather than inventing a number.
`src/damage-v2` remains the place for full damage composition; this platform is
the layer that decides *what belongs in that calculation in the first place*.

## Design

See [`src/engine/README.md`](../src/engine/README.md) for the model: the shared
tag alphabet, the four exceptions to plain tag matching, and how to extend the
lexicon, the stat-key parser and the synergy rules.
