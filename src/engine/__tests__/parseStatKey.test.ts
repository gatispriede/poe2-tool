import { parseStatKey } from '../parseStatKey';

describe('PoB stat key morphology', () => {
  it('reads _final as a more multiplier and _+% as an increase', () => {
    expect(parseStatKey('support_brutality_physical_damage_+%_final', 40))
      .toMatchObject({ form: 'more', value: 40, stat: 'damage', damageTypes: ['physical'] });
    expect(parseStatKey('attack_speed_+%', 15))
      .toMatchObject({ form: 'increased', value: 15, stat: 'attackSpeed' });
  });

  it('carries the sign of a negative operator', () => {
    expect(parseStatKey('support_double_barrel_crossbow_reload_speed_-%_final', 30))
      .toMatchObject({ form: 'more', value: -30, stat: 'reloadSpeed' });
  });

  it('finds conditions that trail the operator', () => {
    const effect = parseStatKey('support_executioner_damage_vs_enemies_on_low_life_+%_final', 35);
    expect(effect?.stat).toBe('damage');
    expect(effect?.conditions.length).toBeGreaterThan(0);
  });

  it('treats keys with no operator as base values', () => {
    expect(parseStatKey('number_of_additional_projectiles', 2))
      .toMatchObject({ form: 'flat', value: 2, stat: 'projectileCount' });
  });

  it('refuses millisecond timings rather than reading them as their noun', () => {
    // Without this, `inflict_exposure_for_x_ms = 8000` becomes 8000% penetration.
    expect(parseStatKey('inflict_exposure_for_x_ms_on_ignite', 8000)).toBeUndefined();
  });

  it('clamps penetration to a possible magnitude', () => {
    const effect = parseStatKey('damage_penetrates_resistance_+%', 4000);
    expect(effect && Math.abs(effect.value)).toBeLessThanOrEqual(100);
  });

  it('takes the subject noun from the end of the key, not the gem name', () => {
    // The gem is called "crit cooldown"; the stat it grants is crit chance.
    expect(parseStatKey('support_crit_cooldown_crit_chance_+%_final', 40))
      .toMatchObject({ stat: 'critChance', value: 40 });
    expect(parseStatKey('support_ailment_cooldown_ailment_chance_+%_final', 100))
      .toMatchObject({ stat: 'ailmentChance' });
    // …and a key that really is about cooldown still reads as cooldown.
    expect(parseStatKey('support_cooldown_reduction_cooldown_recovery_+%', 25))
      .toMatchObject({ stat: 'cooldownRecovery' });
  });

  it('marks niche qualifiers as conditions instead of flat multipliers', () => {
    const effect = parseStatKey('support_lockdown_distance_based_pin_damage_+%_final', 120);
    expect(effect?.conditions.length).toBeGreaterThan(0);
  });
});
