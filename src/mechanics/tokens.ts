// Mechanic wording dissection.
//
// Every skill / support / passive carries its rules as a mix of:
//   - skillTypes tags   (Triggers, Triggerable, Cold, Cascadable, …)
//   - description text   ("gains Energy when you Critically Hit")
//   - constantStats keys ("cast_on_crit_gain_X_…_on_crit")
//
// We dissect those into two token sets per entity:
//   EMITS    — conditions / states / resources this entity PRODUCES
//   CONSUMES — conditions this entity REQUIRES or BENEFITS FROM
//
// A synergy chain is an EMITS→CONSUMES match across two entities. The token
// vocabulary is the "principle layer": it encodes which PoE2 keywords feed
// which, independent of any specific gem. New gems slot into existing chains
// automatically because they're matched by token, not by name.

export type Token =
  // trigger conditions
  | 'on_crit' | 'on_hit' | 'on_kill' | 'on_block' | 'on_stun'
  | 'on_melee_hit' | 'on_cast' | 'on_attack'
  // ailment application / exploitation
  | 'freeze' | 'shock' | 'ignite' | 'chill' | 'electrocute' | 'poison' | 'bleed'
  // charges
  | 'power_charge' | 'frenzy_charge' | 'endurance_charge'
  // resources
  | 'mana' | 'life' | 'energy_shield' | 'spirit' | 'rage'
  // damage types (for conversion / scaling chains)
  | 'physical' | 'cold' | 'fire' | 'lightning' | 'chaos'
  // meta / structural
  | 'trigger_host'   // this entity triggers OTHER skills (CoC, Spellslinger)
  | 'triggerable'    // this entity can be triggered by a host
  | 'cascadable' | 'spell' | 'projectile' | 'area' | 'channelled';

export interface Dissection {
  emits: Set<Token>;
  consumes: Set<Token>;
  // raw evidence so the UI can show *why* a token was assigned
  evidence: { token: Token; side: 'emit' | 'consume'; source: string }[];
}

export interface MechanicEntity {
  id: string;
  name: string;
  kind: 'skill' | 'support' | 'meta' | 'passive' | 'keystone' | 'ascendancy';
  skillTypes: string[];
  description?: string;
  statKeys: string[];   // constantStats keys + tree stat lines
  statText: string[];   // human stat lines (tree nodes / support display)
}

const has = (tags: string[], t: string) => tags.includes(t);

// Description / stat-text keyword → token, with which side it lands on.
// `emitWhen` patterns describe producing a condition; `consumeWhen` describe
// requiring / benefiting from one.
interface Rule { token: Token; side: 'emit' | 'consume'; re: RegExp; }

const TEXT_RULES: Rule[] = [
  // --- trigger conditions (emit = "I cause this when…") ---
  { token: 'on_crit',  side: 'emit', re: /\b(?:when you |on )critical(?:ly)?\b|on critical hit/i },
  { token: 'on_kill',  side: 'emit', re: /\b(?:on|when you) kill/i },
  { token: 'on_block', side: 'emit', re: /\bwhen you block|on block/i },
  { token: 'on_stun',  side: 'emit', re: /\b(?:when you |on )stun/i },

  // --- ailment application (emit) ---
  { token: 'freeze',      side: 'emit', re: /\b(?:freeze|freezing|frozen)\b/i },
  { token: 'shock',       side: 'emit', re: /\bshock(?:s|ed|ing)?\b/i },
  { token: 'ignite',      side: 'emit', re: /\bignit(?:e|es|ed|ing)\b/i },
  { token: 'chill',       side: 'emit', re: /\bchill(?:s|ed|ing)?\b/i },
  { token: 'electrocute', side: 'emit', re: /\belectrocut(?:e|es|ed|ing)\b/i },
  { token: 'poison',      side: 'emit', re: /\bpoison(?:s|ed|ing)?\b/i },
  { token: 'bleed',       side: 'emit', re: /\b(?:bleed|bleeding)\b/i },

  // --- ailment exploitation (consume = "I benefit vs / consume this") ---
  { token: 'freeze',      side: 'consume', re: /\b(?:against|vs\.?) frozen|consume.*freeze|while frozen|freeze multiplier/i },
  { token: 'shock',       side: 'consume', re: /\b(?:against|vs\.?) shocked|while shocked|shock multiplier/i },
  { token: 'ignite',      side: 'consume', re: /\b(?:against|vs\.?) ignited|while ignited|ignite multiplier/i },
  { token: 'electrocute', side: 'consume', re: /\b(?:against|vs\.?) electrocuted|electrocute multiplier/i },

  // --- charges ---
  { token: 'power_charge',   side: 'emit',    re: /gain(?:s|ing)? .*power charge|on critical.*power charge/i },
  { token: 'power_charge',   side: 'consume', re: /per power charge|consume.*power charge|per .*power charge/i },
  { token: 'frenzy_charge',  side: 'emit',    re: /gain(?:s|ing)? .*frenzy charge/i },
  { token: 'frenzy_charge',  side: 'consume', re: /per frenzy charge|consume.*frenzy charge/i },

  // --- resources (emit = grants; consume = scales off pool/spend) ---
  { token: 'mana', side: 'consume', re: /per .*maximum mana|per 100 .*mana|% of .*mana/i },
  { token: 'mana', side: 'emit',    re: /gain(?:s|ing)? .*mana|regenerate .*mana/i },
  { token: 'life', side: 'emit',    re: /leech.*as life|gain .*life|recover .*life/i },

  // --- conversion / gain-as-extra (emit a damage type) ---
  { token: 'cold',      side: 'emit', re: /as extra cold|gain.*as cold|convert.*to cold/i },
  { token: 'fire',      side: 'emit', re: /as extra fire|gain.*as fire|convert.*to fire/i },
  { token: 'lightning', side: 'emit', re: /as extra lightning|gain.*as lightning|convert.*to lightning/i },
  // damage-type scaling (consume the type)
  { token: 'cold',      side: 'consume', re: /increased cold damage|more cold damage/i },
  { token: 'fire',      side: 'consume', re: /increased fire damage|more fire damage/i },
  { token: 'lightning', side: 'consume', re: /increased lightning damage|more lightning damage/i },
];

