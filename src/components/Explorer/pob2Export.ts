// PoB2 (Path of Building 2) export — serialize a ParsedBuild plus our
// GeneratedBuild metadata into PoB2's import XML, then compress to the
// base64-deflate "build code" PoB2 desktop and pobb.in accept.
//
// Format reverse-engineered from docs/baseline-builds/raw/*-pob.xml:
//   <PathOfBuilding2>
//     <Build level=… className=… ascendClassName=… targetVersion="0_1"/>
//     <Tree><Spec nodes="comma-separated" treeVersion classId classInternalId
//                ascendClassId ascendancyInternalId/></Tree>
//     <Skills><SkillSet><Skill><Gem level/skillId/nameSpec/.../></Skill></SkillSet></Skills>
//     <Items><Item id="N">text</Item><Slot name=… itemId="N"/></Items>
//   </PathOfBuilding2>
//
// The build code is URL-safe-base64(deflate(xml)). We use the browser's
// CompressionStream('deflate') which is widely supported (Chrome ≥ 80,
// Firefox ≥ 113, Safari ≥ 16.4). The caller catches the (unlikely)
// unsupported case and falls back to raw XML.

import { ParsedBuild, ParsedItem, ParsedGem } from '../../validation/types';
import { GeneratedBuild } from '../../generator/generateBuild';
import treeJson from '../../data/generated/passive-tree.json';


interface TreeClass {
  internalId: string;
  integerId: number;
  name: string;
  ascendancies: { id: string; internalId: string; name: string }[];
}
const TREE_CLASSES = (treeJson as { classes: TreeClass[] }).classes;
const TREE_VERSION = (treeJson as { treeVersion: string }).treeVersion;

// PoB2 uses its own 0-indexed canonical class ordering distinct from GGG's
// integerId. Source: PathOfBuilding-PoE2/src/TreeData/0_4/tree.lua.
const POB2_CLASS_ID: Record<string, number> = {
  Ranger: 0,
  Huntress: 1,
  Warrior: 2,
  Mercenary: 3,
  Druid: 4,
  Witch: 5,
  Sorceress: 6,
  Monk: 7,
};

function findClassInfo(name: string | null): TreeClass | undefined {
  if (!name) return undefined;
  return TREE_CLASSES.find(c => c.name === name || c.internalId === name);
}

function findAscendancyIntegerId(cls: TreeClass, ascName: string | null): number {
  if (!ascName) return 0;
  // PoB uses 1-based index of the ascendancy within the class's list.
  const idx = cls.ascendancies.findIndex(a => a.name === ascName || a.internalId === ascName);
  return idx >= 0 ? idx + 1 : 0;
}

function findAscendancyInternalId(cls: TreeClass, ascName: string | null): string {
  if (!ascName) return '';
  const a = cls.ascendancies.find(x => x.name === ascName || x.internalId === ascName);
  return a ? a.internalId : '';
}

