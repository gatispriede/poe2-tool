// PoB internal stat key → Effect.
//
// Support gems and a skill's own innate stats are not English; they are keys
// like `support_brutality_physical_damage_+%_final`. Those keys have a regular
// morphology:
//
//   [namespace_]…[qualifier_]<stat noun>_<operator>[_final][_condition]
//
// so they parse structurally rather than by enumeration: find the operator
// suffix (that fixes the FORM), find the stat noun (that fixes the BUCKET),
// and read qualifiers/conditions off the remaining tokens.

import { Condition, Effect, ModForm, Tag } from './types';

interface KeyStat { re: RegExp; stat: string; }

/** Ordered most specific first. */
const KEY_STATS: KeyStat[] = [
  { re: /area_of_effect/, stat: 'areaOfEffect' },
  { re: /attack_speed/, stat: 'attackSpeed' },
  { re: /cast_speed/, stat: 'castSpeed' },
  { re: /skill_speed/, stat: 'skillSpeed' },
  { re: /reload_speed/, stat: 'reloadSpeed' },
  { re: /projectile_speed/, stat: 'projectileSpeed' },
  { re: /cooldown(?:_recovery|_speed)?/, stat: 'cooldownRecovery' },
  { re: /number_of_(?:additional_)?(?:projectiles|arrows|crossbow_bolts)|projectiles_\+|additional_fissures/, stat: 'projectileCount' },
  { re: /number_of_chains|_chains?_\+|additional_chains?/, stat: 'chainCount' },
  { re: /pierce/, stat: 'pierce' },
  { re: /fork/, stat: 'fork' },
  { re: /melee_range|weapon_range/, stat: 'meleeRange' },
  // PoB abbreviates critical to `crit` in about half of these keys.
  { re: /crit(?:ical)?[a-z_]*?(?:multiplier|damage)/, stat: 'critDamage' },
  { re: /(?:^|_)crit(?:ical)?(?:_chance)?(?:_|$)/, stat: 'critChance' },
  { re: /penetrat/, stat: 'penetration' },
  { re: /exposure/, stat: 'exposure' },
  { re: /damage_over_time_multiplier/, stat: 'dotMultiplier' },
  { re: /damage_over_time|degen|damage_per_minute/, stat: 'dotDamage' },
  { re: /chance_to_(?:ignite|shock|freeze|chill|poison|bleed|electrocute)|(?:ignite|shock|freeze|poison|bleeding|ailment)_chance|chance_to_inflict/, stat: 'ailmentChance' },
  { re: /(?:ignite|shock|freeze|chill|poison|bleeding|electrocute)[a-z_]*?(?:magnitude|effect|multiplier)/, stat: 'ailmentMagnitude' },
  { re: /(?:ignite|shock|freeze|chill|poison|bleeding)[a-z_]*?duration/, stat: 'ailmentDuration' },
  { re: /buildup/, stat: 'ailmentBuildup' },
  { re: /armour_break/, stat: 'armourBreak' },
  { re: /stun/, stat: 'stunBuildup' },
  { re: /accuracy/, stat: 'accuracy' },
  { re: /(?:skill_effect|secondary_skill_effect|ground_effect|skill|ailment)[a-z_]*?duration|duration(?:_|$)/, stat: 'skillEffectDuration' },
  { re: /mana_cost|cost_\+/, stat: 'manaCost' },
  { re: /life_leech/, stat: 'lifeLeech' },
  { re: /mana_leech/, stat: 'manaLeech' },
  { re: /curse_effect|curse_magnitude/, stat: 'curseEffect' },
  { re: /buff_effect|aura_effect|herald/, stat: 'auraEffect' },
  { re: /(?:^|_)damage(?:_|$)/, stat: 'damage' },
  { re: /maximum_life|minion_life|totem_life/, stat: 'life' },
  { re: /energy_shield/, stat: 'energyShield' },
  { re: /movement_speed/, stat: 'movementSpeed' },
];

const KEY_TAGS: { re: RegExp; tag: Tag }[] = [
  { re: /(?:^|_)melee(?:_|$)/, tag: 'melee' },
  { re: /(?:^|_)spell(?:_|$)/, tag: 'spell' },
  { re: /(?:^|_)attack(?:_|$)/, tag: 'attack' },
  { re: /(?:^|_)projectile/, tag: 'projectile' },
  { re: /(?:^|_)minions?(?:_|$)/, tag: 'minion' },
  { re: /(?:^|_)totems?(?:_|$)/, tag: 'totem' },
  { re: /(?:^|_)traps?(?:_|$)/, tag: 'trap' },
  { re: /(?:^|_)mines?(?:_|$)/, tag: 'mine' },
  { re: /(?:^|_)warcry/, tag: 'warcry' },
  { re: /crossbow/, tag: 'crossbow' },
  { re: /(?:^|_)bow(?:_|$)/, tag: 'bow' },
  { re: /(?:^|_)area(?:_|$)/, tag: 'area' },
];

