// The lexicon. Everything the parser knows about English PoE2 mod wording
// lives here as data, not as code, so extending coverage is a one-line change.

import { Bucket, StatKey, Tag } from './types';

/** Tag words as they appear inside mod lines. Longest phrases first — the
 *  scanner consumes matches left to right and removes them. */
export const TAG_PATTERNS: { re: RegExp; tag: Tag }[] = [
  { re: /\bone[- ]handed melee weapons?\b/i, tag: 'oneHanded' },
  { re: /\bone[- ]handed weapons?\b/i, tag: 'oneHanded' },
  { re: /\btwo[- ]handed melee weapons?\b/i, tag: 'twoHanded' },
  { re: /\btwo[- ]handed weapons?\b/i, tag: 'twoHanded' },
  { re: /\bdual wielding\b/i, tag: 'dualWielding' },
  { re: /\bquarterstaves|quarterstaff\b/i, tag: 'quarterstaff' },
  { re: /\bcrossbows?\b/i, tag: 'crossbow' },
  { re: /\bbows?\b/i, tag: 'bow' },
  { re: /\bwands?\b/i, tag: 'wand' },
  { re: /\bsceptres?\b/i, tag: 'sceptre' },
  { re: /\bstaves|staff\b/i, tag: 'staff' },
  { re: /\bmaces?\b/i, tag: 'mace' },
  { re: /\baxes?\b/i, tag: 'axe' },
  { re: /\bswords?\b/i, tag: 'sword' },
  { re: /\bspears?\b/i, tag: 'spear' },
  { re: /\bflails?\b/i, tag: 'flail' },
  { re: /\bdaggers?\b/i, tag: 'dagger' },
  { re: /\bclaws?\b/i, tag: 'claw' },
  { re: /\bshields?\b/i, tag: 'shield' },
  { re: /\bunarmed\b/i, tag: 'unarmed' },

  { re: /\bminions?\b/i, tag: 'minion' },
  { re: /\bcompanions?\b/i, tag: 'companion' },
  { re: /\bballistae?\b/i, tag: 'ballista' },
  { re: /\btotems?\b/i, tag: 'totem' },
  { re: /\btraps?\b/i, tag: 'trap' },
  { re: /\bmines?\b/i, tag: 'mine' },

  { re: /\bspells?\b/i, tag: 'spell' },
  { re: /\battacks?\b/i, tag: 'attack' },
  { re: /\bmelee\b/i, tag: 'melee' },
  { re: /\bprojectiles?\b/i, tag: 'projectile' },
  { re: /\bnova\b/i, tag: 'nova' },
  { re: /\bslams?\b/i, tag: 'slam' },
  { re: /\bchannell?ing\b/i, tag: 'channelling' },
  { re: /\bwarcr(?:y|ies)\b/i, tag: 'warcry' },
  { re: /\bheralds?\b/i, tag: 'herald' },
  { re: /\bauras?\b/i, tag: 'aura' },
  { re: /\bcurses?\b/i, tag: 'curse' },
  { re: /\bmarks?\b/i, tag: 'mark' },
  { re: /\bbanners?\b/i, tag: 'banner' },
  { re: /\bofferings?\b/i, tag: 'offering' },
  { re: /\bmeta skills?\b/i, tag: 'meta' },
  { re: /\btriggered skills?\b/i, tag: 'triggerable' },

  { re: /\belemental\b/i, tag: 'elemental' },
  { re: /\bphysical\b/i, tag: 'physical' },
  { re: /\bfire\b|\bburning\b|\bignite\b/i, tag: 'fire' },
  { re: /\bcold\b|\bfreeze\b|\bchill\b/i, tag: 'cold' },
  { re: /\blightning\b|\bshock\b|\belectrocut/i, tag: 'lightning' },
  { re: /\bchaos\b/i, tag: 'chaos' },

  { re: /\bareas?\b/i, tag: 'area' },
  { re: /\bcritical\b/i, tag: 'critical' },
  { re: /\bshapeshift/i, tag: 'shapeshift' },
];

/** Which tags describe damage types (used for conversion-aware matching). */
export const DAMAGE_TYPE_TAGS: Tag[] = ['physical', 'fire', 'cold', 'lightning', 'chaos'];
export const ELEMENTAL_TAGS: Tag[] = ['fire', 'cold', 'lightning'];

/** Tags that mean "this modifier is for a proxy that acts on your behalf".
 *  A skill only benefits if it is actually used through that proxy. */
export const PROXY_TAGS: Tag[] = ['minion', 'totem', 'trap', 'mine', 'companion', 'ballista'];

/** Tags that restrict by weapon. Matched against a skill's weaponTypes. */
export const WEAPON_TAGS: Tag[] = [
  'bow', 'crossbow', 'wand', 'staff', 'quarterstaff', 'sceptre', 'mace', 'axe',
  'sword', 'spear', 'flail', 'dagger', 'claw', 'oneHanded', 'twoHanded',
  'dualWielding', 'shield', 'unarmed',
];

