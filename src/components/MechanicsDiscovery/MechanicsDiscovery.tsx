// Mechanics Discovery — dissect skill / support / passive wordings into
// emit→consume tokens and surface real synergy chains. The goal: understand
// the *principle* (e.g. "a crit source feeds Cast-on-Crit which fires a
// high-base spell"), then let those principles seed unknown builds.

import React, { useMemo, useState } from 'react';
import { discoverChains, ChainLink } from '../../mechanics/chains';
import { TOKEN_LABEL, Token } from '../../mechanics/tokens';
import { ARCHETYPES, LEVER_COLOR, LEVER_LABEL } from '../../mechanics/archetypes';
import './MechanicsDiscovery.css';

const STATUS_COLOR: Record<string, string> = { proven: '#4ad6a0', candidate: '#f5b740', theoretical: '#9c9279' };
const PROFILE_COLOR: Record<string, string> = { 'single-target': '#ec5a52', clear: '#5fd6cd', both: '#f1d6a0' };

function ArchetypeMap() {
  // Group archetypes by the classes that run them (an archetype can list more
  // than one; show it under each).
  const byClass = new Map<string, typeof ARCHETYPES>();
  for (const a of ARCHETYPES) {
    for (const cls of a.classes) {
      if (!byClass.has(cls)) byClass.set(cls, []);
      byClass.get(cls)!.push(a);
    }
  }
  return (
    <div className="mech-arch">
      <p className="mech-arch-intro">
        The damage archetypes per character type — what each build's damage
        actually comes from, where it's worth investing, and the open question
        where a NEW mechanic might live. <strong>This is the targeting map.</strong>
      </p>
      {Array.from(byClass.entries()).sort().map(([cls, list]) => (
        <section key={cls} className="mech-arch-class">
          <h3>{cls}</h3>
          {list.map((a) => (
            <div className="mech-arch-card" key={a.id + cls}>
              <div className="mech-arch-head">
                <span className="mech-arch-name">{a.name}</span>
                <span className="mech-arch-badge" style={{ color: STATUS_COLOR[a.status] }}>{a.status}</span>
                <span className="mech-arch-badge" style={{ color: PROFILE_COLOR[a.profile] }}>{a.profile}</span>
              </div>
              <div className="mech-arch-chain">{a.chain}</div>
              {a.evidence && <div className="mech-arch-evidence">▸ {a.evidence}</div>}
              <div className="mech-arch-levers">
                {a.levers.map((l, i) => (
                  <div className="mech-arch-lever" key={i}>
                    <span className="mech-arch-lever-w" style={{ color: LEVER_COLOR[l.weight] }}>{LEVER_LABEL[l.weight]}</span>
                    <span className="mech-arch-lever-name">{l.lever}</span>
                    <span className="mech-arch-lever-note">{l.note}</span>
                  </div>
                ))}
              </div>
              {a.discover && <div className="mech-arch-discover">🔍 discover: {a.discover}</div>}
            </div>
          ))}
        </section>
      ))}
    </div>
  );
}

const KIND_COLOR: Record<string, string> = {
  skill: '#5fd6cd',
  support: '#c9a9e0',
  meta: '#f1d6a0',
  keystone: '#e0913f',
  ascendancy: '#ec5a52',
  passive: '#8f8a76',
};

export default function MechanicsDiscovery() {
  const result = useMemo(() => discoverChains(), []);
  const [tokenFilter, setTokenFilter] = useState<Token | 'all'>('all');
  const [query, setQuery] = useState('');
  const [tab, setTab] = useState<'archetypes' | 'chains'>('archetypes');

  const tokensWithChains = useMemo(() => {
    const set = new Set<Token>();
    result.chains.forEach((c) => set.add(c.token));
    return Array.from(set);
  }, [result.chains]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return result.chains.filter((c) => {
      if (tokenFilter !== 'all' && c.token !== tokenFilter) return false;
      if (q && !(`${c.source.name} ${c.sink.name} ${c.principle}`.toLowerCase().includes(q))) return false;
      return true;
    });
  }, [result.chains, tokenFilter, query]);

  // Group filtered chains by token so each "principle" is its own section.
  const grouped = useMemo(() => {
    const map = new Map<Token, ChainLink[]>();
    for (const c of filtered) {
      if (!map.has(c.token)) map.set(c.token, []);
      map.get(c.token)!.push(c);
    }
    return Array.from(map.entries()).sort((a, b) => b[1][0].weight - a[1][0].weight);
  }, [filtered]);

  return (
    <div className="mech-root">
      <header className="mech-head">
        <h2>Mechanics Discovery</h2>
        <p>
          The targeting map for build discovery. <strong>Archetypes</strong>
          lays out, per character type, what each build's damage comes from and
          where the open questions are. <strong>Chains</strong> dissects every
          gem wording into emit→consume tokens and surfaces raw synergy
          candidates.
        </p>
        <div className="mech-tabs">
          <button className={`mech-tab ${tab === 'archetypes' ? 'active' : ''}`} onClick={() => setTab('archetypes')}>Archetypes</button>
          <button className={`mech-tab ${tab === 'chains' ? 'active' : ''}`} onClick={() => setTab('chains')}>Chains ({result.chains.length})</button>
        </div>
      </header>

      {tab === 'archetypes' && <ArchetypeMap />}

      {tab === 'chains' && <>
      <div className="mech-controls">
        <button
          className={`mech-chip ${tokenFilter === 'all' ? 'active' : ''}`}
          onClick={() => setTokenFilter('all')}
        >
          All principles
        </button>
        {tokensWithChains.map((t) => (
          <button
            key={t}
            className={`mech-chip ${tokenFilter === t ? 'active' : ''}`}
            onClick={() => setTokenFilter(t)}
          >
            {TOKEN_LABEL[t]}
          </button>
        ))}
        <input
          className="mech-search"
          placeholder="Search a gem or principle…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
      </div>

      <div className="mech-groups">
        {grouped.map(([token, chains]) => (
          <section key={token} className="mech-group">
            <div className="mech-group-head">
              <span className="mech-token">{TOKEN_LABEL[token]}</span>
              <span className="mech-weight">impact {chains[0].weight}</span>
              <span className="mech-count">{chains.length} chains</span>
            </div>
            <p className="mech-principle">{chains[0].principle}</p>
            <div className="mech-chain-list">
              {chains.slice(0, 40).map((c, i) => (
                <div className="mech-chain" key={i}>
                  <span className="mech-node" style={{ color: KIND_COLOR[c.source.kind] }}>
                    {c.source.name}
                    <small>{c.source.kind} · {c.source.why}</small>
                  </span>
                  <span className="mech-arrow">{TOKEN_LABEL[c.token]} →</span>
                  <span className="mech-node" style={{ color: KIND_COLOR[c.sink.kind] }}>
                    {c.sink.name}
                    <small>{c.sink.kind} · {c.sink.why}</small>
                  </span>
                </div>
              ))}
              {chains.length > 40 && (
                <div className="mech-more">+ {chains.length - 40} more — narrow with search</div>
              )}
            </div>
          </section>
        ))}
        {grouped.length === 0 && <div className="mech-empty">No chains match.</div>}
      </div>
      </>}
    </div>
  );
}
