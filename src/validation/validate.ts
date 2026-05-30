// Build validator. Implements the five layers from docs/validity-model.md.
// Layer 1 / 2 / 3 / 4 are fully implemented against the generated data.
// Layer 5 here is a structural check on stat-kind classification only;
// arithmetic correctness of damage composition lives in composeDamage.ts.

import skillsJson from '../data/generated/skills.json';
import treeJson from '../data/generated/passive-tree.json';
import { classifyStat, cleanModText } from './classifyStat';
import { ParsedBuild, ParsedItem, ValidationError, ValidationResult } from './types';

// Narrow types for the generated JSON. We trust the sync-data pipeline to
// keep them in shape — the Zod schemas there are the source of truth.
interface SkillRecord {
  id: string;
  name: string;
  isSupport: boolean;
  skillTypes: string[];
  requireSkillTypes: string[];
  addSkillTypes: string[];
  excludeSkillTypes: string[];
  gemFamily: string[];
  color?: number;
  castTime?: number;
  description?: string;
}

interface TreeNode {
  id: number;
  name?: string;
  stats: string[];
  connections: number[];
  isAscendancyStart?: boolean;
  ascendancyName?: string;
  classesStart?: string[];
}

interface ClassRecord {
  internalId: string;
  integerId: number;
  name: string;
  startNodeId: number;
  ascendancies: Array<{ id: string; internalId: string; name: string; startNodeId?: number }>;
}

const skillsById: Record<string, SkillRecord> = {};
for (const s of skillsJson as SkillRecord[]) skillsById[s.id] = s;

const treeNodesById: Record<number, TreeNode> = {};
for (const n of Object.values((treeJson as { nodes: Record<string, TreeNode> }).nodes)) {
  treeNodesById[n.id] = n;
}

const treeClassesByName: Record<string, ClassRecord> = {};
for (const c of (treeJson as { classes: ClassRecord[] }).classes) {
  treeClassesByName[c.name] = c;
}

// Undirected adjacency map. PoE2 tree edges are stored on only ONE side of
// each edge in passive-tree.json — building this once at module load is
// essential for any reachability check (see validity-model.md Layer 4).
const treeAdjacency: Map<number, Set<number>> = (() => {
  const adj = new Map<number, Set<number>>();
  for (const n of Object.values(treeNodesById)) {
    if (!adj.has(n.id)) adj.set(n.id, new Set());
    for (const c of n.connections) {
      if (!adj.has(c)) adj.set(c, new Set());
      adj.get(n.id)!.add(c);
      adj.get(c)!.add(n.id);
    }
  }
  return adj;
})();

// Layer 1 — equipment.
// Note: weapon-bases.json currently only covers weapon categories; the
// canonical mod database (`item-mods.json`) covers all slots but we can't
// run base-eligibility checks for non-weapon slots yet. Layer 1 here is
// limited to structural item checks (prefix/suffix counts, rarity-based
// caps). Eligibility-against-base validation requires armour/jewelry base
// extraction, queued separately.
function validateItem(slotName: string, item: ParsedItem, errors: ValidationError[]): void {
  if (!item) return;

  // PoB exports magic items with at most 1 prefix + 1 suffix, rares with
  // up to 3 + 3. We can't tell prefix from suffix in the parsed text alone,
  // but we can cap total explicit count by rarity as a sanity check.
  const explicitCount = item.explicits.length;
  const cap = item.rarity === 'RARE' ? 6 : item.rarity === 'MAGIC' ? 2 : item.rarity === 'UNIQUE' ? 99 : 99;

  if (explicitCount > cap) {
    errors.push({
      layer: 1,
      kind: 'too-many-explicits',
      message: `${slotName} (${item.name}/${item.base}) has ${explicitCount} explicit mods but rarity ${item.rarity} caps at ${cap}`,
      context: { slot: slotName, itemName: item.name, rarity: item.rarity, count: explicitCount, cap },
    });
  }
}

