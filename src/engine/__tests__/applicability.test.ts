import { applies } from '../applicability';
import { parseModLine } from '../parseMod';
import { buildSkillProfile, skillCapabilities } from '../skillProfile';
import { loadDataset } from '../dataset.node';
import { Dataset, RawSkill } from '../types';

const dataset: Dataset = loadDataset(process.cwd());
const raw = (name: string): RawSkill =>
  dataset.skills.find((s) => s.name === name && !s.isSupport)!;
const profile = (name: string) => buildSkillProfile(raw(name));
const effect = (line: string) => parseModLine(line)[0];

describe('applicability', () => {
  const spark = profile('Spark');
  const sunder = profile('Sunder');

  it('routes cast speed to spells and attack speed to attacks', () => {
    expect(applies(effect('10% increased Cast Speed'), spark).applies).toBe(true);
    expect(applies(effect('10% increased Cast Speed'), sunder).applies).toBe(false);
    expect(applies(effect('10% increased Attack Speed'), sunder).applies).toBe(true);
    expect(applies(effect('10% increased Attack Speed'), spark).applies).toBe(false);
  });

  it('honours damage types, and knows an attack inherits its type from gear', () => {
    expect(applies(effect('20% increased Lightning Damage'), spark).strength).toBe('direct');
    expect(applies(effect('20% increased Cold Damage'), spark).applies).toBe(false);
    // Sunder is a weapon attack: elemental scaling is possible but not innate.
    expect(applies(effect('20% increased Fire Damage'), sunder).strength).toBe('conditional');
    expect(applies(effect('20% increased Physical Damage'), sunder).strength).toBe('direct');
  });

  it('kills weapon-restricted mods on spells and keeps them on compatible attacks', () => {
    expect(applies(effect('20% increased Damage with Bows'), spark).applies).toBe(false);
    expect(applies(effect('20% increased Damage with Bows'), sunder).applies).toBe(false);
    expect(applies(effect('20% increased Damage with Maces'), sunder).applies).toBe(true);
  });

  it('treats totem mods as a build decision rather than a hard no', () => {
    const totem = effect('20% increased Totem Damage');
    const caps = skillCapabilities(raw('Spark'));
    expect(applies(totem, spark, { capabilities: caps }).strength).toBe('setup');
    expect(applies(totem, spark, { capabilities: caps, delivery: 'totem' }).strength).toBe('direct');
  });

  it('rejects geometry a skill does not have', () => {
    expect(applies(effect('10% increased Area of Effect'), spark).applies).toBe(false);
    expect(applies(effect('10% increased Area of Effect'), sunder).applies).toBe(true);
    expect(applies(effect('+2 to number of Projectiles'), sunder).applies).toBe(false);
    expect(applies(effect('+2 to number of Projectiles'), spark).applies).toBe(true);
  });

  it('reports conditions as reduced uptime, not as absence', () => {
    const conditional = applies(effect('30% more Damage while Channelling'), spark);
    expect(conditional.applies).toBe(true);
    expect(conditional.strength).toBe('conditional');
    expect(conditional.uptime).toBeLessThan(1);
  });

  it('only lets presence mods reach skills that act through presence', () => {
    expect(applies(effect('30% increased Presence Area of Effect'), spark).applies).toBe(false);
  });
});
