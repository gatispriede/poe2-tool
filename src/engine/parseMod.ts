// English mod-line → Effect[].
//
// The parser is deliberately grammar-shaped rather than pattern-per-mod:
//
//   [target prefix] [magnitude + FORM] [subject] [conditional clauses]
//
// It peels the line in that order. Whatever survives is matched against the
// stat registry (longest match wins) and the leftover words are scanned for
// tags. A line the parser only half understands still produces an Effect, but
// with a reduced parseConfidence so the UI can show it as "needs review"
// instead of silently pretending it scaled your damage.

import { Condition, Effect, ModForm, Tag } from './types';
import {
  CONDITIONS, DAMAGE_TYPE_TAGS, STATS, StatDef, TAG_PATTERNS, TARGET_HINTS,
} from './vocab';

/** "(5-8)" → 6.5, "(25-50)%" → 37.5. PoB stores unique ranges this way. */
function averageRanges(text: string): string {
  return text.replace(/\((\d+(?:\.\d+)?)\s*[-–]\s*(\d+(?:\.\d+)?)\)/g, (_m, a, b) =>
    String((Number(a) + Number(b)) / 2));
}

export function normalizeLine(line: string): string {
  return averageRanges(
    line
      .replace(/\{[^}]*\}/g, '')     // {tags:fire}, {variant:2}
      .replace(/\s+/g, ' ')
      .trim(),
  );
}

interface ConditionScan {
  base: string;
  conditions: Condition[];
  extraTags: Tag[];
  uptime: number;
}

function scanConditions(text: string): ConditionScan {
  let base = text;
  const conditions: Condition[] = [];
  const extraTags: Tag[] = [];
  let uptime = 1;
  for (const def of CONDITIONS) {
    const m = base.match(def.re);
    if (!m) continue;
    conditions.push({ kind: def.kind, text: m[0].trim(), tags: def.tags });
    if (def.tags) extraTags.push(...def.tags);
    // Weapon and equipment clauses are hard requirements, not uptime losses.
    if (def.kind !== 'weapon' && def.kind !== 'equipment') uptime = Math.min(uptime, def.uptime);
    base = base.replace(def.re, ' ');
  }
  return { base: base.replace(/\s+/g, ' ').trim(), conditions, extraTags, uptime };
}

function detectTarget(text: string): Effect['target'] {
  for (const hint of TARGET_HINTS) if (hint.re.test(text)) return hint.target;
  return 'self';
}

interface FormScan { form: ModForm; value: number; valueMax?: number; subject: string; }

const FORM_WORDS: Record<string, { form: ModForm; sign: number }> = {
  increased: { form: 'increased', sign: 1 },
  reduced: { form: 'increased', sign: -1 },
  more: { form: 'more', sign: 1 },
  less: { form: 'more', sign: -1 },
  faster: { form: 'increased', sign: 1 },
  slower: { form: 'increased', sign: -1 },
};

function scanForm(text: string): FormScan {
  // Conversion: "50% of Physical Damage Converted to Fire Damage"
  let m = text.match(/(\d+(?:\.\d+)?)% of (\w+) damage converted to (\w+) damage/i);
  if (m) return { form: 'conversion', value: Number(m[1]), subject: `${m[2]} to ${m[3]} damage` };

  // Gain as extra: "Gain 20% of Physical Damage as Extra Fire Damage"
  m = text.match(/gain (\d+(?:\.\d+)?)% of (\w+) damage as extra (\w+) damage/i);
  if (m) return { form: 'gainAs', value: Number(m[1]), subject: `${m[2]} to ${m[3]} damage` };

  // Penetration: "Damage Penetrates 15% Lightning Resistance"
  m = text.match(/damage penetrates (\d+(?:\.\d+)?)% (\w+) resistance/i);
  if (m) return { form: 'penetration', value: Number(m[1]), subject: `${m[2]} penetration` };

  // Added: "Adds 5 to 12 Fire Damage to Attacks"
  m = text.match(/adds (\d+(?:\.\d+)?) to (\d+(?:\.\d+)?) (\w+) damage(?: to (\w+))?/i);
  if (m) {
    return {
      form: 'added', value: Number(m[1]), valueMax: Number(m[2]),
      subject: `adds ${m[3]} damage${m[4] ? ' ' + m[4] : ''}`,
    };
  }

  // Percent forms anywhere in the line: "Minions deal 12% increased Damage".
  m = text.match(/([+-]?\d+(?:\.\d+)?)%\s+(increased|reduced|more|less|faster|slower)\b/i);
  if (m) {
    const word = FORM_WORDS[m[2].toLowerCase()];
    return {
      form: word.form,
      value: Number(m[1]) * word.sign,
      subject: text.replace(m[0], ' '),
    };
  }

  // Chance: "25% chance to Shock"
  m = text.match(/(\d+(?:\.\d+)?)% chance to (.+)/i);
  if (m) return { form: 'chance', value: Number(m[1]), subject: m[2] };

  // Flat: "+15% to Critical Damage Bonus", "+30 to maximum Life", "-4 Physical…"
  m = text.match(/([+-]\d+(?:\.\d+)?)%?\s+(?:to\s+)?(.+)/i);
  if (m) return { form: 'flat', value: Number(m[1]), subject: m[2] };

  // Bare percentage with no form word: "20% of Armour also applies to…"
  m = text.match(/(\d+(?:\.\d+)?)%\s+(.+)/i);
  if (m) return { form: 'flat', value: Number(m[1]), subject: m[2] };

  return { form: 'grant', value: 0, subject: text };
}

