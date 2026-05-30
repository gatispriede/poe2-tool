// Build explorer — jest-runnable entry point for discovering new builds.
//
// Not part of the normal test suite. Gated by EXPLORE=1 so `npm test` skips
// it. Invoke via:
//
//   npm run explore                        # all 4 classes, top 5, char Lv 100
//   CLASS=Huntress npm run explore         # one class
//   LEVEL=50 npm run explore               # campaign-stage build profile
//   LEVEL=84 npm run explore               # mid-mapping profile
//   LEVEL=90 npm run explore               # endgame profile
//   CLASS=Witch TOP_N=10 LEVEL=84 npm run explore
//   ITEM_LEVEL=86 npm run explore          # override default ilvl from profile
//
// The generator + composer code is the same as production; this file is
// only a runner + formatter.

import * as fs from 'fs';
import * as path from 'path';
import skills from '../data/generated/skills.json';

// Optional config sidecar: if .explore-env.json exists in cwd, merge into env.
// Lets sandboxed shells that can't pass env-prefix invocations still configure
// the run via a small JSON file.
try {
  const cfgPath = path.resolve(process.cwd(), '.explore-env.json');
  if (fs.existsSync(cfgPath)) {
    const cfg = JSON.parse(fs.readFileSync(cfgPath, 'utf8')) as Record<string, string>;
    for (const [k, v] of Object.entries(cfg)) {
      if (process.env[k] === undefined) process.env[k] = String(v);
    }
  }
} catch { /* ignore */ }
import {
  generateTopBuildsForClass,
  CLASS_PROFILE,
  GeneratedBuild,
} from '../generator/generateBuild';
import { composeDamage } from '../damage-v2/composeDamage';
import { coverageScore } from '../damage-v2/coverage';

interface SkillLike { id: string; name: string; skillTypes: string[]; constantStats?: [string, number][]; }

const RUN = process.env.EXPLORE === '1';
const TOP_N = Number(process.env.TOP_N || 5);
const CHAR_LEVEL = Number(process.env.LEVEL || 100);
const ITEM_LEVEL_OVERRIDE = process.env.ITEM_LEVEL ? Number(process.env.ITEM_LEVEL) : undefined;
const ASCENDANCY = process.env.ASCENDANCY;
const CLASS_FILTER = (process.env.CLASS || 'all').toLowerCase();

// Canonical class names by lowercase key for env-var ergonomics.
const CLASS_BY_KEY: Record<string, string> = {};
for (const name of Object.keys(CLASS_PROFILE)) CLASS_BY_KEY[name.toLowerCase()] = name;

const out = (s: string) => process.stdout.write(s + '\n');

function fmt(n: number): string {
  if (n >= 1e6) return `${(n / 1e6).toFixed(2)}M`;
  if (n >= 1e3) return `${(n / 1e3).toFixed(1)}k`;
  return n.toFixed(0);
}

