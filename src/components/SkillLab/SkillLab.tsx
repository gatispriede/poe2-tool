import React, { useMemo, useState } from 'react';
import './SkillLab.css';
import { loadDataset, datasetManifest } from '../../engine/dataset.browser';
import { buildSources } from '../../engine/sources';
import { analyzeSkill, SourceMatch } from '../../engine/skillIndex';
import { buildSkillProfile } from '../../engine/skillProfile';
import { findSynergies, profilesFor, SynergyLink } from '../../engine/synergy';
import { BuildContext, DEFAULT_CONTEXT } from '../../engine/scoring';
import { Bucket, RawSkill, SkillProfile } from '../../engine/types';

type View = Bucket | 'synergy';

const BUCKET_TABS: { id: View; label: string; help: string }[] = [
  {
    id: 'damage',
    label: 'Damage',
    help: 'Everything that makes a single use of this skill hit harder: increases and more-multipliers that reach it, crit, penetration, added damage, and the ailment scaling it can actually inflict.',
  },
  {
    id: 'aoe',
    label: 'Area & coverage',
    help: 'Everything that makes one use of the skill reach more enemies — area of effect, extra projectiles, chains, pierce and reach. Coverage is throughput, so it is scored on its own axis rather than folded into damage.',
  },
  {
    id: 'speed',
    label: 'Application speed',
    help: 'Everything that gets the damage onto the enemy sooner: cast and attack speed, cooldown recovery, ailment buildup, and modifiers that make damaging ailments deal their total faster.',
  },
  {
    id: 'utility',
    label: 'Sustain & defence',
    help: 'Sources that keep you alive or keep the skill castable. They do not scale the hit, so they are ranked separately and never inflate the damage list.',
  },
  {
    id: 'synergy',
    label: 'Skills to pair',
    help: 'Skills that produce what this one consumes, or consume what this one produces — trigger hosts, corpse suppliers, exposure and curse appliers, ailment payloads.',
  },
];

const pct = (v: number) => `${v >= 0 ? '+' : ''}${(v * 100).toFixed(1)}%`;

function SkillHeader({ profile }: { profile: SkillProfile }) {
  const stats: [string, string][] = [];
  if (profile.castTime) stats.push(['cast time', `${profile.castTime}s`]);
  if (profile.cooldown) stats.push(['cooldown', `${profile.cooldown}s`]);
  if (profile.baseDamage.max) stats.push(['base hit', `${profile.baseDamage.min}–${profile.baseDamage.max}`]);
  if (profile.areaRadius) stats.push(['radius', String(profile.areaRadius)]);
  if (profile.projectiles) stats.push(['projectiles', String(profile.projectiles)]);
  if (profile.duration) stats.push(['duration', `${profile.duration}s`]);
  if (profile.damageTypes.length) stats.push(['deals', profile.damageTypes.join(' / ')]);
  if (profile.weaponTypes.length) stats.push(['weapons', profile.weaponTypes.join(', ')]);

  return (
    <div className="lab-profile">
      <div className="lab-tagrow">
        {[...profile.tags].map((tag) => (
          <span key={tag} className={`lab-tag ${['spell', 'attack', 'minion', 'totem'].includes(tag) ? 'type' : ''}`}>
            {tag}
          </span>
        ))}
      </div>
      <div className="lab-stats">
        {stats.map(([label, value]) => (
          <span key={label}>{label} <b>{value}</b></span>
        ))}
      </div>
      {profile.description && <p className="lab-subtitle" style={{ marginTop: 10 }}>{profile.description}</p>}
      <div className="lab-mechanics">
        <div>produces <code>{[...profile.emits].join(', ') || '—'}</code></div>
        <div>needs <code>{[...profile.consumes].join(', ') || '—'}</code></div>
      </div>
    </div>
  );
}

