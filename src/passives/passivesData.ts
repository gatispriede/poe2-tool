// Simplified static passive tree node dataset (placeholder for real PoE2 data)
// In a real integration, replace with fetched data from Path of Exile API / exported JSON.

import { PassiveStats } from '../damage/model';

export type PassiveNodeType = 'small' | 'notable';

export type PassiveNode = {
  id: string;
  name: string;
  type: PassiveNodeType;
  stats: Partial<PassiveStats>; // use Partial<PassiveStats> for broader compatibility
};

export const PASSIVE_NODES: PassiveNode[] = [
  { id: 's_phys_1', name: 'Physical Damage +10%', type: 'small', stats: { increasedPhysicalDamagePct: 10 } },
  { id: 's_phys_2', name: 'Physical Damage +12%', type: 'small', stats: { increasedPhysicalDamagePct: 12 } },
  { id: 's_as_1', name: 'Attack Speed +5%', type: 'small', stats: { increasedAttackSpeedPct: 5 } },
  { id: 's_as_2', name: 'Attack Speed +7%', type: 'small', stats: { increasedAttackSpeedPct: 7 } },
  { id: 's_crit_chance_1', name: 'Critical Chance +20%', type: 'small', stats: { increasedCritChancePct: 20 } },
  { id: 's_crit_multi_1', name: 'Critical Multiplier +15%', type: 'small', stats: { increasedCritMultiplierPct: 15 } },
  { id: 'n_phys_mastery', name: 'Brutal Notable (+25% Physical Damage)', type: 'notable', stats: { increasedPhysicalDamagePct: 25 } },
  { id: 'n_as_mastery', name: 'Frenzied Notable (+12% Attack Speed)', type: 'notable', stats: { increasedAttackSpeedPct: 12 } },
  { id: 'n_crit_cluster', name: 'Precise Notable (+40% Crit Chance, +25% Crit Multi)', type: 'notable', stats: { increasedCritChancePct: 40, increasedCritMultiplierPct: 25 } },
  { id: 'n_phys_speed', name: 'Slaughter Notable (+18% Phys, +8% Attack Speed)', type: 'notable', stats: { increasedPhysicalDamagePct: 18, increasedAttackSpeedPct: 8 } },
];
