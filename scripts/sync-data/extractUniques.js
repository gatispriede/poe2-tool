// Reads PathOfBuilding-PoE2/src/Data/Uniques/*.lua and produces a typed list
// of unique items. Each .lua file is a Lua array of [[ ... ]] long-strings,
// where each long-string is an item-text block in PoB's clipboard format:
//
//   Death's Harp
//   Dualstring Bow
//   Variant: 0.2.0
//   Variant: 0.3.0
//   Variant: Current
//   Implicits: 1
//   +50% Surpassing chance to fire an additional Arrow
//   {variant:1}+(50-70)% to Critical Damage Bonus
//   ...
//
// Parser rules:
//   - Line 1 = item name
//   - Line 2 = base type (must match a base in our DB if it's a category we extract)
//   - "Variant: X" lines list the available variants. The active one is "Current"
//     when present, else the LAST variant listed.
//   - "{variant:N}<text>" mod lines apply only to variant index N (1-based).
//     Untagged mod lines apply to all variants.
//   - "Implicits: N" header counts how many of the following mod lines are
//     implicits (in line-order). Defaults to 0 if absent.
//   - "League: X" / "Source: X" / "Upgrade: X" are metadata; preserved as-is.

const fs = require('fs');
const path = require('path');
const { readLuaTables } = require('./parseLua');
const { z } = require('zod');

// All weapon/armour/jewellery slot categories shipped in Uniques/.
const UNIQUE_FILES = [
  'amulet.lua','axe.lua','belt.lua','body.lua','boots.lua','bow.lua',
  'claw.lua','crossbow.lua','dagger.lua','flail.lua','flask.lua','focus.lua',
  'gloves.lua','helmet.lua','jewel.lua','mace.lua','quiver.lua','ring.lua',
  'sceptre.lua','shield.lua','spear.lua','staff.lua','sword.lua','traptool.lua',
  'wand.lua',
  // skipping: fishing, incursionlimb, soulcore, talisman, tincture — niche/league-locked
];

const Unique = z.object({
  name: z.string(),
  baseType: z.string(),
  league: z.string().optional(),
  source: z.string().optional(),
  variants: z.array(z.string()).default([]),
  currentVariant: z.number().nullable(),   // 1-based index into variants, or null
  implicits: z.array(z.string()).default([]),
  explicits: z.array(z.string()).default([]),
  // Categorisation — derived from the file name; useful for slot mapping
  category: z.string(),
});

function parseBlock(text, category) {
  const lines = text.split(/\r?\n/).map(l => l.trim()).filter(l => l.length > 0);
  if (lines.length < 2) return null;
  const name = lines[0];
  const baseType = lines[1];

  const variants = [];
  let implicitsCount = 0;
  let league;
  let source;
  let i = 2;

  // Header parsing — keep reading until we run out of recognised keys.
  while (i < lines.length) {
    const l = lines[i];
    if (l.startsWith('Variant:')) {
      variants.push(l.slice('Variant:'.length).trim());
      i++; continue;
    }
    if (l.startsWith('Implicits:')) {
      implicitsCount = parseInt(l.slice('Implicits:'.length).trim(), 10) || 0;
      i++; continue;
    }
    if (l.startsWith('League:'))  { league  = l.slice('League:'.length).trim();  i++; continue; }
    if (l.startsWith('Source:'))  { source  = l.slice('Source:'.length).trim();  i++; continue; }
    if (l.startsWith('Upgrade:') || l.startsWith('LevelReq:') || l.startsWith('Requires Level')
        || l.startsWith('Has Alt Variant') || l.startsWith('Selected Variant')
        || l.startsWith('Item Level:') || l.startsWith('Crucible:')) {
      i++; continue;
    }
    break;
  }

  // Variant resolution: prefer "Current"; fallback to last.
  let currentVariant = null;
  if (variants.length > 0) {
    const cIdx = variants.findIndex(v => v.toLowerCase() === 'current');
    currentVariant = cIdx >= 0 ? cIdx + 1 : variants.length;
  }

  // Mod lines: split into implicits + explicits, filtering by variant tag.
  const allMods = [];
  for (; i < lines.length; i++) {
    const l = lines[i];
    // Match variant tag "{variant:1,2}..." or "{variant:1}..."
    const vm = l.match(/^\{variant:([0-9,]+)\}(.*)$/);
    if (vm) {
      const variantsHere = vm[1].split(',').map(n => parseInt(n, 10));
      if (currentVariant != null && variantsHere.includes(currentVariant)) {
        allMods.push(vm[2].trim());
      }
      // else: this mod line is for a different variant — skip.
      continue;
    }
    allMods.push(l);
  }

  const implicits = allMods.slice(0, implicitsCount);
  const explicits = allMods.slice(implicitsCount);

  const candidate = {
    name,
    baseType,
    league,
    source,
    variants,
    currentVariant,
    implicits,
    explicits,
    category,
  };
  const parsed = Unique.safeParse(candidate);
  if (!parsed.success) return null;
  return parsed.data;
}

function extractUniques(pobDataDir) {
  const out = [];
  const errors = [];
  for (const file of UNIQUE_FILES) {
    const abs = path.join(pobDataDir, 'Uniques', file);
    if (!fs.existsSync(abs)) { errors.push({ file, reason: 'missing' }); continue; }
    const category = path.basename(file, '.lua');
    const tables = readLuaTables(abs);
    const blocks = Object.values(tables).filter(v => typeof v === 'string');
    for (const block of blocks) {
      const u = parseBlock(block, category);
      if (u) out.push(u);
      else   errors.push({ file, reason: 'parse', preview: block.slice(0, 80) });
    }
  }
  return { uniques: out, errors };
}

module.exports = { extractUniques };
