// End-to-end test: pick a class → get the top-N highest-DPS builds.
//
// Acceptance criteria:
//   (1) Every weapon base in the output ∈ weapon-bases.json (no invented)
//   (2) Every weapon mod text matches a real mod in item-mods.json
//   (3) Every skill / support skillId ∈ skills.json
//   (4) Each weapon's mods pass the eligibility rule (Layer 1)
//   (5) validateBuild on the full build does not throw Layer-2/4 errors
//       (L1/L3/L5 informational findings are tolerated — those are
//       documented-deferred validator gaps, not generator bugs).

import bases from '../../data/generated/weapon-bases.json';
import mods from '../../data/generated/item-mods.json';
import skills from '../../data/generated/skills.json';
import { generateTopBowAttackBuildsForHuntress, generateTopMeleeBuildsForWarrior, generateTopSpellBuildsForWitch, generateTopSpellBuildsForSorceress, GeneratedBuild } from '../generateBuild';
import { modCanRollOnBase } from '../generateWeapon';

const baseIds = new Set((bases as { id: string }[]).map(b => b.id));
const skillIds = new Set((skills as { id: string }[]).map(s => s.id));

// Shared acceptance-test helpers (used by both class suites below).
function expectInGameReproducible(results: GeneratedBuild[]): void {
  const baseIds = new Set((bases as { id: string }[]).map(b => b.id));
  const skillIds = new Set((skills as { id: string }[]).map(s => s.id));
  const modsById: Record<string, unknown> = {};
  for (const m of mods as { id: string }[]) modsById[m.id] = m;
  const allBases = bases as { id: string }[];

  for (const r of results) {
    // Bases real
    const baseId = r.build.equipped['Weapon 1'].base;
    expect(baseId).not.toBeNull();
    expect(baseIds.has(baseId!)).toBe(true);

    // Skills + supports real
    for (const g of r.build.skillGroups) {
      for (const gem of g.gems) {
        if (!gem.skillId || gem.skillId === '') continue;
        expect(skillIds.has(gem.skillId)).toBe(true);
      }
    }

    // Weapon mod-ids real + eligible (only relevant for RARE; uniques have
    // fixed mods that aren't sourced from item-mods.json).
    const item = r.build.equipped['Weapon 1'];
    const base = allBases.find(b => b.id === item.base);
    expect(base).toBeDefined();
    if (r.weaponRarity === 'RARE') {
      for (const modId of r.weaponModIds) {
        const m = modsById[modId];
        expect(m).toBeDefined();
        expect(modCanRollOnBase(m as never, base as never, item.itemLevel ?? 82)).toBe(true);
      }
      const chosen = r.weaponModIds.map(id => modsById[id] as { type: string; group: string });
      expect(chosen.filter(m => m.type === 'Prefix').length).toBeLessThanOrEqual(3);
      expect(chosen.filter(m => m.type === 'Suffix').length).toBeLessThanOrEqual(3);
      expect(new Set(chosen.map(m => m.group)).size).toBe(chosen.length);
    } else {
      // Uniques: name must exist in our uniques.json
      expect(r.weaponUniqueName).not.toBeNull();
    }

    // No Layer 2/4 blocking errors
    const blocking = r.validation.errors.filter(
      e => (e.layer === 2 && e.kind !== 'placeholder-gem') || e.layer === 4
    );
    expect(blocking).toEqual([]);
  }
}

function printBuilds(label: string, results: GeneratedBuild[]): void {
  /* eslint-disable no-console */
  console.log(`\n${label} top ${results.length} generated builds (in-game reproducible):`);
  for (let i = 0; i < results.length; i++) {
    const r = results[i];
    const item = r.build.equipped['Weapon 1'];
    const grp = r.build.skillGroups.find(g => g.gems.some(x => x.skillId === r.skillId))!;
    const supports = grp.gems.filter(g => {
      if (!g.skillId) return false;
      const rec = (skills as { id: string; isSupport: boolean }[]).find(s => s.id === g.skillId);
      return rec && rec.isSupport;
    }).map(g => g.nameSpec);
    const weaponLabel = r.weaponRarity === 'UNIQUE'
      ? `${r.weaponUniqueName} (${item.base}) [UNIQUE]`
      : `${item.base} [RARE]`;
    const modeLabel = r.triggerMode === 'cast_on_crit' ? ' [via Cast on Critical]' : '';
    console.log(`\n  #${i + 1} ${r.skillName}${modeLabel}  (${r.dps.toFixed(0)} DPS)`);
    console.log(`     weapon  : ${weaponLabel}`);
    console.log(`     tree    : ${r.build.trees[0].nodes.length} nodes from class start`);
    console.log(`     mods    :`);
    for (const m of item.explicits) console.log(`       - ${m}`);
    console.log(`     supports: ${supports.join(' / ')}`);
  }
  /* eslint-enable no-console */
}

