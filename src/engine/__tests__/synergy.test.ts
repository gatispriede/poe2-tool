import { loadDataset } from '../dataset.node';
import { buildSkillProfile } from '../skillProfile';
import { findSynergies, profilesFor } from '../synergy';
import { Dataset } from '../types';

const dataset: Dataset = loadDataset(process.cwd());
const partners = profilesFor(dataset.skills);
const profile = (name: string) =>
  buildSkillProfile(dataset.skills.find((s) => s.name === name && !s.isSupport)!);

const partnerNames = (links: { partner: { name: string } }[]) => links.map((l) => l.partner.name);

describe('synergy market', () => {
  it('finds who supplies what a skill consumes', () => {
    const { enablers } = findSynergies(profile('Detonate Dead'), partners, { limit: 40 });
    // Detonate Dead eats corpses; minion skills leave them.
    expect(partnerNames(enablers)).toContain('Raise Zombie');
    expect(enablers.find((l) => l.partner.name === 'Raise Zombie')?.rule.id).toBe('corpse');
  });

  it('finds who consumes what a skill supplies', () => {
    const { enabled } = findSynergies(profile('Sunder'), partners, { limit: 60 });
    expect(enabled.length).toBeGreaterThan(0);
  });

  it('pairs trigger hosts with triggerable payloads', () => {
    const { enablers } = findSynergies(profile('Comet'), partners, { limit: 40 });
    const trigger = enablers.find((l) => l.rule.id === 'trigger' || l.rule.id === 'meta-energy');
    expect(trigger).toBeDefined();
  });

  it('does not offer a skill an amplifier it already supplies itself', () => {
    // Spark shocks on its own, so "partner shocks for you" is not a finding.
    const { enablers } = findSynergies(profile('Spark'), partners, { limit: 60 });
    expect(enablers.every((l) => l.rule.id !== 'shock-amp')).toBe(true);
  });

  it('never pairs a skill with itself or with a support gem', () => {
    const { enablers, enabled } = findSynergies(profile('Spark'), partners, { limit: 60 });
    for (const link of [...enablers, ...enabled]) {
      expect(link.partner.name).not.toBe('Spark');
      expect(link.partner.isSupportOnly).toBe(false);
    }
  });
});