function xmlEscape(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

/**
 * Render a ParsedItem back into the multi-line text form PoB2 uses inside
 * <Item>…</Item>. PoB parses this on import.
 */
function itemToText(item: ParsedItem): string {
  const lines: string[] = [];
  lines.push(`Rarity: ${(item.rarity || 'NORMAL').toUpperCase()}`);
  if (item.name && item.name !== item.base) lines.push(item.name);
  if (item.base) lines.push(item.base);
  if (item.itemLevel != null) lines.push(`Item Level: ${item.itemLevel}`);
  if (item.quality != null && item.quality > 0) lines.push(`Quality: ${item.quality}`);
  if (item.sockets) lines.push(`Sockets: ${item.sockets}`);
  if (item.levelReq != null) lines.push(`LevelReq: ${item.levelReq}`);
  if (item.implicits.length) {
    lines.push(`Implicits: ${item.implicits.length}`);
    for (const m of item.implicits) lines.push(m);
  } else {
    lines.push('Implicits: 0');
  }
  for (const m of item.explicits) lines.push(m);
  for (const r of item.runes || []) lines.push(`Rune: ${r}`);
  return lines.join('\n');
}

function gemToXml(gem: ParsedGem): string {
  const attrs: string[] = [
    `level="${gem.level ?? 1}"`,
    `quality="${gem.quality ?? 0}"`,
    `skillId="${xmlEscape(gem.skillId || '')}"`,
    `nameSpec="${xmlEscape(gem.nameSpec || '')}"`,
    `enabled="${gem.enabled ? 'true' : 'false'}"`,
    'enableGlobal1="true"',
    'enableGlobal2="true"',
    'count="1"',
  ];
  if (gem.variantId) attrs.push(`variantId="${xmlEscape(gem.variantId)}"`);
  if (gem.gemId) attrs.push(`gemId="${xmlEscape(gem.gemId)}"`);
  return `\t\t\t<Gem ${attrs.join(' ')}/>`;
}

export function buildPob2Xml(generated: GeneratedBuild): string {
  const b: ParsedBuild = generated.build;
  const className = b.build.className || 'Huntress';
  const ascName = b.build.ascendClassName || '';
  const cls = findClassInfo(className);
  const classId = POB2_CLASS_ID[className] ?? 0;
  const classInternalId = cls?.integerId ?? 0;
  const ascendClassId = cls ? findAscendancyIntegerId(cls, ascName) : 0;
  const ascendancyInternalId = cls ? findAscendancyInternalId(cls, ascName) : '';

  const tree = b.trees[0];
  const nodesAttr = tree ? tree.nodes.join(',') : '';
  const treeVersion = tree?.treeVersion || TREE_VERSION;

  // Find the active skill group index — we make it the mainSocketGroup so
  // PoB calculates with the right skill.
  const mainGroupIdx = b.skillGroups.findIndex(g =>
    g.gems.some(x => x.skillId === generated.skillId),
  );

  // ----- Items + Slots -----
  const itemBlocks: string[] = [];
  const slotBlocks: string[] = [];
  let nextItemId = 1;
  const slotOrder = Object.keys(b.equipped);
  for (const slotName of slotOrder) {
    const item = b.equipped[slotName];
    if (!item) continue;
    const id = nextItemId++;
    itemBlocks.push(`\t\t<Item id="${id}">\n${itemToText(item)}\n\t\t</Item>`);
    slotBlocks.push(`\t\t<Slot name="${xmlEscape(slotName)}" itemId="${id}"/>`);
  }

  // ----- Skills -----
  const skillBlocks: string[] = [];
  b.skillGroups.forEach((g, i) => {
    const isMain = i === mainGroupIdx;
    const gems = g.gems
      .filter(x => x.skillId || x.nameSpec)
      .map(gemToXml)
      .join('\n');
    skillBlocks.push(
      `\t\t<Skill mainActiveSkill="1" mainActiveSkillCalcs="1" enabled="${g.enabled !== false ? 'true' : 'false'}"${isMain ? ' includeInFullDPS="true"' : ''}>\n${gems}\n\t\t</Skill>`,
    );
  });

  return [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<PathOfBuilding2>',
    `\t<Build level="${generated.characterLevel}" className="${xmlEscape(className)}" ascendClassName="${xmlEscape(ascName)}" targetVersion="0_1" mainSocketGroup="${mainGroupIdx + 1}" viewMode="TREE"/>`,
    '\t<Tree activeSpec="1">',
    `\t\t<Spec ascendancyInternalId="${ascendancyInternalId}" ascendClassId="${ascendClassId}" classInternalId="${classInternalId}" masteryEffects="" secondaryAscendClassId="nil" nodes="${nodesAttr}" treeVersion="${treeVersion}" classId="${classId}"/>`,
    '\t</Tree>',
    '\t<Skills activeSkillSet="1">',
    '\t\t<SkillSet id="1">',
    skillBlocks.join('\n'),
    '\t\t</SkillSet>',
    '\t</Skills>',
    '\t<Items activeItemSet="1">',
    itemBlocks.join('\n'),
    slotBlocks.join('\n'),
    '\t</Items>',
    '</PathOfBuilding2>',
  ].join('\n');
}

/**
 * Compress XML to PoB2's "build code" format:
 *   URL-safe-base64(deflate(xml))
 *
 * Uses browser native CompressionStream('deflate'). Returns null if the
 * environment doesn't support compression — caller should fall back to
 * presenting raw XML.
 */
export async function compressToPobCode(xml: string): Promise<string | null> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const CS: any = (globalThis as any).CompressionStream;
  if (typeof CS === 'undefined') return null;
  const stream = new Blob([xml]).stream().pipeThrough(new CS('deflate'));
  const compressed = new Uint8Array(await new Response(stream).arrayBuffer());
  // Base64 encode
  let binary = '';
  for (let i = 0; i < compressed.length; i++) binary += String.fromCharCode(compressed[i]);
  const b64 = btoa(binary);
  // URL-safe: PoB2 / pobb.in expect '-' '_' instead of '+' '/'
  return b64.replace(/\+/g, '-').replace(/\//g, '_');
}