export interface StatDef {
  key: StatKey;
  label: string;
  bucket: Bucket;
  /** Matched against the mod subject once the form prefix is removed.
   *  Order matters: the registry is scanned top to bottom. */
  re: RegExp;
  /** Tags this stat implies about the affected skill. */
  implies?: Tag[];
  /** True when the stat only matters if the skill deals damage over time. */
  dotOnly?: boolean;
}

/** The stat registry, most specific first. */
export const STATS: StatDef[] = [
  // A "Grants Skill" line adds a skill, it does not scale the one you picked.
  { key: 'grantsSkill', label: 'Grants a Skill', bucket: 'utility', re: /grants skill|grants level \d+/i },

  // ---- speed / rate of application -------------------------------------
  { key: 'attackSpeed', label: 'Attack Speed', bucket: 'speed', re: /attack speed/i, implies: ['attack'] },
  { key: 'castSpeed', label: 'Cast Speed', bucket: 'speed', re: /cast speed/i, implies: ['spell'] },
  { key: 'skillSpeed', label: 'Skill Speed', bucket: 'speed', re: /skill speed/i },
  { key: 'warcrySpeed', label: 'Warcry Speed', bucket: 'speed', re: /warcry speed/i, implies: ['warcry'] },
  { key: 'reloadSpeed', label: 'Reload Speed', bucket: 'speed', re: /reload speed/i, implies: ['crossbow'] },
  { key: 'cooldownRecovery', label: 'Cooldown Recovery Rate', bucket: 'speed', re: /cooldown recovery(?: rate)?/i },
  { key: 'chargeRecovery', label: 'Charge Recovery', bucket: 'speed', re: /(?:additional|maximum) uses?\b|charge recovery|use recovery/i },
  { key: 'projectileSpeed', label: 'Projectile Speed', bucket: 'speed', re: /projectile speed/i, implies: ['projectile'] },
  { key: 'ailmentBuildup', label: 'Ailment Buildup', bucket: 'speed', re: /(?:freeze|shock|electrocute|ignite|stun|chill) buildup|buildup/i },
  { key: 'dotFaster', label: 'Damaging Ailments deal damage faster', bucket: 'speed', re: /(?:ignites?|poisons?|bleeding|burning|damaging ailments?)[^.]{0,32}deal damage|deal damage[^.]{0,32}(?:ignites?|poisons?|bleeding)/i, dotOnly: true },
  { key: 'skillEffectDuration', label: 'Skill Effect Duration', bucket: 'speed', re: /skill effect duration|effect duration/i, implies: ['duration'] },
  { key: 'movementSpeed', label: 'Movement Speed', bucket: 'utility', re: /movement speed/i },

  // ---- area / coverage --------------------------------------------------
  { key: 'presenceArea', label: 'Presence Area of Effect', bucket: 'aoe', re: /presence[^.]*area of effect|area of effect of your presence/i },
  // A jewel's radius and your light radius are not the skill's area.
  { key: 'jewelRadius', label: 'Jewel Radius', bucket: 'utility', re: /jewels?[^.]*radius|radius[^.]*jewels?/i },
  { key: 'lightRadius', label: 'Light Radius', bucket: 'utility', re: /light radius/i },
  { key: 'areaOfEffect', label: 'Area of Effect', bucket: 'aoe', re: /area of effect|explosion radius|radius/i, implies: ['area'] },
  { key: 'projectileCount', label: 'Projectile Count', bucket: 'aoe', re: /number of projectiles|additional (?:projectiles?|arrows?|bolts?)|fires? an additional|projectiles? fired/i, implies: ['projectile'] },
  { key: 'chainCount', label: 'Chains', bucket: 'aoe', re: /number of chains|chains? (?:an )?additional|additional chains?|chain \d+ additional/i },
  { key: 'pierce', label: 'Pierce', bucket: 'aoe', re: /pierce/i, implies: ['projectile'] },
  { key: 'fork', label: 'Fork', bucket: 'aoe', re: /\bforks?\b/i, implies: ['projectile'] },
  { key: 'meleeRange', label: 'Melee Range', bucket: 'aoe', re: /\b(?:melee |strike |weapon )?range\b/i, implies: ['melee'] },

  // ---- damage -----------------------------------------------------------
  { key: 'critChance', label: 'Critical Hit Chance', bucket: 'damage', re: /critical (?:hit|strike) chance/i, implies: ['critical'] },
  { key: 'critDamage', label: 'Critical Damage Bonus', bucket: 'damage', re: /critical (?:damage bonus|strike multiplier)/i, implies: ['critical'] },
  { key: 'penetration', label: 'Resistance Penetration', bucket: 'damage', re: /penetrat/i },
  { key: 'exposure', label: 'Enemy Resistance Reduction', bucket: 'damage', re: /\bexposure\b/i },
  { key: 'dotMultiplier', label: 'Damage over Time Multiplier', bucket: 'damage', re: /damage over time multiplier/i, dotOnly: true },
  { key: 'dotDamage', label: 'Damage over Time', bucket: 'damage', re: /damage over time/i, dotOnly: true },
  { key: 'ailmentMagnitude', label: 'Ailment Magnitude', bucket: 'damage', re: /magnitude/i },
  { key: 'ailmentChance', label: 'Ailment Chance', bucket: 'damage', re: /chance to (?:shock|freeze|ignite|chill|electrocute|poison|bleed)\w*|chance to inflict|(?:shock|freeze|ignite|chill|electrocute|poison|bleed)\w* chance/i },
  { key: 'curseEffect', label: 'Curse Effect', bucket: 'damage', re: /curse effect|effect of your curses/i, implies: ['curse'] },
  { key: 'auraEffect', label: 'Buff / Aura Effect', bucket: 'damage', re: /(?:aura|buff|herald) effect|effect of.*(?:aura|buff|herald)/i },
  { key: 'accuracy', label: 'Accuracy Rating', bucket: 'damage', re: /accuracy/i, implies: ['attack'] },
  // Deliberately stops before the qualifier: "+7 to Level of all Melee Skills"
  // must leave "Melee Skills" behind so the tag scan can restrict it.
  { key: 'gemLevel', label: 'Skill Gem Level', bucket: 'damage', re: /level of all\b|to level of\b|skill gem level/i },
  { key: 'stunBuildup', label: 'Stun Buildup', bucket: 'damage', re: /stun (?:buildup|damage)/i },
  { key: 'armourBreak', label: 'Armour Break', bucket: 'damage', re: /armour break|break[^.]*armour/i },
  { key: 'addedDamage', label: 'Added Damage', bucket: 'damage', re: /adds .*damage|added damage/i },
  { key: 'damage', label: 'Damage', bucket: 'damage', re: /damage/i },

  // ---- ailment persistence ---------------------------------------------
  // "on you" lines are defensive; the enemy-facing variants scale your damage.
  { key: 'ailmentsOnYou', label: 'Ailments on You', bucket: 'utility', re: /(?:duration|effect|potency) of [^.]*on you|(?:shock|chill|freeze|ignite|poison|bleeding|electrocute)\w* duration on you|avoid being \w+|slowing potency/i },
  { key: 'ailmentDuration', label: 'Ailment Duration on Enemies', bucket: 'damage', re: /duration of damaging ailments|(?:shock|chill|freeze|ignite|poison|bleeding|electrocute)\w* duration(?: on enemies)?|parried debuff duration/i },
  { key: 'totemPlacement', label: 'Totem Placement Speed', bucket: 'speed', re: /(?:totem )?placement speed/i, implies: ['totem'] },
  { key: 'minionDuration', label: 'Minion Duration', bucket: 'utility', re: /minion duration|minions revive/i, implies: ['minion'] },

  // ---- sustain / cost ---------------------------------------------------
  { key: 'manaCost', label: 'Mana Cost', bucket: 'utility', re: /mana cost|cost of skills/i },
  { key: 'lifeLeech', label: 'Life Leech', bucket: 'utility', re: /life leech|leeched as life|life leeched/i },
  { key: 'manaLeech', label: 'Mana Leech', bucket: 'utility', re: /mana leech|leeched as mana|mana leeched/i },
  { key: 'manaRegen', label: 'Mana Regeneration', bucket: 'utility', re: /mana regen/i },
  { key: 'spirit', label: 'Spirit', bucket: 'utility', re: /spirit/i },

  { key: 'mana', label: 'Maximum Mana', bucket: 'utility', re: /maximum mana|\bmana\b/i },
  { key: 'rage', label: 'Rage', bucket: 'utility', re: /\brage\b/i },
  { key: 'onKillRecovery', label: 'Recovery on Kill / Hit', bucket: 'utility', re: /(?:life|mana|energy shield) (?:per enemy|gained when|per second|gained on)/i },
  { key: 'stunThreshold', label: 'Stun / Ailment Threshold', bucket: 'utility', re: /stun threshold|ailment threshold|freeze threshold|stun recovery|stun duration/i },
  { key: 'rarity', label: 'Item Rarity', bucket: 'utility', re: /rarity of items/i },
  { key: 'flaskCharges', label: 'Flask & Charm Charges', bucket: 'utility', re: /(?:flask|charm) charges|flask [^.]*recovery/i },

  // ---- defence / attributes (utility bucket) ----------------------------
  { key: 'life', label: 'Maximum Life', bucket: 'utility', re: /maximum life|life regen|life recovery/i },
  { key: 'energyShield', label: 'Energy Shield', bucket: 'utility', re: /energy shield/i },
  { key: 'armour', label: 'Armour', bucket: 'utility', re: /armour/i },
  { key: 'evasion', label: 'Evasion', bucket: 'utility', re: /evasion/i },
  { key: 'block', label: 'Block', bucket: 'utility', re: /block/i },
  { key: 'resistance', label: 'Resistances', bucket: 'utility', re: /resistances?/i },
  { key: 'attributes', label: 'Attributes', bucket: 'utility', re: /strength|dexterity|intelligence|attributes?/i },
];

