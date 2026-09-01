// Raw PoB skill → SkillProfile.
//
// The profile is the skill's identity in engine terms: which tags it carries
// (that decides what can modify it), which damage types it actually deals
// (after its own innate conversions), how fast it repeats, how big it is, and
// which mechanics it produces or consumes (that decides what pairs with it).

import { RawSkill, SkillProfile, Tag } from './types';
import { ELEMENTAL_TAGS } from './vocab';

/** skillType → tag. Only entries that change what can modify the skill. */
const TYPE_TAGS: Record<string, Tag> = {
  Spell: 'spell',
  AreaSpell: 'area',
  Attack: 'attack',
  Melee: 'melee',
  MeleeSingleTarget: 'melee',
  Projectile: 'projectile',
  Area: 'area',
  Nova: 'nova',
  Slam: 'slam',
  Channel: 'channelling',
  Movement: 'movement',
  Travel: 'travel',
  Wall: 'wall',
  Orb: 'orb',
  Grenade: 'grenade',
  Rain: 'rain',
  Duration: 'duration',
  DamageOverTime: 'damageOverTime',
  Physical: 'physical',
  Fire: 'fire',
  Cold: 'cold',
  Lightning: 'lightning',
  Chaos: 'chaos',
  Minion: 'minion',
  CreatesMinion: 'minion',
  CreatesUndeadMinion: 'minion',
  CreatesSkeletonMinion: 'minion',
  CreatesDemonMinion: 'minion',
  CommandsMinions: 'minion',
  Companion: 'companion',
  CreatesCompanion: 'companion',
  SummonsTotem: 'totem',
  SummonsAttackTotem: 'totem',
  TotemsAreBallistae: 'ballista',
  Aura: 'aura',
  Herald: 'herald',
  AppliesCurse: 'curse',
  IsBlasphemy: 'blasphemy',
  Mark: 'mark',
  Buff: 'buff',
  Banner: 'banner',
  Offering: 'offering',
  Warcry: 'warcry',
  Guard: 'guard',
  Meta: 'meta',
  Triggers: 'trigger',
  Triggerable: 'triggerable',
  Persistent: 'persistent',
  Chains: 'chaining',
  Shapeshift: 'shapeshift',
  RangedAttack: 'attack',
  Bow: 'bow',
  Spear: 'spear',
  CrossbowSkill: 'crossbow',
  QuarterstaffSkill: 'quarterstaff',
  DualWieldOnly: 'dualWielding',
  RequiresShield: 'shield',
};

const WEAPON_TYPE_TAGS: Record<string, Tag[]> = {
  Bow: ['bow', 'twoHanded', 'martial'],
  Crossbow: ['crossbow', 'twoHanded', 'martial'],
  Staff: ['staff', 'twoHanded'],
  Talisman: [],
  Claw: ['claw', 'oneHanded', 'martial'],
  Dagger: ['dagger', 'oneHanded', 'martial'],
  Flail: ['flail', 'oneHanded', 'martial'],
  Spear: ['spear', 'oneHanded', 'martial'],
  'One Hand Axe': ['axe', 'oneHanded', 'martial'],
  'One Hand Mace': ['mace', 'oneHanded', 'martial'],
  'One Hand Sword': ['sword', 'oneHanded', 'martial'],
  'Two Hand Axe': ['axe', 'twoHanded', 'martial'],
  'Two Hand Mace': ['mace', 'twoHanded', 'martial'],
  'Two Hand Sword': ['sword', 'twoHanded', 'martial'],
};

/** Mechanic tokens for the synergy engine. Emitting a token means the skill
 *  produces that state; consuming means it needs or exploits it. */
