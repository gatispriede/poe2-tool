// Reads PathOfBuilding-PoE2/src/Data/ModItem.lua and produces a flat array of
// ItemMod entries. The critical improvement vs the old regex parser:
//   - Captures ALL stat lines per mod, not just the first.
//   - Parses each `(min-max)` range structurally so consumers can compute
//     numeric rolls without re-regexing the display text.

const fs = require('fs');
const path = require('path');
const { readLuaTables } = require('./parseLua');
const { ItemMod } = require('./schemas');

const RANGE_RE = /\(([\-\d.]+)-([\-\d.]+)\)/g;

// Keyword classifier. Order matters: more-specific patterns are checked first
// so they win over more-general ones (e.g. `+N to Level of` would also match
// the addedFlat `+N to` pattern; the skillLevel branch must come first).
//
// Each branch consumes a normalised text and returns one of the StatKind
// values from schemas.js. `unknown` is a deliberate fall-through — the
// damage composer must refuse to silently bucket these as "increased".
const KIND_RULES = [
  // "+N to Level of <skills>" — must win over the generic "+N to" addedFlat.
  { kind: 'skillLevel', re: /\bto Level of\b/i },
  // "X% of <type> Damage Converted to <type2>"
  { kind: 'converted',  re: /\bConverted to\b/i },
  // "Gain X% of Damage as Extra <type>"
  { kind: 'extra',      re: /\bas Extra\b/i },
  // "Adds N to M <type> Damage" — added flat range
  { kind: 'addedRange', re: /^Adds\b/i },
  // "% more" / "% less" — multiplicative bucket
  // Case-sensitive: "more" and "less" are PoE keywords; "more than" etc.
  // don't appear in mod text but we still anchor to a preceding %.
  { kind: 'more',       re: /%\s+(more|less)\b/ },
  // "% increased" / "% reduced" — additive bucket
  { kind: 'increased',  re: /%\s+(increased|reduced)\b/ },
  // "+N to <stat>" or "+N% to <stat>" — flat additions to absolute (e.g.
  // +12 to Strength) and percent (e.g. +21% to Fire Resistance) stats.
  // Both go into the addedFlat bucket; the composer distinguishes via the
  // stat name in the text.
  { kind: 'addedFlat',  re: /^[+-]?(?:\(?-?[\d.]+(?:-[\d.]+)?\)?)%?\s+to\b/ },
];

function classifyStat(text) {
  for (const rule of KIND_RULES) {
    if (rule.re.test(text)) return rule.kind;
  }
  return 'unknown';
}

function parseStatLine(text) {
  const ranges = [];
  let m;
  RANGE_RE.lastIndex = 0;
  while ((m = RANGE_RE.exec(text)) !== null) {
    ranges.push([parseFloat(m[1]), parseFloat(m[2])]);
  }
  return { text, kind: classifyStat(text), ranges };
}

function extractMods(pobDataDir) {
  const absPath = path.join(pobDataDir, 'ModItem.lua');
  const raw = readLuaTables(absPath);

  const out = [];
  const errors = [];

  for (const [id, entry] of Object.entries(raw)) {
    if (typeof entry !== 'object' || entry === null) continue;

    // Stat lines live as the table's array portion (parseLua stashed them under __array).
    const statTexts = Array.isArray(entry.__array) ? entry.__array.filter(s => typeof s === 'string') : [];
    const stats = statTexts.map(parseStatLine);

    const candidate = {
      id,
      type: entry.type,
      affix: entry.affix || '',
      level: typeof entry.level === 'number' ? entry.level : 1,
      group: entry.group || id,
      stats,
      weightKey: Array.isArray(entry.weightKey) ? entry.weightKey.filter(x => typeof x === 'string') : [],
      weightVal: Array.isArray(entry.weightVal) ? entry.weightVal.filter(x => typeof x === 'number') : [],
      modTags: Array.isArray(entry.modTags) ? entry.modTags.filter(x => typeof x === 'string') : [],
      statOrder: Array.isArray(entry.statOrder) ? entry.statOrder.filter(x => typeof x === 'number') : [],
      tradeHash: entry.tradeHash,
    };

    const parsed = ItemMod.safeParse(candidate);
    if (parsed.success) {
      out.push(parsed.data);
    } else {
      errors.push({ id, reason: 'schema', issues: parsed.error.issues.slice(0, 3) });
    }
  }

  return { mods: out, errors };
}

module.exports = { extractMods };