function SourceRow({ match }: { match: SourceMatch }) {
  const gain = match.total.dps || match.total.aoe || match.total.rate || match.total.utility;
  const leading = match.matches.reduce((a, b) =>
    (Math.abs(b.score.dps) + Math.abs(b.score.aoe) > Math.abs(a.score.dps) + Math.abs(a.score.aoe) ? b : a));
  const reason = leading.applicability.reasons[0];
  return (
    <div className="lab-row">
      <span className={`lab-dot ${match.strength}`}>●</span>
      <span className="lab-kind">{match.source.kind}</span>
      <div>
        <div className="lab-name">{match.source.name}</div>
        <div className="lab-lines">
          {match.source.raw.slice(0, 3).map((line, i) => (
            <span key={i}>{line.replace(/\{[^}]*\}/g, '')}</span>
          ))}
        </div>
        {reason && match.strength !== 'direct' && <div className="lab-reason">↳ {reason}</div>}
        {leading.score.note && <div className="lab-note">{leading.score.note}</div>}
      </div>
      <div className={`lab-gain ${gain < 0 ? 'negative' : ''}`}>{pct(gain)}</div>
      <div className="lab-cost">{match.costLabel}</div>
    </div>
  );
}

function SynergyColumn({ title, links }: { title: string; links: SynergyLink[] }) {
  return (
    <div className="lab-synergy-col">
      <h3>{title}</h3>
      {!links.length && <div className="lab-empty">nothing in the data pairs this way.</div>}
      {links.map((link) => (
        <div key={link.partner.id} className="lab-synergy-row">
          <b>{link.partner.name}</b>
          <span className="lab-synergy-rule">{link.rule.label} · {link.token}</span>
          <div className="lab-synergy-why">{link.why}</div>
        </div>
      ))}
    </div>
  );
}

