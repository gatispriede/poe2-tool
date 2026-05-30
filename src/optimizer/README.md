# Single-axis build optimizer

Discovery tools that take a known-good build (one of our baseline fixtures,
or an imported PoB code) and search for upgrades along one axis at a time.
Output: ranked list of swap suggestions with DPS deltas.

## What's here

- **`optimizeSupports.ts`** — for a given skill group, try every
  Layer-3-compatible support gem in each support slot, rank by DPS gain.
  ~250 candidates × 5 slots × ~5ms each = under 100ms on the test fixture.

Coming:
- `optimizeGearSlot.ts` — for one slot, try every candidate item the
  caller supplies (drops, vendor offerings, mod-bench variants), rank.
- `optimizeTreePath.ts` — for a target node, find the cheapest
  reachable allocation chain (Steiner-tree-like).

## Today's caveats — read these before trusting output

The optimizer is exactly as smart as `composeDamage`. Effects the composer
doesn't model are **invisible** to the optimizer, so a support whose value
is entirely in an unmodelled effect (e.g. enemy resistance negation) looks
like a no-op and any swap away from it appears to be an upgrade.

We surface this as a **per-swap warning** when the *removed* support has
stat keys our pattern matcher doesn't recognise. Example output:

```
slot 4: remove "Rakiata's Flow" → "Deliberation"  Δ +223,330  (+20.0%)
        ⚠ removed support "Rakiata's Flow" has 1 unmodelled stat(s)
        — improvement may be a composer blind-spot
```

Translation: Rakiata's Flow grants 100% chance to invert enemy elemental
resistance (a ~3-4× damage boost vs 75%-res bosses that we don't model).
The optimizer sees Rakiata as zero contribution and Deliberation as +20%
MORE damage → "swap is +20%". In-game, the swap is probably a large
regression.

So the working interpretation today is:

| Output | Trust level |
|--------|-------------|
| **Improvement + no warning** | likely a real upgrade |
| **Improvement + warning** | needs human verification — composer blind-spot may be the whole reason |
| **Regression + no warning** | likely a real regression |
| **Regression + warning** | very likely a real regression (lost both modelled & unmodelled value) |

## Running the test

```
npm test -- --testPathPattern=optimizer --watchAll=false
```

Prints the top-K improvements and regressions for zeolet's Ice Shot setup.

## Bug-classes the optimizer surfaced (during construction)

Building this tool exposed three real bugs in the composer's support-stat
matcher — every one of these would have silently corrupted damage even
without the optimizer, just hidden because we were only ever scoring the
fixtures' OWN supports:

1. **`_melee_damage_+%_final = -100` on Retreat I/II/III** propagated
   as a "more damage" multiplier of `(1 + -100/100) = 0`, dropping DPS to
   zero. Fix: type-guard the key — `_melee_damage_` only applies if the
   skill has the Melee tag.
2. **`_stun_damage_+%_final = 500` on Ruthless** bucketed as a +500%
   MORE hit damage multiplier (×6 DPS), but stun_damage is a separate
   game system. Fix: explicit reject list for non-hit-damage sub-types
   (stun, ignite, bleed, poison, reflect, recoup, secondary).
3. **`_in_weapon_set_two` suffix on Rigwald's Ferocity** prevented the
   underlying `_damage_+%_final` from matching the bucket regex. Fix:
   strip the suffix before pattern matching. (This one was already caught
   by the v4 fixture but the same shape recurred elsewhere.)

The optimizer is therefore valuable as a **fuzzing tool for the composer**
even before it's trustworthy as an upgrade-suggester. Run it against any
new fixture to surface composer bugs you wouldn't otherwise notice.

## Why no `validateBuild` enforcement?

The optimizer calls `validateBuild` for each variant but DOESN'T reject
on Layer-3 incompatibility errors. Reason: our Layer-3 check doesn't
model tag accretion (see `src/validation/README.md`), so it produces false
positives on legal builds. Refining Layer-3 is a separate piece of work.
The optimizer's own `compatible()` predicate runs the same intersection
check independently to filter candidates upfront.
