// Zod schemas. Anything failing these is logged and dropped, not silently included.
const { z } = require('zod');

const WeaponDamage = z.object({
  PhysicalMin: z.number().optional(),
  PhysicalMax: z.number().optional(),
  FireMin: z.number().optional(),
  FireMax: z.number().optional(),
  ColdMin: z.number().optional(),
  ColdMax: z.number().optional(),
  LightningMin: z.number().optional(),
  LightningMax: z.number().optional(),
  ChaosMin: z.number().optional(),
  ChaosMax: z.number().optional(),
  CritChanceBase: z.number().optional(),
  AttackRateBase: z.number().optional(),
  Range: z.number().optional(),
}).passthrough();

const WeaponBase = z.object({
  id: z.string(),                  // base name, e.g. "Driftwood Wand"
  category: z.string(),            // file name, e.g. "wand"
  type: z.string(),                // PoB type, e.g. "Wand"
  quality: z.number().default(20),
  socketLimit: z.number().default(3),
  implicit: z.string().nullable().optional(),
  // Kept as a passthrough for now; PoB sometimes nests this as array-of-array
  // and we don't consume its inner shape yet.
  implicitModTypes: z.array(z.any()).default([]),
  tags: z.array(z.string()),       // positive tags only (true entries)
  // Stash negative `no_X_spell_mods` style tags here so the eligibility rule can use them.
  excludeTags: z.array(z.string()).default([]),
  req: z.object({
    level: z.number().optional(),
    str: z.number().optional(),
    dex: z.number().optional(),
    int: z.number().optional(),
  }).default({}),
  weapon: WeaponDamage.nullable().optional(),
});

// Defensive stats block. Present on body/helmet/boots/gloves/shield/focus.
// Fields are all optional because each base only populates the ones it has
// (e.g. an Evasion helmet has no Armour, an int focus only has EnergyShield).
const ArmourStats = z.object({
  Armour: z.number().optional(),
  Evasion: z.number().optional(),
  EnergyShield: z.number().optional(),
  Ward: z.number().optional(),
  BlockChance: z.number().optional(),
  MovementPenalty: z.number().optional(),
}).passthrough();

// Non-weapon item bases: amulet/belt/body/boots/gloves/helmet/quiver/ring/
// shield/focus/flask/jewel. Mirrors WeaponBase but swaps the `weapon` block
// for an optional `armour` block, plus passes through utility-flask `charm`
// data and belt `charmLimit`. Kept in a separate file so existing weapon
// consumers don't churn.
const ArmourBase = z.object({
  id: z.string(),
  category: z.string(),            // file name, e.g. "body", "ring"
  type: z.string(),                // PoB type, e.g. "Body Armour", "Ring"
  subType: z.string().optional(),  // e.g. "Armour" for body, undefined for ring
  quality: z.number().default(20),
  socketLimit: z.number().default(0),
  charmLimit: z.number().optional(),
  implicit: z.string().nullable().optional(),
  implicitModTypes: z.array(z.any()).default([]),
  tags: z.array(z.string()),
  excludeTags: z.array(z.string()).default([]),
  req: z.object({
    level: z.number().optional(),
    str: z.number().optional(),
    dex: z.number().optional(),
    int: z.number().optional(),
  }).default({}),
  armour: ArmourStats.nullable().optional(),
  // Utility flasks / charms have their own block; stash verbatim.
  charm: z.any().optional(),
});

