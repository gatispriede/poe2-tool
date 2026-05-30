# POE2 Damage Calculator - AI Context File

## Project Overview
A React TypeScript application for calculating damage in Path of Exile 2, including passive tree nodes, skills, weapons, and mod combinations. Uses SciChart for visualization.

## Tech Stack
- **Framework**: React 19.2.0 with TypeScript 4.9.5
- **Build Tool**: Create React App (react-scripts 5.0.1)
- **Charting**: SciChart 3.0.0 (requires runtime license key)
- **Data Extraction**: Cheerio, node-fetch

## Project Structure

```
poe2/
├── src/
│   ├── App.tsx                    # Main app with navigation between pages
│   ├── components/                # UI Components
│   │   ├── AttackSkillsPlanner/   # Attack skill + weapon damage planner with mods
│   │   ├── SpellSkillsPlanner/    # Spell skill + caster weapon planner with mods
│   │   ├── BuildPlanner/          # Legacy build planner (skill + weapon selection)
│   │   ├── DamageCalculator/      # Main damage calculator page
│   │   ├── DamageGraph/           # SciChart damage visualization component
│   │   ├── SkillsBrowser/         # Browse all skills with filters and sorting
│   │   ├── WeaponsBrowser/        # Browse all weapons with mod generator
│   │   ├── PassiveTreeSelector/   # Passive tree node selection
│   │   ├── SamplePassiveSelector/ # Sample passive selection UI
│   │   ├── TablePassiveSelector/  # Table-based passive selection
│   │   ├── SkillSelector/         # Skill dropdown selector
│   │   ├── WeaponSelector/        # Weapon dropdown selector
│   │   └── WeaponModSelector/     # Weapon mod (prefix/suffix) selector
│   ├── data/                      # JSON data files
│   │   ├── PoBSkills.json         # All skills extracted from Path of Building 2 (LARGE)
│   │   ├── Weapons.json           # All weapons with damage stats
│   │   ├── WeaponMods.json        # Weapon prefixes/suffixes with applicable weapons
│   │   ├── Wands.json             # Wand-specific data
│   │   ├── Quarterstaffs.json     # Quarterstaff weapon data
│   │   ├── QuarterstaffMods.json  # Quarterstaff-specific mods
│   │   ├── SkillGems.json         # Basic skill gem data
│   │   ├── ElementalSkillGems.json# Elemental skill gems
│   │   ├── SpellBaseDamage.json   # Spell base damage values
│   │   └── DataTableData.ts       # Legacy data table definitions
│   ├── damage/                    # Damage calculation logic
│   │   ├── formulas.ts            # PoB2-compatible damage formulas
│   │   ├── model.ts               # TypeScript interfaces for damage calc
│   │   └── __tests__/             # Unit tests for damage calculations
│   └── passives/                  # Passive skill tree data
│       ├── passive_skills_wiki_table.json  # Parsed passive nodes
│       ├── sample_passive_skills.json      # Sample passive data
│       ├── parser.ts              # Passive effect text parser
│       ├── effectParser.ts        # Parse passive effect values
│       ├── aggregator.ts          # Aggregate passive bonuses
│       └── passivesData.ts        # Passive data utilities
├── scripts/                       # Data extraction scripts (Node.js)
│   ├── extractPoBSkills.js        # Extract skills from PathOfBuilding-PoE2
│   ├── extractWeapons.js          # Extract weapon data
│   ├── extractWeaponMods.js       # Extract weapon mod data
│   ├── extractSkillGems.js        # Extract skill gems from wiki
│   ├── extractWands.js            # Extract wand data
│   ├── extractQuarterstaffs.js    # Extract quarterstaff data
│   └── ... (other extraction scripts)
├── PathOfBuilding-PoE2/           # Path of Building 2 source (reference data)
│   └── src/Data/                  # Lua data files for skills, gems, etc.
├── public/                        # Static assets
│   ├── scichart2d.wasm            # SciChart WebAssembly (REQUIRED)
│   └── scichart2d.data            # SciChart data file (REQUIRED)
└── build/                         # Production build output
```

## Key Data Structures