const EMIT_TYPES: Record<string, string> = {
  Triggers: 'triggers_skills',
  GeneratesCharges: 'charges',
  CreatesGroundEffect: 'ground_effect',
  CreatesGroundRune: 'ground_effect',
  CreatesCompanion: 'companion',
  CreatesMinion: 'minion_body',
  CreatesUndeadMinion: 'minion_body',
  CreatesSkeletonMinion: 'minion_body',
  MinionsCanExplode: 'corpse',
  AppliesCurse: 'curse_on_enemy',
  Mark: 'mark_on_enemy',
  Warcry: 'warcry_buff',
  EmpowersOtherSkill: 'empowers_next',
  ModifiesNextSkill: 'empowers_next',
  Herald: 'herald_buff',
  Aura: 'aura_buff',
  Buff: 'self_buff',
  Banner: 'banner_buff',
  Offering: 'offering_buff',
  CausesBurning: 'ignite',
  GeneratesEnergy: 'meta_energy',
  GeneratesInfusion: 'infusion',
  Wall: 'wall',
  CreatesFissure: 'fissure',
  Detonator: 'detonates',
  Hazard: 'hazard',
};

const CONSUME_TYPES: Record<string, string> = {
  Triggerable: 'triggered_by_host',
  SkillConsumesIgnite: 'ignite',
  SkillConsumesShock: 'shock',
  SkillConsumesFreeze: 'freeze',
  SkillConsumesBleeding: 'bleed',
  SkillConsumesParried: 'parry',
  ConsumesFullyBrokenArmour: 'armour_break',
  SkillConsumesPowerChargesOnUse: 'charges',
  SkillConsumesFrenzyChargesOnUse: 'charges',
  SkillConsumesEnduranceChargesOnUse: 'charges',
  ConsumesCharges: 'charges',
  RequiresCharges: 'charges',
  ConsumesRage: 'rage',
  TargetsDestructibleCorpses: 'corpse',
  TargetsDestructibleRareCorpses: 'corpse',
  InteractsWithElementalGround: 'ground_effect',
  DetonatesAfterTime: 'detonates',
  Invokable: 'meta_energy',
  Unleashable: 'meta_energy',
  Multicastable: 'meta_energy',
  Cascadable: 'meta_energy',
  Barrageable: 'meta_energy',
  ComboStacking: 'combo',
  UsedByTotem: 'totem_host',
  MirageArcherCanUse: 'mirage_host',
  CommandableMinion: 'minion_command',
};

/** Ailment tokens implied by the damage the skill deals. A lightning hit can
 *  shock, a cold hit can freeze/chill, a fire hit can ignite. */
const TYPE_AILMENTS: Partial<Record<Tag, string[]>> = {
  lightning: ['shock', 'electrocute'],
  cold: ['freeze', 'chill'],
  fire: ['ignite'],
  physical: ['bleed', 'armour_break'],
  chaos: ['poison'],
};

function lastLevelStats(skill: RawSkill): Record<string, number> {
  const entries = skill.perLevelStats ?? [];
  if (!entries.length) return {};
  const preferred = entries.find((e) => e.level === 20) ?? entries[entries.length - 1];
  return preferred.stats ?? {};
}