// Layer 2 — every gem must reference a known skill ID.
function validateSkillsLayer2(build: ParsedBuild, errors: ValidationError[]): void {
  for (let g = 0; g < build.skillGroups.length; g++) {
    const group = build.skillGroups[g];
    for (let i = 0; i < group.gems.length; i++) {
      const gem = group.gems[i];
      if (!gem.enabled) continue;
      if (!gem.skillId) {
        // A gem with no skillId AND level 0 is a PoB placeholder (player
        // picked a name slot but didn't choose a variant). Surface it as a
        // distinct kind so callers can decide whether it's an error or a
        // soft "this build is half-configured" indicator.
        const isPlaceholder = (gem.level === 0 || gem.level === null);
        errors.push({
          layer: 2,
          kind: isPlaceholder ? 'placeholder-gem' : 'gem-missing-skillId',
          message: `Skill group ${g + 1}, gem ${i + 1} (${gem.nameSpec}) has no skillId${isPlaceholder ? ' (placeholder)' : ''}`,
          context: { groupIndex: g, gemIndex: i, nameSpec: gem.nameSpec, level: gem.level },
        });
        continue;
      }
      if (!skillsById[gem.skillId]) {
        errors.push({
          layer: 2,
          kind: 'unknown-skill',
          message: `Skill group ${g + 1}, gem ${i + 1}: skillId "${gem.skillId}" not in skill database`,
          context: { groupIndex: g, gemIndex: i, skillId: gem.skillId, nameSpec: gem.nameSpec },
        });
      }
    }
  }
}

// Layer 3 — each support must be compatible with the active skill(s) in
// its socket group. Compatibility rules:
//   - support.requireSkillTypes ⊆ activeSkill.skillTypes
//   - support.excludeSkillTypes ∩ activeSkill.skillTypes = ∅
//   - no two gems in the group share a gemFamily
function validateSupportsLayer3(build: ParsedBuild, errors: ValidationError[]): void {
  for (let g = 0; g < build.skillGroups.length; g++) {
    const group = build.skillGroups[g];
    const activeGems = group.gems.filter(x => x.enabled);
    const actives = activeGems.filter(x => x.skillId && skillsById[x.skillId!] && !skillsById[x.skillId!].isSupport);
    const supports = activeGems.filter(x => x.skillId && skillsById[x.skillId!] && skillsById[x.skillId!].isSupport);

    // gemFamily uniqueness (a socket can't carry two gems of the same family).
    const familySeen = new Map<string, string>();
    for (const gem of activeGems) {
      if (!gem.skillId) continue;
      const rec = skillsById[gem.skillId!];
      if (!rec) continue;
      for (const fam of rec.gemFamily) {
        if (familySeen.has(fam)) {
          errors.push({
            layer: 3,
            kind: 'gem-family-clash',
            message: `Skill group ${g + 1}: "${rec.name}" and "${familySeen.get(fam)}" share gem family "${fam}"`,
            context: { groupIndex: g, family: fam, gem1: familySeen.get(fam), gem2: rec.name },
          });
        } else {
          familySeen.set(fam, rec.name);
        }
      }
    }

    // For each support, check it's compatible with at least one active skill in the group.
    for (const sup of supports) {
      const supRec = skillsById[sup.skillId!];
      if (!supRec) continue;
      let compatible = false;
      for (const act of actives) {
        const actRec = skillsById[act.skillId!];
        if (!actRec) continue;
        const required = supRec.requireSkillTypes;
        const excluded = supRec.excludeSkillTypes;
        const actTags = new Set(actRec.skillTypes);
        const requireOk = required.length === 0 || required.every(t => actTags.has(t));
        const excludeOk = !excluded.some(t => actTags.has(t));
        if (requireOk && excludeOk) { compatible = true; break; }
      }
      if (!compatible && actives.length > 0) {
        errors.push({
          layer: 3,
          kind: 'support-incompatible',
          message: `Skill group ${g + 1}: support "${supRec.name}" doesn't apply to any active skill in the group`,
          context: {
            groupIndex: g,
            support: supRec.name,
            require: required(supRec),
            exclude: excludedTags(supRec),
            activeSkills: actives.map(a => skillsById[a.skillId!]?.name),
          },
        });
      }
    }
  }
}

function required(s: SkillRecord): string[] { return s.requireSkillTypes; }
function excludedTags(s: SkillRecord): string[] { return s.excludeSkillTypes; }

