import { PassiveStats } from '../damage/model';
import { TablePassiveRow } from '../data/DataTableData';

export interface ParsedTablePassiveEffect {
  stats: Partial<PassiveStats>;
  moreDamage: number[]; // list of % more modifiers
}

const INC_PHYS = /(\d+)%\s+increased\s+(Melee|Physical)\s+Damage/i;
const INC_ATTACK_SPEED = /(\d+)%\s+increased\s+Attack\s+Speed/i;
const INC_CRIT_CHANCE = /(\d+)%\s+increased\s+Critical( Strike| Hit)? Chance/i;
const INC_CRIT_MULTI = /(\d+)%\s+increased\s+Critical( Strike)? Damage Bonus|\+(\d+)% to Critical Strike Multiplier/i;
const MORE_DAMAGE = /(\d+)%\s+more\s+Damage/i;
const MORE_MAX_LIFE = /(\d+)%\s+more\s+Maximum\s+Life/i; // ignored for damage

// Spell-specific patterns
const INC_SPELL_DAMAGE = /(\d+)%\s+increased\s+Spell\s+Damage/i;
const INC_ELEMENTAL_DAMAGE = /(\d+)%\s+increased\s+Elemental\s+Damage/i;
const INC_FIRE_DAMAGE = /(\d+)%\s+increased\s+Fire\s+Damage/i;
const INC_COLD_DAMAGE = /(\d+)%\s+increased\s+Cold\s+Damage/i;
const INC_LIGHTNING_DAMAGE = /(\d+)%\s+increased\s+Lightning\s+Damage/i;
const INC_CHAOS_DAMAGE = /(\d+)%\s+increased\s+Chaos\s+Damage/i;
const INC_CAST_SPEED = /(\d+)%\s+increased\s+Cast\s+Speed/i;
const INC_SPELL_CRIT_CHANCE = /(\d+)%\s+increased\s+Spell\s+Critical\s+Strike\s+Chance/i;
const INC_AREA_DAMAGE = /(\d+)%\s+increased\s+Area\s+(of\s+Effect\s+)?Damage/i;
const INC_PROJECTILE_DAMAGE = /(\d+)%\s+increased\s+Projectile\s+Damage/i;

export function parseEffectText(effect: string): ParsedTablePassiveEffect {
  const stats: Partial<PassiveStats> = {};
  const moreDamage: number[] = [];
  const segments = effect.split(/[;,.]/).map(s => s.trim()).filter(Boolean);
  for (const seg of segments) {
    let m;
    if ((m = seg.match(INC_PHYS))) {
      const val = Number(m[1]);
      stats.increasedPhysicalDamagePct = (stats.increasedPhysicalDamagePct ?? 0) + val;
    }
    if ((m = seg.match(INC_ATTACK_SPEED))) {
      const val = Number(m[1]);
      stats.increasedAttackSpeedPct = (stats.increasedAttackSpeedPct ?? 0) + val;
    }
    if ((m = seg.match(INC_CRIT_CHANCE))) {
      const val = Number(m[1]);
      stats.increasedCritChancePct = (stats.increasedCritChancePct ?? 0) + val;
    }
    if ((m = seg.match(INC_CRIT_MULTI))) {
      const val = Number(m[1] || m[2]);
      stats.increasedCritMultiplierPct = (stats.increasedCritMultiplierPct ?? 0) + val;
    }
    if ((m = seg.match(MORE_DAMAGE))) {
      const val = Number(m[1]);
      moreDamage.push(val);
    }
    // Spell-specific modifiers
    if ((m = seg.match(INC_SPELL_DAMAGE))) {
      const val = Number(m[1]);
      stats.increasedSpellDamagePct = (stats.increasedSpellDamagePct ?? 0) + val;
    }
    if ((m = seg.match(INC_ELEMENTAL_DAMAGE))) {
      const val = Number(m[1]);
      stats.increasedElementalDamagePct = (stats.increasedElementalDamagePct ?? 0) + val;
    }
    if ((m = seg.match(INC_FIRE_DAMAGE))) {
      const val = Number(m[1]);
      stats.increasedFireDamagePct = (stats.increasedFireDamagePct ?? 0) + val;
    }
    if ((m = seg.match(INC_COLD_DAMAGE))) {
      const val = Number(m[1]);
      stats.increasedColdDamagePct = (stats.increasedColdDamagePct ?? 0) + val;
    }
    if ((m = seg.match(INC_LIGHTNING_DAMAGE))) {
      const val = Number(m[1]);
      stats.increasedLightningDamagePct = (stats.increasedLightningDamagePct ?? 0) + val;
    }
    if ((m = seg.match(INC_CHAOS_DAMAGE))) {
      const val = Number(m[1]);
      stats.increasedChaosDamagePct = (stats.increasedChaosDamagePct ?? 0) + val;
    }
    if ((m = seg.match(INC_CAST_SPEED))) {
      const val = Number(m[1]);
      stats.increasedCastSpeedPct = (stats.increasedCastSpeedPct ?? 0) + val;
    }
    if ((m = seg.match(INC_SPELL_CRIT_CHANCE))) {
      const val = Number(m[1]);
      stats.increasedSpellCritChancePct = (stats.increasedSpellCritChancePct ?? 0) + val;
    }
    if ((m = seg.match(INC_AREA_DAMAGE))) {
      const val = Number(m[1]);
      stats.increasedAreaDamagePct = (stats.increasedAreaDamagePct ?? 0) + val;
    }
    if ((m = seg.match(INC_PROJECTILE_DAMAGE))) {
      const val = Number(m[1]);
      stats.increasedProjectileDamagePct = (stats.increasedProjectileDamagePct ?? 0) + val;
    }
    // ignore MORE_MAX_LIFE for DPS
  }
  return { stats, moreDamage };
}

export function aggregateTablePassiveRows(rows: TablePassiveRow[], selectedIds: string[]) {
  const agg: ParsedTablePassiveEffect = { stats: {}, moreDamage: [] };
  for (const id of selectedIds) {
    const row = rows.find(r => r.id === id);
    if (!row) continue;
    const parsed = parseEffectText(row.effect);
    for (const [k, v] of Object.entries(parsed.stats)) {
      const key = k as keyof PassiveStats;
      if (Array.isArray(v)) {
        // Handle array properties
        if (!agg.stats[key]) {
          (agg.stats[key] as any) = [...v];
        } else if (Array.isArray(agg.stats[key])) {
          (agg.stats[key] as any) = [...(agg.stats[key] as any[]), ...v];
        }
      } else if (typeof v === 'number') {
        // Handle number properties
        if (agg.stats[key] === undefined) {
          (agg.stats[key] as any) = v;
        } else if (typeof agg.stats[key] === 'number') {
          (agg.stats[key] as any) = (agg.stats[key] as number) + v;
        }
      }
    }
    agg.moreDamage.push(...parsed.moreDamage);
  }
  return agg;
}

