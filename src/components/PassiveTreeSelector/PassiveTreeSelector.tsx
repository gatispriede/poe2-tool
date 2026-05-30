import React, { useState, useMemo } from 'react';
import { searchPassiveNodes, aggregatePassiveStats } from '../../passives/aggregator';
import { PASSIVE_NODES } from '../../passives/passivesData';
import { PassiveStats } from '../../damage/model';
import { parsePassiveNodes, mergePassiveNodeSets, RawPassiveNode } from '../../passives/parser';
import { aggregatePassiveStatsFromNodes } from '../../passives/aggregator';
import './PassiveTreeSelector.css';

export interface PassiveTreeSelectorProps {
  selectedIds: string[];
  onChange: (ids: string[], aggregated: PassiveStats) => void;
}

const PassiveTreeSelector: React.FC<PassiveTreeSelectorProps> = ({ selectedIds, onChange }) => {
  const [query, setQuery] = useState('');
  const [typeFilter, setTypeFilter] = useState<'all' | 'small' | 'notable'>('all');
  const [nodes, setNodes] = useState(PASSIVE_NODES);
  const [rawInput, setRawInput] = useState('');
  const [parseError, setParseError] = useState<string | null>(null);

  const results = useMemo(() => {
    const q = query.trim().toLowerCase();
    return nodes.filter(n => (typeFilter === 'all' || n.type === typeFilter) && (q === '' || n.name.toLowerCase().includes(q)));
  }, [query, typeFilter, nodes]);
  const aggregated = useMemo(() => aggregatePassiveStatsFromNodes(nodes, selectedIds), [selectedIds, nodes]);

  const toggle = (id: string) => {
    onChange(
      selectedIds.includes(id) ? selectedIds.filter(x => x !== id) : [...selectedIds, id],
      aggregatePassiveStats(selectedIds.includes(id) ? selectedIds.filter(x => x !== id) : [...selectedIds, id])
    );
  };

  const clear = () => onChange([], {});
  const selectAllShown = () => onChange(results.map(r => r.id), aggregatePassiveStats(results.map(r => r.id)));

  const importJSON = () => {
    setParseError(null);
    try {
      const parsedRaw = JSON.parse(rawInput);
      if (!Array.isArray(parsedRaw)) throw new Error('JSON must be an array of objects');
      const normalized: RawPassiveNode[] = parsedRaw.map((o: any, idx: number) => ({
        id: String(o.id ?? idx),
        name: String(o.name ?? 'Unnamed Node ' + idx),
        stats: Array.isArray(o.stats) ? o.stats.map(String) : [],
        type: o.type === 'small' || o.type === 'notable' ? o.type : undefined,
      }));
      const parsedNodes = parsePassiveNodes(normalized);
      setNodes(prev => mergePassiveNodeSets(prev, parsedNodes));
    } catch (e: any) {
      setParseError(e.message || 'Failed to parse');
    }
  };

  const handleFile = (f: File | null) => {
    if (!f) return;
    setParseError(null);
    const reader = new FileReader();
    reader.onload = () => {
      setRawInput(String(reader.result));
    };
    reader.readAsText(f);
  };

  return (
    <div className="passive-selector">
      <h2>Passive Tree Nodes</h2>
      <div className="controls">
        <input
          type="text"
          placeholder="Search nodes..."
          value={query}
          onChange={e => setQuery(e.target.value)}
        />
        <select value={typeFilter} onChange={e => setTypeFilter(e.target.value as any)}>
          <option value="all">All Types</option>
          <option value="small">Small</option>
          <option value="notable">Notables</option>
        </select>
        <button onClick={selectAllShown}>Select All Shown</button>
        <button onClick={clear}>Clear</button>
      </div>
      <details style={{ marginBottom: '0.5rem' }}>
        <summary>Import Passive Nodes (JSON)</summary>
        <p style={{ fontSize: '0.75rem' }}>Provide JSON array: <code>[{`{"id":"123","name":"Strong Arm","stats":["10% increased Physical Damage"],"type":"small"}`}]</code>. Stats lines parsed for Physical Damage, Attack Speed, Crit Chance, Crit Multi.</p>
        <textarea
          value={rawInput}
          onChange={e => setRawInput(e.target.value)}
          rows={6}
          style={{ width: '100%', background:'#222', color:'#fff', border:'1px solid #444', borderRadius:4 }}
          placeholder='Paste JSON here'
        />
        <div style={{ display:'flex', gap:8, marginTop:8, alignItems:'center', flexWrap:'wrap' }}>
          <input type='file' accept='.json,application/json' onChange={e => handleFile(e.target.files?.[0] ?? null)} />
          <button onClick={importJSON}>Merge & Parse</button>
          <span style={{ fontSize:'0.7rem', opacity:0.8 }}>Total nodes: {nodes.length}</span>
          {parseError && <span style={{ color:'salmon', fontSize:'0.7rem' }}>{parseError}</span>}
        </div>
      </details>
      <div className="node-list">
        {results.map(node => (
          <label key={node.id} className={`node-item ${node.type}`}>
            <input
              type="checkbox"
              checked={selectedIds.includes(node.id)}
              onChange={() => toggle(node.id)}
            />
            <span className="name">{node.name}</span>
            <span className="stats">
              {Object.entries(node.stats).map(([k, v]) => (
                <span key={k}>{k.replace('increased', 'inc').replace(/Pct$/, '%')}: {v}</span>
              ))}
            </span>
          </label>
        ))}
        {results.length === 0 && <div className="empty">No nodes match.</div>}
      </div>
      <div className="aggregated">
        <h3>Aggregated Stats</h3>
        {Object.keys(aggregated).length === 0 && <div className="empty">None selected.</div>}
        <ul>
          {Object.entries(aggregated).map(([k, v]) => (
            <li key={k}>{k}: {v}</li>
          ))}
        </ul>
      </div>
      <details>
        <summary>Data Source Notes</summary>
        <p>Static placeholder plus any imported nodes. For full PoE2 tree, export or construct a JSON from poe2wiki. Avoid copyrighted bulk data distribution; import locally instead.</p>
      </details>
    </div>
  );
};

export default PassiveTreeSelector;