const KEY_DAMAGE_TYPES: { re: RegExp; tag: Tag }[] = [
  { re: /physical/, tag: 'physical' },
  { re: /(?:^|_)fire|ignite|burning/, tag: 'fire' },
  { re: /(?:^|_)cold|freeze|chill/, tag: 'cold' },
  { re: /lightning|shock|electrocute/, tag: 'lightning' },
  { re: /chaos|poison/, tag: 'chaos' },
  { re: /elemental/, tag: 'elemental' },
];

/** Qualifiers that can sit anywhere in the key and always narrow it. A support
 *  that reads `..._distance_based_pin_damage_+%_final` is not a flat damage
 *  multiplier; it is one that needs a specific state to be true. */
const KEY_QUALIFIERS: { re: RegExp; kind: Condition['kind']; uptime: number }[] = [
  { re: /(?:^|_)(pin|pinned)(?:_|$)/, kind: 'enemyState', uptime: 0.4 },
  { re: /distance_based|close_range|long_range|at_min_distance|at_max_distance/, kind: 'enemyState', uptime: 0.5 },
  { re: /low_life|full_life/, kind: 'enemyState', uptime: 0.4 },
  { re: /(?:^|_)(stage|stages|combo|infusion|seals?|charges?|energy|rage|glory)(?:_|$)/, kind: 'perStack', uptime: 0.6 },
  { re: /(?:^|_)(shocked|ignited|chilled|frozen|burning|bleeding|poisoned)(?:_|$)/, kind: 'enemyState', uptime: 0.6 },
  { re: /(?:^|_)(moving|stationary|channelling|channeling|dual_wielding)(?:_|$)/, kind: 'selfState', uptime: 0.6 },
  { re: /first_hit|final_strike|big_hit|killing_blow/, kind: 'onEvent', uptime: 0.4 },
];

const KEY_CONDITIONS: { re: RegExp; kind: Condition['kind'] }[] = [
  { re: /_while_([a-z_]+)$/, kind: 'selfState' },
  { re: /_vs_([a-z_]+)$/, kind: 'enemyState' },
  { re: /_against_([a-z_]+)$/, kind: 'enemyState' },
  { re: /_if_([a-z_]+)$/, kind: 'selfState' },
  { re: /_per_([a-z_]+)$/, kind: 'perStack' },
  { re: /_on_([a-z_]+)$/, kind: 'onEvent' },
  { re: /_when_([a-z_]+)$/, kind: 'onEvent' },
  { re: /_from_([a-z_]+)$/, kind: 'onEvent' },
];

/** Where a pattern's LAST occurrence ends, or -1. The first occurrence is the
 *  wrong one to measure: `support_crit_cooldown_crit_chance` mentions crit
 *  twice, and only the second one is the subject. */
function lastMatchEnd(re: RegExp, text: string): number {
  const global = new RegExp(re.source, re.flags.includes('g') ? re.flags : `${re.flags}g`);
  let end = -1;
  let m = global.exec(text);
  while (m) {
    end = m.index + m[0].length;
    if (m[0].length === 0) global.lastIndex += 1;
    m = global.exec(text);
  }
  return end;
}

/** Operator suffix → modifier form. `_final` is PoB's marker for "more". */
function readForm(key: string): { form: ModForm; sign: number; trimmed: string } | undefined {
  const patterns: { re: RegExp; form: ModForm; sign: number }[] = [
    { re: /_\+%_final$/, form: 'more', sign: 1 },
    { re: /_-%_final$/, form: 'more', sign: -1 },
    { re: /_%_final$/, form: 'more', sign: 1 },
    { re: /_\+%$/, form: 'increased', sign: 1 },
    { re: /_-%$/, form: 'increased', sign: -1 },
    { re: /_\+$/, form: 'flat', sign: 1 },
    { re: /_-$/, form: 'flat', sign: -1 },
    { re: /_%$/, form: 'chance', sign: 1 },
    { re: /_ms$/, form: 'flat', sign: 1 },
    { re: /_permyriad$/, form: 'flat', sign: 1 },
  ];
  for (const p of patterns) {
    if (p.re.test(key)) return { form: p.form, sign: p.sign, trimmed: key.replace(p.re, '') };
  }
  return undefined;
}

