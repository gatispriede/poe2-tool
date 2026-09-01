import { loadDataset } from '../dataset.node';
import { buildSources } from '../sources';
import { analyzeSkill } from '../skillIndex';
import { Dataset, RawSkill } from '../types';

const dataset: Dataset = loadDataset(process.cwd());
const sources = buildSources(dataset);
const raw = (name: string): RawSkill =>
  dataset.skills.find((s) => s.name === name && !s.isSupport)!;

const names = (matches: { source: { name: string } }[]) => matches.map((m) => m.source.name);

describe('skill index', () => {
  const spark = analyzeSkill(raw('Spark'), sources.all, { limitPerBucket: 0 });
  const sunder = analyzeSkill(raw('Sunder'), sources.all, { limitPerBucket: 0 });

  it('finds sources in every bucket the platform reports', () => {
    expect(spark.counts.damage).toBeGreaterThan(100);
    expect(spark.counts.speed).toBeGreaterThan(20);
    expect(sunder.counts.aoe).toBeGreaterThan(10);
  });

  it('never files an area-of-effect source under a skill with no area', () => {
    const aoeSources = spark.buckets.aoe.flatMap((m) => m.matches);
    expect(aoeSources.some((m) => m.effect.stat === 'areaOfEffect')).toBe(false);
  });

  it('excludes weapons the skill cannot swing', () => {
    // Lioneye's Glare is a bow; Sunder is a mace/axe/sword slam.
    expect(names(sunder.buckets.damage)).not.toContain("Lioneye's Glare");
  });

  it('excludes weapon-local damage from spells', () => {
    const localOnSpell = spark.buckets.damage
      .flatMap((m) => m.matches)
      .filter((m) => m.applicability.reasons.some((r) => r.startsWith('local to the weapon')));
    expect(localOnSpell).toHaveLength(0);
  });

  it('ranks by gain per point, so a cheap node can beat a deep one', () => {
    const treeMatches = spark.buckets.damage.filter((m) => m.source.cost.kind === 'passivePoints');
    const efficiencies = treeMatches.map((m) => m.efficiency);
    expect(efficiencies).toEqual([...efficiencies].sort((a, b) => b - a));
  });

  it('files a source under what it is mostly worth, not under a side stat', () => {
    // A weapon whose value is local physical damage belongs in Damage even
    // though its attack-speed line also contributes to the rate axis.
    const speedNames = names(sunder.buckets.speed);
    const damageNames = names(sunder.buckets.damage);
    expect(damageNames.length).toBeGreaterThan(speedNames.length);
    for (const match of sunder.buckets.speed) {
      expect(Math.abs(match.total.rate)).toBeGreaterThan(0);
    }
  });

  it('keeps the reason a conditional source is conditional', () => {
    const conditional = spark.buckets.damage.find((m) => m.strength === 'conditional');
    expect(conditional?.matches[0].applicability.reasons.length).toBeGreaterThan(0);
  });

  it('keeps "cannot support skills with a cooldown" gems off cooldown skills', () => {
    const charged = dataset.skills.find((s) => s.name === 'Charged Sunder' && !s.isSupport)!;
    const analysis = analyzeSkill(charged, sources.all, { limitPerBucket: 0 });
    const all = [...analysis.buckets.damage, ...analysis.buckets.speed, ...analysis.buckets.aoe];
    expect(names(all)).not.toContain('Hit and Run');
  });

  it('gates support gems on PoB skill types', () => {
    const meleeOnly = sources.supports.find((s) => (s.requireSkillTypes ?? []).includes('Melee'));
    expect(meleeOnly).toBeDefined();
    expect(names(spark.buckets.damage)).not.toContain(meleeOnly!.name);
  });
});
