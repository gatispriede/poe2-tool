// Core vocabulary of the relationship engine.
//
// Everything in this platform reduces to three nouns and one verb:
//
//   SkillProfile   — what a skill IS (tags, damage types, timing, geometry)
//   Effect         — an atomic, machine-readable statement pulled out of any
//                    English mod line or PoB stat key
//   EffectSource   — where an Effect came from (tree node, item mod, unique,
//                    support gem, ascendancy) plus what it costs to obtain
//   applies()      — the verb: does this Effect touch this SkillProfile, and
//                    under what condition?
//
// Nothing here imports data. The engine is pure over a Dataset, so the same
// code runs in the browser (webpack JSON imports) and in the CLI (fs reads).

/** Canonical tag vocabulary. A tag is either something a skill IS or a
 *  restriction a modifier carries. Both sides use the same alphabet, which is
 *  what makes applicability a set operation instead of a pile of special cases. */
export type Tag =
  // delivery
  | 'spell' | 'attack' | 'melee' | 'projectile' | 'area' | 'nova' | 'slam'
  | 'channelling' | 'movement' | 'travel' | 'wall' | 'orb' | 'grenade' | 'rain'
  // damage types
  | 'physical' | 'fire' | 'cold' | 'lightning' | 'chaos' | 'elemental'
  // damage delivery mode
  | 'hit' | 'damageOverTime' | 'ailment' | 'duration'
  // agents that deal the damage for you
  | 'minion' | 'totem' | 'trap' | 'mine' | 'companion' | 'ballista'
  // persistent / support-side categories
  | 'aura' | 'herald' | 'curse' | 'mark' | 'buff' | 'banner' | 'offering'
  | 'warcry' | 'guard' | 'meta' | 'trigger' | 'triggerable' | 'persistent'
  // weapon restrictions
  | 'bow' | 'crossbow' | 'wand' | 'staff' | 'quarterstaff' | 'sceptre'
  | 'mace' | 'axe' | 'sword' | 'spear' | 'flail' | 'dagger' | 'claw'
  | 'oneHanded' | 'twoHanded' | 'dualWielding' | 'shield' | 'unarmed'
  | 'weapon' | 'martial'
  // misc mechanics
  | 'critical' | 'chaining' | 'piercing' | 'shapeshift' | 'brand' | 'blasphemy';

/** How a modifier composes with everything else in the build. */
export type ModForm =
  | 'increased'    // additive % bucket (reduced is stored as a negative)
  | 'more'         // its own multiplier (less is stored as a negative)
  | 'added'        // "Adds X to Y <type> Damage"
  | 'flat'         // "+X to <stat>"
  | 'chance'       // "X% chance to <thing>"
  | 'conversion'   // "X% of A Damage Converted to B Damage"
  | 'gainAs'       // "Gain X% of A Damage as Extra B Damage"
  | 'penetration'  // "Damage Penetrates X% <element> Resistance"
  | 'grant'        // no magnitude: a behaviour ("Projectiles Pierce all Enemies")
  | 'unknown';

/** What the modifier acts on, in engine-canonical terms. Registered in vocab.ts. */
export type StatKey = string;

/** The four questions the platform answers for a skill. */
export type Bucket = 'damage' | 'aoe' | 'speed' | 'utility';

/** Conditions that gate an effect but are not plain tag restrictions. */
export interface Condition {
  kind:
    | 'selfState'      // while moving, while on low life, while channelling
    | 'enemyState'     // against ignited / heavy stunned enemies
    | 'recently'       // if you've killed recently
    | 'onEvent'        // on kill, on hit, when you block
    | 'perStack'       // per power charge, per 10 Dexterity
    | 'weapon'         // with bows, while dual wielding
    | 'equipment'      // from equipped body armour
    | 'limit';         // maximum / limit clauses
  text: string;
  /** Tags this condition additionally demands of the skill (e.g. "with Bows"). */
  tags?: Tag[];
}

export interface Effect {
  form: ModForm;
  /** Signed magnitude. "reduced"/"less" arrive here negative. */
  value: number;
  /** Second magnitude for range forms, e.g. Adds 5 to 10. */
  valueMax?: number;
  stat: StatKey;
  /** Tags the SKILL must carry for this effect to apply at all. */
  requires: Tag[];
  /** Tags that disqualify the skill. */
  excludes: Tag[];
  /** Damage types this effect is restricted to, if any. */
  damageTypes: Tag[];
  /** Conversion / gainAs source and destination. */
  from?: Tag;
  to?: Tag;
  conditions: Condition[];
  /** Whether the modifier acts on the player's own skills or something else
   *  (minions, enemies, allies). 'other' effects never scale your own hit. */
  target: 'self' | 'minion' | 'enemy' | 'ally' | 'other';
  raw: string;
  /** Confidence the parse is faithful, 0..1. Lines the parser only partly
   *  understood keep a low score so the UI can flag them instead of lying. */
  parseConfidence: number;
}

