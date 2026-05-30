// Canvas tree renderer — adapted from natwarth/poe2-skilltree
// (app/src/render/draw.ts). Stripped of sprite atlas, version diff,
// weapon-set tagging, and notes layers — pure colored dots + lines.

import type { Camera } from './camera';
import type { AtlasSet } from './atlas';
import type { NodeKind, ParsedTree, TreeNode } from './types';

const ALLOC_EDGE = '#f1d6a0';
const ALLOC_DOT = '#f4dca6';

const FRAME: Record<NodeKind, string | null> = {
  keystone: 'frame:KeystoneFrameUnallocated',
  notable: 'frame:NotableFrameUnallocated',
  ascNotable: 'frame:AscendancyFrameNotableUnallocated',
  ascStart: 'frame:AscendancyStartNode',
  jewel: 'frame:JewelFrameUnallocated',
  ascNormal: 'frame:AscendancyFrameNormalUnallocated',
  small: 'frame:PSSkillFrame',
  mastery: null,
};

const FRAME_ALLOCATED: Record<NodeKind, string | null> = {
  keystone: 'frame:KeystoneFrameAllocated',
  notable: 'frame:NotableFrameAllocated',
  ascNotable: 'frame:AscendancyFrameNotableAllocated',
  ascStart: 'frame:AscendancyStartNode',
  jewel: 'frame:JewelFrameAllocated',
  ascNormal: 'frame:AscendancyFrameNormalAllocated',
  small: 'frame:PSSkillFrameActive',
  mastery: null,
};

const ICON_PREFIX: Record<NodeKind, string[]> = {
  keystone: ['keystoneActive', 'notableActive', 'normalActive'],
  ascNotable: ['notableActive', 'keystoneActive', 'normalActive'],
  notable: ['notableActive', 'normalActive', 'keystoneActive'],
  jewel: ['normalActive', 'notableActive'],
  ascNormal: ['normalActive', 'notableActive'],
  ascStart: ['normalActive', 'notableActive'],
  small: ['normalActive', 'notableActive'],
  mastery: [],
};

const iconCache = new WeakMap<TreeNode, string | null>();
function resolveIconKey(set: AtlasSet, n: TreeNode): string | null {
  const hit = iconCache.get(n);
  if (hit !== undefined) return hit;
  let key: string | null = null;
  if (n.icon) {
    for (const p of ICON_PREFIX[n.kind]) {
      const k = `${p}:${n.icon}`;
      if (set.skills.has(k)) {
        key = k;
        break;
      }
    }
  }
  iconCache.set(n, key);
  return key;
}

const DOT: Record<NodeKind, { color: string; r: number }> = {
  keystone: { color: '#e0913f', r: 60 },
  notable: { color: '#d9c184', r: 44 },
  ascNotable: { color: '#c9a9e0', r: 44 },
  ascStart: { color: '#cbb27a', r: 40 },
  jewel: { color: '#5fd6cd', r: 38 },
  ascNormal: { color: '#8b86a8', r: 26 },
  small: { color: '#8f8a76', r: 24 },
  mastery: { color: '#c8a35a', r: 34 },
};

export function nodeWorldRadius(n: TreeNode): number {
  return DOT[n.kind].r * 1.4;
}

export interface RenderOpts {
  dpr: number;
  hoverKey: string | null;
  selectedClass: number | null;
  selectedAsc: string | null;
  allocated: Set<string>;
  previewKeys: Set<string>;
  atlases: AtlasSet | null;
}

