// Node-side dataset loader (CLI, tests). Reads the generated JSON from disk so
// the engine core stays free of any import of the data itself.

import * as fs from 'fs';
import * as path from 'path';
import { Dataset } from './types';

const GENERATED = ['src', 'data', 'generated'];

export function loadDataset(root: string = process.cwd()): Dataset {
  const read = <T>(file: string): T =>
    JSON.parse(fs.readFileSync(path.join(root, ...GENERATED, file), 'utf8')) as T;
  return {
    skills: read('skills.json'),
    tree: read('passive-tree.json'),
    itemMods: read('item-mods.json'),
    uniques: read('uniques.json'),
  };
}

export function loadManifest(root: string = process.cwd()): Record<string, unknown> {
  const file = path.join(root, ...GENERATED, 'manifest.json');
  return fs.existsSync(file) ? JSON.parse(fs.readFileSync(file, 'utf8')) : {};
}
