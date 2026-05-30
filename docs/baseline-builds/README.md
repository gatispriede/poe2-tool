# Baseline builds

Real top-tier builds scraped from poe.ninja, used as **ground-truth fixtures**
for the damage calculator and optimizer. If our calc says build X is best but
poe.ninja's top players run Y, our model is wrong — not them.

## What's here

| File | Character | Class | Headline | Headline DPS | Damage profile |
|------|-----------|-------|----------|--------------|----------------|
| [rsfearless-arc.md](rsfearless-arc.md) | ttv_RsFearless | Blood Mage | Spark → CoC → Arc | 1.0M (Arc, triggered) | spell, trigger-chain |
| [gaobin-comet-trigger.md](gaobin-comet-trigger.md) | 小手冰冰冷 (Gaobin) | Blood Mage | Spark → CoC → Comet | 180M (Comet, triggered) | spell, trigger-chain at scale |
| [zeolet-ice-shot.md](zeolet-ice-shot.md) | InwJokerJrZaaa (zeolet) | Amazon | Ice Shot (direct-fire bow attack) | 17M (Ice Shot, direct) | attack, weapon-based |

All three are from the **Vaal** league. They span three meaningfully
different damage profiles — pick fixtures that cover the case you're
implementing, not just whichever is closest.

## Status

Fixtures are **complete enough** to drive damage-calc validation. We have:

- Class / ascendancy / level / keystones
- Defensive stats (life, ES, mana, spirit, res, EHP, max hit)
- Skill DPS estimates as reported by poe.ninja
- All gem socket groups with every gem's `skillId`, `level`, `quality`, `variantId`
- Every equipped item with rarity, name, base, item level, quality, sockets,
  runes, implicits, and explicits — fully parsed
- Allocated passive tree node IDs (133 for Gaobin, 156 for RsFearless)
- Tree metadata: classId, ascendClassId, tree version

Pipeline:

```
poe.ninja                                     scripts/parse-pob.js
"Import code for PoB" textbox                       │
  │                                                 ▼
  └── *-pob.txt  ──zlib+base64──→  *-pob.xml  ──→  *-build.json
```

The `.txt` (raw PoB code) is the source of truth. Re-running
`node scripts/parse-pob.js <file.txt>` regenerates the JSON.

## How to use

When building or testing the damage calculator:

1. Pick a fixture (e.g. Gaobin's triggered Comet).
2. Configure our calc with the same skill + supports + level + keystones.
3. Compare output against the poe.ninja-reported DPS column.
4. If we're more than ~10% off and we have all relevant inputs, the calc has a
   bug or is missing a mechanic.

For trigger builds, the relevant DPS is the **triggered** skill's DPS, not the
direct-cast number. See `poe2-mechanics.md`.
