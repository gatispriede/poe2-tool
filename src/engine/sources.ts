// Every place a modifier can come from, reduced to one shape.
//
// A passive node, a rare-item affix, a unique's explicit and a support gem are
// all "a bag of effects you can pay for". Normalising them lets the index rank
// a keystone against a support gem against a ring mod on the same axis.

import { parseModLine } from './parseMod';
import { parseStatBag } from './parseStatKey';
import {
  Dataset, EffectSource, RawItemMod, RawSkill, RawTreeNode, SourceCost,
} from './types';
import { buildTreeGraph, nodeList, pointCost, TreeGraph } from './treeGraph';

function treeSourceKind(node: RawTreeNode): EffectSource['kind'] {
  if (node.ascendancyName) return 'ascendancy';
  if (node.isKeystone) return 'keystone';
  if (node.isNotable) return 'notable';
  if (node.isJewelSocket) return 'jewelSocket';
  return 'passive';
}

export function treeSources(dataset: Dataset, graph?: TreeGraph, classId?: string): EffectSource[] {
  const g = graph ?? buildTreeGraph(dataset.tree);
  const out: EffectSource[] = [];
  for (const node of nodeList(dataset.tree)) {
    const stats = node.stats ?? [];
    if (!stats.length) continue;
    const effects = stats.flatMap(parseModLine);
    const kind = treeSourceKind(node);
    const cost: SourceCost = node.ascendancyName
      ? { kind: 'ascendancyPoints', amount: 1, detail: node.ascendancyName }
      : (() => {
          const c = pointCost(g, node.id, classId);
          return {
            kind: 'passivePoints' as const,
            amount: Number.isFinite(c.points) ? c.points : 999,
            detail: c.className ? `${c.points} points from ${c.className} start` : undefined,
          };
        })();
    out.push({
      id: `tree:${node.id}`,
      name: node.name ?? `Node ${node.id}`,
      kind,
      effects,
      raw: stats,
      nodeId: node.id,
      ascendancyName: node.ascendancyName,
      cost,
    });
  }
  return out;
}

/** PoB marks item-local mods with a `Local` prefix on the mod or its group.
 *  A local "+50% increased Physical Damage" pumps the weapon's own damage —
 *  which is everything for an attack and nothing for a spell. */
export function isLocalMod(mod: RawItemMod): boolean {
  return /^Local/.test(mod.id) || /^Local/.test(mod.group ?? '');
}

/** Weapon slots, so a weapon-only mod can be reported as conditional on your
 *  actually wielding one of them. */
export const WEAPON_SLOTS = new Set([
  'axe', 'bow', 'claw', 'crossbow', 'dagger', 'flail', 'mace', 'sceptre', 'spear',
  'staff', 'sword', 'wand', 'warstaff', 'weapon', 'one_hand_weapon', 'two_hand_weapon',
]);

/** Item slots a mod can actually roll on, from PoB's spawn-weight table. */
export function modSlots(mod: RawItemMod): string[] {
  const slots: string[] = [];
  const keys = mod.weightKey ?? [];
  const values = mod.weightVal ?? [];
  for (let i = 0; i < keys.length; i += 1) {
    if ((values[i] ?? 0) > 0 && keys[i] !== 'default') slots.push(keys[i]);
  }
  return slots;
}

export function itemModSources(dataset: Dataset): EffectSource[] {
  const out: EffectSource[] = [];
  for (const mod of dataset.itemMods) {
    const lines = (mod.stats ?? []).map((s) => s.text).filter(Boolean);
    if (!lines.length) continue;
    const slots = modSlots(mod);
    if (!slots.length) continue;
    out.push({
      id: `mod:${mod.id}`,
      name: mod.affix ? `${mod.affix} (${mod.group ?? mod.id})` : mod.id,
      kind: 'itemMod',
      effects: lines.flatMap(parseModLine),
      raw: lines,
      itemCategories: slots,
      isLocal: isLocalMod(mod),
      cost: { kind: 'itemSlot', amount: 1, detail: `${mod.type ?? 'affix'} · ilvl ${mod.level ?? 1}` },
    });
  }
  return out;
}

export function uniqueSources(dataset: Dataset): EffectSource[] {
  const out: EffectSource[] = [];
  for (const unique of dataset.uniques) {
    const lines = [...(unique.implicits ?? []), ...(unique.explicits ?? [])]
      // Requirement lines describe who may equip the item, not what it does.
      .filter((l) => !/^variant:/i.test(l) && !/requirement/i.test(l));
    if (!lines.length) continue;
    out.push({
      id: `unique:${unique.name}`,
      name: unique.name,
      kind: 'unique',
      effects: lines.flatMap(parseModLine),
      raw: lines,
      itemCategories: unique.category ? [unique.category] : [],
      baseType: unique.baseType,
      isLocal: false,
      cost: { kind: 'itemSlot', amount: 1, detail: unique.baseType },
    });
  }
  return out;
}

function lastLevelStats(skill: RawSkill): Record<string, number> | undefined {
  const entries = skill.perLevelStats ?? [];
  if (!entries.length) return undefined;
  return (entries.find((e) => e.level === 20) ?? entries[entries.length - 1]).stats;
}

/** A handful of gems ship with their internal id as their display name.
 *  `SupportMetaCastOnMeleeKillPlayer` reads much better split up. */
export function displayName(name: string): string {
  if (!/^Support[A-Z]/.test(name)) return name;
  return name
    .replace(/^Support/, '')
    .replace(/Player$/, '')
    .replace(/([a-z])([A-Z])/g, '$1 $2')
    .trim();
}

export function supportSources(dataset: Dataset): EffectSource[] {
  const out: EffectSource[] = [];
  for (const skill of dataset.skills) {
    if (!skill.isSupport) continue;
    const effects = parseStatBag(skill.constantStats, lastLevelStats(skill));
    out.push({
      id: `support:${skill.id}`,
      name: displayName(skill.name),
      kind: 'support',
      effects,
      raw: [
        skill.description ?? '',
        ...(skill.constantStats ?? []).map(([k, v]) => `${k} = ${v}`),
        ...Object.entries(lastLevelStats(skill) ?? {}).map(([k, v]) => `${k} = ${v}`),
      ].filter(Boolean),
      requireSkillTypes: skill.requireSkillTypes ?? [],
      excludeSkillTypes: skill.excludeSkillTypes ?? [],
      addSkillTypes: skill.addSkillTypes ?? [],
      gemFamily: skill.gemFamily ?? [],
      cost: { kind: 'gemSocket', amount: 1, detail: 'support gem socket' },
    });
  }
  return out;
}

export interface SourceBundle {
  graph: TreeGraph;
  tree: EffectSource[];
  itemMods: EffectSource[];
  uniques: EffectSource[];
  supports: EffectSource[];
  all: EffectSource[];
}

export function buildSources(dataset: Dataset, classId?: string): SourceBundle {
  const graph = buildTreeGraph(dataset.tree);
  const tree = treeSources(dataset, graph, classId);
  const itemMods = itemModSources(dataset);
  const uniques = uniqueSources(dataset);
  const supports = supportSources(dataset);
  return { graph, tree, itemMods, uniques, supports, all: [...tree, ...itemMods, ...uniques, ...supports] };
}