// Layer 4 — every allocated node must be reachable from the character's
// class-start node (or an allocated ascendancy-start node) through other
// allocated nodes. Jewel-radius effects do NOT bypass this rule; they ADD
// stats at compose time.
function validateTreeLayer4(build: ParsedBuild, errors: ValidationError[]): void {
  const spec = build.trees[0];
  if (!spec) return;

  const className = build.build.className;
  const classRec = className ? treeClassesByName[className] : undefined;
  if (!classRec) {
    errors.push({
      layer: 4,
      kind: 'unknown-class',
      message: `class "${className}" not found in tree data`,
    });
    return;
  }

  const allocated = new Set(spec.nodes);
  const reachable = new Set<number>();

  // BFS from class start, if allocated.
  if (allocated.has(classRec.startNodeId)) {
    bfs(allocated, classRec.startNodeId, reachable);
  } else {
    errors.push({
      layer: 4,
      kind: 'no-class-start',
      message: `class-start node ${classRec.startNodeId} for ${className} is not allocated; build is rootless`,
      context: { className, expectedStart: classRec.startNodeId },
    });
  }

  // BFS from each allocated ascendancy-start node.
  for (const id of spec.nodes) {
    const n = treeNodesById[id];
    if (n && n.isAscendancyStart) bfs(allocated, id, reachable);
  }

  const orphans = spec.nodes.filter(id => !reachable.has(id));
  for (const id of orphans) {
    const n = treeNodesById[id];
    errors.push({
      layer: 4,
      kind: 'unreachable-node',
      message: `node ${id} (${n?.name ?? 'unknown'}) is allocated but not connected to the class/ascendancy start through other allocated nodes`,
      context: { nodeId: id, nodeName: n?.name, ascendancy: n?.ascendancyName },
    });
  }
}

function bfs(allocated: Set<number>, startId: number, out: Set<number>): void {
  if (!allocated.has(startId)) return;
  if (out.has(startId)) return;
  const queue: number[] = [startId];
  out.add(startId);
  while (queue.length) {
    const cur = queue.shift()!;
    const neighbours = treeAdjacency.get(cur);
    if (!neighbours) continue;
    // Use forEach to avoid downlevelIteration on Set (tsconfig is es5).
    neighbours.forEach(adj => {
      if (allocated.has(adj) && !out.has(adj)) {
        out.add(adj);
        queue.push(adj);
      }
    });
  }
}

// Layer 5 — structural check: every stat line on every equipped item must
// classify into a known StatKind. Unknown kinds are fail-closed; we'd rather
// extend the classifier than silently mis-compose damage.
//
// This does NOT validate damage arithmetic — that belongs in composeDamage.
function validateCompositionLayer5(build: ParsedBuild, errors: ValidationError[]): void {
  for (const [slotName, item] of Object.entries(build.equipped)) {
    if (!item) continue;
    const allLines = [...item.implicits, ...item.explicits];
    for (const rawLine of allLines) {
      const cleaned = cleanModText(rawLine);
      if (!cleaned) continue;
      // Single-word flags like "Corrupted" / "Mirrored" / "Split" carry no
      // damage semantics. Recognise and skip the most common ones.
      if (KNOWN_FLAG_LINES.has(cleaned)) continue;

      const kind = classifyStat(cleaned);
      if (kind === 'unknown') {
        errors.push({
          layer: 5,
          kind: 'unknown-stat-kind',
          message: `${slotName}: stat "${cleaned}" does not match any known keyword bucket`,
          context: { slot: slotName, itemName: item.name, statText: cleaned },
        });
      }
    }
  }
}

// Whole-line literals that carry no damage semantics. Extend as the classifier
// learns to ignore more flag-only mods.
const KNOWN_FLAG_LINES = new Set<string>([
  'Corrupted',
  'Mirrored',
  'Split',
  'Unidentified',
]);

export function validateBuild(build: ParsedBuild): ValidationResult {
  const errors: ValidationError[] = [];

  // Layer 1
  for (const [slot, item] of Object.entries(build.equipped)) {
    validateItem(slot, item, errors);
  }

  // Layer 2 & 3 (skills and support compatibility)
  validateSkillsLayer2(build, errors);
  validateSupportsLayer3(build, errors);

  // Layer 4 (tree reachability)
  validateTreeLayer4(build, errors);

  // Layer 5 structural (stat-kind coverage; arithmetic not done here)
  validateCompositionLayer5(build, errors);

  return { valid: errors.length === 0, errors };
}
