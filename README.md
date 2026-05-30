## PoE2 Damage Calculator - Path of Building 2 Compatible

A comprehensive damage calculator for Path of Exile 2 that follows **Path of Building 2's calculation methodology** for accurate DPS calculations.

### 🎯 Key Features

- ✅ **PoB2 Compatible Calculations** - Uses the same formula order as Path of Building 2
- ✅ **Weapon Modifiers** - Up to 3 prefixes and 3 suffixes per weapon (20 total mods available)
- ✅ **297 Skill Gems** - Extracted directly from PathOfBuilding-PoE2 data
- ✅ **Skills Browser** - Browse all skills with filtering by type, element, and weapon requirements
- ✅ **18+ Base Weapons** - Wands, sceptres, swords, daggers, and bows
- ✅ **Passive Tree Integration** - Select passive skills that affect calculations
- ✅ **Real-time DPS** - Instant calculation updates with visual breakdown

---

## 🧮 Calculation Methodology (Path of Building 2)

This calculator implements the **exact calculation order** used by Path of Building 2:

### **Step-by-Step Calculation Order:**

#### **1. Base Weapon Damage**
```
Base Min/Max Damage
× (1 + Local Increased Damage from Weapon)
```

#### **2. Local Modifiers (Weapon-Specific)**
```
Physical Damage:
  Base × (1 + Total Local Increased Physical %)
  
Elemental Damage:
  Flat Added Fire/Cold/Lightning
  (NOT affected by local physical increases)
```

#### **3. Global Increased Damage (Additive Pool)**
```
Physical: Physical Damage × (1 + Global Increased Physical %)
Fire: Fire Damage × (1 + Global Increased Fire %)
Cold: Cold Damage × (1 + Global Increased Cold %)
Lightning: Lightning Damage × (1 + Global Increased Lightning %)
```

#### **4. More Damage Multipliers (Multiplicative Chain)**
```
Total Damage × (1 + More1%) × (1 + More2%) × ...

Example: 30% more × 40% more = 1.3 × 1.4 = 1.82 (82% total increase)
```

#### **5. Critical Strikes (PoB2 Multiplicative Scaling)**

**⚠️ IMPORTANT: PoB2 uses multiplicative crit scaling, NOT additive!**

```
Base Crit Chance (weapon dependent, default 5%)
× (1 + Local Increased Crit %)     ← MULTIPLICATIVE
× (1 + Global Increased Crit %)    ← MULTIPLICATIVE

Example: 5% base × (1 + 30% local) × (1 + 150% global)
       = 5% × 1.3 × 2.5 = 16.25% final crit chance

Critical Multiplier:
  Base Multiplier (default 150%)
  + All Increased Crit Multi %      ← ADDITIVE
```

#### **6. Weighted Average Damage**
```
Average Hit = Non-Crit Damage × (1 - Crit Chance + Crit Chance × Crit Multiplier)

Example: 100 damage, 20% crit, 2.0× multiplier
       = 100 × (0.8 + 0.2 × 2.0)
       = 100 × 1.2 = 120 average damage
```

#### **7. Attack Speed**
```
Base APS
× (1 + Local Increased AS % + Global Increased AS %)  ← ADDITIVE
× (1 + More AS1 %) × (1 + More AS2 %) × ...           ← MULTIPLICATIVE
```

#### **8. Final DPS**
```
DPS = Average Hit × Attacks Per Second
```

---

## 🔧 Weapon Modifier System

### **20 Total Modifiers (10 Prefixes + 10 Suffixes)**

**Prefixes (Offense):**
- **Tyrannical** (T1): 155-169% increased physical damage
- **Merciless** (T2): 140-154% increased physical damage
- **Flaring** (T1): Adds 45-68 to 85-110 fire damage
- **Frigid** (T1): Adds 42-62 to 78-104 cold damage
- **Shocking** (T1): Adds 8-15 to 95-145 lightning damage
- **Keen** (T1): 38-42% increased critical strike chance
- **Heavy** (T3): Physical damage + accuracy hybrid
- **Vicious** (T4): 60-79% increased physical damage
- **Cruel** (T5): 40-59% increased physical damage
- **Burning** (T2): Adds 35-52 to 65-88 fire damage

**Suffixes (Speed & Utility):**
- **of the Assassin** (T1): Crit chance + multiplier combo
- **of Slaying** (T2): Crit chance + multiplier combo
- **of Alacrity** (T1): 15-18% increased attack speed
- **of Skill** (T2): 12-14% increased attack speed
- **of Precision** (T1): 280-320% increased accuracy
- **of Performance** (T2): Attack speed + accuracy hybrid
- **of Penetrating** (T1): 35-40% crit penetration
- **of Spite** (T2): 35-40% more damage vs low life
- **of Onslaught** (T3): 8-12% chance to gain onslaught
- **of Bloodletting** (T2): 25-30% chance to bleed on crit

**Modifier Features:**
- ✅ Maximum 3 prefixes and 3 suffixes per weapon
- ✅ Item level requirements (15-83)
- ✅ Min/max value ranges with auto-rolling
- ✅ Individual reroll functionality
- ✅ Real-time damage integration

---

## 📖 Skills Browser

A dedicated page to browse, filter, and sort all 297 active skills extracted from PathOfBuilding-PoE2.

### **Features**
- **Search** - Filter skills by name, description, or tags
- **Gem Type Filter** - Attack, Spell, Buff, Minion, Warcry, Mark, Banner, etc.
- **Element Filter** - Fire, Cold, Lightning, Chaos, Physical
- **Weapon Filter** - Filter by required weapon type (Bow, Wand, Sword, etc.)
- **Sorting** - Sort by name, type, element, damage modifier, tier, or weapon
- **View Modes**:
  - **Table View** - Compact sortable table with all skill details
  - **Cards View** - Skills grouped by weapon requirement with detailed cards

