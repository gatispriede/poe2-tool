// Evaluates the user's discovery: Ice Shot (phys→cold) → Whisper of the
// Brotherhood (cold→lightning) → Voltaxic Rift (lightning→chaos) = chaos that
// ignores boss resistance. Quantifies the RESISTANCE-BYPASS benefit on the
// real DLtydZs Ice Shot fixture, holding the weapon constant (the weapon
// tradeoff is analysed separately in the writeup — Voltaxic is a weak-phys bow).

import fs from 'fs';
import path from 'path';
import { composeDamage } from '../composeDamage';
import { ParsedBuild } from '../../validation/types';

function loadCalib(name: string): ParsedBuild {
  const p = path.resolve(__dirname, '../../data/baseline-builds/calibration', `${name}.json`);
  return JSON.parse(fs.readFileSync(p, 'utf8')) as ParsedBuild;
}

describe('Ice Shot → cold → lightning → chaos chain', () => {
  it('quantifies the chaos resistance-bypass on a pinnacle boss', () => {
    const build = loadCalib('DLtydZs_Mos6');
    const skillId = 'IceShotPlayer';
    const gi = build.skillGroups.findIndex((g) => g.gems.some((x) => x.skillId === skillId));

    // Inject the conversion chain onto the build's gear: Whisper (cold→lightning)
    // on a ring, Voltaxic's lightning→chaos line on the weapon. The composer's
    // convertedToChaosPct then credits the chaos bypass for the cold hit.
    const withChain: ParsedBuild = JSON.parse(JSON.stringify(build));
    const ring = withChain.equipped['Ring 1'] || withChain.equipped['Ring 2'];
    if (ring) ring.explicits = [...ring.explicits, '100% of Cold Damage Converted to Lightning Damage'];
    const wpn = withChain.equipped['Weapon 1'];
    if (wpn) wpn.explicits = [...wpn.explicits, '100% of Lightning Damage Converted to Chaos Damage'];

    const tiers = ['white', 'boss', 'pinnacle'] as const;
    // eslint-disable-next-line no-console
    console.log('\n=== Ice Shot: cold vs chaos-chain (same weapon, isolates res bypass) ===');
    for (const t of tiers) {
      const cold = composeDamage({ build, skillGroupIndex: gi, skillId, targetTier: t });
      const chaos = composeDamage({ build: withChain, skillGroupIndex: gi, skillId, targetTier: t });
      const gain = ((chaos.dps / cold.dps - 1) * 100);
      // eslint-disable-next-line no-console
      console.log(
        `  ${t.padEnd(8)} cold ${(cold.dps / 1000).toFixed(0)}k (×${cold.enemy.effectivenessMul.toFixed(2)} ${cold.enemy.dominantType})  ` +
        `→ chaos-chain ${(chaos.dps / 1000).toFixed(0)}k (×${chaos.enemy.effectivenessMul.toFixed(2)})  ` +
        `= ${gain >= 0 ? '+' : ''}${gain.toFixed(0)}%`
      );
    }
    expect(gi).toBeGreaterThanOrEqual(0);
  });
});
