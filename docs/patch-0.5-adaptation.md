# Patch 0.5.0 "Return of the Ancients" — adaptation map

Source: official notes — https://www.pathofexile.com/forum/view-thread/3932540

The headline finding: **~95% of this patch is data, not code.** Our system
is data-driven — skill damage, support effects, unique mods, item mods, tree
values, and ascendancy stats all flow in by re-running `npm run sync-data`
against the updated PathOfBuilding-PoE2 repo (see [season-refresh.md](season-refresh.md)).
This doc records the exceptions that needed code, and classifies each patch
section so we know what to re-verify after the data refresh.

## What changed in code (this pass, proactive)

| Change | File | Why |
|---|---|---|
| Added Spirit Walker (Huntress) + Martial Artist (Monk) to CLASS_PROFILE | [generateBuild.ts](../src/generator/generateBuild.ts) | The 2 new 0.5 ascendancies. Forward-ready; synthesizer no-ops on them until composer tree refreshes from PoB 0.5. |
| Crit-multi regex now matches `critical_damage_bonus` as well as `critical_strike_multiplier` | [applySupportMods.ts](../src/damage-v2/applySupportMods.ts), [applyActiveSkillBuffs.ts](../src/damage-v2/applyActiveSkillBuffs.ts) | 0.5 renamed display "Critical Strike Multiplier" → "Critical Damage Bonus". Insurance against a PoB stat-id rename silently dropping crit supports. |

## Net-new game systems (assessed)

| System | Affects our DPS calc? | Action |
|---|---|---|
| **Runic Ward** (new defence — survives at 1 life) | No — pure defensive layer | Out of scope (DPS-only). Revisit if/when we add an EHP model. |
| **Minion Splash / Minion Splash II** supports | Only minion builds | Picked up as data; minion DPS isn't deeply modelled yet regardless. |
| **23 new Lineage support gems** (Arbiter's Reach, etc.) | Yes, as new optimizer candidates | Data refresh. Verify their `constantStats` keys land in a recognized bucket; unrecognized keys surface in the `support stats skipped` note. |
| **50+ new uniques** (Mageblood, Loreweave, Voices) | Yes — some are build-defining | Data refresh via `extractUniques`. Mageblood-class items that *rewrite rules* (flask uptime) may need bespoke modelling later. |
| **.build file format** (in-game build sharing) | No (import/export, not calc) | Possible future import path; not a calc change. |

## Section-by-section classification

| Patch section | Class | Notes |
|---|---|---|
| Player Changes (bleed-while-moving, leech caps, deflect formula, splash once-per-area, archon buffs) | mostly **defensive / data** | Leech 40k cap + single-instance and deflect formula are defensive — out of our DPS scope. None touch the hit-damage pipeline. |
| Ascendancy Changes (Blood Mage Vitality Siphon 20%, Chronomancer rework, etc.) | **data** | Ascendancy node stats live in the tree. Refresh updates them. We don't yet model ascendancy *mechanics* beyond stat lines (task #16). |
| Passive Tree Changes (~60 nodes retuned, new clusters, keystone reworks) | **data** | All in `passive-tree.json`. ⚠️ keystone node IDs may shift — re-verify `KEYSTONE_NODE_IDS` (Eldritch Battery 57513, Mind Over Matter 45918) in [maxEnergyShield.ts](../src/damage-v2/maxEnergyShield.ts). |
| Skill Changes (Comet nerf, Cull the Weak buff, Volcano 8% base crit, dozens more) | **data** | `perLevelStats` / `constantStats` update on refresh. Comet builds will recompute lower automatically. |
| Support Changes (Overextend removed, Uhtred's +2 was +3, Volt rework, etc.) | **data** | Optimizer reads supports from skills.json. **Overextend removed** → our zeolet fixture references it but the lookup skips it gracefully (no crash; zeolet is a 0.4 baseline). |
| Unique Item Changes (Hyrri's Ire evasion nerf, Atziri's Acuity rework, etc.) | **data** | `uniques.json` refresh. |
| Item Changes (armour/evasion/ES level scaling, rune retunes, mod-tier changes, crafted-mod limits) | **data** | `weapon-bases`, `armour-bases`, `item-mods` refresh. The "+5 at Tier 1 (was +7)" skill-level mods directly affect generated rare weapon DPS. |
| Monster / Quest / UI / Microtransaction / Bug Fixes | **ignore** | No bearing on the build calculator. |

## Post-refresh re-verification checklist (run after PoB ships 0.5 + `npm run sync-data`)

1. **Keystone IDs** — confirm Eldritch Battery / Mind Over Matter still map to 57513 / 45918:
   ```
   node -e 'const t=require("./src/data/generated/passive-tree.json"); for (const n of Object.values(t.nodes)) if (/Eldritch Battery|Mind Over Matter/.test(n.name||"")) console.log(n.id, n.name)'
   ```
   If changed, update `KEYSTONE_NODE_IDS` and the `requiredTreeNodes` literal (57513) in [generateBuild.ts](../src/generator/generateBuild.ts).
2. **Crit stat key** — confirm whether PoB renamed `critical_strike_multiplier`. If it's now `critical_damage_bonus`, our regex already handles it; if it's a third spelling, add it.
3. **Comet baseline** — recompute Witch Comet; expect it LOWER than our current 26.43M (Comet was nerfed). That's correct, not a regression.
4. **New supports in optimizer** — run a Witch/Warrior explore and check the `support stats skipped` notes for new Lineage supports whose stat keys we don't bucket yet; add regex branches as needed.
5. **Mageblood / Voices** — if these landed, decide whether to model their rule-rewriting effects (flask permanence, jewel socket transforms) or leave as stat-only.
6. **Spirit Walker / Martial Artist** — once the composer tree has them, run `CLASS=Huntress ASCENDANCY="Spirit Walker"` and `CLASS=Monk ASCENDANCY="Martial Artist"` explores to confirm the synthesizer allocates their nodes.

## What this patch does NOT break

- The composer's damage pipeline (flat → conversion → extra → increased → more → crit → rate). No new damage type, no new core multiplier class.
- The data extraction pipeline (`sync-data`) — the lua shapes are unchanged; only values moved.
- The visual passive tree — already on 0.5 via natwarth's data.
