import React, { useState, useCallback, useMemo } from 'react';
import './Explorer.css';
import {
  generateTopBuildsForClass,
  GeneratedBuild,
  LEVEL_PROFILES,
  CLASS_PROFILE,
} from '../../generator/generateBuild';
import { composeDamage, ComposeBreakdown } from '../../damage-v2/composeDamage';
import skillsJson from '../../data/generated/skills.json';
import BuildCard from './BuildCard';

// Display order in the dropdown. Matches PoE2's own class-select ordering
// (martial first, then casters).
const CLASS_ORDER: string[] = [
  'Huntress', 'Ranger', 'Mercenary', 'Warrior', 'Monk', 'Druid', 'Witch', 'Sorceress',
];

// Short archetype labels for the dropdown subtitle.
const ARCHETYPE_LABEL: Record<string, string> = {
  'bow-attack':      'Bow attacks',
  'crossbow-attack': 'Crossbow attacks',
  'mace-attack':     'Mace attacks',
  'staff-attack':    'Quarterstaff attacks',
  'spell':           'Spells',
  'shapeshift-totem':'Shapeshift / Totem',
};

const LEVEL_OPTIONS = [50, 84, 90, 100] as const;
type LevelOption = typeof LEVEL_OPTIONS[number];
const LEVEL_LABEL: Record<LevelOption, string> = {
  50:  'Lv 50 · Campaign',
  84:  'Lv 84 · Mid-maps',
  90:  'Lv 90 · Endgame',
  100: 'Lv 100 · Max',
};

export interface ExplorerResult {
  build: GeneratedBuild;
  breakdown: ComposeBreakdown | null;
}

const skillsById: Record<string, { isSupport: boolean }> = {};
for (const s of skillsJson as { id: string; isSupport: boolean }[]) {
  skillsById[s.id] = s;
}

const Explorer: React.FC = () => {
  const [klass, setKlass] = useState<string>('Huntress');
  const [ascendancy, setAscendancy] = useState<string>(CLASS_PROFILE['Huntress'].defaultAscendancy);
  const [topN, setTopN] = useState(5);
  const [characterLevel, setCharacterLevel] = useState<LevelOption>(90);
  const [results, setResults] = useState<ExplorerResult[]>([]);
  const [running, setRunning] = useState(false);
  const [elapsedMs, setElapsedMs] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  const classProfile = CLASS_PROFILE[klass];
  // When the class changes, snap ascendancy back to that class's default
  // unless the user already picked one valid for the new class.
  const ascendancyOptions = useMemo(() => classProfile.ascendancies, [classProfile]);
  const effectiveAscendancy = ascendancyOptions.includes(ascendancy) ? ascendancy : classProfile.defaultAscendancy;

  const onClassChange = (next: string) => {
    setKlass(next);
    setAscendancy(CLASS_PROFILE[next].defaultAscendancy);
  };

  const run = useCallback(() => {
    setRunning(true);
    setError(null);
    setResults([]);
    // Defer to next tick so the "Discovering..." state can paint before the
    // synchronous generator blocks the main thread for a few seconds.
    setTimeout(() => {
      const t0 = performance.now();
      try {
        const builds = generateTopBuildsForClass(klass, topN, { characterLevel, ascendancy: effectiveAscendancy });
        const enriched: ExplorerResult[] = builds.map(b => {
          let breakdown: ComposeBreakdown | null = null;
          try {
            const idx = b.build.skillGroups.findIndex(g => g.gems.some(x => x.skillId === b.skillId));
            if (idx >= 0) {
              breakdown = composeDamage({
                build: b.build,
                skillGroupIndex: idx,
                skillId: b.skillId,
                triggerMode: b.triggerMode,
              });
            }
          } catch { /* breakdown is optional */ }
          return { build: b, breakdown };
        });
        setResults(enriched);
        setElapsedMs(performance.now() - t0);
      } catch (e) {
        setError(e instanceof Error ? e.message : String(e));
      } finally {
        setRunning(false);
      }
    }, 50);
  }, [klass, topN, characterLevel, effectiveAscendancy]);

  return (
    <div className="explorer">
      <header className="explorer-header">
        <h1>Build Explorer</h1>
        <p className="explorer-subtitle">
          Generate top-N highest-DPS builds per class. All outputs are in-game
          reproducible (validated against weapon-bases, item-mods, and skill data).
        </p>
      </header>

      <div className="explorer-controls">
        <label className="explorer-field">
          <span>Class</span>
          <select value={klass} onChange={e => onClassChange(e.target.value)} disabled={running}>
            {CLASS_ORDER.map(name => (
              <option key={name} value={name}>
                {name} · {ARCHETYPE_LABEL[CLASS_PROFILE[name].archetype]}
              </option>
            ))}
          </select>
        </label>

        <label className="explorer-field">
          <span>Ascendancy</span>
          <select value={effectiveAscendancy} onChange={e => setAscendancy(e.target.value)} disabled={running}>
            {ascendancyOptions.map(a => (
              <option key={a} value={a}>{a}</option>
            ))}
          </select>
        </label>

        <label className="explorer-field">
          <span>Top N</span>
          <input
            type="number"
            min={1}
            max={20}
            value={topN}
            onChange={e => setTopN(Math.max(1, Math.min(20, Number(e.target.value) || 1)))}
            disabled={running}
          />
        </label>

        <label className="explorer-field">
          <span>Character Level</span>
          <select
            value={characterLevel}
            onChange={e => setCharacterLevel(Number(e.target.value) as LevelOption)}
            disabled={running}
          >
            {LEVEL_OPTIONS.map(lv => (
              <option key={lv} value={lv}>{LEVEL_LABEL[lv]}</option>
            ))}
          </select>
        </label>

        <div className="explorer-field explorer-profile">
          <span>Profile</span>
          <div className="explorer-profile-pills">
            <span title="Active gem level">gem Lv {LEVEL_PROFILES[characterLevel].gemLevel}</span>
            <span title="Total passive points (level + quest grants)">{LEVEL_PROFILES[characterLevel].passivePoints} pts</span>
            <span title="Item level for mod / base eligibility">ilvl {LEVEL_PROFILES[characterLevel].itemLevel}</span>
          </div>
        </div>

        <button className="explorer-discover" onClick={run} disabled={running}>
          {running ? 'Discovering…' : 'Discover Builds'}
        </button>
      </div>

      {error && <div className="explorer-error">Error: {error}</div>}

      {!running && results.length > 0 && (
        <div className="explorer-meta">
          {results.length} build{results.length === 1 ? '' : 's'} for {klass} ({effectiveAscendancy}) at {LEVEL_LABEL[characterLevel]}
          {elapsedMs != null && <span> · {(elapsedMs / 1000).toFixed(1)}s</span>}
        </div>
      )}

      {running && (
        <div className="explorer-loading">
          Running generator over all candidate skills… (typically 2–10s)
        </div>
      )}

      <div className="explorer-results">
        {results.map((r, i) => (
          <BuildCard key={i} rank={i + 1} result={r} skillsById={skillsById} />
        ))}
      </div>

      {!running && !error && results.length === 0 && (
        <div className="explorer-empty">
          Press <strong>Discover Builds</strong> to generate top-N builds for the selected class.
        </div>
      )}
    </div>
  );
};

export default Explorer;
