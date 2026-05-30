# Path of Building (PoE2) - Data Source Context

This document describes the Path of Building Community (PoE2) application structure, which serves as our primary data source for building a PoE2 build planning tool.

**PoB Location:** `C:\Users\User\AppData\Roaming\Path of Building Community (PoE2)`

---

## Overview

Path of Building Community (PoE2) is a desktop build planning tool written in **Lua** with a **C++ backend**. It contains comprehensive game data for Path of Exile 2 including skills, items, passive trees, and calculation engines.

**Current Version:** 0.15.0 (Jan 14, 2026)

---

## Project Statistics

| Metric | Count |
|--------|-------|
| Total Lua Files | 918 |
| Lua Code Lines | ~345,000+ |
| Core Modules | 23 |
| UI Control Classes | 67 |
| Data Files | 773 |
| Data File Lines | ~272,000 |
| PNG Assets | 257 |
| Tree Versions | 4 (0_1, 0_2, 0_3, 0_4) |

---

## Key Data Files

### Skill Gems
**Location:** `Data/Gems.lua` (462 KB)

Contains all skill gem definitions with:
- Gem metadata (name, ID, grantedEffectId)
- Tags (intelligence, spell, area, cold, etc.)
- Gem type (Spell, Attack, Support)
- Attribute requirements (reqStr, reqDex, reqInt)
- Tier and max level

**Example Structure:**
```lua
["Metadata/Items/Gems/SkillGemIceNova"] = {
    name = "Ice Nova",
    gameId = "Metadata/Items/Gems/SkillGemIceNova",
    grantedEffectId = "IceNovaPlayer",
    tags = { intelligence = true, spell = true, area = true, cold = true },
    gemType = "Spell",
    reqStr = 0, reqDex = 0, reqInt = 100,
    Tier = 1,
    naturalMaxLevel = 20,
}
```

**Additional Skill Data:**
- `Data/Skills/act_str.lua` - Strength active skills
- `Data/Skills/act_dex.lua` - Dexterity active skills
- `Data/Skills/act_int.lua` - Intelligence active skills
- `Data/Skills/sup_str.lua` - Strength support gems
- `Data/Skills/sup_dex.lua` - Dexterity support gems
- `Data/Skills/sup_int.lua` - Intelligence support gems
- `Data/Skills/minion.lua` - Minion skills
- `Data/Skills/spectre.lua` - Spectre skills
- `Data/SkillStatMap.lua` (98 KB) - Skill stat mappings

### Item Data

**Base Types:** `Data/Bases/` (429 KB total)
- `amulet.lua`, `axe.lua`, `belt.lua`, `body.lua`, `boots.lua`
- `bow.lua`, `claw.lua`, `crossbow.lua`, `dagger.lua`, `flask.lua`
- `gloves.lua`, `helmet.lua`, `jewel.lua`, `mace.lua`, `quiver.lua`
- `ring.lua`, `sceptre.lua`, `shield.lua`, `staff.lua`, `sword.lua`
- `wand.lua`, `focus.lua`, `trap.lua`

**Unique Items:** `Data/Uniques/` (184 KB total)
- Same structure as bases, one file per item type
- Contains fixed modifiers and variants

### Modifier Data

**Core Files:**
- `Data/ModCache.lua` (956 KB) - All cached modifiers
- `Data/ModItem.lua` (596 KB) - Item modifiers
- `Data/ModItemExclusive.lua` (1.3 MB) - Exclusive modifiers
- `Data/ModScalability.lua` (1.3 MB) - Mod scaling data
- `Data/QueryMods.lua` (517 KB) - Trade query modifiers

### Stat Descriptions
**Location:** `Data/StatDescriptions/`
- `stat_descriptions.lua` - Main stat lookup
- `gem_stat_descriptions.lua` - Gem-specific stats
- `skill_stat_descriptions.lua` - Skill stats
- `passive_skill_stat_descriptions.lua` - Passive tree stats
- `active_skill_gem_stat_descriptions.lua` - Active gem stats

### Other Data
- `Data/Spectres.lua` (475 KB) - Spectre minion data
- `Data/Essence.lua` (40 KB) - Essence crafting
- `Data/Minions.lua` (37 KB) - Minion stats
- `Data/ClusterJewels.lua` (36 KB) - Cluster jewel data
- `Data/Global.lua` - Game constants and tables

---

## Passive Tree Data