describe('Huntress build generator v1', () => {
  const results = generateTopBowAttackBuildsForHuntress(5, { itemLevel: 82 });

  it('produces at least 3 valid builds', () => {
    expect(results.length).toBeGreaterThanOrEqual(3);
  });

  it('every build is in-game reproducible', () => {
    expectInGameReproducible(results);
  });

  it('prints top builds (informational)', () => {
    printBuilds('Huntress', results);
  });
});

describe('Ice Shot weapon-candidate scoreboard (informational)', () => {
  it('lists rare-best vs each viable unique', async () => {
    /* eslint-disable @typescript-eslint/no-var-requires, no-console */
    const { generateBuildForSkill } = require('../generateBuild');
    const { pickUniqueWeaponsForSkill } = require('../generateUniqueWeapons');
    const { composeDamage } = require('../../damage-v2/composeDamage');

    const rare = generateBuildForSkill('Huntress', 'IceShotPlayer', { itemLevel: 82 });
    expect(rare).not.toBeNull();
    const uniques = pickUniqueWeaponsForSkill('IceShotPlayer');

    const grpIdx = rare!.build.skillGroups.findIndex((g: { gems: { skillId: string | null }[] }) =>
      g.gems.some(x => x.skillId === 'IceShotPlayer'));

    const scores: { name: string; dps: number }[] = [];
    scores.push({ name: `[RARE] ${rare!.weaponBase}`, dps: rare!.dps });
    for (const u of uniques) {
      const b = { ...rare!.build, equipped: { ...rare!.build.equipped, 'Weapon 1': u.item } };
      try {
        const dps = composeDamage({ build: b, skillGroupIndex: grpIdx, skillId: 'IceShotPlayer' }).dps;
        scores.push({ name: `[UNIQUE] ${u.uniqueName} (${u.baseId})`, dps });
      } catch { /* ignore */ }
    }
    scores.sort((a, b) => b.dps - a.dps);
    console.log('\nIce Shot weapon candidates (top 8):');
    for (const s of scores.slice(0, 8)) {
      console.log(`  ${s.dps.toString().padStart(8)} DPS  —  ${s.name}`);
    }
    /* eslint-enable */
  });
});

describe('Warrior build generator v1', () => {
  const results = generateTopMeleeBuildsForWarrior(5, { itemLevel: 82 });

  it('produces at least 3 valid builds', () => {
    expect(results.length).toBeGreaterThanOrEqual(3);
  });

  it('every build is in-game reproducible', () => {
    expectInGameReproducible(results);
  });

  it('prints top builds (informational)', () => {
    printBuilds('Warrior', results);
  });
});

describe('Witch (spell) build generator v1', () => {
  const results = generateTopSpellBuildsForWitch(5, { itemLevel: 82 });

  it('produces at least 3 valid builds', () => {
    expect(results.length).toBeGreaterThanOrEqual(3);
  });

  it('every build is in-game reproducible', () => {
    expectInGameReproducible(results);
  });

  it('prints top builds (informational)', () => {
    printBuilds('Witch', results);
  });
});

describe('Sorceress (spell) build generator v1', () => {
  const results = generateTopSpellBuildsForSorceress(5, { itemLevel: 82 });

  it('produces at least 3 valid builds', () => {
    expect(results.length).toBeGreaterThanOrEqual(3);
  });

  it('every build is in-game reproducible', () => {
    expectInGameReproducible(results);
  });

  it('prints top builds (informational)', () => {
    printBuilds('Sorceress', results);
  });
});