function printBuild(rank: number, r: GeneratedBuild): void {
  const item = r.build.equipped['Weapon 1'];
  const grp = r.build.skillGroups.find(g => g.gems.some(x => x.skillId === r.skillId))!;
  const supports = grp.gems
    .filter(g => {
      if (!g.skillId) return false;
      const rec = (skills as { id: string; isSupport: boolean }[]).find(s => s.id === g.skillId);
      return rec && rec.isSupport;
    })
    .map(g => g.nameSpec);
  const weaponLabel = r.weaponRarity === 'UNIQUE'
    ? `${r.weaponUniqueName} (${item.base}) [UNIQUE]`
    : `${item.base} [RARE]`;
  const modeLabel = r.triggerMode === 'cast_on_crit' ? ' [via Cast on Critical]' : '';

  // Re-run composer with full breakdown to surface bucket info.
  let breakdown: ReturnType<typeof composeDamage> | null = null;
  try {
    const idx = r.build.skillGroups.findIndex(g => g.gems.some(x => x.skillId === r.skillId));
    if (idx >= 0) {
      breakdown = composeDamage({ build: r.build, skillGroupIndex: idx, skillId: r.skillId, triggerMode: r.triggerMode });
    }
  } catch { /* breakdown is optional */ }

  out(`\n  #${rank} ${r.skillName}${modeLabel}  (${fmt(r.dps)} DPS)`);
  out(`     weapon  : ${weaponLabel}`);
  if (r.weaponRarity === 'RARE') {
    for (const m of item.explicits) out(`       - ${m}`);
  }
  out(`     supports: ${supports.join(' / ') || '(none)'}`);
  out(`     tree    : ${r.build.trees[0].nodes.length} nodes`);
  if (breakdown) {
    const g = breakdown.global;
    out(`     hits    : 1st-hit=${fmt(breakdown.firstHitDps)}  ramped=${fmt(breakdown.rampedDps)} (once slow/poison/ailment on target)`);
    out(`     buckets : perHit=${fmt(breakdown.perHit)}  hps=${breakdown.hitsPerSecond.toFixed(2)}  critX=${breakdown.expectedCritMultiplier.toFixed(2)}`);
    out(`     scaling : +${g.increasedDamagePct.toFixed(0)}% inc  x${g.moreDamageFactor.toFixed(2)} more  +${g.addedFlatToAttacksAvg.toFixed(0)} added/atk  +${g.extraDamagePct.toFixed(0)}% extra`);
    if (breakdown.notes.length) out(`     notes   : ${breakdown.notes.slice(0, 3).join(' | ')}`);
  }

  // Clear-speed view: ailments apply freely to white packs, and one use hits
  // `coverage.targets` enemies. clearScore = white-tier DPS × targets.
  try {
    const idx = r.build.skillGroups.findIndex(g => g.gems.some(x => x.skillId === r.skillId));
    const skillRec = (skills as SkillLike[]).find(s => s.id === r.skillId);
    if (idx >= 0 && skillRec) {
      const whiteDps = composeDamage({ build: r.build, skillGroupIndex: idx, skillId: r.skillId, triggerMode: r.triggerMode, targetTier: 'white' }).dps;
      const cov = coverageScore(skillRec);
      const clear = whiteDps * cov.targets;
      out(`     clear   : ${fmt(clear)} pack-DPS  (~${cov.targets.toFixed(1)} targets/use: ${cov.label}${cov.confidence === 'low' ? ' · coverage under-counted (secondary hits not modelled)' : ''})`);
    }
  } catch { /* clear view is optional */ }
}

function printClass(className: string, builds: GeneratedBuild[]): void {
  const lvlLabel = builds[0]
    ? `char Lv ${builds[0].characterLevel} (gem Lv ${builds[0].gemLevel}, ${builds[0].passivePoints} pts, ilvl ${builds[0].itemLevel})`
    : `Lv ${CHAR_LEVEL}`;
  out(`\n=== ${className} — top ${builds.length} @ ${lvlLabel} ===`);
  if (!builds.length) {
    out('  (no viable builds)');
    return;
  }
  for (let i = 0; i < builds.length; i++) printBuild(i + 1, builds[i]);
}

(RUN ? describe : describe.skip)('explore', () => {
  const allKeys = Object.keys(CLASS_BY_KEY);
  const targets =
    CLASS_FILTER === 'all'
      ? allKeys
      : allKeys.filter(k => k === CLASS_FILTER);

  if (!targets.length) {
    it('rejects unknown class', () => {
      throw new Error(`Unknown CLASS=${CLASS_FILTER}. Choose one of: ${allKeys.join(', ')}`);
    });
    return;
  }

  for (const key of targets) {
    const className = CLASS_BY_KEY[key];
    it(`${className}`, () => {
      const builds = generateTopBuildsForClass(className, TOP_N, {
        characterLevel: CHAR_LEVEL,
        itemLevel: ITEM_LEVEL_OVERRIDE,
        ascendancy: ASCENDANCY,
      });
      printClass(className, builds);
      if (process.env.EXPLORE_DUMP && builds.length) {
        const dumpPath = path.resolve(process.cwd(), process.env.EXPLORE_DUMP);
        const existing = fs.existsSync(dumpPath) ? JSON.parse(fs.readFileSync(dumpPath, 'utf8')) : {};
        existing[className] = {
          dps: builds[0].dps,
          nodes: builds[0].build.trees[0].nodes,
        };
        fs.writeFileSync(dumpPath, JSON.stringify(existing, null, 2));
      }
      expect(builds.length).toBeGreaterThan(0);
    }, 180_000);
  }
});
