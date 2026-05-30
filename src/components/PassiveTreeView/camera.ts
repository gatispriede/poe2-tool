// Pan/zoom camera — adapted from natwarth/poe2-skilltree (app/src/lib/camera.ts).

export function clamp(v: number, lo: number, hi: number) {
  return v < lo ? lo : v > hi ? hi : v;
}

export class Camera {
  x = 0;
  y = 0;
  zoom = 0.1;
  vw = 1;
  vh = 1;
  minZoom = 0.02;
  maxZoom = 2.5;
  dirty = true;

  setViewport(w: number, h: number) {
    this.vw = w;
    this.vh = h;
    this.dirty = true;
  }

  worldToScreenX(wx: number) {
    return (wx - this.x) * this.zoom + this.vw / 2;
  }
  worldToScreenY(wy: number) {
    return (wy - this.y) * this.zoom + this.vh / 2;
  }
  screenToWorldX(sx: number) {
    return (sx - this.vw / 2) / this.zoom + this.x;
  }
  screenToWorldY(sy: number) {
    return (sy - this.vh / 2) / this.zoom + this.y;
  }

  panByScreen(dx: number, dy: number) {
    this.x -= dx / this.zoom;
    this.y -= dy / this.zoom;
    this.dirty = true;
  }

  zoomAt(factor: number, sx: number, sy: number) {
    const wx = this.screenToWorldX(sx);
    const wy = this.screenToWorldY(sy);
    this.zoom = clamp(this.zoom * factor, this.minZoom, this.maxZoom);
    this.x = wx - (sx - this.vw / 2) / this.zoom;
    this.y = wy - (sy - this.vh / 2) / this.zoom;
    this.dirty = true;
  }

  fit(b: { minX: number; minY: number; maxX: number; maxY: number }, pad = 0.92) {
    const w = b.maxX - b.minX;
    const h = b.maxY - b.minY;
    this.x = (b.minX + b.maxX) / 2;
    this.y = (b.minY + b.maxY) / 2;
    this.zoom = clamp(Math.min(this.vw / w, this.vh / h) * pad, this.minZoom, this.maxZoom);
    this.dirty = true;
  }

  centerOn(wx: number, wy: number, zoom?: number) {
    this.x = wx;
    this.y = wy;
    if (zoom) this.zoom = clamp(zoom, this.minZoom, this.maxZoom);
    this.dirty = true;
  }
}