/** Longest stat match wins; ties break on registry order (most specific first). */
function resolveStat(subject: string): { def: StatDef; matched: string } | undefined {
  let best: { def: StatDef; matched: string } | undefined;
  for (const def of STATS) {
    const m = subject.match(def.re);
    if (!m) continue;
    if (!best || m[0].length > best.matched.length) best = { def, matched: m[0] };
  }
  return best;
}

function scanTags(text: string): Tag[] {
  const found: Tag[] = [];
  let rest = ` ${text} `;
  for (const { re, tag } of TAG_PATTERNS) {
    if (re.test(rest)) {
      if (!found.includes(tag)) found.push(tag);
      rest = rest.replace(new RegExp(re.source, 'gi'), ' ');
    }
  }
  return found;
}

/** "Critical" names the stat, not a class of skill: every skill can crit, so
 *  it must not become a requirement the way "Area" or "Projectile" do. */
const NON_RESTRICTIVE: Tag[] = ['critical'];

export function parseModLine(line: string): Effect[] {
  const normalized = normalizeLine(line);
  if (!normalized) return [];

  const target = detectTarget(normalized);
  const { base, conditions, extraTags, uptime } = scanConditions(normalized);
  const { form, value, valueMax, subject } = scanForm(base);
  const stat = resolveStat(subject);

  // Tags come from whatever the stat match did not consume, plus condition tags.
  const leftover = stat ? subject.replace(stat.matched, ' ') : subject;
  const tags = [...new Set([...scanTags(leftover), ...extraTags])];

  // The stat phrase itself can name a damage type ("Adds 5 to 12 Fire Damage",
  // "increased Freeze Buildup" → cold). Those types are restrictions too.
  const statTypes = stat && form !== 'conversion' && form !== 'gainAs'
    ? scanTags(stat.matched).filter((t) => DAMAGE_TYPE_TAGS.includes(t) || t === 'elemental')
    : [];
  const damageTypes = [...new Set([
    ...tags.filter((t) => DAMAGE_TYPE_TAGS.includes(t) || t === 'elemental'),
    ...statTypes,
  ])];
  let requires = tags.filter((t) => !damageTypes.includes(t) && !NON_RESTRICTIVE.includes(t));
  if (stat?.def.implies) {
    for (const t of stat.def.implies) {
      if (!requires.includes(t) && !NON_RESTRICTIVE.includes(t)) requires.push(t);
    }
  }

  let statKey = stat?.def.key ?? 'unknown';
  // "Enemies have -15% to Fire Resistance" is a damage modifier, not a defence.
  if (statKey === 'resistance' && target === 'enemy') statKey = 'exposure';

  let from: Tag | undefined;
  let to: Tag | undefined;
  if (form === 'conversion' || form === 'gainAs') {
    const parts = subject.match(/(\w+) to (\w+) damage/i);
    if (parts) {
      from = scanTags(parts[1])[0];
      to = scanTags(parts[2])[0];
    }
    requires = requires.filter((t) => !DAMAGE_TYPE_TAGS.includes(t));
  }

  let confidence = 1;
  if (!stat) confidence -= 0.6;
  if (form === 'grant') confidence -= 0.3;
  if (form === 'unknown') confidence -= 0.4;
  if (leftover.replace(/[^a-z]/gi, '').length > 24) confidence -= 0.15;

  const effect: Effect = {
    form,
    value,
    valueMax,
    stat: statKey,
    requires,
    excludes: [],
    damageTypes: form === 'conversion' || form === 'gainAs' ? (to ? [to] : []) : damageTypes,
    from,
    to,
    conditions,
    target,
    raw: normalized,
    parseConfidence: Math.max(0.05, Math.round(confidence * 100) / 100),
  };

  // Uptime rides on the effect through its conditions; scoring reads it back.
  (effect as Effect & { uptime?: number }).uptime = uptime;
  return [effect];
}

/** Uptime assumption attached by the condition scan (1 when unconditional). */
export function effectUptime(effect: Effect): number {
  const u = (effect as Effect & { uptime?: number }).uptime;
  return typeof u === 'number' ? u : 1;
}

export function bucketOf(effect: Effect): import('./types').Bucket {
  const def = STATS.find((s) => s.key === effect.stat);
  return def?.bucket ?? 'utility';
}

export function statLabel(key: string): string {
  return STATS.find((s) => s.key === key)?.label ?? key;
}