export function buildSkillProfile(skill: RawSkill): SkillProfile {
  const skillTypes = skill.skillTypes ?? [];
  const tags = new Set<Tag>();
  for (const t of skillTypes) {
    const tag = TYPE_TAGS[t];
    if (tag) tags.add(tag);
  }
  for (const w of skill.weaponTypes ?? []) {
    for (const tag of WEAPON_TYPE_TAGS[w] ?? []) tags.add(tag);
  }
  if (tags.has('attack')) tags.add('weapon');
  if (skillTypes.includes('Damage') || skillTypes.includes('Attack')) tags.add('hit');

  const stats = lastLevelStats(skill);
  const constants = new Map(skill.constantStats ?? []);

  // Damage types: declared tags, plus whatever the base damage stats say, plus
  // the destination of the skill's own innate conversions.
  const byType: SkillProfile['baseDamage']['byType'] = {};
  let min = 0;
  let max = 0;
  for (const [key, value] of Object.entries(stats)) {
    const m = key.match(/^spell_(minimum|maximum)_base_(\w+?)_damage$/);
    if (!m) continue;
    const type = m[2] as Tag;
    tags.add(type);
    const slot = byType[type] ?? [0, 0];
    if (m[1] === 'minimum') slot[0] += value; else slot[1] += value;
    byType[type] = slot;
    if (m[1] === 'minimum') min += value; else max += value;
  }
  for (const [key] of constants) {
    const m = key.match(/^active_skill_base_physical_damage_%_to_convert_to_(\w+)$/);
    if (m) tags.add(m[1] as Tag);
  }
  if (ELEMENTAL_TAGS.some((t) => tags.has(t))) tags.add('elemental');

  const damageTypes = (['physical', 'fire', 'cold', 'lightning', 'chaos'] as Tag[])
    .filter((t) => tags.has(t));

  const emits = new Set<string>();
  const consumes = new Set<string>();
  for (const t of skillTypes) {
    if (EMIT_TYPES[t]) emits.add(EMIT_TYPES[t]);
    if (CONSUME_TYPES[t]) consumes.add(CONSUME_TYPES[t]);
  }
  const dealsDamage = skillTypes.includes('Damage') || skillTypes.includes('Attack') || max > 0;
  if (dealsDamage) {
    for (const type of damageTypes) {
      for (const ailment of TYPE_AILMENTS[type] ?? []) emits.add(ailment);
    }
    emits.add('hit');
  }
  // Chance-to-ailment stats prove intent even when the damage type does not.
  for (const key of [...constants.keys(), ...Object.keys(stats)]) {
    if (/ignite_chance/.test(key)) emits.add('ignite');
    if (/shock_chance|shock_effect/.test(key)) emits.add('shock');
    if (/freeze|chill_effect/.test(key)) emits.add('freeze');
    if (/poison_chance/.test(key)) emits.add('poison');
    if (/bleeding_chance/.test(key)) emits.add('bleed');
    if (/armour_break/.test(key)) emits.add('armour_break');
    if (/exposure/.test(key)) emits.add('exposure');
    if (/stun/.test(key)) emits.add('stun');
  }
  if (skill.description) {
    const d = skill.description.toLowerCase();
    if (/corpse/.test(d)) consumes.add('corpse');
    if (/curse/.test(d)) emits.add('curse_on_enemy');
    if (/exposure/.test(d)) emits.add('exposure');
    if (/detonat/.test(d)) emits.add('detonates');
  }

  const lastLevel = (skill.levels ?? [])[(skill.levels ?? []).length - 1];
  const cooldown = (skill.levels ?? []).map((l) => l.cooldown).find((c) => typeof c === 'number');
  const durationMs = constants.get('base_skill_effect_duration');

  return {
    id: skill.id,
    name: skill.name,
    tags,
    skillTypes,
    description: skill.description,
    damageTypes,
    baseDamage: { min, max, byType },
    castTime: skill.castTime,
    cooldown,
    attackSpeedMultiplier: lastLevel?.attackSpeedMultiplier,
    areaRadius: constants.get('active_skill_base_area_of_effect_radius'),
    secondaryAreaRadius: constants.get('active_skill_base_secondary_area_of_effect_radius'),
    projectiles: stats['base_number_of_projectiles'] ?? constants.get('base_number_of_projectiles'),
    chains: stats['number_of_chains'] ?? constants.get('number_of_chains'),
    duration: typeof durationMs === 'number' ? durationMs / 1000 : undefined,
    manaCost: lastLevel?.manaCost,
    weaponTypes: skill.weaponTypes ?? [],
    emits,
    consumes,
    deliversDamage: dealsDamage,
    isSupportOnly: skill.isSupport,
  };
}

/** Capabilities that are build decisions rather than intrinsic tags. */
export function skillCapabilities(skill: RawSkill): { totem: boolean; trap: boolean; mine: boolean } {
  const t = skill.skillTypes ?? [];
  return {
    totem: t.includes('Totemable'),
    trap: t.includes('Trappable'),
    mine: t.includes('Mineable'),
  };
}
