// Shared types for the build-validity layer.
//
// `ParsedBuild` is the shape produced by scripts/parse-pob.js — the same
// shape our `docs/baseline-builds/raw/*-build.json` fixtures use.

export type Layer = 1 | 2 | 3 | 4 | 5;

export interface ValidationError {
  layer: Layer;
  kind: string;     // short identifier, e.g. "unknown-skill" / "unreachable-node"
  message: string;
  context?: Record<string, unknown>;
}

export interface ValidationResult {
  valid: boolean;
  errors: ValidationError[];
}

export interface ParsedItem {
  id: string;
  rarity: string | null;
  name: string | null;
  base: string | null;
  itemLevel: number | null;
  quality: number | null;
  sockets: string | null;
  levelReq: number | null;
  runes: string[];
  implicits: string[];
  explicits: string[];
  rawLines: string[];
}

export interface ParsedGem {
  skillId: string | null;
  nameSpec: string | null;
  variantId: string | null;
  gemId: string | null;
  level: number | null;
  quality: number;
  enabled: boolean;
}

export interface ParsedSkillGroup {
  label: string | null;
  mainActiveSkill: number | null;
  enabled: boolean;
  gems: ParsedGem[];
}

export interface ParsedTreeSpec {
  classId: number | null;
  classInternalId: string | null;
  ascendClassId: number | null;
  ascendancyInternalId: string | null;
  treeVersion: string | null;
  nodes: number[];
  masteryEffects: string;
}

export interface ParsedBuild {
  build: {
    level: number | null;
    className: string | null;
    ascendClassName: string | null;
    mainSocketGroup: number | null;
    targetVersion: string | null;
    useSecondWeaponSet?: boolean;
  };
  trees: ParsedTreeSpec[];
  skillGroups: ParsedSkillGroup[];
  equipped: Record<string, ParsedItem>;
}
