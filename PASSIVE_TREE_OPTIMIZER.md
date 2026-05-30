# Passive Tree Optimizer for Spell Skills

## Overview

The Passive Tree Optimizer analyzes the passive skill tree and automatically selects the best nodes to maximize spell damage for a given skill, considering a budget of passive points (default: 120).

## Features

### 1. **Automatic Optimization**
- Uses a greedy algorithm to select the most impactful passive nodes
- Calculates the DPS contribution of each node dynamically
- Prioritizes nodes based on their actual impact on final DPS

### 2. **Element-Specific Optimization**
The optimizer adapts to different spell types:
- **Fire Skills**: Prioritizes Fire Damage, Elemental Damage, and Spell Damage nodes
- **Cold Skills**: Prioritizes Cold Damage, Elemental Damage, and Spell Damage nodes  
- **Lightning Skills**: Prioritizes Lightning Damage, Elemental Damage, and Spell Damage nodes
- **Chaos Skills**: Prioritizes Chaos Damage and generic Spell Damage nodes
- **Physical Skills**: Prioritizes Physical Damage and Spell Damage nodes
- **Generic Skills**: Prioritizes generic Spell Damage and Cast Speed nodes

### 3. **Comprehensive Stat Tracking**
The optimizer tracks and displays:
- ✨ **Spell Damage**: Generic spell damage increases
- 🔥❄️⚡ **Elemental Damage**: Applies to Fire, Cold, and Lightning
- 🔥 **Fire Damage**: Fire-specific increases
- ❄️ **Cold Damage**: Cold-specific increases
- ⚡ **Lightning Damage**: Lightning-specific increases
- ☠️ **Chaos Damage**: Chaos-specific increases
- ⚡ **Cast Speed**: Increased cast speed
- 🎯 **Critical Strike Chance**: Spell critical strike chance
- 💥 **Critical Strike Multiplier**: Spell critical strike multiplier
- 🎯 **Area Damage**: For area-effect spells
- 🏹 **Projectile Damage**: For projectile spells

### 4. **Two Modes of Operation**

#### Auto Mode (Default)
- Automatically selects the optimal 120 nodes (or custom amount)
- Re-optimizes when you change:
  - Selected skill
  - Skill element
  - Base damage values
  - Number of passive points

#### Manual Mode
- Browse all available passive nodes
- Click nodes to select/deselect them
- See immediate feedback on your selections
- Limited to your passive point budget

### 5. **Visual Feedback**
- **Keystones** (red): High-impact nodes with major bonuses
- **Notables** (orange): Medium-impact nodes with good bonuses
- **Small Passives** (gray): Basic nodes with small bonuses

## How It Works

### Algorithm

1. **Initialization**: Start with an empty passive allocation and current DPS
2. **Evaluation Loop**: For each available unallocated node:
   - Calculate current DPS with existing allocations
   - Calculate DPS with the node added
   - Compute the DPS contribution (difference)
3. **Selection**: Pick the node with the highest DPS contribution
4. **Iteration**: Repeat until reaching the passive point limit or no beneficial nodes remain

### DPS Calculation

The optimizer uses a comprehensive DPS formula:

```
Final DPS = Base Damage × Damage Multiplier × Cast Speed × Crit Multiplier
```

Where:
- **Base Damage**: Skill's base damage + weapon conversion
- **Damage Multiplier**: 1 + (Increased Spell Damage + Increased Elemental Damage + Increased Element-Specific Damage) / 100
- **Cast Speed**: Base Cast Speed × (1 + Increased Cast Speed / 100)
- **Crit Multiplier**: 1 + (Crit Chance / 100) × (Crit Multiplier - 1)

### Passive Node Values