export function parseStatKey(key: string, value: number): Effect | undefined {
  const lower = key.toLowerCase();

  // The operator suffix sits between the stat noun and any trailing condition
  // (`..._damage_+%_final_while_dual_wielding`), so peel the form first, then
  // read conditions off whatever trails it, then off the head.
  let head = lower;
  let tail = '';
  const formInfo = (() => {
    const direct = readForm(head);
    if (direct) return direct;
    for (const c of KEY_CONDITIONS) {
      const m = head.match(c.re);
      if (!m) continue;
      const candidate = readForm(head.replace(c.re, ''));
      if (candidate) { tail = m[0]; return candidate; }
    }
    return undefined;
  })();

  const conditions: Condition[] = [];
  let body = formInfo ? formInfo.trimmed : head;
  for (const c of KEY_CONDITIONS) {
    for (const source of [tail, body]) {
      const m = source.match(c.re);
      if (!m) continue;
      conditions.push({ kind: c.kind, text: m[1].replace(/_/g, ' ') });
      if (source === body) body = body.replace(c.re, '');
    }
  }

  // Keys with no operator suffix are base/absolute values (e.g.
  // `base_number_of_projectiles`); they read as flat additions.
  const form: ModForm = formInfo?.form ?? 'flat';
  const sign = formInfo?.sign ?? 1;

  // Millisecond keys are timings (delays, windows, durations). Reading one as
  // its noun would turn `inflict_exposure_for_x_ms = 8000` into 8000%
  // penetration, so they only survive when the noun really is a duration.
  const isMs = /_ms(?:_|$)/.test(lower);

  // PoB keys read namespace-first and noun-last: in
  // `support_ailment_cooldown_ailment_chance_+%_final` the subject is the
  // ailment chance, not the cooldown the gem name mentions. So among all
  // matching nouns, take the one that ends latest in the key.
  let statMatch: KeyStat | undefined;
  let statEnd = -1;
  for (const candidate of KEY_STATS) {
    const end = lastMatchEnd(candidate.re, body);
    if (end > statEnd) { statEnd = end; statMatch = candidate; }
  }
  if (!statMatch) return undefined;
  if (isMs && statMatch.stat !== 'skillEffectDuration' && statMatch.stat !== 'ailmentDuration') {
    return undefined;
  }

  let uptime = 1;
  for (const q of KEY_QUALIFIERS) {
    if (!q.re.test(body)) continue;
    const m = body.match(q.re);
    conditions.push({ kind: q.kind, text: (m && m[1] ? m[1] : m ? m[0] : '').replace(/_/g, ' ').trim() });
    uptime = Math.min(uptime, q.uptime);
  }
  if (conditions.length && uptime === 1) uptime = 0.7;

  const requires = KEY_TAGS.filter((t) => t.re.test(body)).map((t) => t.tag);
  const damageTypes = KEY_DAMAGE_TYPES.filter((t) => t.re.test(body)).map((t) => t.tag);

  // Penetration and exposure are percentages of resistance; anything past 100
  // is a misparse rather than a very good mod.
  const raw = value * sign;
  const magnitude = (statMatch.stat === 'penetration' || statMatch.stat === 'exposure')
    ? Math.max(-100, Math.min(100, raw))
    : raw;

  const effect: Effect = {
    form,
    value: magnitude,
    stat: statMatch.stat,
    requires,
    excludes: [],
    damageTypes,
    conditions,
    target: requires.includes('minion') ? 'minion' : 'self',
    raw: `${key} = ${value}`,
    parseConfidence: formInfo ? 0.85 : 0.6,
  };
  (effect as Effect & { uptime?: number }).uptime = uptime;
  return effect;
}

/** Parse a whole stat bag (constantStats plus one level of perLevelStats). */
export function parseStatBag(
  constants: [string, number][] | undefined,
  levelStats: Record<string, number> | undefined,
): Effect[] {
  const out: Effect[] = [];
  for (const [k, v] of constants ?? []) {
    const e = parseStatKey(k, v);
    if (e) out.push(e);
  }
  for (const [k, v] of Object.entries(levelStats ?? {})) {
    const e = parseStatKey(k, v);
    if (e) out.push(e);
  }
  return out;
}