// Stat-key → token (machine-readable; complements text rules).
const KEY_RULES: Rule[] = [
  { token: 'on_crit',     side: 'emit',    re: /_on_crit\b|cast_on_crit/i },
  { token: 'mana',        side: 'consume', re: /per_100_max_mana|permyriad.*mana/i },
  { token: 'lightning',   side: 'emit',    re: /gain_as_lightning/i },
  { token: 'cold',        side: 'emit',    re: /gain_as_cold|to_gain_as_cold/i },
  { token: 'freeze',      side: 'consume', re: /freeze_multiplier/i },
  { token: 'shock',       side: 'consume', re: /shock_multiplier/i },
  { token: 'electrocute', side: 'consume', re: /electrocute_multiplier/i },
  { token: 'power_charge', side: 'consume', re: /per_power_charge|per_endurance/i },
  { token: 'cascadable',  side: 'consume', re: /cascade/i },
];

// skillTypes tag → token.
const TAG_TOKENS: { tag: string; token: Token; side: 'emit' | 'consume' }[] = [
  { tag: 'Triggers',    token: 'trigger_host', side: 'emit' },
  { tag: 'Triggerable', token: 'triggerable',  side: 'emit' },  // advertises "I can be triggered"
  { tag: 'Cascadable',  token: 'cascadable',   side: 'emit' },
  { tag: 'Spell',       token: 'spell',        side: 'emit' },
  { tag: 'Projectile',  token: 'projectile',   side: 'emit' },
  { tag: 'Area',        token: 'area',         side: 'emit' },
  { tag: 'Channel',     token: 'channelled',   side: 'emit' },
  { tag: 'Cold',        token: 'cold',         side: 'emit' },
  { tag: 'Fire',        token: 'fire',         side: 'emit' },
  { tag: 'Lightning',   token: 'lightning',    side: 'emit' },
  { tag: 'Chaos',       token: 'chaos',        side: 'emit' },
];

export function dissect(entity: MechanicEntity): Dissection {
  const emits = new Set<Token>();
  const consumes = new Set<Token>();
  const evidence: Dissection['evidence'] = [];
  const add = (token: Token, side: 'emit' | 'consume', source: string) => {
    (side === 'emit' ? emits : consumes).add(token);
    evidence.push({ token, side, source });
  };

  for (const { tag, token, side } of TAG_TOKENS) {
    if (has(entity.skillTypes, tag)) add(token, side, `tag:${tag}`);
  }

  const textBlob = [entity.description ?? '', ...entity.statText].join('  ');
  for (const { token, side, re } of TEXT_RULES) {
    if (re.test(textBlob)) {
      const m = textBlob.match(re);
      add(token, side, `text:"${(m?.[0] ?? '').trim().slice(0, 40)}"`);
    }
  }

  for (const key of entity.statKeys) {
    for (const { token, side, re } of KEY_RULES) {
      if (re.test(key)) add(token, side, `stat:${key.slice(0, 48)}`);
    }
  }

  return { emits, consumes, evidence };
}

export const TOKEN_LABEL: Record<Token, string> = {
  on_crit: 'on Critical Hit', on_hit: 'on Hit', on_kill: 'on Kill',
  on_block: 'on Block', on_stun: 'on Stun', on_melee_hit: 'on Melee Hit',
  on_cast: 'on Cast', on_attack: 'on Attack',
  freeze: 'Freeze', shock: 'Shock', ignite: 'Ignite', chill: 'Chill',
  electrocute: 'Electrocute', poison: 'Poison', bleed: 'Bleed',
  power_charge: 'Power Charge', frenzy_charge: 'Frenzy Charge',
  endurance_charge: 'Endurance Charge',
  mana: 'Mana', life: 'Life', energy_shield: 'Energy Shield',
  spirit: 'Spirit', rage: 'Rage',
  physical: 'Physical', cold: 'Cold', fire: 'Fire',
  lightning: 'Lightning', chaos: 'Chaos',
  trigger_host: 'Triggers Skills', triggerable: 'Can Be Triggered',
  cascadable: 'Cascadable', spell: 'Spell', projectile: 'Projectile',
  area: 'Area', channelled: 'Channelled',
};
