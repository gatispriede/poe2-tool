// Tooltip — adapted from natwarth/poe2-skilltree (app/src/components/Tooltip.tsx).
// Simplified: no diff/markup/notes layers.

import React from 'react';
import type { TreeNode } from './types';

const KIND_LABEL: Record<string, string> = {
  keystone: 'Keystone',
  notable: 'Notable',
  small: 'Small Passive',
  jewel: 'Jewel Socket',
  mastery: 'Mastery',
  ascNotable: 'Ascendancy Notable',
  ascNormal: 'Ascendancy Passive',
  ascStart: 'Ascendancy Start',
};

// PoE stat-string markers like [Tag|display text] → "display text"; bare [Tag] → "Tag".
function cleanStat(s: string): string {
  return s.replace(/\[([^|\]]+)\|([^\]]+)\]/g, '$2').replace(/\[([^\]]+)\]/g, '$1');
}

interface Props {
  node: TreeNode;
  x: number;
  y: number;
}

export default function Tooltip({ node, x, y }: Props) {
  const left = Math.min(x + 20, window.innerWidth - 360);
  const top = Math.min(y + 20, window.innerHeight - 280);

  return (
    <div className="ptv-tooltip" style={{ left, top }}>
      <div className="ptv-tooltip__name">{node.name || 'Unnamed'}</div>
      <div className="ptv-tooltip__kind">
        {KIND_LABEL[node.kind] ?? node.kind}
        {node.ascendancyId ? ` · ${node.ascendancyId}` : ''}
      </div>
      {node.stats.map((s, i) =>
        cleanStat(s)
          .split('\n')
          .map((line, j) => (
            <div className="ptv-tooltip__stat" key={`${i}-${j}`}>
              {line}
            </div>
          ))
      )}
      {node.flavourText && node.flavourText.length > 0 && (
        <div className="ptv-tooltip__flavour">{node.flavourText.join(' ')}</div>
      )}
    </div>
  );
}
