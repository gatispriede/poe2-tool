// Canvas + input handler — adapted from natwarth/poe2-skilltree
// (app/src/components/TreeCanvas.tsx). Removed weapon-set tagging,
// focus animation, sprite atlas, touch double-tap.

import React, { memo, useEffect, useRef } from 'react';
import type { AtlasSet } from './atlas';
import type { Camera } from './camera';
import type { ParsedTree, TreeNode } from './types';
import { pickNode, renderTree, type RenderOpts } from './draw';

interface Props {
  tree: ParsedTree;
  camera: Camera;
  selectedClass: number | null;
  selectedAsc: string | null;
  allocated: Set<string>;
  previewKeys: Set<string>;
  atlases: AtlasSet | null;
  onHover: (node: TreeNode | null, clientX: number, clientY: number) => void;
  onPick: (node: TreeNode | null) => void;
  onPreviewKeysChange: (keys: Set<string>) => void;
  pathFor: (node: TreeNode) => string[] | null;
}

function TreeCanvas(props: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const optsRef = useRef<Props>(props);
  optsRef.current = props;
  props.camera.dirty = true;

  const pointers = useRef<Map<number, { x: number; y: number }>>(new Map());
  const dragging = useRef(false);
  const moved = useRef(false);
  const pinchDist = useRef(0);
  const hoverKey = useRef<string | null>(null);
  const downPos = useRef<{ x: number; y: number } | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current!;
    const container = containerRef.current!;
    const ctx = canvas.getContext('2d', { alpha: true })!;
    const cam = props.camera;
    let raf = 0;
    let stop = false;

    const dprRef = { current: 1 };
    const targetDpr = () => {
      const full = Math.min(window.devicePixelRatio || 1, 2);
      return cam.zoom < 0.1 ? Math.min(full, 1) : full;
    };
    const applyDpr = () => {
      const dpr = dprRef.current;
      const w = container.clientWidth;
      const h = container.clientHeight;
      canvas.width = Math.floor(w * dpr);
      canvas.height = Math.floor(h * dpr);
      canvas.style.width = w + 'px';
      canvas.style.height = h + 'px';
    };
    const resize = () => {
      dprRef.current = targetDpr();
      applyDpr();
      const firstFit = cam.vw <= 1;
      cam.setViewport(container.clientWidth, container.clientHeight);
      if (firstFit) cam.fit(optsRef.current.tree.bounds);
    };
    resize();

    const ro = new ResizeObserver(resize);
    ro.observe(container);

    const onWheelNative = (e: WheelEvent) => {
      e.preventDefault();
      const rect = canvas.getBoundingClientRect();
      const factor = Math.pow(1.0015, -e.deltaY * (e.ctrlKey ? 2.2 : 1));
      cam.zoomAt(factor, e.clientX - rect.left, e.clientY - rect.top);
    };
    canvas.addEventListener('wheel', onWheelNative, { passive: false });

    const loop = () => {
      if (stop) return;
      const td = targetDpr();
      if (Math.abs(td - dprRef.current) > 0.01) {
        dprRef.current = td;
        applyDpr();
        cam.dirty = true;
      }
      if (cam.dirty) {
        cam.dirty = false;
        const dpr = dprRef.current;
        const p = optsRef.current;
        const ropts: RenderOpts = {
          dpr,
          hoverKey: hoverKey.current,
          selectedClass: p.selectedClass,
          selectedAsc: p.selectedAsc,
          allocated: p.allocated,
          previewKeys: p.previewKeys,
          atlases: p.atlases,
        };
        renderTree(ctx, cam, p.tree, ropts);
      }
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);

    return () => {
      stop = true;
      cancelAnimationFrame(raf);
      ro.disconnect();
      canvas.removeEventListener('wheel', onWheelNative);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Translate a client pointer to canvas-local coords (camera works in canvas px).
  const localOf = (clientX: number, clientY: number) => {
    const rect = canvasRef.current!.getBoundingClientRect();
    return { lx: clientX - rect.left, ly: clientY - rect.top };
  };

  const onPointerDown = (e: React.PointerEvent) => {
    try {
      (e.target as Element).setPointerCapture(e.pointerId);
    } catch {
      /* synthetic event */
    }
    const { lx, ly } = localOf(e.clientX, e.clientY);
    pointers.current.set(e.pointerId, { x: lx, y: ly });
    if (pointers.current.size === 1) {
      dragging.current = true;
      moved.current = false;
      downPos.current = { x: lx, y: ly };
    } else if (pointers.current.size === 2) {
      const [a, b] = Array.from(pointers.current.values());
      pinchDist.current = Math.hypot(a.x - b.x, a.y - b.y);
    }
  };

  const onPointerMove = (e: React.PointerEvent) => {
    const cam = optsRef.current.camera;
    const { lx, ly } = localOf(e.clientX, e.clientY);
    const prev = pointers.current.get(e.pointerId);
    pointers.current.set(e.pointerId, { x: lx, y: ly });

    if (pointers.current.size === 2) {
      const [a, b] = Array.from(pointers.current.values());
      const dist = Math.hypot(a.x - b.x, a.y - b.y);
      if (pinchDist.current > 0) {
        const mx = (a.x + b.x) / 2;
        const my = (a.y + b.y) / 2;
        cam.zoomAt(dist / pinchDist.current, mx, my);
      }
      pinchDist.current = dist;
      moved.current = true;
      return;
    }

    if (dragging.current && prev) {
      if (!moved.current && downPos.current) {
        const tot = Math.hypot(lx - downPos.current.x, ly - downPos.current.y);
        if (tot > 6) moved.current = true;
      }
      if (moved.current) {
        cam.panByScreen(lx - prev.x, ly - prev.y);
        hoverKey.current = null;
        optsRef.current.onPreviewKeysChange(new Set());
        optsRef.current.onHover(null, 0, 0);
      }
      return;
    }

    const wx = cam.screenToWorldX(lx);
    const wy = cam.screenToWorldY(ly);
    const p = optsRef.current;
    const hit = pickNode(p.tree, wx, wy);
    const newKey = hit ? hit.key : null;
    if (newKey !== hoverKey.current) {
      hoverKey.current = newKey;
      if (hit) {
        const path = p.pathFor(hit);
        p.onPreviewKeysChange(path ? new Set(path) : new Set());
      } else {
        p.onPreviewKeysChange(new Set());
      }
      cam.dirty = true;
    }
    p.onHover(hit, e.clientX, e.clientY);
  };

  const endPointer = (e: React.PointerEvent) => {
    pointers.current.delete(e.pointerId);
    if (pointers.current.size < 2) pinchDist.current = 0;
    if (pointers.current.size === 0) {
      if (dragging.current && !moved.current) {
        const p = optsRef.current;
        const cam = p.camera;
        const { lx, ly } = localOf(e.clientX, e.clientY);
        const wx = cam.screenToWorldX(lx);
        const wy = cam.screenToWorldY(ly);
        const hit = pickNode(p.tree, wx, wy);
        p.onPick(hit);
      }
      dragging.current = false;
      moved.current = false;
    }
  };

  return (
    <div ref={containerRef} className="ptv-canvas-wrap">
      <canvas
        ref={canvasRef}
        className="ptv-canvas"
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={endPointer}
        onPointerCancel={endPointer}
      />
    </div>
  );
}

export default memo(TreeCanvas);
