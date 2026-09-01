// Browser-side dataset loader. The generated JSON is bundled directly; the
// engine core never imports data itself, so this file is the only place the
// app pays that bundle cost.

import skills from '../data/generated/skills.json';
import tree from '../data/generated/passive-tree.json';
import itemMods from '../data/generated/item-mods.json';
import uniques from '../data/generated/uniques.json';
import manifest from '../data/generated/manifest.json';
import { Dataset, RawItemMod, RawSkill, RawTree, RawUnique } from './types';

let cached: Dataset | undefined;

export function loadDataset(): Dataset {
  if (!cached) {
    cached = {
      skills: skills as unknown as RawSkill[],
      tree: tree as unknown as RawTree,
      itemMods: itemMods as unknown as RawItemMod[],
      uniques: uniques as unknown as RawUnique[],
    };
  }
  return cached;
}

export const datasetManifest = manifest as { sourceCommit?: string; generatedAt?: string };
