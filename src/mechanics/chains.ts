// Synergy-chain discovery.
//
// Loads every skill / support / passive as a MechanicEntity, dissects each
// into emit/consume tokens (tokens.ts), then matches emitters to consumers to
// surface real damage-amplifying chains. The output is principle-first: each
// chain is "<source> produces <token> → <sink> exploits <token>", which holds
// for ANY future gem that emits or consumes the same token.

import skillsJson from '../data/generated/skills.json';
import treeJson from '../data/generated/passive-tree.json';
import { dissect, MechanicEntity, Token, TOKEN_LABEL } from './tokens';

interface RawSkill {
  id: string;
  name: string;
  isSupport: boolean;
  skillTypes: string[];
  description?: string;
  constantStats?: [string, number][];
  requireSkillTypes?: string[];
  perLevelStats?: { level: number; stats: Record<string, number> }[];
}

// Average spell base damage at a high level — used to rank trigger payloads so
// we surface the spells actually worth triggering (Comet, Hexblast) rather
// than every triggerable spell in the game.
function spellBaseDamage(s: RawSkill): number {
  const lv = s.perLevelStats?.find((e) => e.level === 20) ?? s.perLevelStats?.slice(-1)[0];
  if (!lv) return 0;
  let min = 0, max = 0;
  for (const [k, v] of Object.entries(lv.stats)) {
    if (/^spell_minimum_base_\w+_damage$/.test(k)) min += v;
    if (/^spell_maximum_base_\w+_damage$/.test(k)) max += v;
  }
  return (min + max) / 2;
}
interface RawTreeNode {
  id: number;
  name?: string;
  stats: string[];
  isKeystone?: boolean;
  isNotable?: boolean;
  ascendancyName?: string;
}

function buildEntities(): MechanicEntity[] {
  const out: MechanicEntity[] = [];

  for (const s of skillsJson as RawSkill[]) {
    const kind: MechanicEntity['kind'] = s.skillTypes?.includes('Meta')
      ? 'meta'
      : s.isSupport
      ? 'support'
      : 'skill';
    out.push({
      id: s.id,
      name: s.name,
      kind,
      skillTypes: s.skillTypes ?? [],
      description: s.description,
      statKeys: (s.constantStats ?? []).map(([k]) => k),
      statText: [],
    });
  }

  const tree = treeJson as unknown as { nodes: Record<string, RawTreeNode> };
  for (const n of Object.values(tree.nodes)) {
    if (!n.stats || !n.stats.length) continue;
    const kind: MechanicEntity['kind'] = n.ascendancyName
      ? 'ascendancy'
      : n.isKeystone
      ? 'keystone'
      : 'passive';
    // Only keep notables / keystones / ascendancy nodes — small passives are
    // noise for chain discovery (their stats repeat across hundreds of nodes).
    if (kind === 'passive' && !n.isNotable) continue;
    out.push({
      id: `node:${n.id}`,
      name: n.name || `Node ${n.id}`,
      kind,
      skillTypes: [],
      statKeys: [],
      statText: n.stats,
    });
  }

  return out;
}

export interface ChainLink {
  token: Token;
  tokenLabel: string;
  source: { id: string; name: string; kind: string; why: string };
  sink: { id: string; name: string; kind: string; why: string };
  // Why this pairing is meaningful (the "principle").
  principle: string;
  // Heuristic strength: how impactful this chain class tends to be (0-100).
  weight: number;
}

// Per-token: is it a real amplification when emitted→consumed, and how strong.
const CHAIN_PRINCIPLES: Partial<Record<Token, { principle: string; weight: number }>> = {
  on_crit: {
    principle: 'A reliable crit source feeds a Cast-on-Critical trigger host, which fires high-base triggered spells for free.',
    weight: 95,
  },
  freeze: {
    principle: 'Freezing the target unlocks "more damage vs Frozen" / freeze-multiplier consumers — a cold-spell amplifier loop.',
    weight: 70,
  },
  shock: {
    principle: 'Shock raises all damage taken by the target; shock-conditional consumers stack on top.',
    weight: 75,
  },
  ignite: {
    principle: 'Igniting enables ignite-magnitude and "vs Ignited" consumers — fire/DoT scaling.',
    weight: 65,
  },
  electrocute: {
    principle: 'Electrocute lets electrocute-multiplier marks (Voltaic) add conditional more-damage.',
    weight: 60,
  },
  power_charge: {
    principle: 'A charge generator feeds "per Power Charge" / charge-consuming payoffs.',
    weight: 55,
  },
  mana: {
    principle: 'A large mana pool fuels Archmage-style "gain as Lightning per 100 Mana" — turns EHP/mana into raw damage.',
    weight: 80,
  },
  cold: {
    principle: 'Phys→Cold conversion or gain-as-cold pipes damage into cold scaling (increased Cold Damage).',
    weight: 50,
  },
  fire: {
    principle: 'Fire conversion / gain-as-fire pipes damage into fire scaling.',
    weight: 50,
  },
  lightning: {
    principle: 'Lightning conversion / gain-as-lightning pipes damage into lightning scaling (and Archmage synergy).',
    weight: 50,
  },
};

export interface DiscoverOptions {
  // Restrict the SINK side to these kinds (e.g. only trigger hosts).
  limit?: number;
}

export interface DiscoveryResult {
  chains: ChainLink[];
  entityCount: number;
  tokenCounts: { token: Token; emits: number; consumes: number }[];
}

