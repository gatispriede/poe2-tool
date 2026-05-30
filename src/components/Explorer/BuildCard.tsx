import React, { useState } from 'react';
import { ExplorerResult } from './Explorer';
import { ParsedItem, ParsedGem } from '../../validation/types';
import { buildPob2Xml, compressToPobCode } from './pob2Export';
import treeJson from '../../data/generated/passive-tree.json';

interface TreeNode {
  id: number;
  name?: string;
  stats?: string[];
  isNotable?: boolean;
  isKeystone?: boolean;
  isMastery?: boolean;
  isAscendancyStart?: boolean;
  ascendancyName?: string;
}
const TREE_NODES = (treeJson as { nodes: Record<string, TreeNode> }).nodes;

interface Props {
  rank: number;
  result: ExplorerResult;
  skillsById: Record<string, { isSupport: boolean }>;
}

// Slot display order — weapons first, then armour, then jewellery.
const SLOT_ORDER = [
  'Weapon 1', 'Weapon 2',
  'Helmet', 'Body Armour', 'Gloves', 'Boots',
  'Belt', 'Amulet', 'Ring 1', 'Ring 2',
  'Flask 1', 'Flask 2', 'Charm 1', 'Charm 2', 'Charm 3',
];

function fmt(n: number): string {
  if (n >= 1e6) return `${(n / 1e6).toFixed(2)}M`;
  if (n >= 1e3) return `${(n / 1e3).toFixed(1)}k`;
  return n.toFixed(0);
}

function rarityClass(item: ParsedItem): string {
  const r = (item.rarity || '').toLowerCase();
  if (r === 'unique') return 'item-unique';
  if (r === 'rare') return 'item-rare';
  if (r === 'magic') return 'item-magic';
  return 'item-normal';
}

const SlotItem: React.FC<{ slot: string; item: ParsedItem }> = ({ slot, item }) => (
  <div className={`build-card-slot ${rarityClass(item)}`}>
    <div className="build-card-slot-head">
      <span className="build-card-slot-name">{slot}</span>
      <span className="build-card-slot-item">
        {item.name && item.name !== item.base ? `${item.name} ` : ''}
        <span className="build-card-slot-base">{item.base}</span>
      </span>
    </div>
    {item.implicits.length > 0 && (
      <ul className="build-card-slot-mods build-card-slot-implicits">
        {item.implicits.map((m, i) => <li key={`i${i}`}>{m}</li>)}
      </ul>
    )}
    {item.explicits.length > 0 && (
      <ul className="build-card-slot-mods">
        {item.explicits.map((m, i) => <li key={`e${i}`}>{m}</li>)}
      </ul>
    )}
    {item.runes && item.runes.length > 0 && (
      <ul className="build-card-slot-mods build-card-slot-runes">
        {item.runes.map((r, i) => <li key={`r${i}`}>{r}</li>)}
      </ul>
    )}
  </div>
);

const SkillGem: React.FC<{ gem: ParsedGem; isActive: boolean }> = ({ gem, isActive }) => (
  <div className={`build-card-gem ${isActive ? 'active' : 'support'}`}>
    <span className="build-card-gem-name">{gem.nameSpec || gem.skillId || '?'}</span>
    {gem.level != null && <span className="build-card-gem-lvl">Lv {gem.level}</span>}
    {gem.quality > 0 && <span className="build-card-gem-q">+{gem.quality}%q</span>}
  </div>
);

