// Per-archetype mechanics map.
//
// The app's primary aim is DISCOVERY: lay out, per character type, the known
// damage archetypes and HOW each one actually scales — so we can target real
// builds and spot the gaps where a NEW mechanic might live. Calc refinement
// exists to verify these.
//
// Each archetype records its damage chain, its scaling levers (what you invest
// in, and how much it's worth), the damage profile (single-target / clear /
// both), a proven/candidate status, and real evidence where we have it.

export type DamageProfile = 'single-target' | 'clear' | 'both';
export type Status = 'proven' | 'candidate' | 'theoretical';

export interface ScalingLever {
  lever: string;
  // 'core' = the build doesn't work without it; 'major'/'minor' = relative
  // marginal value; 'clear-only' = helps pack clear but ~0 single-target;
  // 'trap' = commonly over-invested for little single-target gain.
  weight: 'core' | 'major' | 'minor' | 'clear-only' | 'trap';
  note: string;
}

export interface Archetype {
  id: string;
  name: string;
  classes: string[];           // which classes/ascendancies run it
  chain: string;               // the mechanic chain, e.g. "Spark → Cast on Crit → Comet"
  profile: DamageProfile;
  status: Status;
  levers: ScalingLever[];
  evidence?: string;           // real build / DPS anchor
  discover?: string;           // the open question / where a new mechanic might be
}