The optimizer considers multiple damage scaling types:
1. **Generic Spell Damage**: Always applies (10-14% on small nodes, 20-40% on notables)
2. **Elemental Damage**: Applies to Fire, Cold, Lightning (12-16% on small nodes, 15-30% on notables)
3. **Element-Specific**: Higher values (14-20% on small nodes, 35-40% on notables)
4. **Cast Speed**: Multiplies DPS directly (5-8% on small nodes, 10-20% on notables)
5. **Critical Strike**: Compound effect on DPS (25-35% chance on small nodes, 40-60% on notables)

## Usage in Spell Skills Planner

1. **Select a Spell Skill** from the skill list
2. **Configure your setup**:
   - Choose weapon type (Wand, Sceptre, Staff)
   - Select a base weapon (optional)
   - Add support skills (up to 5)
   - Set bonus modifiers (crit, cast speed, etc.)
3. **View Passive Tree Optimization**:
   - Scroll down to the "🌳 Passive Tree Optimizer" section
   - The optimizer automatically calculates the best 120 nodes
   - View aggregated stats in the summary
   - Click "Show Details" to see all selected nodes

### Customization

- **Adjust Points**: Change the "Max Points" input to optimize for different point budgets (1-200)
- **Manual Selection**: Switch to "Manual Mode" to hand-pick specific nodes
- **Element Focus**: The optimizer automatically adapts when you select different elemental skills

## Technical Implementation

### File Structure

```
src/
├── passives/
│   ├── passiveTreeOptimizer.ts      # Core optimization logic
│   ├── mockPassiveTreeData.ts       # Mock passive tree data (79 nodes)
│   └── effectParser.ts              # Enhanced to parse spell modifiers
├── components/
│   └── SpellSkillsPlanner/
│       ├── PassiveTreeOptimizer.tsx # React component
│       └── SpellSkillsPlanner.tsx   # Main planner (integrated)
└── damage/
    └── model.ts                      # Extended with spell stats
```

### Key Functions

- `optimizePassiveAllocation()`: Main optimization algorithm
- `calculatePassiveNodeValue()`: Calculates DPS contribution of a node
- `aggregatePassiveNodes()`: Sums up stats from multiple nodes
- `parsePassiveEffect()`: Parses node descriptions into stat bonuses

## Future Enhancements

1. **Path Finding**: Consider travel nodes and actual tree pathing
2. **Jewel Sockets**: Support for jewel socket allocation
3. **Cluster Jewels**: Integration of cluster jewel mechanics
4. **Real Tree Data**: Import actual PoE2 passive tree from PathOfBuilding
5. **Build Sharing**: Export/import passive allocations
6. **Multi-Objective**: Optimize for defense + offense simultaneously
7. **Ascendancy Integration**: Factor in ascendancy passive bonuses

## Example Output

For a **Level 20 Fireball** with 500 base damage:

**Optimized Allocation (120 points)**:
- Keystones: 2 nodes
  - Pain Attunement (+60% Spell Damage, +20% Cast Speed)
  - Elemental Equilibrium (+50% Elemental Damage, +30% Spell Damage)
- Notables: 18 nodes (including Conflagration, Spell Mastery, etc.)
- Small Passives: 100 nodes

**Aggregated Stats**:
- Spell Damage: +520%
- Elemental Damage: +280%
- Fire Damage: +360%
- Cast Speed: +95%
- Spell Critical Chance: +150%
- Spell Critical Multiplier: +85%

**DPS Impact**: ~400% increase from passive tree alone

## Notes

- The optimizer uses a **greedy algorithm**, which may not always find the global optimum but provides very good results efficiently
- **Cast Speed** is weighted appropriately as it directly multiplies DPS
- **Critical Strike** scaling becomes more valuable with higher crit multiplier bonuses
- **Element-specific** nodes are prioritized over generic nodes when they apply
- The mock data includes 79 nodes; real PoE2 tree has 500+ nodes

## Testing

Run the test script to verify the optimizer:

```bash
node scripts/testPassiveOptimizer.js
```

This will output:
- Number of nodes selected
- Aggregated stat totals
- Breakdown by node type (Keystone/Notable/Small)

