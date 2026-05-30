// Compute a build's maximum mana from base + Int + gear + tree.
//
// Sources, mirroring PoB-PoE2's order (see CalcSetup.lua):
//   base = 30 + 4 × characterLevel             (mana_per_level × level + 30)
//   + intelligence × 2                          (Int → Mana, every class)
//   + Σ "+N to maximum Mana" mods               (flat from gear + tree)
//   × (1 + Σ "X% increased maximum Mana" / 100)
//
// We deliberately approximate: PoB's mana flag-handling (Eldritch Battery,
// Mind Over Matter, etc.) is mostly about how mana is USED rather than the
// pool size. The mana POOL is straightforward.

import type { ParsedBuild } from '../validation/types';
import treeJson from '../data/generated/passive-tree.json';
import { computeMaxEnergyShield, KEYSTONE_NODE_IDS, hasKeystone } from './maxEnergyShield';

interface TreeNode { id: number; stats: string[]; }
const treeNodesById: Record<number, TreeNode> = {};
for (const n of Object.values((treeJson as { nodes: Record<string, TreeNode> }).nodes)) {
  treeNodesById[n.id] = n;
}

const MANA_PER_LEVEL = 4;
const MANA_BASE_OFFSET = 30;
const INT_TO_MANA = 2;

function flatFrom(text: string, predicate: (t: string) => boolean): number {
  if (!predicate(text)) return 0;
  // "+N to maximum Mana" — capture the integer.
  const m = text.match(/\+?(\-?\d+(?:\.\d+)?)\s+to\s+maximum\s+Mana/i);
  if (!m) return 0;
  return Number(m[1]) || 0;
}

function pctFrom(text: string, predicate: (t: string) => boolean): number {
  if (!predicate(text)) return 0;
  // "X% increased maximum Mana" or "X% reduced maximum Mana". Anchor on
  // end-of-pattern so "Mana Recovery Rate", "Mana Reservation", etc don't
  // spuriously match.
  const m = text.match(/(\-?\d+(?:\.\d+)?)%\s+(increased|reduced)\s+maximum\s+Mana(?=$|[\s.,])/i);
  if (!m) return 0;
  const sign = m[2].toLowerCase() === 'reduced' ? -1 : 1;
  return sign * (Number(m[1]) || 0);
}

function flatIntFrom(text: string): number {
  // "+N to Intelligence" — gear / tree.
  const m = text.match(/\+?(\-?\d+)\s+to\s+Intelligence/i);
  if (m) return Number(m[1]) || 0;
  // "+N to all Attributes" — applies to Int too.
  const m2 = text.match(/\+?(\-?\d+)\s+to\s+all\s+Attributes/i);
  if (m2) return Number(m2[1]) || 0;
  return 0;
}

export interface MaxManaResult {
  total: number;
  base: number;
  fromInt: number;
  flat: number;
  pctIncrease: number;
  intelligence: number;
  // Lines we used, kept for debugging / notes.
  notes: string[];
}

export function computeMaxMana(build: ParsedBuild): MaxManaResult {
  const level = build.build.level ?? 100;
  const base = MANA_BASE_OFFSET + MANA_PER_LEVEL * level;

  // Collect every stat line from gear (incl. runes) and tree.
  const lines: string[] = [];
  for (const [slot, item] of Object.entries(build.equipped)) {
    if (!item) continue;
    if (slot.startsWith('Flask')) continue;
    if (slot.startsWith('Charm')) continue;
    lines.push(...item.implicits, ...item.explicits, ...item.runes);
  }
  const spec = build.trees[0];
  if (spec) {
    for (const id of spec.nodes) {
      const node = treeNodesById[id];
      if (!node) continue;
      lines.push(...node.stats);
    }
  }

  // PoB classes have a small base attribute; we don't model that yet —
  // approximate with 50 base for caster classes, 30 for others.
  const className = build.build.className || '';
  const isCaster = /Witch|Sorceress/.test(className);
  const baseInt = isCaster ? 50 : 25;

  let intelligence = baseInt;
  let flat = 0;
  let pctIncrease = 0;
  const notes: string[] = [];
  for (const line of lines) {
    intelligence += flatIntFrom(line);
    flat += flatFrom(line, t => /to\s+maximum\s+Mana/i.test(t));
    pctIncrease += pctFrom(line, t => /maximum\s+Mana/i.test(t));
  }

  const fromInt = intelligence * INT_TO_MANA;
  const preMult = base + fromInt + flat;
  let total = Math.max(0, preMult * (1 + pctIncrease / 100));

  if (intelligence > baseInt) notes.push(`int=${intelligence} (base ${baseInt} + ${intelligence - baseInt} from gear/tree)`);
  if (flat) notes.push(`flat +${flat} from gear/tree`);
  if (pctIncrease) notes.push(`%inc ${pctIncrease}% from gear/tree`);

  // Eldritch Battery keystone: convert all Energy Shield into mana on top of
  // the regular mana pool. In PoB-PoE2 this is the dominant scaling for
  // mana-stacking Witch builds (Gaobin's 9312 mana is mostly ES-from-gear
  // converted via EB).
  if (hasKeystone(build, KEYSTONE_NODE_IDS.eldritchBattery)) {
    const es = computeMaxEnergyShield(build);
    if (es.total > 0) {
      total += es.total;
      notes.push(`Eldritch Battery: +${es.total} mana from ES (base ${es.baseFromGear} + flat ${es.flat}, %inc ${es.pctIncrease})`);
    }
  }

  return { total: Math.round(total), base, fromInt, flat, pctIncrease, intelligence, notes };
}
