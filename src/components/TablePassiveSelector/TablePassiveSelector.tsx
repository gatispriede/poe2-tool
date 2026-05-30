import React, { useState, useMemo } from 'react';
import { TABLE_PASSIVES, TablePassiveRow } from '../../data/DataTableData';
import { aggregateTablePassiveRows } from '../../passives/effectParser';
import { PassiveStats } from '../../damage/model';

export interface TablePassiveSelectorProps {
  selectedIds: string[];
  onChange: (ids: string[], aggregated: { stats: Partial<PassiveStats>; moreDamage: number[] }) => void;
}

const TablePassiveSelector: React.FC<TablePassiveSelectorProps> = ({ selectedIds, onChange }) => {
  const [query, setQuery] = useState('');
  const filtered: TablePassiveRow[] = useMemo(() => {
    const q = query.toLowerCase();
    return TABLE_PASSIVES.filter(p => p.name.toLowerCase().includes(q) || p.effect.toLowerCase().includes(q));
  }, [query]);

  const agg = useMemo(() => aggregateTablePassiveRows(TABLE_PASSIVES, selectedIds), [selectedIds]);

  const toggle = (id: string) => {
    const next = selectedIds.includes(id) ? selectedIds.filter(x => x !== id) : [...selectedIds, id];
    onChange(next, aggregateTablePassiveRows(TABLE_PASSIVES, next));
  };

  const clear = () => onChange([], { stats: {}, moreDamage: [] });
  const selectAllShown = () => {
    const all = filtered.map(f => f.id);
    onChange(all, aggregateTablePassiveRows(TABLE_PASSIVES, all));
  };

  return (
    <div style={{ background:'#1e1e1e', color:'#fff', padding:'0.75rem', borderRadius:8, display:'flex', flexDirection:'column', gap:8 }}>
      <h2>Table Passives</h2>
      <div style={{ display:'flex', gap:8, flexWrap:'wrap' }}>
        <input value={query} onChange={e => setQuery(e.target.value)} placeholder='Search…' style={{ background:'#222', color:'#fff', border:'1px solid #444', borderRadius:4, padding:'4px 8px' }} />
        <button onClick={selectAllShown}>Select All Shown</button>
        <button onClick={clear}>Clear</button>
        <span style={{ fontSize:'0.7rem', opacity:0.7 }}>Selected: {selectedIds.length}</span>
      </div>
      <div style={{ maxHeight:220, overflow:'auto', display:'flex', flexDirection:'column', gap:4 }}>
        {filtered.map(row => (
          <label key={row.id} style={{ background:'#262626', padding:'4px 6px', borderRadius:4, display:'flex', flexDirection:'column', cursor:'pointer' }}>
            <div style={{ display:'flex', alignItems:'center', gap:6 }}>
              <input type='checkbox' checked={selectedIds.includes(row.id)} onChange={() => toggle(row.id)} />
              <strong style={{ color: row.type === 'Notable' ? '#c58602' : row.type === 'Keystone' ? '#d14' : '#fff' }}>{row.name}</strong>
              <span style={{ fontSize:'0.6rem', opacity:0.7 }}>{row.type}</span>
            </div>
            <span style={{ fontSize:'0.65rem', opacity:0.85 }}>{row.effect}</span>
          </label>
        ))}
        {filtered.length === 0 && <div style={{ fontSize:'0.7rem', opacity:0.7 }}>No matches.</div>}
      </div>
      <div style={{ marginTop:8 }}>
        <h3 style={{ fontSize:'0.85rem', margin:'4px 0' }}>Aggregated Stats</h3>
        <div style={{ display:'flex', flexWrap:'wrap', gap:6 }}>
          {Object.entries(agg.stats).map(([k,v]) => <span key={k} style={{ background:'#2a2a2a', padding:'3px 6px', borderRadius:4, fontSize:'0.6rem' }}>{k}:{v}</span>)}
          {agg.moreDamage.length > 0 && <span style={{ background:'#2a2a2a', padding:'3px 6px', borderRadius:4, fontSize:'0.6rem' }}>moreDamage:{agg.moreDamage.join('+')}</span>}
          {Object.keys(agg.stats).length === 0 && agg.moreDamage.length === 0 && <span style={{ fontSize:'0.6rem', opacity:0.6 }}>None</span>}
        </div>
      </div>
    </div>
  );
};

export default TablePassiveSelector;