export function discoverChains(opts: DiscoverOptions = {}): DiscoveryResult {
  const entities = buildEntities();
  const dissected = entities.map((e) => ({ e, d: dissect(e) }));

  // Index emitters and consumers by token.
  const emittersByToken = new Map<Token, typeof dissected>();
  const consumersByToken = new Map<Token, typeof dissected>();
  for (const item of dissected) {
    item.d.emits.forEach((t) => {
      if (!emittersByToken.has(t)) emittersByToken.set(t, []);
      emittersByToken.get(t)!.push(item);
    });
    item.d.consumes.forEach((t) => {
      if (!consumersByToken.has(t)) consumersByToken.set(t, []);
      consumersByToken.get(t)!.push(item);
    });
  }

  const chains: ChainLink[] = [];
  const seen = new Set<string>();

  // Trigger chains. Only genuine Meta trigger gems (Cast on Crit, Spellslinger,
  // …) count as hosts — not every skill that happens to carry a `Triggers`
  // tag. Payloads are triggerable spells RANKED by base damage and capped, so
  // we surface the spells worth triggering (Comet, Hexblast) rather than all
  // 300+ triggerable skills.
  const damageById = new Map<string, number>();
  for (const s of skillsJson as RawSkill[]) damageById.set(s.id, spellBaseDamage(s));

  const hosts = (emittersByToken.get('trigger_host') ?? []).filter((i) => i.e.kind === 'meta');
  const TOP_PAYLOADS = 25;
  const triggerables = (emittersByToken.get('triggerable') ?? [])
    .filter((i) => i.d.emits.has('spell') && (damageById.get(i.e.id) ?? 0) > 0)
    .sort((a, b) => (damageById.get(b.e.id) ?? 0) - (damageById.get(a.e.id) ?? 0))
    .slice(0, TOP_PAYLOADS);

  // Derive the host's real trigger condition from its name/description, so
  // "Cast on Block" reads "on Block" not a generic "on Hit".
  const conditionOf = (name: string, desc: string): { token: Token; label: string } => {
    const n = `${name} ${desc}`.toLowerCase();
    if (/critical/.test(n)) return { token: 'on_crit', label: 'on Critical Hit' };
    if (/\bblock/.test(n)) return { token: 'on_block', label: 'on Block' };
    if (/\bkill|death/.test(n)) return { token: 'on_kill', label: 'on Kill' };
    if (/\bstun/.test(n)) return { token: 'on_stun', label: 'on Stun' };
    if (/ailment|ignite|freeze|shock/.test(n)) return { token: 'ignite', label: 'on Elemental Ailment' };
    if (/dodge/.test(n)) return { token: 'on_hit', label: 'on Dodge' };
    return { token: 'on_hit', label: 'on Hit' };
  };

  for (const host of hosts) {
    const cInfo = conditionOf(host.e.name, host.e.description ?? '');
    const cond = cInfo.token;
    for (const tgt of triggerables) {
      const key = `trig:${host.e.id}->${tgt.e.id}`;
      if (seen.has(key)) continue;
      seen.add(key);
      const dmg = damageById.get(tgt.e.id) ?? 0;
      chains.push({
        token: cond,
        tokenLabel: cInfo.label,
        source: { id: host.e.id, name: host.e.name, kind: host.e.kind, why: 'meta trigger gem' },
        sink: { id: tgt.e.id, name: tgt.e.name, kind: tgt.e.kind, why: `triggerable spell · base dmg ~${Math.round(dmg)}` },
        principle:
          `Socket a high-base spell into ${host.e.name}; a fast "${cInfo.label}" source auto-fires it, bypassing cast time. Generalizes the Spark→Cast-on-Crit→Comet pattern.`,
        weight: Math.round(90 + Math.min(8, dmg / 300)), // nudge higher-base payloads up
      });
    }
  }

  // General emit→consume matching for the remaining tokens.
  for (const [token, principle] of Object.entries(CHAIN_PRINCIPLES) as [Token, { principle: string; weight: number }][]) {
    const emitters = emittersByToken.get(token) ?? [];
    const consumers = consumersByToken.get(token) ?? [];
    if (!emitters.length || !consumers.length) continue;
    for (const em of emitters) {
      for (const co of consumers) {
        if (em.e.id === co.e.id) continue; // an entity feeding itself isn't a chain
        const key = `${token}:${em.e.id}->${co.e.id}`;
        if (seen.has(key)) continue;
        seen.add(key);
        const emWhy = em.d.evidence.find((x) => x.token === token && x.side === 'emit')?.source ?? '';
        const coWhy = co.d.evidence.find((x) => x.token === token && x.side === 'consume')?.source ?? '';
        chains.push({
          token,
          tokenLabel: TOKEN_LABEL[token],
          source: { id: em.e.id, name: em.e.name, kind: em.e.kind, why: emWhy },
          sink: { id: co.e.id, name: co.e.name, kind: co.e.kind, why: coWhy },
          principle: principle.principle,
          weight: principle.weight,
        });
      }
    }
  }

  chains.sort((a, b) => b.weight - a.weight || a.source.name.localeCompare(b.source.name));

  const tokenCounts = (Object.keys(TOKEN_LABEL) as Token[]).map((token) => ({
    token,
    emits: emittersByToken.get(token)?.length ?? 0,
    consumes: consumersByToken.get(token)?.length ?? 0,
  })).filter((t) => t.emits || t.consumes);

  return {
    chains: opts.limit ? chains.slice(0, opts.limit) : chains,
    entityCount: entities.length,
    tokenCounts,
  };
}