// A single statline on a mod. PoB stores them as array entries with embedded
// `(min-max)` ranges. We keep the raw text, a parsed structured form, AND a
// keyword bucket so the damage composer can switch on `kind` rather than
// pattern-matching text again.
//
// `kind` is one of:
//   "increased"   — % increased / reduced     (additive bucket, multiplied by total %)
//   "more"        — % more / less             (multiplicative bucket)
//   "addedRange"  — "Adds N to M <type> Damage" (two-range added flat damage)
//   "addedFlat"   — "+N to <stat>" or "+N to <type> Damage" (single-range flat)
//   "extra"       — "Gain X% of Damage as Extra <type>"  (parallel damage instance)
//   "converted"   — "X% of <type> Damage Converted to <type2>"
//   "skillLevel"  — "+N to Level of <skills>" (level shift, non-linear)
//   "unknown"     — pattern not recognised. Composer must FAIL CLOSED on these,
//                   not silently bucket them as "increased".
const StatKind = z.enum(['increased','more','addedRange','addedFlat','extra','converted','skillLevel','unknown']);

const StatRoll = z.object({
  text: z.string(),                // "Adds (10-15) to (20-25) Fire Damage"
  kind: StatKind,
  ranges: z.array(z.tuple([z.number(), z.number()])).default([]),
});

const ItemMod = z.object({
  id: z.string(),                  // PoB mod id, e.g. "Strength1"
  type: z.enum(['Prefix', 'Suffix']),
  affix: z.string(),
  level: z.number(),
  group: z.string(),
  stats: z.array(StatRoll),        // ALL stat lines, not just the first
  weightKey: z.array(z.string()).default([]),
  weightVal: z.array(z.number()).default([]),
  modTags: z.array(z.string()).default([]),
  statOrder: z.array(z.number()).default([]),
  tradeHash: z.union([z.number(), z.string()]).optional(),
});

// Per-gem-level scaling. PoB stores this as `skills[id].levels[N] = {...}`.
// We keep the fields the damage composer actually needs:
//   - baseMultiplier: skill's "added attack damage effectiveness" / base
//     damage multiplier at this gem level. For attacks, this multiplies
//     weapon damage. For spells, the gem's own base damage (in statSets)
//     is what scales.
//   - attackSpeedMultiplier: % adjustment to weapon attack rate (-10 = 10%
//     less attack speed, +20 = 20% more). Per-skill quirk.
//   - levelRequirement: character level needed to use the gem at this level.
const SkillLevel = z.object({
  level: z.number(),
  baseMultiplier: z.number().optional(),
  attackSpeedMultiplier: z.number().optional(),
  levelRequirement: z.number().optional(),
  manaCost: z.number().optional(),
  // Firing-frequency gates: cooldown (seconds) and stored uses. Without these
  // the composer treats cooldown skills as spammable at weapon/cast rate.
  cooldown: z.number().optional(),
  storedUses: z.number().optional(),
});

// A skill (active or support). Now also carries per-level scaling so the
// damage composer can read it directly without a second Lua trip.
const Skill = z.object({
  id: z.string(),                         // PoB key, e.g. "CometPlayer"
  name: z.string(),                       // display name, e.g. "Comet"
  color: z.number().optional(),           // 1=str, 2=dex, 3=int (gem colour)
  isSupport: z.boolean(),

  // Active-skill tags (e.g. ["Spell","Cold","Projectile"]). For supports
  // this is empty; supports describe their effect on a skill via the
  // require/add/exclude triple below.
  skillTypes: z.array(z.string()).default([]),

  // Support-only compatibility rules. Skills satisfy a support iff:
  //   require ⊆ skill.skillTypes  AND  exclude ∩ skill.skillTypes = ∅
  // After socketing, `add` is appended to the skill's effective tags.
  requireSkillTypes: z.array(z.string()).default([]),
  addSkillTypes:     z.array(z.string()).default([]),
  excludeSkillTypes: z.array(z.string()).default([]),

  // Gems sharing a family cannot be socketed together (PoB convention).
  gemFamily: z.array(z.string()).default([]),

  // Per-level scaling. Empty for supports that have no level-keyed numbers
  // (e.g. simple flag supports).
  levels: z.array(SkillLevel).default([]),

  // Support gems describe their effect as PoB "constantStats" key/value
  // pairs (or "baseMods" / "qualityStats" — TODO). We capture
  // constantStats verbatim; the damage composer pattern-matches the keys.
  // Each entry: [stat_id, magnitude]
  constantStats: z.array(z.tuple([z.string(), z.number()])).default([]),

  // Per-level scaling for stats from `statSets[0]`. PoB stores these as
  // `statSets[1].levels[N] = [val1, val2, ...]` where the positional
  // values map (in order) to `statSets[1].stats[]` stat-id names. We
  // present them as an array of { level, stats: { [statId]: value } }
  // entries so the damage composer can read level-scaled buffs (e.g.
  // Sniper's Mark's "enemy_additional_critical_strike_multiplier" rising
  // from 20 at level 1 to ~83 at level 12).
  perLevelStats: z.array(z.object({
    level: z.number(),
    stats: z.record(z.string(), z.number()),
  })).default([]),

  // Weapon-type restriction (e.g. Ice Shot requires Bow). Keys are PoB
  // weapon type names (matches WeaponBase.type).
  weaponTypes: z.array(z.string()).default([]),

  // Carried through for the UI / damage model but not part of validity.
  castTime: z.number().optional(),
  description: z.string().optional(),
});

