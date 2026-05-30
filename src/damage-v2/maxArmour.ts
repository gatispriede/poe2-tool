// Compute a build's total Armour — needed for the "armour as damage" archetype
// (Smith of Kitava, Doryani's Prototype: "% of Armour also applies to Damage").
// Armour is normally a pure defence; these mods turn the pool into flat hit
// damage, so the composer must know how big the pool is.
//
// v1 scope (documented approximations):
//   - Base armour from each equipped armour item (armour-bases.json).
//   - Flat "+N to Armour" (incl. "Armour and Evasion/Energy Shield" hybrids).
//   - "% increased Armour" (incl. hybrids + quality), applied globally.
//   total = (baseArmour + flatArmour) × (1 + increasedPct/100)
// NOT yet modelled (refinements): Strength→armour, Smith's "+200 per connected
// notable", determination/grace-style auras, per-item local vs global split.

import armourBasesJson from '../data/generated/armour-bases.json';
import { ParsedBuild } from '../validation/types';
import { cleanModText } from '../validation/classifyStat';

interface ArmourBase { id: string; armour: { Armour?: number } | null }
const armourBaseById: Record<string, ArmourBase> = {};
for (const b of armourBasesJson as ArmourBase[]) armourBaseById[b.id] = b;

function lineNum(text: string): number | null {
  const range = text.match(/\((-?\d+(?:\.\d+)?)-(-?\d+(?:\.\d+)?)\)/);
  if (range) return (parseFloat(range[1]) + parseFloat(range[2])) / 2;
  const m = text.match(/-?\d+(?:\.\d+)?/);
  return m ? parseFloat(m[0]) : null;
}

export interface ArmourResult {
  total: number;
  baseArmour: number;
  flatArmour: number;
  increasedPct: number;
}

export function computeArmour(build: ParsedBuild): ArmourResult {
  // PER-ITEM local computation: an item's quality and its "% increased Armour"
  // mods apply ONLY to that item's base armour, not globally. Summing them
  // across all ~15 equipped items (the old bug) produced absurd 1000%+ figures.
  // Global tree armour% is NOT modelled here yet (documented under-count — far
  // safer than the over-count, which made every build equip Doryani's).
  let baseArmour = 0;
  let flatArmour = 0;
  let incAccum = 0;   // for reporting: item-weighted average increased
  let total = 0;

  for (const item of Object.values(build.equipped)) {
    if (!item) continue;
    const base = item.base ? armourBaseById[item.base] : undefined;
    const itemBase = base?.armour?.Armour ?? 0;

    let localFlat = 0;
    let localInc = item.quality ?? 0; // quality is local to this item
    for (const raw of [...item.implicits, ...item.explicits, ...item.runes]) {
      const t = cleanModText(raw);
      if (/^\+?\(?-?[\d.]/.test(t) && /\bto\b.*\bArmour\b/i.test(t) && !/%/.test(t)) {
        const n = lineNum(t);
        if (n != null) localFlat += n;
        continue;
      }
      if (/%\s+increased\s+(?:Armour\b|Armour and|Armour, |Defences\b)/i.test(t)) {
        const n = lineNum(t);
        if (n != null) localInc += n;
      }
    }
    baseArmour += itemBase;
    flatArmour += localFlat;
    incAccum += localInc;
    total += (itemBase + localFlat) * (1 + localInc / 100);
  }

  return { total, baseArmour, flatArmour, increasedPct: incAccum };
}
