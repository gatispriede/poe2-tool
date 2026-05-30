// Generate a valid rare non-weapon item (armour / jewellery / offhand) for
// a given slot + class, then pick affixes using the same eligibility rule
// the weapon generator uses.
//
// Layer-1 invariants enforced:
//   - Base is from armour-bases.json
//   - Each mod is from item-mods.json
//   - Each mod's weightKey intersects the base's tags with weightVal > 0
//   - No `no_X_spell_mods` exclude tag clashes
//   - No two mods share the same `group`
//   - prefix count ≤ 3, suffix count ≤ 3

import armourBasesJson from '../data/generated/armour-bases.json';
import { ParsedItem } from '../validation/types';
import { modCanRollOnBase, pickModsForSkill } from './generateWeapon';
import { ScalingBias } from './synthesizeTree';

interface ArmourBase {
  id: string;
  category: string;
  type: string;
  subType?: string;
  quality: number;
  socketLimit: number;
  implicit: string | null;
  implicitModTypes: unknown[];
  tags: string[];
  excludeTags: string[];
  req: { level?: number; str?: number; dex?: number; int?: number };
  armour?: unknown;
}

const allArmourBases: ArmourBase[] = armourBasesJson as ArmourBase[];

/** Maps slot name (as used in ParsedBuild.equipped) → armour category. */
const SLOT_TO_CATEGORY: Record<string, string> = {
  'Helmet':      'helmet',
  'Body Armour': 'body',
  'Gloves':      'gloves',
  'Boots':       'boots',
  'Belt':        'belt',
  'Amulet':      'amulet',
  'Ring 1':      'ring',
  'Ring 2':      'ring',
};

/**
 * Preferred class-attribute tag for armour selection. Determines which
 * `<attr>_armour` variant we pick when multiple are available.
 */
const CLASS_ATTRIBUTE_TAG: Record<string, string> = {
  Huntress:  'dex_armour',
  Ranger:    'dex_armour',
  Witch:     'int_armour',
  Sorceress: 'int_armour',
  Warrior:   'str_armour',
  Mercenary: 'str_dex_armour',
  Druid:     'str_int_armour',
  Monk:      'dex_int_armour',
};

/**
 * Pick the best base for a slot. For body/helmet/gloves/boots we prefer
 * the class's attribute-themed variant; for belts/amulets/rings the
 * `<attr>_armour` tag doesn't apply (they don't have armour ratings) so we
 * just pick the highest-tier base.
 */
export function pickArmourBaseForSlot(slotName: string, className: string, itemLevel = 82): ArmourBase | null {
  const cat = SLOT_TO_CATEGORY[slotName];
  if (!cat) return null;
  const preferredTag = CLASS_ATTRIBUTE_TAG[className];

  const inCat = allArmourBases.filter(b => b.category === cat && (b.req.level ?? 0) <= itemLevel);
  if (inCat.length === 0) return null;

  // Score: matching class attribute tag = big bonus; otherwise just go by
  // level. For neutral categories (jewellery), level-only is fine.
  function score(b: ArmourBase): number {
    let s = (b.req.level ?? 0);
    if (preferredTag && b.tags.includes(preferredTag)) s += 1000;
    return s;
  }
  inCat.sort((a, b) => score(b) - score(a));
  return inCat[0];
}

/**
 * Generate a valid rare item for the slot. Mods are picked using the same
 * skill-relevance scoring as weapon affixes (so a Warrior gets
 * physical/attack-relevant mods, a Witch gets spell mods, etc.).
 */
export function generateRareForSlot(
  slotName: string,
  className: string,
  skillId: string,
  itemLevel = 82,
  bias: ScalingBias = 'balanced',
): { item: ParsedItem; base: ArmourBase; modIds: string[] } | null {
  const base = pickArmourBaseForSlot(slotName, className, itemLevel);
  if (!base) return null;
  // Reuse pickModsForSkill — it operates on tags/excludeTags/level which
  // all armour bases have. `bias` makes a crit-committed build roll crit
  // damage bonus where it pays off, without polluting balanced builds.
  const mods = pickModsForSkill(base as never, skillId, itemLevel, 'realistic', bias);
  const explicits = mods.flatMap(m => renderModLines(m));

  const item: ParsedItem = {
    id: `gen-rare-${slotName.replace(/\s+/g, '_')}-${base.id.replace(/\s+/g, '_')}`,
    rarity: 'RARE',
    name: `Generated Rare ${slotName}`,
    base: base.id,
    itemLevel,
    quality: 20,
    sockets: null,
    levelReq: base.req.level ?? null,
    runes: [],
    implicits: base.implicit ? [base.implicit] : [],
    explicits,
    rawLines: [`Rarity: RARE`, `Generated Rare ${slotName}`, base.id, ...explicits],
  };
  return { item, base, modIds: mods.map(m => m.id) };
}

interface RenderableMod {
  stats: { text: string; ranges: [number, number][] }[];
}

function renderModLines(mod: RenderableMod): string[] {
  return mod.stats.map(s => {
    let t = s.text;
    for (const [lo, hi] of s.ranges) {
      const mid = Math.floor((lo + hi) / 2);
      t = t.replace(`(${lo}-${hi})`, String(mid));
    }
    return t;
  });
}

// Re-export the eligibility rule for tests + verification.
export { modCanRollOnBase };