// Passive tree node — fields needed for Layer-4 validity AND for Layer-5
// jewel-radius effects. Asset paths and other render-only data are stripped.
const TreeNode = z.object({
  id: z.number(),
  name: z.string().optional(),
  stats: z.array(z.string()).default([]),
  connections: z.array(z.number()).default([]),    // adjacent node IDs

  // Positioning — needed to compute which nodes fall inside a jewel's radius.
  // Node position = group.center + orbitRadii[orbit] * (cos, sin) of
  // orbitAnglesByOrbit[orbit][orbitIndex]. Constants live on PassiveTree.
  group: z.number().optional(),
  orbit: z.number().optional(),
  orbitIndex: z.number().optional(),

  // Node flags (only present when true).
  isNotable: z.boolean().optional(),
  isKeystone: z.boolean().optional(),
  isMastery: z.boolean().optional(),
  isJewelSocket: z.boolean().optional(),
  isAscendancyStart: z.boolean().optional(),

  // Ascendancy nodes carry the ascendancy's name (e.g. "Blood Mage").
  ascendancyName: z.string().optional(),
  // Class-start nodes list which classes use them.
  classesStart: z.array(z.string()).optional(),
});

const TreeGroup = z.object({
  x: z.number(),
  y: z.number(),
});

// Constants needed to project orbit/orbitIndex to a real (x,y).
const TreeConstants = z.object({
  skillsPerOrbit: z.array(z.number()),
  orbitRadii: z.array(z.number()),
  // orbitAnglesByOrbit[orbit] is an array of angles in radians.
  orbitAnglesByOrbit: z.array(z.array(z.number())),
});

const TreeClass = z.object({
  internalId: z.string(),                // e.g. "Witch1"  (used by PoB Spec)
  integerId: z.number(),
  name: z.string(),                      // e.g. "Witch"
  startNodeId: z.number(),               // class-start passive node ID
  ascendancies: z.array(z.object({
    id: z.string(),                      // e.g. "Blood Mage"  (display id)
    internalId: z.string(),              // e.g. "Witch2"
    name: z.string(),
    startNodeId: z.number().optional(),
  })),
});

const PassiveTree = z.object({
  treeVersion: z.string(),
  classes: z.array(TreeClass),
  nodes: z.record(z.string(), TreeNode), // keyed by node ID as string
  groups: z.record(z.string(), TreeGroup),
  constants: TreeConstants,
  jewelSlots: z.array(z.number()).default([]),
});

const Manifest = z.object({
  sourceCommit: z.string(),        // PoB-PoE2 git SHA
  generatedAt: z.string(),         // ISO timestamp
  counts: z.record(z.string(), z.number()),
});

module.exports = { WeaponBase, ArmourBase, ItemMod, StatRoll, Skill, PassiveTree, TreeNode, TreeClass, Manifest };
