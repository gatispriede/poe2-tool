# Handoff — pick this up locally

Everything below is committed. Two workstreams: the **Skill Lab** (skill ↔ tree ↔
item relationship engine) and the **item filter** hardening for patch 0.5.5.

---

## 1. Skill Lab — done, running, tested

A platform that answers, for one skill at a time, *what in the game changes what
this skill does, and by how much* — across the passive tree, item affixes,
uniques and support gems.

| Where | What |
| --- | --- |
| `src/engine/` | The engine. Start at [`src/engine/README.md`](src/engine/README.md) |
| `src/components/SkillLab/` | The UI (first tab in the app) |
| `scripts/lab/skill-lab.js` | Same engine, in the terminal |
| `docs/skill-lab.md` | How to read the output |

```bash
npm install
npm start                                  # Skill Lab tab
npm run lab -- "Spark"                     # all four buckets
npm run lab -- "Spark" --bucket speed      # one axis
npm run lab -- "Sunder" --class Warrior    # price tree nodes from one class
npm run lab -- "Detonate Dead" --synergy   # what to pair it with
npm run lab -- --coverage                  # what the parser understands
CI=true npx react-scripts test --testPathPattern "engine/__tests__" --watchAll=false
```

**Test state:** 46 engine tests pass. Four suites fail repo-wide
(`validate`, `WeaponModSelector`, `WeaponMods`, `App.test`) — all four fail
identically on the pre-existing commit `672bcf4`, verified in a throwaway
worktree. They are stale expectations from before the tabbed layout and the 0.5
data sync, not regressions. Fixing them is unclaimed work.

**Design in one line:** everything reduces to a shared tag alphabet, so
applicability is a set test rather than a pattern-per-mod table — re-synced data
lands in the right bucket without new code. Four deliberate exceptions
(proxy delivery, weapon clauses, an attack's gear-derived damage type,
conditions as uptime) are documented in `src/engine/README.md`.

---

## 2. Item filter — hardened for 0.5.5

**The problem.** The filter is first-match-wins and ends with a good magenta
catch-all `Show`, but ~13 blanket `Hide` rules fire before it — `Hide / Class ==
"Amulets"`, `Hide / Rarity Rare`, `Hide / Rarity Normal Magic`. Those hide by
*category*, so anything the game adds in a category you already hide never
reaches the catch-all. New content is silently swallowed.

**The fix.** `scripts/filter/harden-filter.js` rewrites each blanket `Hide` into
an explicit blocklist by naming every base type in the synced data (948 of them,
from `src/data/generated/{weapon,armour}-bases.json` via
`scripts/filter/baseTypes.js`). Same items hidden as before; anything the data
has never heard of stops matching and falls through to your catch-all. Only
`BaseType ==` is used — syntax your filter already relies on, nothing that needs
verifying against a patch.

```bash
node scripts/filter/harden-filter.js filters/original.filter --report
node scripts/filter/harden-filter.js filters/original.filter \
    --vendor-quality --before "HIDE DEX/INT BODY ARMOUR" \
    -o filters/hardened.filter
```

| File | |
| --- | --- |
| `filters/original.filter` | your filter as uploaded, untouched |
| `filters/hardened.filter` | the output to paste into the site |

**Verified invariants** (re-run the commands above to reproduce):

- 13 blanket hides → 0 remaining. Re-running `--report` on the output confirms it.
- Known bases (`Emerald Ring`, `Lapis Amulet`, `Attuned Wand`, `Vaal Greaves`,
  `Colossal Life Flask`) still appear in the hide lists — today's screen is unchanged.
- 0.5.5 core-integration items (`Sacred Bloom`, `Verisium Remnant`,
  `Exotic Coinage`) appear in **no** hide list — they reach the catch-all.
- Show blocks 103 → 108 (the five vendor-quality rules), Hide blocks 24 → 24.
- Size 44 KB → 112 KB. Ugly to read, harmless to load.

**Vendor-quality highlight.** `--vendor-quality` adds five pink-background
`Show` rules, one per quality-currency family, placed above the blanket hides:

| Family | Classes |
| --- | --- |
| Armourer's Scrap | Body Armours, Helmets, Gloves, Boots, Shields, Bucklers |
| Blacksmith's Whetstone | all martial weapons |
| Arcanist's Etcher | Wands, Sceptres, Staves, Foci |
| Glassblower's Bauble | Life/Mana Flasks, Charms |
| Gemcutter's Prism | Skill Gems, Support Gems |

Threshold is `Quality >= 1` (`--min-quality N` to change it). Your existing
cyan `Quality >= 20` rule sits above it and still wins, so 20%+ items keep the
cyan treatment and 1–19% become pink.

### Open items on the filter

1. **`Hide / Class == "Skill Gems" "Support Gems"` is still blanket.** Gem names
   are not in the base-type data, so enumerating them would change what the rule
   hides. New gems in a future patch will be hidden by it. Options: enumerate
   from `src/data/generated/skills.json` (1226 names), or convert it to a dim
   `Show`. Needs a decision.
2. **The vendor recipe threshold is an assumption.** 0.5.5's notes say nothing
   about vendor quality returns and the web is unreachable from the cloud
   container, so `Quality >= 1` is a judgement call, not a verified mechanic.
   Confirm in game and adjust `--min-quality`.
3. **Re-run after every data sync.** `npm run sync-data` then re-run the harden
   command, so the enumerated lists cover the newest bases and only genuinely
   new content falls through.

---

## 3. Patch 0.5.5 — what actually matters here

From the notes PDF (OCR'd locally; the forum is unreachable from the container).
0.5.5 is an **event-league and core-integration patch, not a content patch** —
there is no new-base-types section. Sections: Forbidden Rites event league,
Ritual changes, Trial of Chaos, **Runes of Aldur moving to core**, endgame,
league content, UI, microtransactions, bug fixes.

The filter-relevant part is Runes of Aldur going core: Expedition, Farrow,
Dannig, Expedition Tablets, Verisium Remnants and Expedition uniques now appear
in Standard and Forbidden Rites. Plus **Sacred Blooms** as a new Ritual reward.
Those are exactly the items a trailing `Hide / Rarity Normal Magic` would have
eaten — which is what the hardening prevents.

**Not yet done:** re-syncing the Skill Lab dataset to 0.5.5.
`npm run sync-data` pulls from PathOfBuilding-PoE2; the current data is PoB
commit `9c2bf031` (2026-05-30). Nothing in the engine should need code changes —
that is the point of the tag-alphabet design — but `npm run lab -- --coverage`
after the sync will show whether any new wording slipped past the lexicon.

---

## 4. Environment notes (cost me time, will cost you none)

- **Outbound web is blocked** in the cloud container: `pathofexile.com` and
  `pathofexile2.com` both return 403 at the egress proxy, and the filter URL is
  account-gated on top of that. Patch notes and the filter had to be uploaded as
  files. Locally you will not have this problem.
- The notes PDF is a print-to-PDF with **no text layer**. Extraction needs
  `poppler-utils` + `tesseract-ocr` (`pdftoppm -r 150 -png`, then `tesseract`).
- The CLI runs the TypeScript engine directly through a ~30-line
  `require` hook (`scripts/lab/ts-runtime.js`) — no build step, no new
  dependency. `npx tsc --noEmit` stays the type gate.
