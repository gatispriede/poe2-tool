# Season / patch refresh runbook

How to update our data when GGG ships a new PoE2 patch and the community
updates the upstream sources we depend on.

## Upstream sources we mirror

| Data | Upstream | Our copy | Refresh command |
|---|---|---|---|
| Skills, supports, weapon bases, armour bases, item mods, uniques, passive tree (Lua-extracted) | [PathOfBuildingCommunity/PathOfBuilding-PoE2](https://github.com/PathOfBuildingCommunity/PathOfBuilding-PoE2) | `src/data/generated/*.json` | `git -C PathOfBuilding-PoE2 pull` then `npm run sync-data` |
| Spell base damage tables (per-level min/max from PoB) | Same PoB-PoE2 `src/Data/Skills/*.lua` | `src/data/SpellBaseDamage.json` then merged into `src/data/generated/skills.json` via `perLevelStats` | `node scripts/extractSpellBaseDamage.js && node scripts/mergeSpellDamage.js` (see note below) |
| Visual tree (renders the Step 4 canvas) | [natwarth/poe2-skilltree](https://github.com/natwarth/poe2-skilltree) `data.json` | `public/TreeData/tree.json` | `node scripts/convertTreeData.js --download` |

Note on spell base damage: `extractSpellBaseDamage.js` reads PoB's
`act_int.lua` / `act_dex.lua` / `act_str.lua` directly. If PoB-PoE2 hasn't
updated its skill data yet, the run will pick up nothing new. The merge
step writes to `src/data/PoBSkills.json` (a separate side file) — the
canonical skill data the composer reads (`src/data/generated/skills.json`)
already contains `perLevelStats` from the `sync-data` extractor's
`extractSkills.js`, so merging is mostly a debug-mirror today.

## Patch-day order of operations

1. **Pull upstream PoB** in the sibling repo:
   ```
   git -C PathOfBuilding-PoE2 pull
   ```
   If PoB-PoE2 hasn't released patch data yet, wait — that's the blocker.

2. **Regenerate our typed JSON**:
   ```
   npm run sync-data
   ```
   Writes `src/data/generated/{weapon-bases,armour-bases,item-mods,skills,passive-tree,uniques,manifest}.json`. Check `manifest.json` for the new PoB commit SHA.

3. **Refresh the visual tree** (only if GGG changed the tree this patch):
   ```
   node scripts/convertTreeData.js --download
   ```
   Backs up the old tree to `public/TreeData/tree.0_4.json.bak` (or matching version).

4. **Smoke-test composer against the baseline fixture**:
   ```
   npx react-scripts test --testPathPattern=composeDamage --watchAll=false
   ```
   Expected: zeolet Ice Shot ≈ 1.5M DPS. If it diverges sharply, a regex bucket has broken from a renamed PoB stat — see [composer-evolution.md](composer-evolution.md) for the per-bucket iteration pattern.

5. **Run discovery** to surface what's strong post-patch:
   ```
   CLASS=Witch ASCENDANCY="Blood Mage" TOP_N=5 LEVEL=100 npm run explore
   CLASS=Warrior                       TOP_N=5 LEVEL=100 npm run explore
   # … one per class
   ```

## What typically breaks on a patch

- **Stat key renames in supports** — silently drops a support from our bucket detector. Symptom: a known-good support stops contributing in the optimizer. Fix: open the affected support in PoB-PoE2 lua, grep its new key, add a regex branch in `applySupportMods.ts` or `applyActiveSkillBuffs.ts`.
- **New keystones** — `synthesizeTree.ts` won't anchor them unless added to `requiredNodeIds` for the relevant archetype (see Eldritch Battery wiring for the pattern).
- **New skill gems** — automatically picked up by the candidate enumerator. Worth checking that `perLevelStats` is populated for spell gems; if PoB skipped a level table, the spell silently scales from 0.
- **New trigger meta gems** (CoC-style) — these come in as `SupportMeta*` IDs; the optimizer already excludes them from the swap pool (see task #23). Add real trigger modeling in a follow-up.
- **Passive tree restructure** — keystone node IDs change. `KEYSTONE_NODE_IDS` in `src/damage-v2/maxEnergyShield.ts` needs updating from the new `passive-tree.json`. Find by `node.name === 'Eldritch Battery'` etc.

## Sanity checks after refresh

A 5-minute round-trip:

```
# Did sync-data succeed cleanly?
jq '.errors // []' src/data/generated/*.errors.json 2>/dev/null

# Spell base damage populated for top spells?
node -e 'const s=require("./src/data/generated/skills.json"); for (const id of ["CometPlayer","SparkPlayer","ArcPlayer","HexblastPlayer"]) { const x=s.find(y=>y.id===id); const lvl20=x?.perLevelStats?.[19]; console.log(id, lvl20 ? JSON.stringify(lvl20.stats) : "NO LEVEL DATA"); }'

# Tree has expected node count
node -e 'const t=require("./src/data/generated/passive-tree.json"); console.log("Tree nodes:", Object.keys(t.nodes).length)'

# Composer still produces a number
npx react-scripts test --testPathPattern=composeDamage --watchAll=false 2>&1 | grep DPS
```

If any of these surface an empty / zero / NaN result, fix that before
running discovery — bad inputs cascade into nonsense outputs.

## Open precision gaps that won't auto-update

These need code changes when the patch ships them:

- **0.5 trigger gems as first-class** (Cast on Crit / Spellslinger as standalone gems hosting sub-skills) — task #20. Today modelled as a binary `triggerMode` flag on the composer with a 6.67/sec cap.
- **Caster weapons** (Wand / Sceptre / Focus) — `weapon: null` in our `weapon-bases.json` because the extractor only reads attack-weapon stats. Spell builds currently borrow Quarterstaff stats. See task #19.
- **Per-damage-type tracking** — over-counts "increased Cold Damage" against the physical portion of mixed-type skills. See `docs/damage-calc-coverage.md` Step 2.2.
- **Enemy resistance baseline** — composer assumes 0% res. Real-boss DPS is 2-4× less than what we compute. See `docs/damage-calc-coverage.md` Step 4.
- **Real CoC trigger rate** — computes Spark's hits/sec but caps at 6.67. Theoretically correct (game caps at ~150ms cooldown); will need revisiting if GGG retunes CoC.