export type SourceKind =
  | 'passive' | 'notable' | 'keystone' | 'ascendancy' | 'jewelSocket'
  | 'support' | 'itemMod' | 'unique' | 'skillInnate';

export interface EffectSource {
  id: string;
  name: string;
  kind: SourceKind;
  effects: Effect[];
  raw: string[];
  /** Tree geometry, when the source lives on the passive tree. */
  nodeId?: number;
  ascendancyName?: string;
  /** Item context. */
  itemCategories?: string[];
  baseType?: string;
  /** Weapon/armour-local mod: it modifies the ITEM, not your character, so it
   *  reaches a skill only through the weapon that skill swings. */
  isLocal?: boolean;
  /** Support gems declare their own applicability directly. */
  requireSkillTypes?: string[];
  excludeSkillTypes?: string[];
  addSkillTypes?: string[];
  gemFamily?: string[];
  /** What acquiring this costs: passive points, a gem socket, an item slot. */
  cost: SourceCost;
}

export interface SourceCost {
  kind: 'passivePoints' | 'gemSocket' | 'itemSlot' | 'ascendancyPoints' | 'free';
  amount: number;
  /** For tree sources: cheapest total points from this class's start. */
  detail?: string;
}

/** Everything the engine knows about one active skill. */
export interface SkillProfile {
  id: string;
  name: string;
  tags: Set<Tag>;
  skillTypes: string[];
  description?: string;
  /** Damage types the skill actually ends up dealing (post base conversions). */
  damageTypes: Tag[];
  baseDamage: { min: number; max: number; byType: Partial<Record<Tag, [number, number]>> };
  /** Seconds. castTime for spells, base attack time proxy for attacks. */
  castTime?: number;
  cooldown?: number;
  attackSpeedMultiplier?: number;
  /** Geometry. */
  areaRadius?: number;
  secondaryAreaRadius?: number;
  projectiles?: number;
  chains?: number;
  /** Seconds of skill effect duration, when the skill has one. */
  duration?: number;
  manaCost?: number;
  weaponTypes: string[];
  /** Mechanic tokens this skill emits / consumes, for the synergy engine. */
  emits: Set<string>;
  consumes: Set<string>;
  /** Delivery classification used by the UI and scoring. */
  deliversDamage: boolean;
  isSupportOnly: boolean;
}

/** Result of testing one effect against one skill. */
export interface Applicability {
  applies: boolean;
  /** 'direct'    — always on for this skill
   *  'conditional' — needs a state/enemy/weapon condition to be true
   *  'setup'     — needs a build decision (totem/trap/mine/minion usage)
   *  'no'        — never applies */
  strength: 'direct' | 'conditional' | 'setup' | 'no';
  reasons: string[];
  /** Fraction of the time the effect is assumed live, for scoring. */
  uptime: number;
}

/** Raw data shapes as they exist in src/data/generated. */
export interface RawSkill {
  id: string;
  name: string;
  color?: number;
  isSupport: boolean;
  skillTypes?: string[];
  requireSkillTypes?: string[];
  addSkillTypes?: string[];
  excludeSkillTypes?: string[];
  gemFamily?: string[];
  levels?: {
    level: number; levelRequirement?: number; manaCost?: number;
    cooldown?: number; baseMultiplier?: number; storedUses?: number;
    attackSpeedMultiplier?: number;
  }[];
  constantStats?: [string, number][];
  perLevelStats?: { level: number; stats: Record<string, number> }[];
  weaponTypes?: string[];
  castTime?: number;
  description?: string;
}

export interface RawTreeNode {
  id: number;
  name?: string;
  stats?: string[];
  connections?: number[];
  group?: number;
  orbit?: number;
  orbitIndex?: number;
  ascendancyName?: string;
  isNotable?: boolean;
  isKeystone?: boolean;
  isJewelSocket?: boolean;
  isAscendancyStart?: boolean;
  classesStart?: number[];
}

export interface RawTree {
  treeVersion?: string;
  classes: {
    internalId: string; integerId: number; name: string; startNodeId: number;
    ascendancies: { id: string; internalId: string; name: string; startNodeId?: number }[];
  }[];
  nodes: Record<string, RawTreeNode> | RawTreeNode[];
}

export interface RawItemMod {
  id: string;
  type?: string;
  affix?: string;
  level?: number;
  group?: string;
  stats?: { text: string; kind?: string; ranges?: number[][] }[];
  weightKey?: string[];
  weightVal?: number[];
  modTags?: string[];
}

export interface RawUnique {
  name: string;
  baseType?: string;
  implicits?: string[];
  explicits?: string[];
  category?: string;
  variants?: string[];
  currentVariant?: number;
}

export interface Dataset {
  skills: RawSkill[];
  tree: RawTree;
  itemMods: RawItemMod[];
  uniques: RawUnique[];
}
