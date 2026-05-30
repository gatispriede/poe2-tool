// Sprite-atlas loader — adapted from natwarth/poe2-skilltree (app/src/lib/atlas.ts).
// Loads a packed .webp + .json frame map and exposes a `drawCentered` helper.

interface Frame {
  x: number;
  y: number;
  w: number;
  h: number;
}

interface AtlasJson {
  frames: Record<string, { frame: Frame }>;
  meta: { image: string; scale?: string; size?: { w: number; h: number } };
}

export class Atlas {
  img!: HTMLImageElement;
  frames: Record<string, Frame> = {};
  scale = 0.5;

  async load(jsonUrl: string, imgUrl: string): Promise<this> {
    const json: AtlasJson = await fetch(jsonUrl).then((r) => r.json());
    this.scale = parseFloat(json.meta.scale ?? '0.5') || 0.5;
    for (const k in json.frames) this.frames[k] = json.frames[k].frame;
    this.img = await loadImage(imgUrl);
    return this;
  }

  has(key: string): boolean {
    return key in this.frames;
  }

  drawCentered(
    ctx: CanvasRenderingContext2D,
    key: string,
    cx: number,
    cy: number,
    size?: number,
    alpha = 1
  ): number {
    const f = this.frames[key];
    if (!f) return 0;
    const natW = f.w / this.scale;
    const natH = f.h / this.scale;
    const ratio = size ? size / Math.max(natW, natH) : 1;
    const w = natW * ratio;
    const h = natH * ratio;
    if (alpha !== 1) ctx.globalAlpha = alpha;
    ctx.drawImage(this.img, f.x, f.y, f.w, f.h, cx - w / 2, cy - h / 2, w, h);
    if (alpha !== 1) ctx.globalAlpha = 1;
    return Math.max(w, h);
  }
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = src;
  });
}

export interface AtlasSet {
  skills: Atlas;
  frame: Atlas;
}

export async function loadAtlases(): Promise<AtlasSet> {
  const base = (process.env.PUBLIC_URL || '').replace(/\/$/, '') + '/TreeData/atlas';
  const [skills, frame] = await Promise.all([
    new Atlas().load(`${base}/skills.json`, `${base}/skills.webp`),
    new Atlas().load(`${base}/frame.json`, `${base}/frame.webp`),
  ]);
  return { skills, frame };
}
