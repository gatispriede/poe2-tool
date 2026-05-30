# Passive Tree Optimizer - UI Mockup

```
╔═══════════════════════════════════════════════════════════════════════════════╗
║  🔮 Spell Skills Planner                                                      ║
╠═══════════════════════════════════════════════════════════════════════════════╣
║                                                                               ║
║  [Skill Selection Panel]        [Weapon Mods & DPS Chart]                    ║
║  ┌─────────────────────┐        ┌────────────────────────────────────────┐   ║
║  │ • Fireball          │        │ 🥇 BEST: 3P + 3S    DPS: 2,450        │   ║
║  │ • Frostbolt         │        │ 🥈 3P + 2S          DPS: 2,380        │   ║
║  │ • Spark             │        │ 🥉 2P + 3S          DPS: 2,310        │   ║
║  │ ...                 │        │ ...                                    │   ║
║  └─────────────────────┘        └────────────────────────────────────────┘   ║
║                                                                               ║
╠═══════════════════════════════════════════════════════════════════════════════╣
║  🌳 PASSIVE TREE OPTIMIZER                                                    ║
╠═══════════════════════════════════════════════════════════════════════════════╣
║                                                                               ║
║  Max Points: [120]  Mode: [Auto Optimize ▼]  [Show Details]  [Clear]        ║
║                                                                               ║
║  ╔══════════════════════════════════════════════════════════════════════╗    ║
║  ║ Allocated: 120 / 120 points                                          ║    ║
║  ║                                                                       ║    ║
║  ║  ✨ Spell Damage:          +520%   ⚡ Cast Speed:           +95%     ║    ║
║  ║  🔥❄️⚡ Elemental Damage:  +280%   🎯 Spell Crit Chance:   +150%    ║    ║
║  ║  🔥 Fire Damage:          +360%   💥 Spell Crit Multi:    +85%     ║    ║
║  ║  🎯 Area Damage:          +45%    🏹 Projectile Damage:   +35%     ║    ║
║  ╚══════════════════════════════════════════════════════════════════════╝    ║
║                                                                               ║
║  [Show Details Expanded View]                                                 ║
║  ┌───────────────────────────────────────────────────────────────────────┐   ║
║  │ 🔴 KEYSTONES (2)                                                       │   ║
║  │ ┌─────────────────────────────────────────────────────────────────┐   │   ║
║  │ │ Pain Attunement                                                 │   │   ║
║  │ │ 60% increased Spell Damage                                      │   │   ║
║  │ │ 20% increased Cast Speed                                        │   │   ║
║  │ └─────────────────────────────────────────────────────────────────┘   │   ║
║  │ ┌─────────────────────────────────────────────────────────────────┐   │   ║
║  │ │ Elemental Equilibrium                                           │   │   ║
║  │ │ 50% increased Elemental Damage                                  │   │   ║
║  │ │ 30% increased Spell Damage                                      │   │   ║
║  │ └─────────────────────────────────────────────────────────────────┘   │   ║
║  │                                                                        │   ║
║  │ 🟠 NOTABLES (18)                                                       │   ║
║  │ ┌─────────────────────────────────────────────────────────────────┐   │   ║
║  │ │ Conflagration                                                   │   │   ║
║  │ │ 35% increased Fire Damage                                       │   │   ║
║  │ │ 15% increased Elemental Damage                                  │   │   ║
║  │ └─────────────────────────────────────────────────────────────────┘   │   ║
║  │ ┌─────────────────────────────────────────────────────────────────┐   │   ║
║  │ │ Spell Mastery                                                   │   │   ║
║  │ │ 25% increased Spell Damage                                      │   │   ║
║  │ │ 8% increased Cast Speed                                         │   │   ║
║  │ └─────────────────────────────────────────────────────────────────┘   │   ║
║  │ ... and 16 more                                                        │   ║
║  │                                                                        │   ║
║  │ ⚪ SMALL PASSIVES (100)                                                │   ║
║  │ ┌──────────────┬──────────────┬──────────────┬──────────────┐       │   ║
║  │ │ Spell Dmg I  │ Spell Dmg II │ Fire Dmg I   │ Fire Dmg II  │       │   ║
║  │ │ Spell Dmg III│ Fire Dmg III │ Fire Dmg IV  │ Elemental I  │       │   ║
║  │ │ Cast Speed I │ Cast Speed II│ Crit Chance I│ Crit Multi I │       │   ║
║  │ │ ...and 88 more nodes...                                     │       │   ║
║  │ └──────────────┴──────────────┴──────────────┴──────────────┘       │   ║
║  └───────────────────────────────────────────────────────────────────────┘   ║
║                                                                               ║
╚═══════════════════════════════════════════════════════════════════════════════╝
```

## UI Features Explained

### Top Section - Controls
- **Max Points Input**: Adjust passive point budget (1-200)
- **Mode Selector**: Toggle between Auto Optimize and Manual Selection
- **Show Details Button**: Expand/collapse detailed node list
- **Clear Button**: (Manual mode only) Clear all selections

### Middle Section - Stat Summary
- **Point Counter**: Shows allocated vs maximum points
- **Stat Grid**: Color-coded display of all bonuses
  - Fire stats in red 🔥
  - Cold stats in blue ❄️
  - Lightning stats in yellow ⚡
  - Chaos stats in purple ☠️
  - Generic stats in cyan ✨
  - Speed stats in purple ⚡
  - Crit stats in yellow/red 🎯💥

### Bottom Section - Detailed View (Expandable)
- **Keystones**: Large nodes with major bonuses (red border)
- **Notables**: Medium nodes with good bonuses (orange border)
- **Small Passives**: Basic nodes displayed in compact grid (gray border)

## Color Coding

| Stat Type | Icon | Color | Purpose |
|-----------|------|-------|---------|
| Spell Damage | ✨ | Cyan (#4fc3f7) | Generic spell scaling |
| Elemental | 🔥❄️⚡ | Cyan (#4fc3f7) | Multi-element scaling |
| Fire | 🔥 | Red (#ff6b6b) | Fire-specific scaling |
| Cold | ❄️ | Blue (#74c0fc) | Cold-specific scaling |
| Lightning | ⚡ | Yellow (#ffe066) | Lightning-specific scaling |
| Chaos | ☠️ | Purple (#d946ef) | Chaos-specific scaling |
| Cast Speed | ⚡ | Purple (#a78bfa) | Speed scaling |
| Crit Chance | 🎯 | Yellow (#fbbf24) | Critical strike |
| Crit Multi | 💥 | Red (#f87171) | Critical damage |
| Area Damage | 🎯 | Cyan (#4fc3f7) | AoE scaling |
| Projectile | 🏹 | Cyan (#4fc3f7) | Projectile scaling |

## User Interaction Flow

1. **Select Skill** → Optimizer auto-runs for that element
2. **View Summary** → See total bonuses at a glance
3. **Show Details** → Inspect which specific nodes were chosen
4. **Adjust Points** → Change budget, see new optimization
5. **Manual Mode** → Hand-pick specific nodes if desired
6. **Clear/Reset** → Start over with selections

## Responsive Design

- **Desktop**: Two-column layout with side-by-side panels
- **Tablet**: Stacked panels, full width
- **Mobile**: Compact view with collapsible sections

## Dark Theme Styling

- Background: #1a1a1a (dark)
- Panels: #0d0d0d (darker)
- Borders: #333 (subtle)
- Accents: #c58602 (gold)
- Text: #fff (white), #888 (muted)

