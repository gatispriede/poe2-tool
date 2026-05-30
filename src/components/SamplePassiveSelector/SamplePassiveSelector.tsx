import React, { useEffect, useState, useMemo } from 'react';
import { PassiveStats } from '../../damage/model';

export interface SamplePassiveRecord {
  id: string;
  name: string;
  type: string;
  effect: string;
  stats: Partial<PassiveStats>;
  moreDamage: number[];
  calculation: { physMultiplier: number };
}

interface SamplePassiveSelectorProps {
  onChange: (aggregated: { stats: Partial<PassiveStats>; moreDamage: number[] }, selectedIds: string[]) => void;
}

const SamplePassiveSelector: React.FC<SamplePassiveSelectorProps> = ({ onChange }) => {
  const [data, setData] = useState<SamplePassiveRecord[]>([]);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [query, setQuery] = useState('');

  useEffect(() => {
    // Dynamic import of generated JSON (bundled at build time)
    import('../../passives/sample_passive_skills.json')
      .then(mod => {
        const raw = (mod as any).default || (mod as any);
        const seen = new Map<string, number>();
        const normalized: SamplePassiveRecord[] = raw.map((r: SamplePassiveRecord) => {
          const count = seen.get(r.id) ?? 0;
          seen.set(r.id, count + 1);
          if (count === 0) return r;
          return { ...r, id: `${r.id}-${count + 1}` };
        });
        setData(normalized);
      })
      .catch(() => setData([]));
  }, []);

  const filtered = useMemo(() => {
    const q = query.toLowerCase();
    return data.filter(r => r.name.toLowerCase().includes(q) || r.effect.toLowerCase().includes(q));
  }, [data, query]);

  const aggregated = useMemo(() => {
    const stats: Partial<PassiveStats> = {};
    const moreDamage: number[] = [];
    for (const id of selectedIds) {
      const node = data.find(d => d.id === id);
      if (!node) continue;
      for (const [k, v] of Object.entries(node.stats)) {
        const key = k as keyof PassiveStats;
        if (Array.isArray(v)) {
          // Handle array properties
          if (!stats[key]) {
            (stats[key] as any) = [...v];
          } else if (Array.isArray(stats[key])) {
            (stats[key] as any) = [...(stats[key] as any[]), ...v];
          }
        } else if (typeof v === 'number') {
          // Handle number properties
          if (stats[key] === undefined) {
            (stats[key] as any) = v;
          } else if (typeof stats[key] === 'number') {
            (stats[key] as any) = (stats[key] as number) + v;
          }
        }
      }
      moreDamage.push(...node.moreDamage);
    }
    return { stats, moreDamage };
  }, [selectedIds, data]);

  useEffect(() => {
    onChange(aggregated, selectedIds);
  }, [aggregated, selectedIds, onChange]);

  const toggle = (id: string) => {
    setSelectedIds(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
  };

  const clear = () => setSelectedIds([]);
  const selectAllFiltered = () => setSelectedIds(filtered.map(f => f.id));

  return (
    <div style={{ background:'#1c1c1c', padding: '0.75rem', borderRadius:8, display:'flex', flexDirection:'column', gap:8 }}>
      <h2 style={{ margin:0, fontSize:'1rem' }}>Sample HTML Passives</h2>
      <div style={{ display:'flex', gap:8, flexWrap:'wrap' }}>
        <input value={query} onChange={e => setQuery(e.target.value)} placeholder='Search…' style={{ background:'#222', color:'#fff', border:'1px solid #444', borderRadius:4, padding:'4px 8px' }} />
        <button onClick={selectAllFiltered}>Select All Shown</button>
        <button onClick={clear}>Clear</button>
        <span style={{ fontSize:'0.7rem', opacity:0.7 }}>Selected {selectedIds.length}</span>
      </div>
      <div style={{ maxHeight:220, overflow:'auto', display:'grid', gap:4 }}>
        {filtered.map(rec => (
          <label key={rec.id} style={{ background:'#262626', padding:'4px 6px', borderRadius:4, cursor:'pointer', display:'flex', flexDirection:'column', gap:2 }}>
            <div style={{ display:'flex', alignItems:'center', gap:6 }}>
              <input type='checkbox' checked={selectedIds.includes(rec.id)} onChange={() => toggle(rec.id)} />
              <strong style={{ fontSize:'0.75rem', color: rec.type === 'Notable' ? '#c58602' : rec.type === 'Keystone' ? '#d14' : '#fff' }}>{rec.name}</strong>
              <span style={{ fontSize:'0.55rem', opacity:0.6 }}>{rec.type}</span>
            </div>
            <span style={{ fontSize:'0.6rem', opacity:0.85 }}>{rec.effect}</span>
          </label>
        ))}
        {filtered.length === 0 && <div style={{ fontSize:'0.65rem', opacity:0.6 }}>No matches.</div>}
      </div>
      <div>
        <h3 style={{ fontSize:'0.8rem', margin:'4px 0' }}>Aggregated</h3>
        <div style={{ display:'flex', flexWrap:'wrap', gap:6 }}>
          {Object.entries(aggregated.stats).map(([k,v]) => <span key={k} style={{ background:'#2a2a2a', padding:'3px 6px', borderRadius:4, fontSize:'0.55rem' }}>{k}:{v}</span>)}
          {aggregated.moreDamage.length > 0 && <span style={{ background:'#2a2a2a', padding:'3px 6px', borderRadius:4, fontSize:'0.55rem' }}>more:{aggregated.moreDamage.join('+')}</span>}
          {Object.keys(aggregated.stats).length === 0 && aggregated.moreDamage.length === 0 && <span style={{ fontSize:'0.55rem', opacity:0.6 }}>None</span>}
        </div>
      </div>
    </div>
  );
};

export default SamplePassiveSelector;