### **Displayed Information**
- Skill name and source (PoB2 indicator)
- Gem type (Attack, Spell, Buff, etc.)
- Element (Fire, Cold, Lightning, etc.)
- Weapon requirements
- More damage multipliers
- More attack speed modifiers  
- Attribute requirements (Str, Dex, Int)
- Tier/level requirement
- Skill tags

---

## 📊 Available Content

### **Weapons (18 total)**
- **Wands (12)**: Driftwood → Gnarled Branch (Lvl 1-70)
- **Sceptres (3)**: Void, Sambar, Sekhem (Lvl 55-65)
- **Melee**: Bronze Sword, Iron Dagger
- **Ranged**: Crude Bow

### **Skills (297 total from PathOfBuilding-PoE2)**

**By Gem Type:**
- **Attack (119)**: Physical melee/ranged skills, slams, strikes, projectiles
- **Spell (79)**: Elemental and chaos spells, curses, warcries
- **Buff (67)**: Auras, heralds, banners, defensive skills
- **Minion (19)**: Summons, spectres, zombies, skeletons
- **Warcry (4)**: Ancestral Cry, Seismic Cry, Infernal Cry
- **Mark (4)**: Sniper's Mark and other target marks
- **Banner (3)**: War Banner and other banner skills
- **Other (2)**: Totem and Shapeshift skills

**By Element:**
- 🔥 **Fire (61)**: Fireball, Firestorm, Incinerate, Herald of Ash, etc.
- ❄️ **Cold (34)**: Ice Nova, Frostbolt, Glacial Cascade, Herald of Ice, etc.
- ⚡ **Lightning (41)**: Spark, Arc, Ball Lightning, Herald of Thunder, etc.
- 💀 **Chaos (22)**: Essence Drain, Contagion, Wither, Soulrend, etc.
- 🗡️ **Physical (40)**: Cleave, Heavy Strike, Boneshatter, Earthquake, etc.

---

## 🎓 Key PoB2 Differences Explained

### **Critical Strike Chance (Multiplicative vs Additive)**

**❌ OLD WAY (Incorrect):**
```
5% base + 30% increased + 150% increased = 185% crit chance
(Capped at 100%)
```

**✅ PoB2 WAY (Correct):**
```
5% × (1 + 30%) × (1 + 150%)
= 5% × 1.3 × 2.5
= 16.25% crit chance
```

**Why it matters:** With multiplicative scaling, you need MUCH more increased crit to reach high values, making crit scaling more balanced.

### **Damage Type Independence**

**Physical damage modifiers** only affect physical damage.  
**Elemental damage** is added separately and scales independently.

```
Example Weapon:
  10-20 physical damage
  + 100% local increased physical damage
  + 5-10 added fire damage

Result:
  Physical: (10-20) × 2.0 = 20-40
  Fire: 5-10 (NOT affected by physical increase)
  Total: 25-50 average damage
```

### **Local vs Global Modifiers**

**Local** = On the weapon itself (applies first)  
**Global** = From passives, skills (applies after local)

```
Example:
  Weapon: 10 damage, 50% local increased
  Passive: 100% global increased
  
  Calculation:
  10 × (1 + 50%) × (1 + 100%)
  = 10 × 1.5 × 2.0
  = 30 damage
```

---

## 🚀 Usage

### **Installation**
```bash
npm install
npm start
```

### **Data Extraction**
```bash
npm run extract:wands              # Extract wand data
npm run extract:weapon-mods        # Generate weapon modifiers
npm run extract:skills             # Update regular skills
npm run extract:elemental-skills   # Extract elemental skills
npm run extract:pob-skills         # Extract skills from PathOfBuilding-PoE2
```

### **Testing**
```bash
npm test                           # Run all tests
npm run build                      # Production build
```

---

## 📝 Technical Implementation

### **TypeScript Architecture**
- Full type safety for all calculations
- Separate damage types (physical, fire, cold, lightning)
- PoB2-compatible formula order

### **Components**
- `DamageCalculatorPage` - Main calculator interface
- `SkillsBrowser` - Browse all 297 skills with filters and sorting
- `WeaponSelector` - Weapon selection with filters
- `WeaponModSelector` - Add/remove/reroll modifiers
- `SkillSelector` - Skill gem selection
- `SamplePassiveSelector` - Passive tree node selection

### **Test Coverage**
- Unit tests for all damage calculations
- Validation of PoB2 formula correctness
- Integration tests for modifier stacking

---

## ⚠️ Known Limitations

- Simplified hit chance (100% assumed)
- No support gem system
- Basic passive tree (not full tree)
- Physical damage only (no chaos, DoT, etc.)
- No configuration for enemy resistances

---

## 📚 References

- **Path of Building 2**: Community fork of PoB for accurate calculations
- **PoE2 Wiki**: https://pathofexile2.wiki.fextralife.com/
- **Craft of Exile**: Mod database reference

---

## 🎯 Accuracy Statement

This calculator implements **Path of Building 2's calculation methodology** to provide accurate damage estimates for Path of Exile 2. While simplified in some areas (no support gems, basic passives), the **core damage calculation follows PoB2's exact formula order** for physical and elemental damage.

**Key Accuracy Points:**
- ✅ Multiplicative crit scaling (PoB2 standard)
- ✅ Correct local vs global modifier ordering
- ✅ Independent damage type scaling
- ✅ Proper "more" multiplier chains
- ✅ Accurate weighted crit average formula

---

## 📄 License

This is an educational tool for Path of Exile 2 theorycrafting. Not affiliated with Grinding Gear Games.
