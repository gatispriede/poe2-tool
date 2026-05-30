# composeDamage

Implements Layer 5 of the validity model (see
[../../docs/validity-model.md](../../docs/validity-model.md)) — the actual
damage arithmetic.

This is the **counterpart** to `src/validation/`. Validation answers "is the
build legal?". Composition answers "given a legal build, what damage does
the skill deal?".

## Coverage map

See [../../docs/damage-calc-coverage.md](../../docs/damage-calc-coverage.md)
for the full tickbox of supported / partial / not-yet items against the
Mobalytics 8-step pipeline. Update that file whenever you add or remove a
bucket so future sessions don't re-derive what's already done.

## v1 baseline (current)

End-to-end pipeline for **one** scenario: an attack skill fired from a
weapon, no triggers, no ailments, no defence side.

Implemented inputs:

- Weapon base damage (from `weapon-bases.json`)
- Weapon **local** added flat physical damage ("Adds N to M Physical Damage")
- Weapon **local** % increased physical damage + quality
- Weapon **local** attack speed
- Weapon **local** crit chance
- Skill's per-level `baseMultiplier` and `attackSpeedMultiplier`
- "+N to Level of <X> Skills" gem-level shift from any equipped item,
  matched against the skill's tags (supports "all Skills" and tag-specific
  forms like "all Projectile" / "all Cold Spell")
- PoE2 default crit multiplier (2×; gear/tree modifiers not yet)

NOT yet implemented (each is a known multiplier on top of v1; rough
expected impact noted):

| Missing | Rough impact | Status |
|---|---|---|
| Tree node stat aggregation (130 nodes for zeolet) | likely 5–10× | TODO |
| Support gem effects (5 supports on Ice Shot) | likely 3–5× multiplicative | TODO |
| Non-weapon item damage mods (gloves, body, amulet, jewels) | likely 2–5× | TODO |
| Gain X% as Extra <type> + skill conversion | additive damage layer | TODO |
| Crit chance & crit multiplier from gear/tree | 1.5–2.5× | TODO |
| Conditional mods ("vs Rare/Unique", "during X", etc.) | 1.2–1.5× when active | TODO |
| Heralds, charges, marks, aura buffs | varies | TODO |
| Local vs global mod distinction via `item-mods.json` lookup | correctness | TODO |

## Today's run — zeolet's Ice Shot

```
weapon          : Behemoth Arch / Obliterator Bow (base 62-115 phys)
effective level : 36  (gem 21 + +15 from skill-level mods)
                       baseMultiplier 9.66
weapon avg dmg  : 547.1   (base 62-115 → 101-181 with +39-66 added → 383-686 after local 279%)
per hit         : 5284.8
hits/sec        : 1.232   (base 1.15 × 1.19 local × 0.9 skill modifier)
crit multiplier : 1.100   (10% crit chance × 2× = +10% effective)
v1 DPS          : 7,160
reported DPS    : 17,000,000
gap (×)         : 2374.3
```

The v1 DPS captures the weapon-local + skill-level contributions cleanly.
The 2374× gap will close as the missing layers are added.

## How to iterate

Each "Missing" item in the table above is its own iteration. Recommended
order (largest expected impact first):

1. **Tree node stats** — read each allocated node's `stats[]` from
   `passive-tree.json`, classify with `classifyStat`, aggregate into the
   global increased/more/etc. buckets.
2. **Support gem effects** — each support's effect on the supported skill
   is stored in `Skills/sup_*.lua` `statSets[].constantStats`. Extend
   `extractSkills.js` to capture those.
3. **Non-weapon item mods** — apply globally; cleanly mirrors the weapon
   loop but without the local-mod distinction.
4. **Conversion + Gain-as-Extra** — implements steps 2.2 of the
   Mobalytics pipeline. Critical for builds like zeolet (phys → cold +
   element extras) and Gaobin (cold conversion).
5. **Crit modifiers from gear/tree** — read `+N% to Critical Strike Multiplier`
   and `+N% to Critical Hit Chance` from non-weapon sources.

Each iteration should re-run the same test and the gap should shrink. Once
the gap is ≤20%, declare v1 of the calc complete and start on the spell
profile (Comet for Gaobin).

## Why a fresh directory (`damage-v2/`) instead of `damage/`?

`src/damage/` predates the validity model and was grounded in the
two-data-systems mess (see `docs/known-pitfalls.md`). When the new
composer reaches parity with what zeolet's poe.ninja DPS reports, the old
`src/damage/` will be deleted and `damage-v2/` renamed to `damage/`.
