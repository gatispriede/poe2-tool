# External data sources

What we use, what we reference, and what's off limits.

## poe.ninja — reference builds

**URL:** https://poe.ninja/poe2/builds/

This is our ground truth for "what builds actually work". poe.ninja scrapes
public characters and ranks them by metrics including DPS.

### URL structure

```
https://poe.ninja/poe2/builds/<league>/character/<account>-<id>/<character_name>?i=<index>&search=<filters>
```

- `<league>` — currently `vaal`. Will change with future leagues.
- `<account>-<id>` — opaque account identifier.
- `<character_name>` — URL-encoded character name; may be non-ASCII.
- `?i=<index>` — which character snapshot (a player can have multiple).
- `?search=...` — `class=Blood+Mage`, `sort=dps`, etc.

### How we use it

- **Validation reference.** When our damage calc disagrees with poe.ninja's
  reported DPS for the same gear + skill + tree, ours is probably wrong.
- **Build discovery.** Sorting by DPS within a class reveals which damage
  sources and trigger chains the top players have found.
- **League awareness.** Build URLs encode league. Don't compare across leagues.

### What it does NOT give us

- A documented API. There's no official poe.ninja API endpoint that we can
  rely on long-term. Anything we scrape is fragile.
- The exact damage calculation. The DPS number is computed; we don't see the
  formula. Treat it as a black-box reference, not a source of mechanics.

## PoB-PoE2 — primary data source

See [pob-data-reference.md](pob-data-reference.md).

Repository: https://github.com/PathOfBuildingCommunity/PathOfBuilding-PoE2
Cloned locally at: `PathOfBuilding-PoE2/`

This is the canonical extract of PoE2 game data, kept current with patches by
the community. We pin our sync to a specific commit (recorded in
`src/data/generated/manifest.json`).

## Path of Exile dev API — useful only for character import

**URL:** https://www.pathofexile.com/developer/docs/index

What it gives us for PoE2:

- **Character endpoint** (`GET /character/<realm>/<name>`) returns the
  character's *allocated* passive node hashes (`passives.hashes`),
  ascendancy specialisations (`passives.specialisations.set1/2/3`),
  jewels, and equipped items (`equipment`, `skills`). This is **exactly
  what PoB's "Character Imports (API)" feature uses** — it's how a player
  enters their account name and gets their build loaded.
- Same shape as what we already get from poe.ninja's PoB import code, but
  **fresh from the player's own characters**, not a third-party scrape.

How we would use it:

1. User authorises our app via OAuth (one-time).
2. We list their characters and let them pick one.
3. We fetch the character endpoint, decode allocated nodes + items, and
   feed it into the same data pipeline we already have for the
   poe.ninja-derived fixtures.
4. Run our optimizer with their build as a starting point.

What it explicitly does NOT provide:

- Tree graph structure (node positions, connections, stats).
- Item base / mod data.
- Any general PoE2 data exports. Quote from the docs: "We are currently
  unable to provide any PoE2-specific data."

Reverse-engineering undocumented endpoints violates ToU (section 7i).

What it explicitly does NOT provide:

- Passive tree structure (node positions, connections, stats).
- Item base / mod data.
- Any PoE2-specific data exports. Quote from the docs:
  > "We are currently unable to provide any PoE2-specific data."

Reverse-engineering undocumented endpoints violates their ToU (section 7i).

## Local game install — viable in theory, redundant in practice

PoE2 ships its content in `Bundles2/*.bundle.bin` files (Oodle-compressed
binary archives). The data we'd want — item bases, skills, mod pools, the
tree graph — lives inside. Community tools exist (libggpk-family for PoE1,
forks emerging for PoE2) that can extract these.

**However**: this is the work the PathOfBuilding-PoE2 maintainers have
already done, and they keep redoing it every patch. Their `src/Data/` is
the *result* of extracting from the bundles — the same files we already
sync from in `PathOfBuilding-PoE2/`.

When direct extraction would actually help:

- We need a field that PoB-PoE2 deliberately doesn't expose (e.g. internal
  spawn weights for endgame-only mods).
- PoB-PoE2 lags a hot-patch and we need data *today*.
- We want to validate a PoB extract against the source.

When it would not help:

- Building this app's optimizer. The PoB-derived JSON already contains
  everything needed.

If we ever do go direct: the binary format is non-trivial (Oodle is a
proprietary codec; community tools wrap it). Start by reading
`PathOfBuilding-PoE2/CONTRIBUTING.md` and the libggpk2 / VisualGGPK2
project READMEs.

## Mobalytics — PoE2 damage & defence calculation order

**URL:** https://mobalytics.gg/poe-2/guides/damage-defence-calc-order

Authoritative reference for the order in which PoE2 applies modifiers to a
hit (player-side) and to incoming damage (enemy-side). Used as the source
of truth for Layer 5 in [validity-model.md](validity-model.md).

Key takeaways we encoded:

- The 8-step pipeline (avoidance → damage calc → damage-taken-as →
  mitigation → damage-taken modifiers → stun → block → resources).
- "Gain X as Extra" is a kind of conversion in PoE2 (different from PoE1's
  treatment).
- Conversion totals over 100% normalise to 100%.
- Armour% and Resist% are *separate* layers, each capped at 90%.
- Damaging-ailment magnitude is computed pre-mitigation (Step 3); Shock
  magnitude is computed post-mitigation (Step 8).
- Poison and Bleed bypass Energy Shield (Step 8).

This is the spec we validate `composeDamage` against. When in doubt about
the order of operations, this URL is the source — not assumptions carried
over from PoE1.

## Other community sources considered

- **marcoaaguiar/poe2-tree** — community-transcribed PoE2 tree node descriptions.
  Self-described as "scuffed", built from screenshots. Lower fidelity than
  PoB-PoE2 extracts. Not used.
- **poe2.dev build planner** — PoB-compatible import/export. Useful as a
  PoB-code interchange format, not as a data source.
- **POEMCP** — PoE1-focused MCP server. Not relevant to PoE2.
