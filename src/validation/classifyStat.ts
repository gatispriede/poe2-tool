// Stat-line keyword classifier. Mirrors the rules in
// scripts/sync-data/extractMods.js — when you add a kind there, add it here.
// Both files must stay in sync; the linked unit test in __tests__ enforces
// behavioural parity.

export type StatKind =
  | 'increased' | 'more'
  | 'addedRange' | 'addedFlat'
  | 'extra' | 'converted'
  | 'skillLevel'
  | 'unknown';

interface Rule { kind: StatKind; re: RegExp; }

// Order matters — more specific patterns first. See validity-model.md for
// the canonical bucket assignments.
const RULES: Rule[] = [
  { kind: 'skillLevel', re: /\bto Level of\b/i },
  { kind: 'converted',  re: /\bConverted to\b/i },
  { kind: 'extra',      re: /\bas Extra\b/i },
  { kind: 'addedRange', re: /^Adds\b/i },
  { kind: 'more',       re: /%\s+(more|less)\b/ },
  { kind: 'increased',  re: /%\s+(increased|reduced)\b/ },
  { kind: 'addedFlat',  re: /^[+-]?(?:\(?-?[\d.]+(?:-[\d.]+)?\)?)%?\s+to\b/ },
];

// PoB exports mod text with embedded markers like `{fractured}` / `{enchant}`
// / `{rune}` / `{desecrated}`. Strip these before classifying.
const TAG_RE = /\{[^}]+\}/g;

export function cleanModText(text: string): string {
  return text.replace(TAG_RE, '').trim();
}

export function classifyStat(text: string): StatKind {
  const clean = cleanModText(text);
  for (const rule of RULES) {
    if (rule.re.test(clean)) return rule.kind;
  }
  return 'unknown';
}