### Skill Interface (from PoBSkills.json)
```typescript
interface Skill {
  id: string;
  name: string;
  description: string;
  fullDescription?: string;
  gemType: string;              // "Attack" | "Spell" | "Buff" | "Minion" | "Warcry"
  type: string;                 // "Attack" | "Spell" | etc.
  element: string | null;       // "Fire" | "Cold" | "Lightning" | "Chaos" | "Physical" | null
  tags: string[];
  tagString: string;
  weaponRequirements: string | null;  // Required weapon types for attacks
  requirements: { str: number; dex: number; int: number };
  tier: number;
  moreDamageMultipliersPct: number[];
  moreAttackSpeedMultipliersPct: number[];
  baseDamageData?: {
    baseMultiplier?: number;           // % of weapon damage used
    baseMultiplierLvl20?: number;
    critChance?: number;
    attackSpeedMultiplier?: number;
  };
  // Spell-specific damage (from PoB extraction)
  minDamageLvl1?: number;
  maxDamageLvl1?: number;
  minDamageLvl20?: number;
  maxDamageLvl20?: number;
  damageTypes?: string[];              // ["fire", "physical", etc.]
  baseEffectiveness?: number;          // For calculating added damage
  incrementalEffectiveness?: number;
  levelDamageData?: Record<string, Record<string, { min: number; max: number }>>;
  castTime?: number;                   // For spells
}
```

### Weapon Interface
```typescript
interface Weapon {
  id: string;
  name: string;
  category: string;            // "One Hand Mace", "Two Hand Sword", etc.
  type: string;                // "Wand", "Staff", "Sword", etc.
  implicit: string | null;
  damage: {
    physical: { min: number; max: number };
    fire: { min: number; max: number };
    cold: { min: number; max: number };
    lightning: { min: number; max: number };
    chaos: { min: number; max: number };
  };
  critChance: number;
  attackRate: number;
  range: number;
  requirements: { level: number; str: number; dex: number; int: number };
  dps: { physical: number; elemental: number; chaos: number; total: number };
}
```

### Weapon Mod Interface
```typescript
interface WeaponMod {
  id: string;
  type: 'Prefix' | 'Suffix';
  affix: string;               // Mod name (e.g., "Flaming")
  level: number;               // Item level required
  group: string | null;        // Mod group (mutually exclusive within group)
  stats: string[];             // Effect descriptions
  category: string;
  applicableWeapons: string[]; // ["All Weapons"] or specific types
}
```

## Main Pages/Components

### 1. Damage Calculator (`/components/DamageCalculator/`)
- Basic damage calculation with weapon, skill, and passive selection
- Uses `damage/formulas.ts` for PoB2-compatible calculations

### 2. Skills Browser (`/components/SkillsBrowser/`)
- Browse all skills from PoBSkills.json
- Filter by type (Attack/Spell), element, weapon requirement
- Sort by base damage, name
- Hover to see full description

### 3. Weapons Browser (`/components/WeaponsBrowser/`)
- Browse all weapons from Weapons.json
- Sort by DPS, crit, attack speed
- Generate random prefix/suffix combinations

### 4. Attack Skills Planner (`/components/AttackSkillsPlanner/`)
- Select attack skill + compatible weapon
- Automatically filters weapons by skill requirements
- Shows best prefix/suffix combinations via SciChart
- Manual bonus inputs (crit mult, crit chance, attack speed)
- Supports weapon-specific mods

### 5. Spell Skills Planner (`/components/SpellSkillsPlanner/`)
- Select spell skill + caster weapon (Wand/Sceptre/Staff)
- Shows spell damage scaling with weapon mods
- SciChart visualization of mod combinations
- Manual bonus inputs
- Supports weapon-specific mods

## Damage Calculation Logic

### Attack Skills (from `AttackSkillsPlanner.tsx`)
Attack skills deal damage based on **weapon base damage × skill multiplier**.

**Calculation Flow:**
1. **STEP 1 - Weapon Base Damage**: Get weapon's physical/elemental min-max values
2. **STEP 2 - Apply Weapon Mods (Prefixes & Suffixes)**:
   - Flat physical damage: `(base + flat) × (1 + %increased)`
   - Added elemental damage from mods
   - Attack speed bonuses
   - Critical strike chance bonuses
   - Result: Modified Weapon Damage
