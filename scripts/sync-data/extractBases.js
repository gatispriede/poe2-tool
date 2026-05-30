// Reads PathOfBuilding-PoE2/src/Data/Bases/*.lua and produces a flat array
// of WeaponBase entries. We currently scope to weapon files only (per the
// "weapons + mods first" plan); other slots can be added later by extending
// WEAPON_FILES below.

const fs = require('fs');
const path = require('path');
const { readLuaTables } = require('./parseLua');
const { WeaponBase } = require('./schemas');

const WEAPON_FILES = [
  'axe', 'bow', 'claw', 'crossbow', 'dagger', 'flail',
  'mace', 'sceptre', 'spear', 'staff', 'sword', 'wand',
  // Note: 'spear' is PoE2's quarterstaff family. 'staff' is two-handed staff/quarterstaff.
  // 'fishing', 'soulcore', 'traptool' are intentionally skipped — not combat weapons.
];

function splitTags(rawTags) {
  // Lua tags table: { staff = true, no_fire_spell_mods = true, ... }
  // Positive (true) entries become `tags`. Anything starting with `no_` is also
  // moved into `excludeTags` so the eligibility rule can reject excluded mods.
  const tags = [];
  const excludeTags = [];
  if (!rawTags || typeof rawTags !== 'object') return { tags, excludeTags };

  for (const [k, v] of Object.entries(rawTags)) {
    if (v !== true) continue;
    tags.push(k);
    if (k.startsWith('no_')) excludeTags.push(k);
  }
  return { tags, excludeTags };
}

function extractBases(pobDataDir) {
  const out = [];
  const errors = [];

  for (const file of WEAPON_FILES) {
    const absPath = path.join(pobDataDir, 'Bases', `${file}.lua`);
    if (!fs.existsSync(absPath)) {
      errors.push({ file, reason: 'missing' });
      continue;
    }

    const tables = readLuaTables(absPath);
    for (const [name, raw] of Object.entries(tables)) {
      if (typeof raw !== 'object' || raw === null) continue;
      // Skip developer/test items.
      if (name.startsWith('[DNT]') || name.startsWith('Test')) continue;

      const { tags, excludeTags } = splitTags(raw.tags);

      // Lua `{}` is ambiguous (empty array vs empty object) and parseLua returns
      // []. Coerce per-field to what each one is semantically.
      const isEmptyArr = (v) => Array.isArray(v) && v.length === 0;
      const req = isEmptyArr(raw.req) ? {} : (raw.req || {});

      const candidate = {
        id: name,
        category: file,
        type: raw.type || 'Unknown',
        quality: raw.quality ?? 20,
        socketLimit: raw.socketLimit ?? 3,
        implicit: raw.implicit ?? null,
        // implicitModTypes can be array-of-array in PoB; we don't consume its
        // inner shape yet, so stash as-is and let the schema accept anything.
        implicitModTypes: Array.isArray(raw.implicitModTypes) ? raw.implicitModTypes : [],
        tags,
        excludeTags,
        req,
        weapon: raw.weapon || null,
      };

      const parsed = WeaponBase.safeParse(candidate);
      if (parsed.success) {
        out.push(parsed.data);
      } else {
        errors.push({ file, name, reason: 'schema', issues: parsed.error.issues });
      }
    }
  }

  return { bases: out, errors };
}

module.exports = { extractBases, WEAPON_FILES };
