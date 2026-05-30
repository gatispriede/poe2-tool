# Validity model — the project's foundation

**Read this before working on any feature.** Every flaw the user has
reported — non-existent gear, wrong skill data, wrong damage — traces to
one of the five layers below being skipped or fudged. The optimizer, the
"find perfect build" goal, trigger chains, ailment scaling — none of those
work until layers 1-5 hold.

## The five layers, in dependency order

```
                    Layer 5: Damage composition
                              ▲
                              │
        Layer 1 ──────────┐   │
        Valid weapon      │   │
                          ▼   │
                       Layer 2
                       Valid skill
                          │
                          ▼
                       Layer 3
                       Valid support  ──►  feeds layer 5
                          │
                          ▼
                       Layer 4
                       Valid tree     ──►  feeds layer 5
```

### Layer 1 — Valid weapon

A weapon is valid iff:

- Its base exists in `src/data/generated/weapon-bases.json`.
- Every mod on it can actually roll on that base:
  - `mod.level ≤ item_level`
  - `∃ i: mod.weightKey[i] ∈ base.tags AND mod.weightVal[i] > 0`
  - No `no_<X>_spell_mods` tag in `base.tags` excludes `mod.modTags`
- No two mods share the same `group`.
- Prefix count ≤ 3 and suffix count ≤ 3.
- Implicit count matches what the base permits.

Source data: [pob-data-reference.md](pob-data-reference.md).
Same rules apply to all gear slots, not just weapons.

### Layer 2 — Valid skill

A skill is valid iff:

