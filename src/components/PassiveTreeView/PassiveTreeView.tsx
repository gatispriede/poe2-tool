// Top-level visual passive tree — adapted from natwarth/poe2-skilltree
// (app/src/App.tsx orchestration). Owns the camera, loads ParsedTree once,
// drives allocation via shortest-path BFS.

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Camera } from './camera';
import HoverLayer, { HoverHandle } from './HoverLayer';
import TreeCanvas from './TreeCanvas';
import { loadParsedTree } from './treeParser';
import { loadAtlases, type AtlasSet } from './atlas';
import { pathFrom, reach } from './allocation';
import type { ParsedTree, TreeNode } from './types';
import './PassiveTreeView.css';

// Map our PoE2 class names → the class index used by `tree.classStart`.
// Each class starts from one of the 6 hub nodes; classStartIndex on those
// hub nodes lists the indices that share the hub (0-5 = PoE1 names, 6-11 = PoE2).
const CLASS_INDEX_BY_NAME: Record<string, number> = {
  Marauder: 0,
  Witch: 1,
  Ranger: 2,
  Duelist: 3,
  Shadow: 4,
  Templar: 5,
  Warrior: 6,
  Sorceress: 7,
  Huntress: 8,
  Mercenary: 9,
  Monk: 10,
  Druid: 11,
};

interface Props {
  className: string;
  allocatedIds: Set<string>;
  onAllocatedChange: (ids: Set<string>) => void;
  pointsAvailable?: number;
}

export default function PassiveTreeView({
  className,
  allocatedIds,
  onAllocatedChange,
  pointsAvailable,
}: Props) {
  const [tree, setTree] = useState<ParsedTree | null>(null);
  const [atlases, setAtlases] = useState<AtlasSet | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [previewKeys, setPreviewKeys] = useState<Set<string>>(() => new Set());
  const cameraRef = useRef<Camera>(new Camera());
  const hoverRef = useRef<HoverHandle>(null);

  useEffect(() => {
    let alive = true;
    loadParsedTree()
      .then((t) => {
        if (alive) setTree(t);
      })
      .catch((e) => {
        if (alive) setLoadError(String(e?.message ?? e));
      });
    // Atlases are optional — rendering falls back to colored dots if they fail to load.
    loadAtlases()
      .then((a) => {
        if (alive) setAtlases(a);
      })
      .catch((e) => {
        // eslint-disable-next-line no-console
        console.warn('Failed to load tree atlases; falling back to dots.', e);
      });
    return () => {
      alive = false;
    };
  }, []);

  const selectedClass = useMemo<number | null>(() => {
    const idx = CLASS_INDEX_BY_NAME[className];
    return typeof idx === 'number' ? idx : null;
  }, [className]);

  const startKey = useMemo<string | null>(() => {
    if (!tree || selectedClass == null) return null;
    return tree.classStart.get(selectedClass)?.key ?? null;
  }, [tree, selectedClass]);

  // Sources = start + currently allocated. We treat allocation as a connected
  // graph rooted at the class start (drop disconnected nodes on each change).
  const sources = useMemo<Set<string>>(() => {
    const s = new Set<string>();
    if (startKey) s.add(startKey);
    allocatedIds.forEach((k) => s.add(k));
    return s;
  }, [startKey, allocatedIds]);

  // Path the click would allocate (or deallocate). Skip mastery/ascendancy
  // nodes for now — those need extra rules we haven't ported yet.
  const pathFor = useCallback(
    (node: TreeNode): string[] | null => {
      if (!tree || !startKey) return null;
      if (node.kind === 'mastery') return null;
      if (node.ascendancyId) return null;
      if (allocatedIds.has(node.key)) return [node.key]; // deallocation preview shows the node itself
      const path = pathFrom(tree.adjacency, sources, node.key, (k) => {
        const t = tree.nodes.get(k);
        if (!t) return false;
        if (t.kind === 'mastery') return false;
        if (t.ascendancyId) return false;
        return true;
      });
      return path;
    },
    [tree, startKey, sources, allocatedIds]
  );

  const onPick = useCallback(
    (node: TreeNode | null) => {
      if (!node || !tree || !startKey) return;
      if (node.kind === 'mastery') return;
      if (node.ascendancyId) return;
      // Deallocate: remove the node and any nodes that lose connectivity to start.
      if (allocatedIds.has(node.key)) {
        if (node.key === startKey) return;
        const next = new Set(allocatedIds);
        next.delete(node.key);
        // Prune anything no longer reachable from start through `next`.
        const reachable = reach(
          tree.adjacency,
          startKey,
          (k) => k === startKey || next.has(k)
        );
        const toRemove: string[] = [];
        next.forEach((k) => { if (!reachable.has(k)) toRemove.push(k); });
        toRemove.forEach((k) => next.delete(k));
        onAllocatedChange(next);
        return;
      }
      // Allocate: extend along the shortest path.
      const path = pathFor(node);
      if (!path) return;
      const next = new Set(allocatedIds);
      for (const k of path) next.add(k);
      onAllocatedChange(next);
    },
    [tree, startKey, allocatedIds, onAllocatedChange, pathFor]
  );

  const onHover = useCallback((node: TreeNode | null, x: number, y: number) => {
    hoverRef.current?.setHover(node, x, y);
  }, []);

  if (loadError) {
    return <div className="ptv-error">Failed to load tree: {loadError}</div>;
  }
  if (!tree) {
    return (
      <div className="ptv-loader">
        <div className="ptv-loader__ring" />
        <div className="ptv-loader__label">Loading tree…</div>
      </div>
    );
  }

  const ptCount = Math.max(0, allocatedIds.size - (startKey && allocatedIds.has(startKey) ? 1 : 0));

  return (
    <div className="ptv-root">
      <TreeCanvas
        tree={tree}
        camera={cameraRef.current}
        selectedClass={selectedClass}
        selectedAsc={null}
        allocated={allocatedIds}
        previewKeys={previewKeys}
        atlases={atlases}
        onHover={onHover}
        onPick={onPick}
        onPreviewKeysChange={setPreviewKeys}
        pathFor={pathFor}
      />
      <HoverLayer ref={hoverRef} />
      <div className="ptv-hud">
        <div className="ptv-hud__row">
          <span className="ptv-hud__label">CLASS</span>
          <span className="ptv-hud__value">{className}</span>
        </div>
        <div className="ptv-hud__row">
          <span className="ptv-hud__label">POINTS</span>
          <span className="ptv-hud__value">
            {ptCount}
            {typeof pointsAvailable === 'number' ? ` / ${pointsAvailable}` : ''}
          </span>
        </div>
        <button
          className="ptv-hud__btn"
          onClick={() => cameraRef.current.fit(tree.bounds)}
          type="button"
        >
          Fit
        </button>
        <button
          className="ptv-hud__btn"
          onClick={() => onAllocatedChange(startKey ? new Set([startKey]) : new Set())}
          type="button"
        >
          Clear
        </button>
      </div>
    </div>
  );
}