3. **STEP 3 - Apply Skill Multiplier**:
   - Skill Damage = Modified Weapon Damage × `baseMultiplier` (e.g., 185% = 1.85)
   - This is the actual hit damage the skill deals
4. **STEP 4 - Calculate DPS**:
   - DPS = Skill Damage × Attack Speed × Effective Crit Multiplier
   - Effective Crit = 1 + (critChance × (critMultiplier - 1))
5. **STEP 5 - Support Skills** (if any):
   - More Damage Multiplier: DPS × (1 + moreDamage%)
   - More Attack Speed: Attacks/s × (1 + moreSpeed%)

**Key Attack Skill Fields:**
- `baseDamageData.baseMultiplier`: % of weapon damage at level 1
- `baseDamageData.baseMultiplierLvl20`: % of weapon damage at level 20
- `weaponRequirements`: Which weapon types can use this skill

### Spell Skills (from `SpellSkillsPlanner.tsx`)
Spell skills have their own base damage that scales with gem level.

**Calculation Flow:**
1. **Skill Base Damage**: `minDamageLvl20` to `maxDamageLvl20` from skill gem
2. **Weapon Mods**: % increased spell damage, added elemental to spells, cast speed
3. **Passive Tree Bonuses**: Integrated from passive tree optimizer (if selected)
   - Increased Spell Damage
   - Increased Elemental Damage (Fire/Cold/Lightning)
   - Element-specific damage (matches skill element)
   - Increased Cast Speed
   - Increased Spell Critical Strike Chance & Multiplier
   - Area/Projectile Damage (if skill has relevant tags)
4. **Cast Speed**: Base cast time modified by cast speed bonuses + passives
5. **Critical Strikes**: Skill crit chance + mods + passive bonuses
6. **Support Skills**: More damage/speed multipliers
7. **Final DPS**: Average Damage × Casts/sec × Effective Crit Multiplier

**Passive Tree Integration:**
- Passive tree stats are automatically applied when the Passive Tree Optimizer component is used
- Stats are passed through all calculation functions via `passiveStats` parameter
- Element-specific bonuses (Fire/Cold/Lightning/Chaos) are applied based on skill element
- Area/Projectile damage bonuses apply when skill has matching tags
- Display shows both individual passive bonuses and total combined multipliers

**Passive Tree Filtering:**
- Filter passive nodes by damage type (Fire, Cold, Lightning, Chaos, Spell, Critical, etc.)
- 12 filter categories with color-coded buttons and emojis
- Filters work in both Auto and Manual optimization modes
- Each node tagged with relevant damage types (e.g., Fire nodes also tagged as Elemental)
- Real-time node count display when filtered
- Smart categorization: nodes can belong to multiple categories

**Key Spell Skill Fields:**
- `minDamageLvl20`, `maxDamageLvl20`: Spell's own damage values at level 20
- `minDamageLvl1`, `maxDamageLvl1`: Spell's damage values at level 1
- `levelDamageData`: Per-level damage data (if available)
- `castTime`: Base time between casts
- `critChance`: Spell's base critical strike chance
- `baseEffectiveness`: How much added damage is scaled

**Skill Level Support:**
- Base skill level selection (1-30, defaults to 20)
- Additional gem levels from mods ("+X to Level of all Skill Gems")
- Damage interpolation between level 1 and level 20
- Extrapolation beyond level 20 when additional levels applied
- Real-time DPS updates based on effective level (base + additional)
- UI inputs for both base level and gear-granted bonus levels

## SciChart Configuration
- **License Key**: Set in component via `SciChartSurface.setRuntimeLicenseKey()`
- **WASM Files**: Must be in `/public/` folder
  - `scichart2d.wasm`
  - `scichart2d.data`