- Its `skillId` exists in PoE2 game data (PoB's `Skills/` directory).
- Its tags (`Attack`/`Spell`, element, `Projectile`/`AreaOfEffect`/etc.) are
  known and used downstream.

We never invent skill IDs. If the codebase references "Comber" and the
game data only has "Comet", that's a Layer-2 violation.

### Layer 3 — Valid support gem on a skill

A support `S` validly attaches to skill `K` iff:

- `S` exists in PoE2 game data.
- `S.allowedTypes ∩ K.tags` is non-empty (the support targets a tag the
  skill has).
- `S.excludedTypes ∩ K.tags` is empty (the support doesn't forbid one of
  the skill's tags).

Examples:
- "Concentrated Area" requires `AreaOfEffect`. Attaching it to a non-area
  skill is a Layer-3 violation.
- A spell-only support attached to an attack skill is a Layer-3 violation
  even if the user picked it on poe.ninja — the data import should reject
  the linkage with an error, not silently include it.

### Layer 4 — Valid passive tree allocation

The tree is **a graph you traverse**, not a flat list of points you cherry-pick.
You start at your class's central node and every allocated node must be a
step away from another allocated node back to that start. Random picks are
invalid even if individual nodes "look right".

A tree allocation is valid iff:

- Every allocated node is reachable through other allocated nodes from
  **some allowed entry point**. The default entry points are:
  - The character's class-start node, if allocated.
  - Any allocated ascendancy-start node.
  - Plus the per-jewel "virtual entry" edges described below.
- Ascendancy nodes are reachable from their ascendancy start node, which is
  itself allocated.
- Total points spent ≤ **point budget** (level + quest reward points + any
  tree points granted by equipped items).
- Ascendancy points spent only on the character's chosen ascendancy.
- Each jewel socket node either is unoccupied or has an actual jewel item
  in our build state — never a "free" socket effect.

**Implementation detail — tree edges are stored asymmetrically.** Each
edge appears on only ONE of its two endpoints in `passive-tree.json`. You
MUST build an undirected adjacency map before doing reachability:

```js
const adj = new Map();
for (const n of Object.values(tree.nodes)) {
  for (const c of n.connections) {
    if (!adj.has(n.id)) adj.set(n.id, new Set());
    if (!adj.has(c))    adj.set(c, new Set());
    adj.get(n.id).add(c);
    adj.get(c).add(n.id);
  }
}
```

Using `connections` directly as a directed edge list silently marks
hundreds of correctly-allocated nodes as orphans. Verified with all three
baseline fixtures: zero orphans with undirected, 119+ false orphans with
directed.

### Jewel effects, classified

Unique jewels do three kinds of thing to the tree. Layer 4 has to handle
each correctly:

1. **Stat-grant** (most jewels). The jewel adds stats to the build's total
   stat sum — sometimes scaled by neighbouring passives in a radius. The
   tree topology is unchanged; Layer 4 reachability rules are not affected.
   Effects compose into Layer 5.
2. **Node-value change.** The jewel rewrites what allocated passives in a
   radius *do* (their stats change). The tree topology is unchanged.
   Allocated nodes' contributions to Layer 5 are read from the jewel's
   rewrite rule instead of the node's default stats.
3. **Local "select without traversing" grant.** The jewel makes certain
   nodes in a radius selectable from the jewel socket itself, bypassing
   normal connectivity for those specific nodes. **You still spend a
   point per selected node** — it's not free. Effectively the jewel adds
   *virtual edges* from the jewel socket to the reachable-by-grant nodes.

For (3), Layer 4 reachability MUST be relaxed locally: the validator's
adjacency map needs virtual edges injected for each "select-grant" jewel
the player has socketed. Without those virtual edges, the validator would
mark perfectly-legal "select-granted" allocations as orphans.

So:

- **Layer 4** = "is this allocation walkable, *given the player's
  equipped jewels*?" Reachability is conditional on the jewel virtual
  edges, not unconditional.
- **Layer 5** = "what stats does this build have?" — where stat-grant and
  node-value-change effects fold in alongside item mods, node stats, gem
  effects.

The validator's current implementation handles class 1 (stat-grant)
implicitly — it doesn't change reachability so nothing breaks. Classes 2
and 3 are not yet modelled. If a build relies on a (3) jewel, the
validator will produce false orphan errors; track this in
[../src/validation/README.md](../src/validation/README.md) under deferred gaps.

### Item-granted tree points

Tree points can also come from equipped items, not just level + quests:

- **Amulet** — the *anointment* slot on an amulet can grant additional
  tree allocation points (different from PoE1's "anointment grants the
  effect of a notable"; PoE2 grants points).
- **Body Armour** — a body armour can carry a single tree point at the
  cost of an explicit stat roll slot.
- **Specific uniques** — some unique items grant points, and a smaller
  set may alter tree behaviour in other ways (specific cases not yet
  catalogued; flag any new mechanic when encountered).

Points granted by items are spent like any other point: through normal
traversal, subject to the same Layer-4 rules. They expand the budget,
not the reachability rule.

For the validator: a meaningful point-budget check needs to inspect
equipped items for `+N to Passive Skill Points` (or whatever the actual
mod text is) and add to `available`. The validator does not enforce
point-budget today; this is queued.

### Layer 5 — Correct damage composition

Given a valid weapon + skill + supports + tree, compute damage by applying
each modifier in its canonical step. The pipeline is authoritative per
[Mobalytics' PoE2 Damage & Defence Calc Order](https://mobalytics.gg/poe-2/guides/damage-defence-calc-order).
Do not approximate — every step has its own bucket and the order matters.

```
PLAYER SIDE (compute outgoing hit/ailment damage)

  1. Avoidance check         attacker rolls vs evasion/dodge/hit-specific avoid.
                             if avoided, STOP. damage = 0.

  2. Damage calculation
     2.1 Flat                base damage (weapon for attack, gem table for spell)
                             + added flat ("Adds N to M", "+N to <type>")
                             × damage effectiveness (skill multiplier)
                             = effective base
     2.2 Conversion & Extra  (a) skill-type conversions first (from gems)
                             (b) then secondary conversions (tree/gear/buffs)
                             total conversion capped at 100% per source type.
                             "Gain X% as Extra <type>" is a kind of conversion
                             — adds parallel damage instance; original unchanged.
     2.3 Multipliers         all "increased / reduced %" summed → additive bucket
                             all "more / less %" multiplied → multiplicative bucket
                             different "increased" tags applying to the same hit
                             still ADD to one bucket — they don't multiply each other.
     2.4 Crit                if hit crits, multiply by (1 + crit damage bonus)
                             defender's crit damage reduction applies here.
     2.5 Roll                pick a number in [min, max]; if Lucky/Unlucky, roll
                             twice and take favourable/unfavourable.
     2.6 Double/Triple       hits only. Triple always overrides Double.

ENEMY SIDE (apply defences, then resources)

  3. Damage taken as         "X% of <type> Damage taken as <type2>" — applied
                             simultaneously across types. Shifted damage loses
                             its inherent type properties (e.g. penetration).
                             >>> Damaging ailment magnitude is computed here
                             >>> (pre-mitigation). Non-damaging ailment magnitude
                             >>> (e.g. Shock) is computed at step 8.

  4. Mitigation              applied in order:
     4.1 Immunities          flat prevention of a type
     4.2 Hit-type avoidance  late avoidance (e.g. Perfidy phys avoid)
     4.3 Armour + PDR        physical hits AND physical DoT
                             additional PDR mods are summed in this bucket
     4.4 Elemental Armour    armour-vs-non-phys (e.g. Prism Guard), pre-resist
     4.5 Resistances         fire / cold / lightning / chaos separately
                             >>> Armour% and Resist% are SEPARATE LAYERS,
                             >>> each capped at 90%.

  5. Damage taken modifiers  applied after mitigation:
     5.1 Flat damage taken   added to remaining damage
     5.2 Increased/reduced   additive bucket
     5.3 More/less           multiplicative bucket

  6. Stun check              if remaining damage > stun threshold (vs max life),
                             stun applies. Player phys/melee hits get +50% more
                             heavy-stun buildup. (Players themselves cannot be
                             heavily stunned.)

  7. Block                   passive or active block rolled. On block, ALL of
                             the hit is prevented — but on-hit effects (stun,
                             freeze) still apply.

  8. Resource depletion      order:
     - entities-before-player effects (totems, etc.)
     - guards (Charm mods, Olroth's Resolve)
     - Energy Shield first. Chaos removes 2× from ES.
     - poison/bleed BYPASS ES — go straight to life.
     - "Mana Before Life" mods (MoM keystone, etc.) — overflow to life.
     - life. life-loss prevention modifiers apply here.
     - shock and other non-damaging ailment magnitudes are calculated here
       using the final post-mitigation damage as input.
```

For our model, the player-side (steps 1-2) is the bulk of Layer 5. Steps
3-8 only matter when computing damage taken (defence) or ailments. Until we
have ailment support, focus on getting 1-2 right against the baseline
fixtures.

The tooltip the player sees IS the composed value. If our model produces
a different number, **our model is wrong**, not the game.

### Wording is the spec

PoE mod text is a deliberate notation — each keyword maps to a specific
bucket in the damage formula. Getting the bucket wrong silently invalidates
every damage number even when Layers 1-4 are perfect. Implement the parser
and composer to switch on keywords, not on "meaning" we guessed at.

| Mod wording | Bucket | Stacking | Example |
|---|---|---|---|
| `X% increased <thing>` | Increased | **Additive** within bucket. Three 30% = +90% = ×1.90 | "30% increased Physical Damage" |
| `X% reduced <thing>` | Increased (negative) | Additive with increased | "20% reduced Cast Speed" |
| `X% more <thing>` | More | **Multiplicative**. Three 30% = 1.30 × 1.30 × 1.30 ≈ ×2.197 | "30% more Damage with Hits" |
| `X% less <thing>` | More (negative) | Multiplicative with more | "20% less Cooldown Recovery" |
| `Adds N to M <type> Damage` | Added (flat) | Additive across mods of same type. Applied *before* increased/more. | "Adds 39 to 66 Physical Damage" |
| `+N to <type> Damage` | Added (flat) | Same as above. | "+8 to Cold Damage" |
| `Gain X% of Damage as Extra <type>` | Extra | Adds a separate damage instance of `<type>`, ORIGINAL DAMAGE UNCHANGED | "Gain 33% of Damage as Extra Cold Damage" |
| `X% of <type> Damage Converted to <type2>` | Conversion | Original `<type>` decreases by X%; new `<type2>` increases. Capped at 100% total conversion. | "50% of Physical Damage Converted to Cold" |
| `+N to Level of <X> Skills` | Skill level shift | Replaces gem's base damage with the value at gem_level + N. Massive non-linear effect. | "+6 to Level of all Cold Spell Skills" |
| `Gain X% increased Y per Z` | Conditional Increased | Same as Increased once Z is determined. Need to evaluate Z first. | "1% increased Damage per 10 Strength" |

The two most common bugs from getting this wrong:

1. **Treating "more" as "increased"** (or vice versa). Two "30% more" mods
   produce ×1.69; two "30% increased" mods produce ×1.60. With ten such
   mods in a build the gap is the difference between "matches poe.ninja"
   and "off by 5×".

2. **Treating "Adds N to M" as "X% more"**. "Adds 39 to 66 Physical Damage"
   adds an average of 52.5 flat to the weapon's base in the Added bucket
   — it does NOT multiply final damage by anything. Conversely, "30% more
   Damage" doesn't add 30 to the base. They live in different stages of
   the formula and combine differently.

3. **Treating `Gain X% as Extra` as conversion.** Conversion *moves* damage
   from one type to another (original decreases). "Gain as Extra" *adds* a
   parallel damage instance of a new type (original unchanged). On a
   build that already converts phys → cold, a "Gain 33% as Extra
   Lightning" mod on top of that adds 33% of the *post-conversion* damage
   as a lightning hit — three damage types are present, not two.

### What this means for code

- The mod-text parser must extract the **keyword shape** (`increased`,
  `more`, `Adds N to M`, `Gain X% as Extra Y`, `Converted to`,
  `+N to Level of`) as a structured field, not just numeric values.
- The damage composer must hold each bucket separately and apply them in
  the order shown in the pipeline above. Mixing buckets at compose time
  cannot be done with arithmetic alone.
- When we encounter a wording we don't recognise, we **log it and fail
  closed**, not silently bucket it into "increased" because that's the
  most common shape. An unknown mod is a Layer-5 violation, same as an
  invented skill is a Layer-2 violation.

## How we validate

For each baseline fixture in `docs/baseline-builds/raw/*-build.json`:

```
validate(build) -> { valid: bool, layer1: [...errors], ..., layer5: [...errors] }
```

The fixtures are ground truth: zeolet should pass all five layers; the
poe.ninja-reported DPS (17M for Ice Shot) is the target for Layer 5's
`composeDamage(build, "Ice Shot")` to hit within ~10-20%.

If a fixture fails Layer 1-4, either our data is wrong or the player's
build genuinely is invalid (rare; treat as a data bug first).

If a fixture passes 1-4 but Layer 5 mis-predicts DPS by >20%, our damage
composition is missing a mechanic.

## What this rules out for now

These are deferred until the five layers pass cleanly:

- **Optimizer / search** — can't search a space whose validity oracle is
  broken.
- **Trigger chains** — relies on Layer 5 already being correct for the
  direct cases.
- **Ailment scaling** (poison/ignite/bleed) — adds rules on top of Layer 5;
  base hit damage must be right first.
- **Conversion chains** beyond a single step — same.
- **Cornerstone unique jewels** — Layer 4 must handle jewel item presence
  before we can model their effect on the tree.

These aren't unimportant — they're how top builds reach their headline
numbers. They're just downstream of the foundation.