export function renderTree(
  ctx: CanvasRenderingContext2D,
  cam: Camera,
  tree: ParsedTree,
  opts: RenderOpts
) {
  const { dpr } = opts;
  const W = cam.vw;
  const H = cam.vh;
  const z = cam.zoom;

  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.clearRect(0, 0, W, H);
  ctx.setTransform(dpr * z, 0, 0, dpr * z, dpr * (W / 2 - cam.x * z), dpr * (H / 2 - cam.y * z));

  const cssPx = (px: number) => px / z;

  const margin = 220 / z;
  const vx0 = cam.x - W / 2 / z - margin;
  const vx1 = cam.x + W / 2 / z + margin;
  const vy0 = cam.y - H / 2 / z - margin;
  const vy1 = cam.y + H / 2 / z + margin;
  const inView = (x: number, y: number) => x > vx0 && x < vx1 && y > vy0 && y < vy1;

  const dimAsc = !!opts.selectedAsc;
  const alphaFor = (n: TreeNode): number => {
    if (dimAsc) {
      if (n.ascendancyId === opts.selectedAsc) return 1;
      return n.ascendancyId ? 0.08 : 0.22;
    }
    if (n.ascendancyId) return 0.12;
    return 1;
  };

  // ---- edges ----------------------------------------------------------
  const hasAlloc = opts.allocated.size > 0;
  const hasPreview = opts.previewKeys.size > 0;
  const edgeBuckets = new Map<number, Path2D>();
  const allocPath = new Path2D();
  const previewPath = new Path2D();
  const previewNodePath = new Path2D();

  const addSeg = (
    p: Path2D,
    fx: number,
    fy: number,
    tx: number,
    ty: number,
    arc: ParsedTree['edges'][number]['arc']
  ) => {
    if (arc) {
      p.moveTo(arc.cx + arc.r * Math.cos(arc.a0), arc.cy + arc.r * Math.sin(arc.a0));
      p.arc(arc.cx, arc.cy, arc.r, arc.a0, arc.a1, arc.ccw);
    } else {
      p.moveTo(fx, fy);
      p.lineTo(tx, ty);
    }
  };

  for (const e of tree.edges) {
    if (e.hidden) continue;
    if (!inView(e.fx, e.fy) && !inView(e.tx, e.ty)) continue;
    if (hasAlloc && opts.allocated.has(e.fromKey) && opts.allocated.has(e.toKey)) {
      addSeg(allocPath, e.fx, e.fy, e.tx, e.ty, e.arc);
      continue;
    }
    if (hasPreview) {
      const fp = opts.previewKeys.has(e.fromKey);
      const tp = opts.previewKeys.has(e.toKey);
      if (
        (fp || tp) &&
        (fp || opts.allocated.has(e.fromKey)) &&
        (tp || opts.allocated.has(e.toKey))
      ) {
        addSeg(previewPath, e.fx, e.fy, e.tx, e.ty, e.arc);
        continue;
      }
    }
    const a = tree.nodes.get(e.fromKey);
    const b = tree.nodes.get(e.toKey);
    if (!a || !b) continue;
    const al = Math.min(alphaFor(a), alphaFor(b));
    if (al < 0.02) continue;
    const bk = Math.round(al * 20) / 20;
    let p = edgeBuckets.get(bk);
    if (!p) edgeBuckets.set(bk, (p = new Path2D()));
    addSeg(p, e.fx, e.fy, e.tx, e.ty, e.arc);
  }

  ctx.lineCap = 'round';
  ctx.strokeStyle = 'rgba(166,138,82,0.7)';
  ctx.lineWidth = cssPx(1.5);
  edgeBuckets.forEach((path, al) => {
    ctx.globalAlpha = al * 0.62;
    ctx.stroke(path);
  });
  ctx.globalAlpha = 1;

  if (hasAlloc) {
    ctx.lineWidth = cssPx(3.5);
    ctx.strokeStyle = ALLOC_EDGE;
    ctx.stroke(allocPath);
  }

  if (hasPreview) {
    ctx.save();
    ctx.strokeStyle = ALLOC_EDGE;
    ctx.globalAlpha = 0.6;
    ctx.lineWidth = cssPx(2.5);
    ctx.setLineDash([cssPx(7), cssPx(6)]);
    ctx.stroke(previewPath);
    ctx.restore();
  }

  // ---- nodes ----------------------------------------------------------
  const dotBuckets = new Map<string, { color: string; alpha: number; path: Path2D }>();
  let hoverRing: { x: number; y: number; r: number } | null = null;
  const set = opts.atlases;
  const lodCutoff = 7;
  const frameW = (key: string) => set ? (set.frame.frames[key]?.w ?? 100) / set.frame.scale : 100;

  for (const n of tree.nodeList) {
    if (n.kind === 'mastery') continue;
    if (!inView(n.x, n.y)) continue;
    const allocated = hasAlloc && opts.allocated.has(n.key);
    const al = allocated ? 1 : alphaFor(n);
    if (al < 0.02) continue;

    const d = DOT[n.kind];
    const frameKey = FRAME[n.kind];
    const natural = set && frameKey ? frameW(frameKey) : 80;
    const screenSize = natural * z;

    if (!set || screenSize < lodCutoff) {
      // Fallback dot rendering when atlases aren't ready or zoomed out.
      if (allocated) {
        const bk = `alloc-${ALLOC_DOT}`;
        let b = dotBuckets.get(bk);
        if (!b) dotBuckets.set(bk, (b = { color: ALLOC_DOT, alpha: 1, path: new Path2D() }));
        const r = d.r * 1.25;
        b.path.moveTo(n.x + r, n.y);
        b.path.arc(n.x, n.y, r, 0, Math.PI * 2);
      } else {
        const dotPx = d.r * 2 * z;
        const minor = n.kind === 'small' || n.kind === 'ascNormal';
        if (!(minor && dotPx < 2)) {
          const bk = `${d.color}|${al}`;
          let b = dotBuckets.get(bk);
          if (!b) dotBuckets.set(bk, (b = { color: d.color, alpha: al, path: new Path2D() }));
          b.path.moveTo(n.x + d.r, n.y);
          b.path.arc(n.x, n.y, d.r, 0, Math.PI * 2);
        }
      }
    } else {
      ctx.globalAlpha = al;
      const ik = resolveIconKey(set, n);
      if (ik) set.skills.drawCentered(ctx, ik, n.x, n.y);
      const fk = allocated ? FRAME_ALLOCATED[n.kind] ?? frameKey : frameKey;
      if (fk) set.frame.drawCentered(ctx, fk, n.x, n.y);
      ctx.globalAlpha = 1;
    }

    if (hasPreview && opts.previewKeys.has(n.key)) {
      const ringR = d.r * 1.55;
      previewNodePath.moveTo(n.x + ringR, n.y);
      previewNodePath.arc(n.x, n.y, ringR, 0, Math.PI * 2);
    }
    if (opts.hoverKey === n.key) {
      hoverRing = { x: n.x, y: n.y, r: d.r * 1.55 * 1.1 };
    }
  }

  dotBuckets.forEach((b) => {
    ctx.globalAlpha = b.alpha;
    ctx.fillStyle = b.color;
    ctx.fill(b.path);
  });
  ctx.globalAlpha = 1;

  if (hasPreview) {
    ctx.save();
    ctx.strokeStyle = ALLOC_EDGE;
    ctx.globalAlpha = 0.7;
    ctx.lineWidth = cssPx(2);
    ctx.setLineDash([cssPx(6), cssPx(5)]);
    ctx.stroke(previewNodePath);
    ctx.restore();
  }

  if (hoverRing) {
    ctx.strokeStyle = '#ece5d6';
    ctx.lineWidth = cssPx(2);
    ctx.beginPath();
    ctx.arc(hoverRing.x, hoverRing.y, hoverRing.r, 0, Math.PI * 2);
    ctx.stroke();
  }

  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
}

/** Nearest node to a world point, within its footprint. */
export function pickNode(tree: ParsedTree, wx: number, wy: number): TreeNode | null {
  let best: TreeNode | null = null;
  let bestD = Infinity;
  for (const n of tree.nodeList) {
    if (n.kind === 'mastery') continue;
    const rr = nodeWorldRadius(n);
    const d = (n.x - wx) ** 2 + (n.y - wy) ** 2;
    if (d < rr * rr && d < bestD) {
      bestD = d;
      best = n;
    }
  }
  return best;
}