- **Theme**: Dark theme with purple accent (#9B59B6)

## NPM Scripts
```bash
npm start                        # Start dev server
npm run build                    # Production build
npm test                         # Run tests

# Data extraction scripts
npm run extract:pob-skills       # Extract skills from PathOfBuilding-PoE2
npm run extract:weapons          # Extract weapons
npm run extract:weapon-mods      # Extract weapon mods
npm run extract:wands            # Extract wands
npm run extract:quarterstaffs    # Extract quarterstaffs
npm run extract:skills           # Extract skill gems from wiki
npm run extract:elemental-skills # Extract elemental skills
```

## Key Files for Common Tasks

### Adding New Skills
1. Update `scripts/extractPoBSkills.js` if extraction logic changes
2. Run `npm run extract:pob-skills`
3. Data saved to `src/data/PoBSkills.json`

### Adding New Weapons
1. Update `scripts/extractWeapons.js`
2. Run `npm run extract:weapons`
3. Data saved to `src/data/Weapons.json`

### Modifying Damage Calculations
- Attack damage: `src/damage/formulas.ts`
- Spell damage: `src/components/SpellSkillsPlanner/SpellSkillsPlanner.tsx` (getSpellDpsBreakdown function)
- Attack planner: `src/components/AttackSkillsPlanner/AttackSkillsPlanner.tsx`

### Adding Passive Effects
1. Update `src/passives/parser.ts` for new effect types
2. Update `src/passives/aggregator.ts` for combining effects

## Common Issues & Solutions

### SciChart WASM Loading Error
- Ensure `scichart2d.wasm` and `scichart2d.data` are in `/public/`
- Check that files are served with correct MIME types
- Verify license key is set before creating chart

### Duplicate Key Warnings
- Check that skill/weapon IDs are unique in JSON data
- Use index as fallback key: `key={item.id || index}`

### Missing Skill Damage Data
- Some skills may lack `minDamageLvl20`/`maxDamageLvl20`
- Fallback to `estimatedBaseDamageLvl20` or `estimatedBaseDamageLvl1`

## Data Sources
1. **PathOfBuilding-PoE2**: Primary source for skill data, gem info, base items
2. **poe2wiki.net**: Passive tree nodes
3. **pathofexile2.wiki.fextralife.com**: Alternative wiki data
4. **craftofexile.com**: Weapon mods, affixes

## PathOfBuilding-PoE2 Data Reference

The `PathOfBuilding-PoE2/` folder contains the Path of Building 2 source code and is the **primary data source** for this project. Key data files are in Lua format.

### Directory Structure
```
PathOfBuilding-PoE2/
├── src/
│   ├── Data/                      # Main data directory
│   │   ├── Skills/                # Skill gem definitions
│   │   │   ├── act_str.lua        # Strength active skills (melee attacks)
│   │   │   ├── act_dex.lua        # Dexterity active skills (bow, traps)
│   │   │   ├── act_int.lua        # Intelligence active skills (spells)
│   │   │   ├── sup_str.lua        # Strength support gems
│   │   │   ├── sup_dex.lua        # Dexterity support gems
│   │   │   ├── sup_int.lua        # Intelligence support gems
│   │   │   ├── minion.lua         # Minion skill definitions
│   │   │   ├── other.lua          # Other skills (meta gems, etc.)
│   │   │   └── spectre.lua        # Spectre minion skills
│   │   ├── Bases/                 # Base item definitions (weapons, armor)
│   │   ├── Uniques/               # Unique item definitions
│   │   ├── Gems.lua               # Gem metadata (requirements, tags)
│   │   ├── Global.lua             # Global game constants
│   │   ├── ModItem.lua            # Rare item mod definitions
│   │   ├── ModItemExclusive.lua   # Weapon-specific mods
│   │   ├── Minions.lua            # Minion stats and scaling
│   │   ├── SkillStatMap.lua       # Skill stat to mod mappings
│   │   └── StatDescriptions/      # Stat text formatting
│   ├── Classes/                   # PoB class definitions
│   ├── Modules/                   # PoB calculation modules
│   └── TreeData/                  # Passive tree node data
├── docs/                          # Documentation
│   ├── addingSkills.md            # How to add new skills
│   ├── addingMods.md              # How to add new mods
│   └── modSyntax.md               # Mod syntax reference
└── tests/                         # Test files
```

### Key Lua Data Files

#### Skills (src/Data/Skills/)
Each skill file contains skill definitions with:
- `baseFlags` - Skill type flags (attack, spell, projectile, etc.)
- `skillTypes` - Skill classification
- `weaponTypes` - Compatible weapon types
- `baseMods` - Base skill modifiers
- `levels` - Per-level scaling data including:
  - `levelRequirement`
  - `manaMultiplier` / `manaCost`
  - `critChance`
  - `attackSpeedMultiplier`
  - `baseMultiplier` - % of weapon damage for attacks
  - Damage values: `PhysicalMin`, `PhysicalMax`, `FireMin`, `FireMax`, etc.

Example skill structure (Lua):
```lua
skills["FireBall"] = {
    name = "Fireball",
    baseFlags = { spell = true, projectile = true, area = true },
    skillTypes = { [SkillType.Spell] = true, [SkillType.Projectile] = true },
    baseMods = {
        skill("radius", 22),
    },
    levels = {
        [1] = { levelRequirement = 1, manaMultiplier = 50, critChance = 6, FireMin = 4, FireMax = 6 },
        [20] = { levelRequirement = 70, manaMultiplier = 50, critChance = 6, FireMin = 180, FireMax = 270 },
    },
}
```

#### Gems Metadata (src/Data/Gems.lua)
Contains gem metadata:
- `grantedEffect` - Links to skill definition
- `tags` - Gem tags for support compatibility
- `primaryAttribute` - str/dex/int
- `supportTypes` - What the support can modify

#### Base Items (src/Data/Bases/)
Weapon and armor base definitions:
- Physical damage ranges
- Attack speed
- Critical strike chance
- Implicit mods
- Item requirements

#### Mods (src/Data/ModItem.lua, ModItemExclusive.lua)
Item modifier definitions:
- Mod tiers and values
- Applicable item types
- Mod groups (for mutual exclusivity)
- Weighting for rolling

### Extraction Process
The `scripts/extractPoBSkillsEnhanced.js` parses skill Lua files to create `src/data/PoBSkills.json`:
1. Reads skill files from `PathOfBuilding-PoE2/src/Data/Skills/` (act_str.lua, act_dex.lua, act_int.lua, etc.)
2. Parses Lua syntax to extract skill definitions including:
   - `castTime` - spell cast time
   - `critChance` - base critical strike chance (from levels block)
   - `baseEffectiveness` - added damage effectiveness (from statSets)
   - `incrementalEffectiveness` - level scaling
   - Damage values from statSets levels (min/max damage per level)
   - `baseMultiplier` - % of weapon damage for attack skills
   - `attackSpeedMultiplier` - attack speed modifier
3. Merges with gem metadata from `Gems.lua` (tags, requirements, gem type)
4. Outputs JSON with proper field names for the React components

### Key Skill Data Fields
```typescript
interface Skill {
  // Identity
  id: string;
  name: string;
  gemType: 'Spell' | 'Attack' | 'Support' | 'Minion' | 'Buff' | etc;
  
  // Spell damage (for spells)
  minDamageLvl1: number;
  maxDamageLvl1: number;
  minDamageLvl20: number;
  maxDamageLvl20: number;
  castTime: number;
  critChance: number;
  baseEffectiveness: number;
  incrementalEffectiveness: number;
  damageTypes: string[];  // ['fire', 'lightning', etc]
  
  // Attack damage (for attacks)
  baseDamageData: {
    baseMultiplier: number;        // Level 1 weapon damage %
    baseMultiplierLvl20: number;   // Level 20 weapon damage %
    critChance: number;
    attackSpeedMultiplier: number;
  };
}
```

### Updating Data
When PathOfBuilding-PoE2 is updated:
1. Pull latest changes: `cd PathOfBuilding-PoE2 && git pull`
2. Run extraction: `node scripts/extractPoBSkillsEnhanced.js`
3. Run weapon mods extraction: `node scripts/extractWeaponModsPoB.js`
4. Verify data in `src/data/PoBSkills.json` and `src/data/WeaponMods.json`

### Weapon Mods Source (`PathOfBuilding-PoE2/src/Data/ModItem.lua`)
Contains all rare item mods with:
- `type` - "Prefix" or "Suffix"
- `affix` - Display name (e.g., "of the Titan")
- Stat description string (e.g., "+(31-33) to Strength")
- `level` - Required item level
- `group` - Mod group (mutually exclusive)
- `weightKey` - Array of item types that can roll this mod (e.g., "wand", "staff", "sceptre", "mace")
- `weightVal` - Weights for each item type (0 = cannot roll)
- `modTags` - Categories (e.g., "attribute", "damage", "critical")

The `scripts/extractWeaponModsPoB.js` parses this to create `src/data/WeaponMods.json`.
