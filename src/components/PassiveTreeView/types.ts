// Tree types — adapted from natwarth/poe2-skilltree (app/src/types.ts).
// Only the fields the visual renderer actually consumes.

export interface RawNode {
  id?: string;
  skill?: number;
  name?: string;
  icon?: string;
  isNotable?: boolean;
  isKeystone?: boolean;
  isMastery?: boolean;
  isJewelSocket?: boolean;
  isAscendancyStart?: boolean;
  isMultipleChoiceOption?: boolean;
  multipleChoiceParent?: number | string;
  ascendancyId?: string;
  ascendancyName?: string;
  classStartIndex?: number[];
  stats?: string[];
  flavourText?: string[];
  group?: number | string;
  orbit?: number;
  orbitIndex?: number;
  x?: number;
  y?: number;
  in?: string[];
  out?: string[];
  edges?: number[];
}

export interface RawEdge {
  from: number | string;
  to: number | string;
  orbit?: number;
  orbitX?: number;
  orbitY?: number;
}

export interface RawClass {
  name: string;
  base_str: number;
  base_dex: number;
  base_int: number;
  ascendancies: { id: string; name: string; internalId?: string }[];
}

export interface RawTreeData {
  tree: string;
  classes: RawClass[];
  nodes: Record<string, RawNode>;
  edges?: RawEdge[];
  min_x: number;
  min_y: number;
  max_x: number;
  max_y: number;
}

export type NodeKind =
  | 'keystone'
  | 'notable'
  | 'mastery'
  | 'jewel'
  | 'ascNotable'
  | 'ascNormal'
  | 'ascStart'
  | 'small';

export interface TreeNode {
  key: string;
  id?: string;
  name: string;
  icon?: string;
  kind: NodeKind;
  ascendancyId?: string;
  classStartIndex?: number[];
  stats: string[];
  flavourText: string[];
  orbit: number;
  x: number;
  y: number;
  mcOption?: boolean;
}

export interface TreeEdge {
  fromKey: string;
  toKey: string;
  fx: number;
  fy: number;
  tx: number;
  ty: number;
  arc?: { cx: number; cy: number; r: number; a0: number; a1: number; ccw: boolean };
  hidden?: boolean;
  asc?: string;
}

export interface ParsedTree {
  nodes: Map<string, TreeNode>;
  nodeList: TreeNode[];
  edges: TreeEdge[];
  classes: RawClass[];
  bounds: { minX: number; minY: number; maxX: number; maxY: number };
  classStart: Map<number, TreeNode>;
  ascStart: Map<string, TreeNode>;
  adjacency: Map<string, string[]>;
}
