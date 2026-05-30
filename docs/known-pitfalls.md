# Known pitfalls

Mistakes that have already been made in this codebase, or are easy to make
next. Read before touching the data layer.

## The two-data-systems problem (pre-rewrite)

Before the `sync-data` pipeline existed, the repo had **two parallel data
systems that disagreed with each other**:

- **System A (runtime):** `src/data/weapons.ts` + `src/data/mods.ts` +
  `src/data/pobParser.ts` fetched Lua files at runtime and parsed with regex.
  Consumed by `BuildPlanner/*` and `src/services/modOptimizer.ts`.
- **System B (static JSON):** `Weapons.json`, `WeaponMods.json`,
  `WeaponModsEnhanced.json`, `WeaponModsSummary.json`, `Quarterstaffs.json`,
  `QuarterstaffMods.json`. Different schema from System A. Consumed by
  `WeaponSelector`, `WeaponModSelector`, `WeaponsBrowser`,
  `AttackSkillsPlanner`, `SpellSkillsPlanner`.

Both systems are being replaced by `src/data/generated/*.json` from the
pipeline. As migration progresses, delete files in System A and System B
rather than leaving them as dead code.

## Regex-parsed Lua is a trap

The original `src/data/mods.ts` parsed Lua with hand-written regex. Three
concrete bugs:

1. **Only the first stat line was captured.** Mods like
   "Adds (10-15) to (20-25) Fire Damage / 8% increased Cast Speed" had the
   second line silently dropped. This caused systematically wrong damage.
2. **No `no_<X>_spell_mods` exclusion.** The eligibility check matched
   positive `weightKey` entries only. Fire spell mods could roll on Gelid
   Staff (which has `no_fire_spell_mods = true`). This caused
   "non-existent gear" complaints.
3. **`{ }` parsed inconsistently.** Empty Lua tables came through as `[]`
   sometimes and `{}` other times, depending on surrounding tokens.

The fix: real Lua AST parsing via `luaparse` at build time. Do not reintroduce
regex parsing for Lua data. If you need a new extractor, follow the pattern in
`scripts/sync-data/extract*.js`.

## Lua `{ }` is genuinely ambiguous

Lua doesn't distinguish empty array from empty object. The AST parser returns
`[]` for `{ }`. Whether that should be coerced to `{}` depends on the
semantic field — `req = { }` is an object, `implicitModTypes = { }` is an
array. The extractor must coerce explicitly per field.

## ~30 ad-hoc extraction scripts in `scripts/`

The repo accumulated overlapping one-off scripts:
`extractPassiveSkills.js`, `extractPassiveSkillsWikiTable.js`,
`extractPassiveSkillsWikiTableFull.js`,
`extractPassiveSkillsWikiTableJson.js`, `extractPoBSkills.js`,
`extractPoBSkillsEnhanced.js`, `extractWeaponMods.js`,
`extractWeaponModsEnhanced.js`, `extractWeaponModsPoB.js`,
`enhancedSpellDamage.js`, `mergeSpellDamage.js`, plus a flock of
`check*.js` and `verify*.js` scripts that exist *because* the extracted data
keeps being wrong.

**The presence of "enhanced" / "full" / "v2" duplicates is itself a smell.**
If you find yourself writing `extractFooEnhanced.js`, instead fix the issue
in the original pipeline. The duplicates rot independently and disagree.

These scripts will be deleted as the `sync-data` pipeline reaches parity for
each domain.

## "Main skill" is not always the damage skill

See [poe2-mechanics.md](poe2-mechanics.md). A damage calculator that takes
"skill + supports + gear + tree" and returns a DPS number is wrong for builds
that route damage through triggered skills. The optimizer must include
trigger source as part of the search space.

## Leagues change the game

A build that's correct in League N may be impossible in League N+1. The PoB
source SHA in `manifest.json` ties our data to a specific league snapshot.
Don't compare DPS across leagues.

## Things that look like a "free tool" but aren't

- **Path of Exile dev API for PoE2** — only returns *allocated* passives
  for a character. Does NOT expose the tree graph, item bases, or mods.
  Reverse-engineering undocumented endpoints violates ToU.
- **marcoaaguiar/poe2-tree** — self-described "scuffed" community
  transcription. Lower fidelity than PoB-PoE2 extracts.
- **poe.ninja** — no documented public API. Treat as a black-box reference
  for validation, not as a data source.
