// Compute a build's maximum energy shield from equipped armour + mods.
//
// PoB reads base ES from each armour piece's `armour.EnergyShield` value;
// our weapon/armour-bases.json carries the same field. On top of base we add
// flat "+N to maximum Energy Shield" and "X% increased Energy Shield" mods
// from gear + tree.
//
// This is the input to the Eldritch Battery keystone, which converts all
// ES to mana (huge multiplier on Archmage builds).

import type { ParsedBuild } from '../validation/types';
import treeJson from '../data/generated/passive-tree.json';
import armourBasesJson from '../data/generated/armour-bases.json';

interface TreeNode { id: number; stats: string[]; }
const treeNodesById: Record<number, TreeNode> = {};
for (const n of Object.values((treeJson as { nodes: Record<string, TreeNode> }).nodes)) {
  treeNodesById[n.id] = n;
}

interface ArmourBase {
  id: string;
  armour: { EnergyShield?: number } | null;
}
const armourBaseById: Record<string, ArmourBase> = {};
for (const a of armourBasesJson as ArmourBase[]) armourBaseById[a.id] = a;

function flatES(text: string): number {
  const m = text.match(/\+?(\-?\d+(?:\.\d+)?)\s+to\s+maximum\s+Energy\s+Shield/i);
  return m ? Number(m[1]) || 0 : 0;
}
function pctES(text: string): number {
  // Strictly the pool-size modifier. Excludes recharge rate, recovery rate,
  // delay, leech, and other ES-adjacent mods that share the substring.
  const m = text.match(
    /(\-?\d+(?:\.\d+)?)%\s+(increased|reduced)\s+(?:maximum\s+)?Energy\s+Shield(?!\s+(?:Recharge|Recovery|Regeneration|Delay|Leech|Reservation))(?=$|[\s.,])/i,
  );
  if (!m) return 0;
  const sign = m[2].toLowerCase() === 'reduced' ? -1 : 1;
  return sign * (Number(m[1]) || 0);
}

export interface MaxESResult {
  total: number;
  baseFromGear: number;
  flat: number;
  pctIncrease: number;
  // Per-slot breakdown for debugging.
  perSlot: { slot: string; base: number }[];
}

export function computeMaxEnergyShield(build: ParsedBuild): MaxESResult {
  let baseFromGear = 0;
  const perSlot: { slot: string; base: number }[] = [];
  const lines: string[] = [];

  for (const [slot, item] of Object.entries(build.equipped)) {
    if (!item) continue;
    if (slot.startsWith('Flask')) continue;
    if (slot.startsWith('Charm')) continue;
    if (slot.startsWith('Weapon')) {
      // Weapon doesn't normally have ES; skip its lines from the ES total
      // (weapon-local lines could contaminate). The Weapon 2 = shield case is
      // worth modeling later — for now we accept the under-count.
      continue;
    }
    const baseEntry = item.base ? armourBaseById[item.base] : undefined;
    const baseES = baseEntry?.armour?.EnergyShield ?? 0;
    if (baseES) {
      baseFromGear += baseES;
      perSlot.push({ slot, base: baseES });
    }
    lines.push(...item.implicits, ...item.explicits, ...item.runes);
  }

  // Tree contributions.
  const spec = build.trees[0];
  if (spec) {
    for (const id of spec.nodes) {
      const node = treeNodesById[id];
      if (!node) continue;
      lines.push(...node.stats);
    }
  }

  let flat = 0;
  let pctIncrease = 0;
  for (const line of lines) {
    flat += flatES(line);
    pctIncrease += pctES(line);
  }

  const total = Math.max(0, (baseFromGear + flat) * (1 + pctIncrease / 100));
  return { total: Math.round(total), baseFromGear, flat, pctIncrease, perSlot };
}

// Tree node IDs for the keystones we model in mana / pool calculations.
// IDs come from `public/TreeData/tree.json` / `passive-tree.json` and stay
// stable across patches as long as GGG keeps the same skill IDs.
export const KEYSTONE_NODE_IDS = {
  eldritchBattery: 57513, // "Converts all Energy Shield to Mana, Doubles Mana Costs"
  mindOverMatter: 45918,
};

export function hasKeystone(build: ParsedBuild, nodeId: number): boolean {
  const spec = build.trees[0];
  if (!spec) return false;
  return spec.nodes.includes(nodeId);
}