const BuildCard: React.FC<Props> = ({ rank, result, skillsById }) => {
  const [expanded, setExpanded] = useState(false);
  const [pobCode, setPobCode] = useState<string | null>(null);
  const [pobCopying, setPobCopying] = useState(false);
  const [pobCopied, setPobCopied] = useState(false);
  const [pobError, setPobError] = useState<string | null>(null);
  const { build, breakdown } = result;
  const weaponItem = build.build.equipped['Weapon 1'];
  const group = build.build.skillGroups.find(g => g.gems.some(x => x.skillId === build.skillId));
  const activeGem = group?.gems.find(g => g.skillId === build.skillId);
  const supportGems = (group?.gems ?? []).filter(g => g.skillId && skillsById[g.skillId]?.isSupport);

  const weaponLabel = build.weaponRarity === 'UNIQUE'
    ? `${build.weaponUniqueName} (${weaponItem.base})`
    : weaponItem.base;

  // Stable list of equipped slots, in the canonical order, plus any extras
  // the build carries that we don't have in SLOT_ORDER.
  const equippedSlots: string[] = [];
  for (const s of SLOT_ORDER) if (build.build.equipped[s]) equippedSlots.push(s);
  for (const s of Object.keys(build.build.equipped)) {
    if (!SLOT_ORDER.includes(s)) equippedSlots.push(s);
  }

  return (
    <div className="build-card">
      <div className="build-card-head" onClick={() => setExpanded(e => !e)}>
        <div className="build-card-rank">#{rank}</div>
        <div className="build-card-title">
          <div className="build-card-skill">
            {build.skillName}
            {build.triggerMode === 'cast_on_crit' && <span className="build-card-tag"> · CoC</span>}
            <span className={`build-card-rarity build-card-rarity-${build.weaponRarity.toLowerCase()}`}>
              {' '}· {build.weaponRarity}
            </span>
          </div>
          <div className="build-card-weapon">{weaponLabel}</div>
        </div>
        <div className="build-card-dps">
          <span className="build-card-dps-value">{fmt(build.dps)}</span>
          <span className="build-card-dps-unit">DPS</span>
        </div>
        <div className="build-card-toggle">{expanded ? '−' : '+'}</div>
      </div>

      {expanded && (
        <div className="build-card-body">
          <section>
            <h4>Skill setup</h4>
            <div className="build-card-skillgroup">
              {activeGem && <SkillGem gem={activeGem} isActive={true} />}
              {supportGems.map((g, i) => <SkillGem key={i} gem={g} isActive={false} />)}
            </div>
          </section>

          <section>
            <h4>Equipped items ({equippedSlots.length})</h4>
            <div className="build-card-slots">
              {equippedSlots.map(slot => (
                <SlotItem key={slot} slot={slot} item={build.build.equipped[slot]} />
              ))}
            </div>
          </section>

          <section>
            <h4>Level profile</h4>
            <div className="build-card-profile">
              <span>char Lv {build.characterLevel}</span>
              <span>gem Lv {build.gemLevel}</span>
              <span>{build.passivePoints} pts</span>
              <span>ilvl {build.itemLevel}</span>
            </div>
          </section>

          {(() => {
            const allocatedIds = build.build.trees[0].nodes;
            const nodes = allocatedIds.map(id => TREE_NODES[String(id)]).filter(Boolean);
            const keystones = nodes.filter(n => n.isKeystone);
            const notables = nodes.filter(n => n.isNotable && !n.isKeystone);
            const ascendancy = notables.filter(n => n.ascendancyName);
            const mainNotables = notables.filter(n => !n.ascendancyName);
            const masteries = nodes.filter(n => n.isMastery);
            const smallCount = nodes.length - keystones.length - notables.length - masteries.length;
            return (
              <section>
                <h4>Passive tree ({allocatedIds.length} nodes)</h4>
                <div className="build-card-tree-summary">
                  <span>{keystones.length} keystones</span>
                  <span>{mainNotables.length} notables</span>
                  {ascendancy.length > 0 && <span>{ascendancy.length} ascendancy</span>}
                  {smallCount > 0 && <span>{smallCount} small</span>}
                </div>
                {keystones.length > 0 && (
                  <div className="build-card-tree-group">
                    <div className="build-card-tree-label">Keystones</div>
                    <ul className="build-card-tree-list">
                      {keystones.map(k => (
                        <li key={k.id} className="build-card-tree-keystone">
                          <strong>{k.name}</strong>
                          {k.stats && k.stats.map((s, i) => <div key={i} className="build-card-tree-stat">{s}</div>)}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
                {mainNotables.length > 0 && (
                  <details className="build-card-tree-details">
                    <summary>{mainNotables.length} notable nodes</summary>
                    <ul className="build-card-tree-list">
                      {mainNotables.map(n => (
                        <li key={n.id}>
                          <strong>{n.name}</strong>
                          {n.stats && n.stats.map((s, i) => <div key={i} className="build-card-tree-stat">{s}</div>)}
                        </li>
                      ))}
                    </ul>
                  </details>
                )}
                {ascendancy.length > 0 && (
                  <details className="build-card-tree-details">
                    <summary>{ascendancy.length} ascendancy nodes</summary>
                    <ul className="build-card-tree-list">
                      {ascendancy.map(n => (
                        <li key={n.id}>
                          <strong>{n.name}</strong> <em>({n.ascendancyName})</em>
                          {n.stats && n.stats.map((s, i) => <div key={i} className="build-card-tree-stat">{s}</div>)}
                        </li>
                      ))}
                    </ul>
                  </details>
                )}
              </section>
            );
          })()}

          <section>
            <h4>Path of Building 2 export</h4>
            <div className="build-card-pob">
              <button
                className="build-card-pob-btn"
                disabled={pobCopying}
                onClick={async () => {
                  setPobCopying(true);
                  setPobError(null);
                  setPobCopied(false);
                  try {
                    const xml = buildPob2Xml(build);
                    const code = await compressToPobCode(xml);
                    if (!code) {
                      setPobError('Your browser does not support CompressionStream; raw XML shown below.');
                      setPobCode(xml);
                    } else {
                      setPobCode(code);
                      try {
                        await navigator.clipboard.writeText(code);
                        setPobCopied(true);
                        setTimeout(() => setPobCopied(false), 2000);
                      } catch {
                        // clipboard write may fail under non-https; user can still copy the textarea manually
                      }
                    }
                  } catch (e) {
                    setPobError(e instanceof Error ? e.message : String(e));
                  } finally {
                    setPobCopying(false);
                  }
                }}
              >
                {pobCopying ? 'Generating…' : pobCopied ? 'Copied to clipboard ✓' : 'Generate PoB2 import code'}
              </button>
              {pobError && <div className="build-card-pob-error">{pobError}</div>}
              {pobCode && (
                <>
                  <p className="build-card-pob-hint">
                    Paste this code into Path of Building 2 (<em>Import/Export Build → Import from string</em>)
                    or open it via{' '}
                    <a href={`https://pobb.in/${encodeURIComponent(pobCode)}`} target="_blank" rel="noreferrer">
                      pobb.in
                    </a>.
                  </p>
                  <textarea
                    className="build-card-pob-code"
                    readOnly
                    rows={4}
                    value={pobCode}
                    onClick={e => (e.target as HTMLTextAreaElement).select()}
                  />
                </>
              )}
            </div>
          </section>

          {breakdown && (
            <section>
              <h4>Damage breakdown</h4>
              <div className="build-card-breakdown">
                <div><span>Per-hit</span><strong>{fmt(breakdown.perHit)}</strong></div>
                <div><span>Hits/sec</span><strong>{breakdown.hitsPerSecond.toFixed(2)}</strong></div>
                <div><span>Crit multi</span><strong>{breakdown.expectedCritMultiplier.toFixed(2)}×</strong></div>
                <div><span>Weapon avg</span><strong>{breakdown.weaponAvgDamage.toFixed(0)}</strong></div>
              </div>
              <div className="build-card-scaling">
                <div><span>Increased</span><strong>+{breakdown.global.increasedDamagePct.toFixed(0)}%</strong></div>
                <div><span>More</span><strong>×{breakdown.global.moreDamageFactor.toFixed(2)}</strong></div>
                <div><span>Added/atk</span><strong>+{breakdown.global.addedFlatToAttacksAvg.toFixed(0)}</strong></div>
                <div><span>Extra</span><strong>+{breakdown.global.extraDamagePct.toFixed(0)}%</strong></div>
                <div><span>Atk speed</span><strong>+{breakdown.global.increasedAttackSpeedPct.toFixed(0)}% / ×{breakdown.global.moreAttackSpeedFactor.toFixed(2)}</strong></div>
                <div><span>Crit chance</span><strong>+{breakdown.global.increasedCritChancePct.toFixed(0)}%</strong></div>
              </div>
              {breakdown.notes.length > 0 && (
                <details className="build-card-notes">
                  <summary>Composer notes ({breakdown.notes.length})</summary>
                  <ul>{breakdown.notes.map((n, i) => <li key={i}>{n}</li>)}</ul>
                </details>
              )}
            </section>
          )}
        </div>
      )}
    </div>
  );
};

export default BuildCard;
