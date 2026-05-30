// Hover overlay — adapted from natwarth/poe2-skilltree (app/src/components/HoverLayer.tsx).
// Owns hover state so mouse movement doesn't re-render the tree.

import React, { forwardRef, useImperativeHandle, useState } from 'react';
import Tooltip from './Tooltip';
import type { TreeNode } from './types';

export interface HoverHandle {
  setHover: (node: TreeNode | null, x: number, y: number) => void;
}

const HoverLayer = forwardRef<HoverHandle, {}>(function HoverLayer(_props, ref) {
  const [h, setH] = useState<{ node: TreeNode; x: number; y: number } | null>(null);

  useImperativeHandle(
    ref,
    () => ({
      setHover: (node, x, y) =>
        setH((prev) => {
          const prevKey = prev?.node.key ?? null;
          const nextKey = node?.key ?? null;
          if (prevKey === nextKey) return prev;
          return node ? { node, x, y } : null;
        }),
    }),
    []
  );

  if (!h) return null;
  return <Tooltip node={h.node} x={h.x} y={h.y} />;
});

export default HoverLayer;
