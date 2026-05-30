// Reads PathOfBuilding-PoE2/src/Data/Bases/*.lua for non-weapon slots and
// produces a flat array of ArmourBase entries. Companion to extractBases.js
// (which handles weapons). Kept separate so weapon consumers don't churn.
//
// Exotic/skip-list categories (soulcore, traptool, talisman, tincture,
// fishing, incursionlimb) are intentionally not included.

const fs = require('fs');
const path = require('path');
const { readLuaTables } = require('./parseLua');
const { ArmourBase } = require('./schemas');

const ARMOUR_FILES = [
  'amulet', 'belt', 'body', 'boots', 'gloves', 'helmet',
  'quiver', 'ring', 'shield', 'focus', 'flask', 'jewel',
];

function splitTags(rawTags) {
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

function extractArmour(pobDataDir) {
  const out = [];
  const errors = [];
  const perCategory = {};

  for (const file of ARMOUR_FILES) {
    const absPath = path.join(pobDataDir, 'Bases', `${file}.lua`);
    if (!fs.existsSync(absPath)) {
      errors.push({ file, reason: 'missing' });
      continue;
    }

    const tables = readLuaTables(absPath);
    perCategory[file] = 0;
    for (const [name, raw] of Object.entries(tables)) {
      if (typeof raw !== 'object' || raw === null) continue;
      if (name.startsWith('[DNT]') || name.startsWith('Test')) continue;

      const { tags, excludeTags } = splitTags(raw.tags);

      const isEmptyArr = (v) => Array.isArray(v) && v.length === 0;
      const req = isEmptyArr(raw.req) ? {} : (raw.req || {});

      // armour block: same `{}` ambiguity — coerce empty array to null.
      let armour = raw.armour;
      if (armour === undefined || isEmptyArr(armour)) armour = null;

      const candidate = {
        id: name,
        category: file,
        type: raw.type || 'Unknown',
        ...(raw.subType ? { subType: raw.subType } : {}),
        quality: raw.quality ?? 20,
        socketLimit: raw.socketLimit ?? 0,
        ...(raw.charmLimit !== undefined ? { charmLimit: raw.charmLimit } : {}),
        implicit: raw.implicit ?? null,
        implicitModTypes: Array.isArray(raw.implicitModTypes) ? raw.implicitModTypes : [],
        tags,
        excludeTags,
        req,
        armour,
        ...(raw.charm !== undefined ? { charm: raw.charm } : {}),
      };

      const parsed = ArmourBase.safeParse(candidate);
      if (parsed.success) {
        out.push(parsed.data);
        perCategory[file]++;
      } else {
        errors.push({ file, name, reason: 'schema', issues: parsed.error.issues });
      }
    }
  }

  return { bases: out, errors, perCategory };
}

module.exports = { extractArmour, ARMOUR_FILES };
