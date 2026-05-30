# Data pipeline

One command, one direction: **PoB-PoE2 Lua → typed validated JSON → app**.

## How it runs

```
npm run sync-data
```

Reads `PathOfBuilding-PoE2/src/Data/` and writes to `src/data/generated/`.

To roll forward on a patch:

```
cd PathOfBuilding-PoE2 && git pull && cd .. && npm run sync-data
```

The PoB-PoE2 community keeps pace with game patches; pulling their repo is the
update mechanism. The PoB git SHA is recorded in `manifest.json`.

## What lives where

```
scripts/sync-data/
  parseLua.js       # luaparse-based AST -> JS converter
  schemas.js        # zod schemas; anything failing them is dropped + logged
  extractBases.js   # Bases/*.lua -> WeaponBase[]
  extractMods.js    # ModItem.lua  -> ItemMod[]
  index.js          # orchestrator

src/data/generated/
  weapon-bases.json  # 301 weapon bases, 12 categories
  item-mods.json     # 1720 item mods with full multi-line stat capture
  skills.json        # 1248 skills: 667 active + 581 support with Layer-3 tags
  passive-tree.json  # 4701 nodes, 8 classes (tree v0_4) for Layer-4 validity
  manifest.json      # PoB commit SHA + timestamp + counts
```

`skills.json` carries identity + Layer-3 compatibility only (`skillTypes`,
`requireSkillTypes`, `addSkillTypes`, `excludeSkillTypes`, `gemFamily`).
Per-level damage tables are intentionally NOT here — those belong to Layer
5 composition and will be extracted into a separate JSON when we tackle
damage calc.

`passive-tree.json` includes the auto-picked latest tree version from
PoB-PoE2's `src/TreeData/` (currently `0_4`). For each class, the
`startNodeId` is resolved from the node tagged with `classesStart`
(PoB uses legacy PoE1 class names there — Witch/Sorceress share node
54447, etc.).

### Important: tree edges are stored asymmetrically

Each PoE2 tree edge is listed on only ONE endpoint's `connections` array,
not both. When traversing for Layer-4 reachability you MUST build an
undirected adjacency map first:

```
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

Treating `connections` as directed will silently mark hundreds of
correctly-allocated nodes as orphans. Verified: all three baseline builds
have zero orphans with the undirected build, hundreds with the directed
one.

## Design choices

- **Build-time, not runtime.** The previous implementation parsed Lua in the
  browser on every page load using regex. Now parsing happens once, in Node,
  using a real Lua AST parser (`luaparse`). Browser only ever sees JSON.
- **Schema validation rejects bad data.** Zod schemas in `schemas.js` validate
  every record. Anything that fails is written to `*.errors.json` rather than
  silently included. Current count: **0 dropped entries**.
- **Empty Lua `{}` is ambiguous.** Lua doesn't distinguish empty array from
  empty object. The parser returns `[]`; extractors coerce to `{}` where the
  schema demands object shape (e.g. weapon `req`).
- **Mod stat lines are arrays, not strings.** PoB stores statlines as table
  array entries alongside named fields. `parseLua` stashes the array portion
  under a synthetic `__array` key so consumers can read both. This is the fix
  that captures multi-stat mods correctly (see `known-pitfalls.md`).

## Adding a new domain (e.g. armor, gems)

1. Add a new `extract<Domain>.js` mirroring `extractBases.js`.
2. Define a schema in `schemas.js`.
3. Call it from `index.js` and write to `src/data/generated/<domain>.json`.
4. Add a parity diff against any old static JSON before deleting the old file.

## What this pipeline does NOT do (yet)

- Skills (`Skills/*.lua`), gems (`Gems.lua`), uniques (`Uniques/*.lua`),
  passives, atlas. Scope is currently weapons + item mods only.
- Stat *interpretation*. We capture text + numeric ranges but don't translate
  them into the typed effects the damage model needs. That's a downstream job.
- Trade affix grouping / "fractured" / "essence-only" mod flags. PoB has the
  raw data; we just don't expose it yet.