/** Conditional clauses. `tags` promote a clause into a hard tag requirement
 *  (a "with Bows" modifier simply does not exist for a spell). */
export const CONDITIONS: {
  re: RegExp; kind: import('./types').Condition['kind']; tags?: Tag[]; uptime: number;
}[] = [
  { re: /\bwith bows?\b/i, kind: 'weapon', tags: ['bow'], uptime: 1 },
  { re: /\bwith crossbows?\b/i, kind: 'weapon', tags: ['crossbow'], uptime: 1 },
  { re: /\bwith quarterstaves\b/i, kind: 'weapon', tags: ['quarterstaff'], uptime: 1 },
  { re: /\bwith (?:maces|axes|swords|spears|flails|daggers|claws|wands|sceptres|staves)\b/i, kind: 'weapon', uptime: 1 },
  { re: /\bwhile dual wielding\b/i, kind: 'weapon', tags: ['dualWielding'], uptime: 1 },
  { re: /\bwith (?:one|two)[- ]handed\b[^,.]*/i, kind: 'weapon', uptime: 1 },
  { re: /\bwhile (?:wielding|holding|you have) a[^,.]*/i, kind: 'weapon', uptime: 1 },

  { re: /\bwhile (?:channell?ing|moving|stationary|sprinting|leeching|shapeshifted)\b/i, kind: 'selfState', uptime: 0.6 },
  { re: /\bwhile (?:on|at) (?:full|low) (?:life|mana|energy shield)\b/i, kind: 'selfState', uptime: 0.5 },
  { re: /\bwhile (?:you have|affected by)[^,.]*/i, kind: 'selfState', uptime: 0.6 },
  { re: /\bwhile surrounded\b/i, kind: 'selfState', uptime: 0.4 },
  { re: /\bduring [^,.]*/i, kind: 'selfState', uptime: 0.4 },

  { re: /\bagainst (?:ignited|shocked|frozen|chilled|electrocuted|poisoned|bleeding)[^,.]*/i, kind: 'enemyState', uptime: 0.8 },
  { re: /\bagainst (?:rare|unique|immobilised|dazed|heavy stunned)[^,.]*/i, kind: 'enemyState', uptime: 0.5 },
  { re: /\bagainst enemies[^,.]*/i, kind: 'enemyState', uptime: 0.5 },
  { re: /\bon (?:enemies|full life enemies)\b/i, kind: 'enemyState', uptime: 0.6 },

  { re: /\bif you(?:'ve| have)[^,.]*recently\b/i, kind: 'recently', uptime: 0.7 },
  { re: /\bif you haven'?t[^,.]*recently\b/i, kind: 'recently', uptime: 0.4 },
  { re: /\brecently\b/i, kind: 'recently', uptime: 0.7 },

  { re: /\bon (?:kill|hit|block|stun|critical hit)\b/i, kind: 'onEvent', uptime: 0.7 },
  { re: /\bwhen you [^,.]*/i, kind: 'onEvent', uptime: 0.6 },

  { re: /\bper (?:power|frenzy|endurance) charge\b/i, kind: 'perStack', uptime: 0.8 },
  { re: /\bper \d*\s*[^,.]*/i, kind: 'perStack', uptime: 0.8 },

  { re: /\bfrom equipped [^,.]*/i, kind: 'equipment', uptime: 1 },
  { re: /\bfrom flasks?\b/i, kind: 'equipment', uptime: 0.4 },
];

/** Words that mean the modifier is not about your own skills. */
export const TARGET_HINTS: { re: RegExp; target: import('./types').Effect['target'] }[] = [
  { re: /^minions? (?:deal|have|gain|take)|minions'/i, target: 'minion' },
  { re: /^companions? (?:deal|have|gain)/i, target: 'minion' },
  { re: /^enemies (?:have|take|are)|^enemy\b/i, target: 'enemy' },
  { re: /^allies\b|allies in your presence/i, target: 'ally' },
];

export const BUCKET_LABEL: Record<Bucket, string> = {
  damage: 'Damage',
  aoe: 'Area & Coverage',
  speed: 'Application Speed',
  utility: 'Sustain & Defence',
};