export const ARCHETYPES: Archetype[] = [
  {
    id: 'spark-coc-comet',
    name: 'Spark → Cast-on-Crit → Comet',
    classes: ['Witch (Blood Mage)', 'Sorceress (Stormweaver)'],
    chain: 'Spark (fast multi-projectile) crits → Cast on Critical fires Comet automatically',
    profile: 'both',
    status: 'proven',
    evidence: 'Gaobin lv99 — Comet 180M (CoC) / 16M (direct). Real ceiling, fully geared.',
    levers: [
      { lever: 'Tree + ascendancy base spell damage', weight: 'core', note: 'the headline damage comes from base spell scaling, NOT the weapon' },
      { lever: 'Crit chance (Sunder the Flesh = 15% base spell crit)', weight: 'core', note: 'drives the CoC trigger rate AND the crit multiplier' },
      { lever: 'Mana pool → Archmage (gain-as-lightning per 100 mana)', weight: 'major', note: 'Eldritch Battery converts ES→mana; turns EHP into damage' },
      { lever: 'Spell Cascade (3 casts) / Spell Echo', weight: 'major', note: 'multiplies cast count — multiplicative with everything' },
      { lever: 'CoC trigger frequency (Spark hits/sec × crit)', weight: 'core', note: 'capped ~6.67/sec; Spark saturates it' },
      { lever: 'Weapon damage', weight: 'minor', note: 'caster weapon is a stat-stick (+levels/crit/cast), not the damage source' },
    ],
    discover: 'Cast on ELEMENTAL AILMENT as a crit-free alternative trigger — cheaper, less contested. Does it out-throughput CoC for a freeze/shock applier?',
  },
  {
    id: 'iceshot-bow',
    name: 'Ice Shot (cold conversion bow)',
    classes: ['Huntress (Amazon)', 'Ranger (Deadeye)'],
    chain: 'Bow attack, 80% phys→cold, arrow hit + ice-shard cone',
    profile: 'both',
    status: 'proven',
    evidence: 'Real builds 52k → 490k → 1.14M Full DPS across gear tiers. Player ceiling ~2M.',
    levers: [
      { lever: 'Weapon phys (then converted to cold)', weight: 'core', note: 'the whole hit scales off bow phys × conversion' },
      { lever: 'Increased Cold + Physical Damage (both scale converted hits)', weight: 'core', note: 'converted damage benefits from BOTH source and destination type mods' },
      { lever: 'Crit chance + crit damage bonus', weight: 'major', note: 'high crit multi (519-974%) on real builds' },
      { lever: 'Ice-shard cone', weight: 'major', note: 'doubles single-target (arrow+shards); blankets packs for clear' },
      { lever: 'Freeze (vs packs)', weight: 'clear-only', note: 'locks packs for clear/defense; does NOT land on bosses' },
      { lever: 'Arrow/projectile count', weight: 'trap', note: 'arrows fan out — clear only; ~0 single-target. Adder supports even penalize damage.' },
    ],
    discover: 'Bow as the CRIT SOURCE for Cast-on-Crit → spell payload (bow-crit hybrid). Does a fast crit bow out-trigger Spark?',
  },
  {
    id: 'lightning-arrow-clear',
    name: 'Lightning Arrow (chain clear)',
    classes: ['Huntress', 'Ranger (Deadeye)'],
    chain: 'Bow attack chains between enemies, AoE on hit',
    profile: 'clear',
    status: 'proven',
    levers: [
      { lever: 'Chain count', weight: 'core', note: '~16 effective targets — the clear engine' },
      { lever: 'Lightning + Elemental damage', weight: 'major', note: 'standard ele scaling' },
      { lever: 'Single-target', weight: 'minor', note: 'lowest boss DPS of the bow skills — pair with a single-target swap' },
    ],
    discover: 'Best single-target partner skill that shares the same bow + tree (clear LA + boss X on one character).',
  },
  {
    id: 'archmage-manastack',
    name: 'Archmage mana-stacking',
    classes: ['Witch', 'Sorceress'],
    chain: 'Huge mana pool → Archmage adds % of mana as flat lightning to spells',
    profile: 'both',
    status: 'proven',
    levers: [
      { lever: 'Maximum mana (Eldritch Battery: ES→mana)', weight: 'core', note: 'damage scales directly with the mana pool' },
      { lever: 'Energy Shield on gear (feeds EB)', weight: 'major', note: 'ES gear becomes damage AND defense' },
      { lever: '+Maximum Mana / Int', weight: 'major', note: 'Int gives mana; Mind Runes buffed in 0.5' },
      { lever: 'Lightning damage scaling', weight: 'major', note: 'the gain-as is lightning' },
    ],
    discover: 'Mana-cost-as-flat interactions with other gain-as layers — does double-converting (e.g. lightning→cold) keep the Archmage flat?',
  },
  {
    id: 'ailment-stack-cold',
    name: 'Freeze / cold-ailment stacking',
    classes: ['Witch', 'Sorceress', 'Huntress'],
    chain: 'Stack freeze buildup + "more vs Frozen" multipliers',
    profile: 'clear',
    status: 'proven',
    levers: [
      { lever: 'Freeze buildup + chill', weight: 'core', note: 'locks packs — strong clear + defense' },
      { lever: '"more vs Frozen" multipliers', weight: 'clear-only', note: 'evaporate on bosses (can\'t freeze them) — a boss-DPS trap' },
    ],
    discover: 'Shock/ignite stacking instead — these DO apply to bosses. Is a shock-stack the boss-viable version of an ailment build?',
  },

  // ── Discovered candidates (mechanics sweep — docs/mechanics-discovery.md) ──
  // Cross-source combinations surfaced by scripts/discover-mechanics.js. Not
  // yet proven against fixtures; each names the data sources it chains.
  {
    id: 'accuracy-crit-trigger',
    name: 'Accuracy → Crit → Trigger (Amazon)',
    classes: ['Huntress (Amazon)'],
    chain: 'Stack accuracy past 100% → Amazon converts excess to crit chance → crit triggers a free payload (Choir of the Storm: Lightning Bolt on Crit)',
    profile: 'both',
    status: 'candidate',
    evidence: 'Amazon "Critical Strike": hit chance can exceed 100%, crit += 25% of excess hit. Choir of the Storm: Trigger Lightning Bolt on Crit.',
    levers: [
      { lever: 'Accuracy rating (becomes crit chance)', weight: 'core', note: 'the novel crit source — sidesteps crit-chance gear/tree entirely' },
      { lever: 'Crit multiplier (now that crit chance is solved)', weight: 'major', note: 'crit chance is no longer the binding constraint, so multi pays' },
      { lever: 'Trigger payload damage (Lightning Bolt)', weight: 'major', note: 'the free crit-triggered spell' },
      { lever: 'Attack/cast rate (trigger frequency)', weight: 'major', note: 'more crits → more triggers, up to the trigger cooldown cap' },
    ],
    discover: 'Does accuracy-stacking out-scale conventional crit gear? Model "excess accuracy → crit" to find out — directly unblocks crit-build discovery (#35).',
  },
  {
    id: 'chaos-conversion-boss',
    name: 'Elemental → Chaos (resistance bypass)',
    classes: ['Witch', 'Sorceress', 'Huntress'],
    chain: 'Build elemental damage, convert it to chaos → ignore the 50% boss elemental resistance (chaos res is 0)',
    profile: 'both',
    status: 'candidate',
    evidence: 'Voltaxic Rift: 100% Lightning→Chaos. Blackflame Covenant (keystone): Fire Spell fire→chaos, ignite→chaos. Acolyte of Chayula: +4% damage as chaos.',
    levers: [
      { lever: 'Conversion to chaos (Voltaxic / Blackflame)', weight: 'core', note: 'the bypass — a smaller chaos hit out-lands a bigger resisted elemental one on bosses' },
      { lever: 'Underlying elemental scaling (still applies pre-conversion)', weight: 'core', note: 'converted damage keeps source-type increases' },
      { lever: 'Ignite-as-chaos (Blackflame)', weight: 'major', note: 'a boss-viable DoT that pays no resistance tax' },
      { lever: 'Penetration', weight: 'trap', note: 'redundant once converted to chaos — chaos has no resistance to penetrate' },
    ],
    discover: 'On a 50%-res pinnacle, does a chaos-converted build beat the same build un-converted? (2M ×0.5 = 1M vs converted ~full). Model chaos bypass in enemyDefense.ts.',
  },
  {
    id: 'onhit-free-spell',
    name: 'On-Hit free spell (no crit needed)',
    classes: ['Warrior (Smith of Kitava)', 'Mercenary'],
    chain: 'Fast multi-hit attack (e.g. chaining Lightning Arrow) → Heat of the Forge grants Fire Spell on Hit → free fire spell per hit, no crit gate',
    profile: 'both',
    status: 'theoretical',
    evidence: 'Smith of Kitava "Heat of the Forge": Grants Skill: Fire Spell on Hit. Triggers on HIT, not crit — lower investment than Cast-on-Crit.',
    levers: [
      { lever: 'Hit frequency (chains/projectiles)', weight: 'core', note: 'each hit fires the spell; chaining/multi-proj multiplies triggers' },
      { lever: 'Fire spell damage scaling', weight: 'major', note: 'the payload' },
      { lever: 'Trigger cooldown cap', weight: 'minor', note: 'on-hit triggers share a rate cap like CoC' },
    ],
    discover: 'Does on-hit triggering out-throughput Cast-on-Crit for a non-crit attack build? No crit investment required — cheaper league-start trigger build.',
  },
  {
    id: 'armour-as-damage',
    name: 'Armour-as-damage (defence = offence)',
    classes: ['Warrior (Smith of Kitava)', 'Marauder'],
    chain: 'Stack massive Armour → "% of Armour also applies to Damage" turns the defensive pool into flat hit damage → scaled by your increases/more/crit',
    profile: 'both',
    status: 'candidate',
    evidence: 'Doryani\'s Prototype: +100% of Armour applies to Lightning. Smith of Kitava: +200 Armour/connected notable, +50% Armour→Elemental, +100% Armour→CHAOS (Dedication to Kitava). Tree: Heatproof/Chillproof/Shockproof/Prism Guard (+30% each).',
    levers: [
      { lever: 'Armour rating (the damage pool)', weight: 'core', note: 'every point of armour becomes damage — Strength, %armour gear, Smith\'s +200/notable, Heavy Armour' },
      { lever: '"% of Armour applies to Damage" stacking', weight: 'core', note: 'Doryani\'s 100% + Smith 50%ele/100%chaos + tree 30%s — multiply the pool→damage transfer' },
      { lever: 'Armour → CHAOS (Smith: Dedication to Kitava)', weight: 'major', note: 'chaos ignores boss resistance — a defensive stat becomes unresisted boss damage' },
      { lever: 'Doryani\'s lightning-res inheritance', weight: 'major', note: 'enemies take YOUR lightning res; stack negative → enemies over-penetrated' },
      { lever: 'Strength stacking', weight: 'major', note: 'Strength feeds Armour (and Giant\'s Blood etc.) — double-dips defence+offence' },
      { lever: 'Increased/more damage', weight: 'minor', note: 'the armour-derived flat still wants the normal multipliers, but the pool is the headline' },
    ],
    discover: 'How much armour can you realistically stack at endgame, and does armour→chaos (Smith) out-damage a conventional build while being far tankier? The defensive stat IS the damage — uniquely survivable. Needs composer support for "armour applies to damage".',
  },
  {
    id: 'armour-break',
    name: 'Armour Break (shred enemy defence → amplify)',
    classes: ['Warrior (Warbringer)', 'Mercenary'],
    chain: 'Break the enemy\'s Armour → "Fully Broken Armour increases all Damage Taken" → every subsequent hit lands amplified',
    profile: 'both',
    status: 'candidate',
    evidence: 'Warbringer: "Break Armour equal to 10% of Hit Damage", Imploding Impacts "Fully Broken Armour increases all Damage Taken from Hits instead". Molten One\'s Gift: broken armour also increases Fire Damage Taken.',
    levers: [
      { lever: 'Armour break application (Warbringer / Sculpted Suffering)', weight: 'core', note: 'get the enemy to fully-broken fast' },
      { lever: '"Broken armour increases damage taken" (Imploding Impacts)', weight: 'core', note: 'converts the break into a global more-damage-taken debuff' },
      { lever: 'Hit damage (drives break amount)', weight: 'major', note: 'break scales with your hit, so raw damage feeds the break loop' },
    ],
    discover: 'Is armour-break + Imploding Impacts a bigger boss multiplier than penetration, and does it stack with shock? An enemy debuff that works regardless of your damage type.',
  },
  {
    id: 'triple-curse',
    name: 'Curse stacking (triple curse)',
    classes: ['Witch (Lich)'],
    chain: 'Whispers of Doom (+1 curse) + Lich Incessant Cacophony (+1 curse) = 3 curses applied at once',
    profile: 'both',
    status: 'theoretical',
    evidence: 'Whispers of Doom (keystone): +1 curse. Lich "Incessant Cacophony": +1 curse. Base 1 → 3.',
    levers: [
      { lever: 'Number of curses (3)', weight: 'core', note: 'each curse is a damage-taken / resistance multiplier on the enemy' },
      { lever: 'Curse effect %', weight: 'major', note: 'scales all three' },
      { lever: 'Curse application (on hit / mark)', weight: 'minor', note: 'delivery method' },
    ],
    discover: 'Are three stacked curses (e.g. -res + more-damage-taken + slow) a bigger boss multiplier than one curse + raw damage? Model curses as enemy debuffs.',
  },
];

export const LEVER_COLOR: Record<ScalingLever['weight'], string> = {
  core: '#f1d6a0',
  major: '#5fd6cd',
  minor: '#8f8a76',
  'clear-only': '#c9a9e0',
  trap: '#ec5a52',
};
export const LEVER_LABEL: Record<ScalingLever['weight'], string> = {
  core: 'CORE', major: 'major', minor: 'minor', 'clear-only': 'CLEAR-ONLY', trap: 'TRAP',
};