export default function SkillLab() {
  const dataset = useMemo(() => loadDataset(), []);
  const actives = useMemo(
    () => dataset.skills.filter((s) => !s.isSupport && !!s.name && (s.skillTypes ?? []).length)
      .sort((a, b) => a.name.localeCompare(b.name)),
    [dataset],
  );
  const partners = useMemo(() => profilesFor(dataset.skills), [dataset]);

  const [search, setSearch] = useState('');
  const [skillId, setSkillId] = useState<string>(() =>
    (actives.find((s) => s.name === 'Spark') ?? actives[0]).id);
  const [view, setView] = useState<View>('damage');
  const [classId, setClassId] = useState<string>('');
  const [delivery, setDelivery] = useState<'self' | 'totem' | 'trap' | 'mine'>('self');
  const [kinds, setKinds] = useState<Record<string, boolean>>({
    tree: true, item: true, support: true,
  });
  const [ctx, setCtx] = useState<BuildContext>(DEFAULT_CONTEXT);

  const sources = useMemo(() => buildSources(dataset, classId || undefined), [dataset, classId]);

  const rawSkill = useMemo(
    () => actives.find((s) => s.id === skillId) as RawSkill,
    [actives, skillId],
  );

  const filteredSources = useMemo(() => sources.all.filter((s) => {
    if (s.kind === 'support') return kinds.support;
    if (s.kind === 'itemMod' || s.kind === 'unique') return kinds.item;
    return kinds.tree;
  }), [sources, kinds]);

  const analysis = useMemo(
    () => analyzeSkill(rawSkill, filteredSources, {
      context: ctx,
      skillContext: { delivery },
      limitPerBucket: 60,
    }),
    [rawSkill, filteredSources, ctx, delivery],
  );

  const synergy = useMemo(
    () => findSynergies(buildSkillProfile(rawSkill), partners, { limit: 20 }),
    [rawSkill, partners],
  );

  const visible = useMemo(() => actives.filter((s) => {
    if (!search) return true;
    const q = search.toLowerCase();
    return s.name.toLowerCase().includes(q)
      || (s.skillTypes ?? []).some((t) => t.toLowerCase().includes(q));
  }), [actives, search]);

  const activeTab = BUCKET_TABS.find((t) => t.id === view)!;
  const numberField = (label: string, key: keyof BuildContext, step = 10) => (
    <label className="lab-field" key={key}>
      <span>{label}</span>
      <input
        type="number"
        step={step}
        value={ctx[key] as number}
        onChange={(e) => setCtx({ ...ctx, [key]: Number(e.target.value) })}
      />
    </label>
  );

  return (
    <div className="lab">
      <aside className="lab-picker">
        <div className="lab-picker-search">
          <input
            value={search}
            placeholder="search skills or tags…"
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <div className="lab-picker-list">
          {visible.map((s) => (
            <button
              key={s.id}
              className={`lab-picker-item ${s.id === skillId ? 'active' : ''}`}
              onClick={() => setSkillId(s.id)}
            >
              {s.name}
              <small>{(s.skillTypes ?? []).slice(0, 4).join(' · ')}</small>
            </button>
          ))}
        </div>
      </aside>

      <main className="lab-main">
        <h1 className="lab-title">{analysis.skill.name}</h1>
        <p className="lab-subtitle">
          Every passive, item mod, unique and support gem in the dataset, tested against this
          skill&apos;s own tags and scored as a marginal gain over the baseline build you set below.
        </p>

        <SkillHeader profile={analysis.skill} />

        <div className="lab-controls">
          <label className="lab-field">
            <span>price tree from</span>
            <select value={classId} onChange={(e) => setClassId(e.target.value)}>
              <option value="">cheapest class</option>
              {dataset.tree.classes.map((c) => (
                <option key={c.internalId} value={c.internalId}>{c.name}</option>
              ))}
            </select>
          </label>
          <label className="lab-field">
            <span>delivered by</span>
            <select value={delivery} onChange={(e) => setDelivery(e.target.value as typeof delivery)}>
              <option value="self">yourself</option>
              <option value="totem">totem</option>
              <option value="trap">trap</option>
              <option value="mine">mine</option>
            </select>
          </label>
          {numberField('baseline increased dmg', 'increasedDamage')}
          {numberField('baseline increased speed', 'increasedSpeed')}
          {numberField('baseline increased area', 'increasedArea')}
          {numberField('enemy resistance', 'enemyResistance', 0.05)}
          <div className="lab-field">
            <span>sources</span>
            <div style={{ display: 'flex', gap: 10 }}>
              {(['tree', 'item', 'support'] as const).map((k) => (
                <label key={k}>
                  <input
                    type="checkbox"
                    checked={kinds[k]}
                    onChange={(e) => setKinds({ ...kinds, [k]: e.target.checked })}
                  />
                  {k}
                </label>
              ))}
            </div>
          </div>
        </div>

        <div className="lab-tabs">
          {BUCKET_TABS.map((tab) => (
            <button
              key={tab.id}
              className={`lab-tab ${view === tab.id ? 'active' : ''}`}
              onClick={() => setView(tab.id)}
            >
              {tab.label}
              {tab.id !== 'synergy' && (
                <span className="count">{analysis.counts[tab.id as Bucket]}</span>
              )}
            </button>
          ))}
        </div>

        <p className="lab-bucket-help">{activeTab.help}</p>

        {view === 'synergy' ? (
          <div className="lab-synergy-cols">
            <SynergyColumn title="Skills that enable or amplify this one" links={synergy.enablers} />
            <SynergyColumn title="Skills this one enables or amplifies" links={synergy.enabled} />
          </div>
        ) : (
          <div className="lab-rows">
            {!analysis.buckets[view as Bucket].length && (
              <div className="lab-empty">nothing in the dataset scales this skill on this axis.</div>
            )}
            {analysis.buckets[view as Bucket].map((match) => (
              <SourceRow key={match.source.id} match={match} />
            ))}
          </div>
        )}

        <p className="lab-footnote">
          <span style={{ color: '#4caf50' }}>●</span> applies directly ·{' '}
          <span style={{ color: '#d3a02a' }}>●</span> conditional, scored at assumed uptime ·{' '}
          <span style={{ color: '#9b6ad4' }}>●</span> needs a build decision (totem / trap / mine).
          <br />
          Gains are marginal against the baseline above — a 10% increase is worth far less on a
          build that already has 400% increased damage than on one with 100%. Weapon-local mods are
          scored in the weapon&apos;s own bucket and hidden from spells entirely.
          <br />
          Data: Path of Building commit {(datasetManifest.sourceCommit ?? '?').slice(0, 8)},
          generated {datasetManifest.generatedAt ?? 'unknown'}.
        </p>
      </main>
    </div>
  );
}
