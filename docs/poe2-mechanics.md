# PoE2 mechanics our damage model must handle

This is not a rules digest. It's a list of mechanics that, if ignored, will
cause our "find the perfect build" optimizer to recommend builds that look
optimal on paper but don't match what top players actually run.

## Leagues are effectively different game versions

PoE2 runs Leagues (current: **Vaal**). A League is not a cosmetic event — it
changes available items, modifies skills, adds whole new mechanics. **A build
that is BiS in League N is often impossible in League N+1.**

Consequences for us:

- Anything we extract is league-specific. The PoB-PoE2 repo tracks the current
  league; `manifest.json` records the source commit so we know which league
  the generated data corresponds to.
- The damage calculator and optimizer should be tagged with the league they
  were built against. Cross-league comparison is meaningless.
- Reference builds from poe.ninja include the league in their URL
  (`/poe2/builds/vaal/...`). When using them as ground truth, match leagues.

## "Main skill" is not always "main damage skill"

The build planner's notion of "I picked Skill X, calculate its damage" is
wrong in a common and important case.

### Trigger chains

A skill can be configured to **cast on trigger** rather than on player input.
The triggering skill is what the player presses. The triggered skill is what
actually deals the damage.

**Examples observed on poe.ninja:**

- *RsFearless* (Blood Mage, Vaal league, lvl 100):
  [build link](https://poe.ninja/poe2/builds/vaal/character/RsFearless-1355/ttv_RsFearless?i=2&search=class%3DBlood%2BMage)
  — Headline skill is Arc at 1.0M DPS, but **it's not direct-cast Arc**. Spark is
  the cast skill, "Cast on Critical (trigger)" gem links to Arc + Comet. So the
  Arc DPS figure is its triggered damage. See
  [baseline-builds/rsfearless-arc.md](baseline-builds/rsfearless-arc.md).

- *Gaobin* (Blood Mage, Vaal, lvl 99, much higher DPS):
  [build link](https://poe.ninja/poe2/builds/vaal/character/Gaobin-8049/%E5%B0%8F%E6%89%8B%E5%86%B0%E5%86%B0%E5%86%B7?i=0&search=class%3DBlood%2BMage%26sort%3Ddps)
  — Has **two Comets**: a direct-cast Comet (16M DPS) and a triggered Comet via
  Spark + Cast on Critical (180M DPS). Same skill, 11× more damage through the
  trigger route. The canonical "tooltip is the wrong objective function" case.
  See [baseline-builds/gaobin-comet-trigger.md](baseline-builds/gaobin-comet-trigger.md).

Both examples are trigger builds. Neither is a direct-cast caster build.
The genuinely direct-cast pattern still exists for some skill archetypes
(e.g. attack-based melee), but for top-DPS spellcasters it's the exception,
not the rule.

### What the model needs

A skill's effective DPS depends on:
1. **Trigger source** (player-cast or another skill).
2. **Trigger condition** (on crit / on hit / on stunned / cooldown / etc.).
3. **Trigger frequency** = source cast rate × condition probability.
4. **Per-hit damage** of the triggered skill.

A single-skill damage calc that takes "Skill + supports + gear + tree" and
returns a number will be **wrong by an order of magnitude** for these builds.

## What this means for the optimizer

"Find perfect supports/gear/tree for skill X" is the wrong framing on its own.
The right framing is:

> Given a *damage source* (which may be a triggered skill), find the perfect
> trigger chain + supports on each skill + gear + tree.

Practical implication: the optimizer's search space includes
`(damage_skill, trigger_skill?, trigger_condition?)` as a tuple, not just
`damage_skill` alone.

## Tooltip damage is the wrong objective function

The skill's displayed per-hit number is a near-useless target on its own. Top
builds reach orders-of-magnitude higher effective DPS by exploiting how
specific damage types stack, scale, and interact. Each damage type has its
own optimization shape; a generic "maximize tooltip damage" optimizer will
miss every interesting build.

### "USE" (attack) vs "CAST" (spell): two different damage foundations

A skill is either an **attack** (uses the weapon's own damage as the base)
or a **spell** (uses the gem's base damage at its level). Top builds for
each follow fundamentally different scaling rules.

| | Attack ("USE") | Spell ("CAST") |
|---|---|---|
| **Base damage source** | Weapon's `min-max physical damage` line | Gem's per-level base damage table |
| **Key scaling stat** | Weapon damage %, attack speed, crit on weapon | `+X to Level of <element> Spell Skills` on weapon/gear |
| **Multiplier targets** | `physical damage`, `attack damage`, `projectile damage` (for bow) | `spell damage`, `<element> damage`, `damage over time` |
| **Conversion** | Phys → element conversion mods on the *weapon* | Less common; mostly stat-tagged |
| **Example skill** | Ice Shot, Lightning Arrow, Sunder | Comet, Arc, Spark |
| **Example fixture** | [zeolet-ice-shot.md](baseline-builds/zeolet-ice-shot.md) | [gaobin-comet-trigger.md](baseline-builds/gaobin-comet-trigger.md), [rsfearless-arc.md](baseline-builds/rsfearless-arc.md) |

An attack-build optimizer that searches for `+to spell skills` mods is
broken before it starts. A spell-build optimizer that searches for `weapon
physical damage` is equally broken. The first classifier the optimizer must
run is **attack-vs-spell** — everything else is downstream.

### Damage-type optimization patterns

These are the patterns that actually matter. The optimizer must know which
pattern applies to the chosen skill, because the *direction* of optimization
is type-dependent:

- **Poison (chaos DoT, stacking):**
  - Each application is an independent stack with its own duration.
  - Many concurrent stacks add together → effective damage grows with stack
    count.
  - Optimization direction: **maximize application rate**, **minimize
    duration** (so stacks turn over fast and a high cast rate keeps a large
    concurrent stack count).
  - Tooltip per-hit can be tiny (e.g. 1000) while real DPS hits the millions
    because dozens of stacks are active simultaneously.

- **Ignite (fire DoT, non-stacking, biggest-wins):**
  - Only the strongest active ignite is applied at a time (default rule).
  - Optimization direction: **maximize single-hit damage**, **maximize
    duration** so one huge ignite burns for as long as possible.
  - Opposite of poison: stacks don't help; duration does.

- **Bleed (physical DoT, biggest-wins, attack-only):**
  - Similar to ignite but scales with physical hit damage and movement.

- **Hit-based (no ailment):**
  - Optimization is direct: maximize per-hit × hit rate × crit multiplier.
  - This is the only case where tooltip DPS roughly equals real DPS.

- **Trigger chains** (see "Main skill is not always main damage skill" above):
  - Effective DPS = `triggered_skill_per_hit × trigger_frequency`.
  - Trigger frequency = source cast rate × condition probability.

### Implication for the optimizer

The optimizer cannot share a single damage function across skills. It must:

1. Classify the chosen skill by its **damage profile** (hit / poison /
   ignite / bleed / trigger-source / trigger-target).
2. Apply the matching optimization target for that profile.
3. Reject "improvements" that look better on tooltip but are worse on the
   real metric (e.g. adding duration to a poison build is usually a *loss*).

This is also why "exploiting calculation weaknesses" describes top builds
accurately: they're not maximizing the obvious knob, they're finding the
*right* knob for that skill's damage profile.

## Cornerstone unique jewels rewrite builds

A single unique jewel placed in a passive tree socket can flip the build's
operating mode entirely. These are not "small stat bonuses" — they're
mechanic-replacing keystones in jewel form.

Examples of the pattern (specific items change with patches):

- **Time-Lost jewels** — alter how passives in a radius behave.
- **Megalomaniac**-style jewels — grant notable-passive effects in a socket.
- **Conversion jewels** — flip a build's damage type at a radius.

Implication for the optimizer:

- Treat each socketed unique jewel as a **branch point in the build space**,
  not just an additive stat source. The same skill + supports + gear with
  Jewel A vs Jewel B can score wildly differently.
- For "find the perfect build for skill X", the search must enumerate
  candidate jewels per relevant socket, not just pick "best stat jewel".
- A build's `base jewels` section on poe.ninja is a strong hint at the
  cornerstones the player is relying on. See the lists in our baseline
  fixtures — e.g. zeolet's "Against the Darkness Time-Lost Diamond" is
  almost certainly a cornerstone for that build.

## Other mechanics likely to matter (not yet implemented)

These are flagged so we don't pretend they don't exist:

- **Conversion order** (physical → cold → fire, etc.) — affects which "more"
  multipliers apply where.
- **More vs increased** — multiplicative vs additive. Easy to get wrong.
- **Spirit budget** — caps how many auras/heralds/triggered skills can be
  reserved at once. The optimizer must respect it as a constraint.
- **Charges** (power/frenzy/endurance) — uptime modeling.
- **Skill effect "level"** — gem level, +levels from gear, quality, all scale
  base damage non-linearly per skill.