**Location:** `TreeData/`

### Versions
- `TreeData/0_1/` - Tree version 0.1
- `TreeData/0_2/` - Tree version 0.2
- `TreeData/0_3/` - Tree version 0.3
- `TreeData/0_4/` - Tree version 0.4 (Latest)
- `TreeData/legion/` - Legion passive trees

### Assets
- Compressed DDS textures (`.dds.zst`)
- Multiple resolutions: 348px to 4000px
- Node graphics for: normal, notable, keystone, ascendancy, oracle

---

## Calculation Modules

**Location:** `Modules/`

### Core Calculation Files
| File | Size | Purpose |
|------|------|---------|
| `CalcOffence.lua` | 5,872 lines | Damage calculations |
| `CalcDefence.lua` | 4,241 lines | Defense calculations |
| `CalcPerform.lua` | 3,270 lines | DPS/performance metrics |
| `CalcSetup.lua` | 83 KB | Calculation environment setup |
| `CalcTriggers.lua` | 79 KB | Triggered effect calculations |
| `CalcSections.lua` | 197 KB | Result formatting/display |
| `ModParser.lua` | 6,933 lines | Modifier text parsing |

### Damage System
- 5 damage types: Physical, Lightning, Cold, Fire, Chaos
- Conversion/gain tables for damage interactions
- Elemental status ailment calculations
- Critical strike and accuracy calculations
- Leech and life gain mechanics

### Defense System
- Armour, evasion, energy shield calculations
- Status ailment thresholds
- Monster AI and poise mechanics
- Damage reduction and mitigation

---

## UI/Class System

**Location:** `Classes/` (67 files)

### Key Classes
| File | Size | Purpose |
|------|------|---------|
| `Item.lua` | 74 KB | Item system |
| `ItemsTab.lua` | 137 KB | Items UI tab |
| `TreeTab.lua` | 101 KB | Passive tree UI tab |
| `PassiveSpec.lua` | 82 KB | Tree specifications |
| `PassiveTreeView.lua` | 67 KB | Tree rendering |
| `SkillsTab.lua` | 58 KB | Skills UI tab |
| `TradeQuery.lua` | 47 KB | Trade integration |
| `ImportTab.lua` | 46 KB | Import/export |
| `GemSelectControl.lua` | 37 KB | Gem selection UI |
| `PassiveTree.lua` | 29 KB | Passive tree logic |

---

## Build File Format

Builds are stored as **XML** files with:
- Complete build state
- Tree specification
- Equipped items
- Skill configurations
- Build settings

**Features:**
- Base64 encoded for share links
- Compression support
- Multiple trees per build
- Export/import functionality

---

## Assets

**Location:** `Assets/` (257 PNG files, ~2 MB)

- UI icons (item slots, weapon types)
- Header graphics for item rarities
- Passive skill node graphics
- Range guide visualization
- Modifier tooltips and UI elements

---

## External Libraries

**Location:** `lua/`
- `base64.lua` - Base64 encoding
- `xml.lua` - XML parsing
- `dkjson.lua` (22 KB) - JSON parsing
- `sha2.lua` (281 KB) - SHA hashing
- `socket.lua` - Network sockets

---

## API Integration

- **libcurl** for HTTP requests
- pathofexile.com API integration
- Trade website integration
- Build sharing via external sites
- Cached responses in `poe_api_response.json`

---

## Useful Entry Points for Data Extraction

1. **All Skills:** `Data/Gems.lua` + `Data/Skills/*.lua`
2. **All Items:** `Data/Bases/*.lua` + `Data/Uniques/*.lua`
3. **All Modifiers:** `Data/ModCache.lua`
4. **Stat Translations:** `Data/StatDescriptions/*.lua`
5. **Passive Tree:** `TreeData/0_4/` (latest version)
6. **Calculation Logic:** `Modules/Calc*.lua`
7. **Item Parsing:** `Classes/Item.lua`
8. **Tree Logic:** `Classes/PassiveSpec.lua` + `Classes/PassiveTree.lua`

---

## Notes for Development

1. All data is in **Lua table format** - will need parsing/conversion
2. Modifier parsing is complex (see `ModParser.lua` - 6,933 lines)
3. Tree data includes compressed image assets
4. Calculation engine handles many edge cases and game mechanics
5. Current tree version is **0_4** (check for updates)
6. Build XML format is well-documented through `ImportTab.lua`
