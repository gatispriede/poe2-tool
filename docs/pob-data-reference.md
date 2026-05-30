# PoB-PoE2 data reference

What's in `PathOfBuilding-PoE2/src/Data/` and how to read it. This is our
canonical source of truth; the game itself is not directly queryable for PoE2
(confirmed via the [official dev API](https://www.pathofexile.com/developer/docs/index):
"We are currently unable to provide any PoE2-specific data").

## File map

```
Bases/                # one Lua file per item category
  axe.lua  bow.lua  claw.lua  crossbow.lua  dagger.lua  flail.lua
  mace.lua sceptre.lua spear.lua staff.lua  sword.lua   wand.lua
  amulet.lua belt.lua ring.lua quiver.lua shield.lua focus.lua
  body.lua boots.lua gloves.lua helmet.lua
  jewel.lua flask.lua fishing.lua soulcore.lua traptool.lua

ModItem.lua           # ~1700 item mods (prefix/suffix rolls)
ModItemExclusive.lua  # mods restricted to specific item sources
ModCorrupted.lua      # corruption implicits
ModRunes.lua          # rune mods
ModFlask.lua          # flask-only mods
ModJewel.lua / ModCharm.lua / ModCache.lua / ModMap.lua / ModVeiled.lua
ModScalability.lua    # tier scaling rules

Skills/               # active + support skills (subdirs by type)
Gems.lua              # gem metadata
Uniques/              # uniques by slot
ClusterJewels.lua     # cluster jewel definitions
Essence.lua           # essence mod pools
Costs.lua             # skill mana/spirit costs
SkillStatMap.lua      # stat -> mod tag mapping; crucial for "which mods scale my skill?"
Global.lua / Misc.lua # constants, formulas
StatDescriptions/     # rendering rules for stat text
```

## WeaponBase (Bases/*.lua)

```lua
itemBases["Ashen Staff"] = {
    type = "Staff",
    quality = 20,
    socketLimit = 4,
    tags = {
        no_physical_spell_mods = true,
        no_lightning_spell_mods = true,
        no_cold_spell_mods = true,
        no_chaos_spell_mods = true,
        staff = true, twohand = true, default = true,
    },
    implicit = "Grants Skill: Level (1-20) Firebolt",
    implicitModTypes = { },
    req = { },
}
```

Key fields:

- **`tags`** — A flat key=true table. Two kinds of entries mixed together:
  - *Positive* tags: `staff`, `twohand`, `default`, base-archetype names like
    `ezomyte_basetype` / `maraketh_basetype`. These match against mod
    `weightKey` to decide eligibility.
  - *Negative* tags (`no_X_spell_mods`): exclude entire mod classes from
    rolling. Without these, every elemental staff would be able to roll every
    spell mod — which would generate nonsense items.
- **`type`** — The PoB category label (`"Staff"`, `"Wand"`, `"Two Handed Axe"`).
  Stable; safe to switch on.
- **`req`** — Stat requirements: `{ level=?, str=?, dex=?, int=? }`. Often
  empty (`{ }`).
- **Weapon damage** lives in a `weapon` sub-table (not shown for staves above
  because PoE2 staves are caster weapons with no melee damage block).

## ItemMod (ModItem.lua)

```lua
["LocalIncreasedPhysicalDamagePercent8"] = {
    type = "Prefix",
    affix = "Merciless",
    "(170-179)% increased Physical Damage",  -- statline as array entry
    statOrder = { 943 },
    level = 82,
    group = "LocalPhysicalDamagePercent",
    weightKey = { "axe", "sword", "mace", ..., "default" },
    weightVal = { 100, 100, 100, ..., 0 },
    modTags = { "physical_damage", "damage", "attack" },
    tradeHash = 1509134228,
}
```

Key fields:

- **Stat lines are unnamed array entries.** A single mod can have multiple
  ("Adds (X-Y) to (Z-W) Fire Damage" + "X% increased Cast Speed" on one mod).
  The previous regex parser only captured the first.
- **`group`** — Mods sharing a group are mutually exclusive on one item. One
  rare can roll at most one mod from `LocalPhysicalDamagePercent`. Generators
  MUST enforce this.
- **`weightKey` + `weightVal`** — parallel arrays. `weightVal[i] > 0` means
  the mod can roll on bases tagged `weightKey[i]`. The final `"default"`
  entry usually has `weightVal=0`, meaning "off by default unless an explicit
  positive tag matches".
- **`level`** — Minimum item level for the mod to roll. Higher = better tier.
- **`modTags`** — Damage type / attack-or-cast / etc. tags. Used by skill
  damage scaling: a skill tagged `attack, physical` is boosted by mods whose
  `modTags` overlap.

## The eligibility rule

**This is the single rule the gear generator must enforce** to stop producing
non-existent items:

```
canRoll(mod, base, itemLevel) =
    mod.level <= itemLevel
  AND (∃ i: mod.weightKey[i] ∈ base.tags AND mod.weightVal[i] > 0)
  AND (no `no_<X>_spell_mods` tag in base.tags excludes mod.modTags X)
```

For uniqueness within an item:

```
rollOne(base):
    pick prefixes:  ≤ 3, all from distinct groups
    pick suffixes:  ≤ 3, all from distinct groups
    weighted by weightVal[i] for the matching tag
```

## Gotchas

- **Files marked "automatically generated, do not edit"** — they are. Don't
  hand-patch them. The upstream PoB repo regenerates from game files. If a
  field looks wrong, check whether the issue is upstream first.
- **`[DNT]` and `Test` prefixed entries** are dev placeholders. Skip them.
- **PoE2 vs PoE1 schema differences.** `passives.specialisations` (set1/set2/set3),
  `passives.quest_stats`, and `skills` (replacing PoE1's `inventory`) are PoE2-only.
  `hashes_ex` and `mastery_effects` are PoE1-only.
