# Gaobin — Triggered Comet Blood Mage

**Source:** https://poe.ninja/poe2/builds/vaal/character/Gaobin-8049/%E5%B0%8F%E6%89%8B%E5%86%B0%E5%86%B0%E5%86%B7?i=0
**Fetched:** 2026-05-15 (poe.ninja's "Last fetched" shown as 7 days ago)
**League:** Fate of the Vaal

## Header

| Field | Value |
|-------|-------|
| Account | `Gaobin#8049` |
| Character | `小手冰冰冷` |
| Class | Blood Mage |
| Level | 99 |

## Damage mechanic (the headline case study)

This build has **two Comets** — direct-cast and triggered — and the trigger
copy outputs **11× more DPS** than the direct-cast copy. This is the canonical
example of "tooltip damage is the wrong objective function".

```
Spark (cast often, crits often, with Pierce/Zenith/Rapid Casting/Projectile Acceleration)
   → Cast on Critical (trigger)
       → Comet  ← 180M effective DPS
```

The separate direct-cast Comet (with Considered Casting, Elemental Focus,
Concentrated Area, Minion Pact II, Rakiata's Flow) reports 16M DPS — strong on
its own, but a footnote next to the triggered version.

### Reported skill DPS (poe.ninja)

| Skill | DPS | Notes |
|-------|-----|-------|
| Comet (triggered) | **180M** | Via Spark + Cast on Critical |
| Comet (direct) | 16M | Same skill, direct cast — 11× lower |
| Arc | 957k | Routed off Spellslinger trigger |
| Spark | 831k | The trigger source itself |

The "average hit" label on Comet implies that's per-cast, before trigger
frequency is applied. (Need to verify — poe.ninja's exact DPS-vs-average-hit
semantics matter for our calc validation.)

## Stats

| | Value |
|---|---|
| Attributes (Str/Dex/Int) | 187 / 86 / 682 |
| Life | 4,003 |
| Energy Shield | — (converted to Mana by Eldritch Battery) |
| Mana | 9,312 |
| Spirit | 185 |
| Armour / Evasion | 252 / 302 |
| Resistances (F/C/L/Chaos) | 60% / 15% / 45% / 0% |
| Movement Speed | 135% |
| Item Rarity | 15% |
| Effective Health Pool | 20k |
| Max Hit (Phys/Fire/Cold/Lit/Chaos) | 15k / 34k / 17k / 25k / 15k |

Low resistances are the cost of going all-in on damage; this is a classic
"glass cannon trigger build".

## Keystones

- **Eldritch Battery** — Converts ES to Mana; doubles mana costs.
- **Mind Over Matter** — Damage taken from Mana before Life; -50% Mana Recovery Rate.

With EB + MoM, the 9,312 mana pool functions as a damage buffer. Together
with the converted ES this is how the build survives despite 0% chaos res.

## Skills + supports

- **Life Remnants 20** — Remnant Potency III, Harmonic Remnants II, Khatal's Rejuvenation, Clarity I, Uruk's Smelting
- **Sigil of Power 20** — Overabundance II, Cooldown Recovery II, Second Wind III, Efficiency II, Prolonged Duration II
- **Comet 21 / 23** *(direct-cast version)* — Rakiata's Flow, Considered Casting, Elemental Focus, Minion Pact II, Concentrated Area
- **Spark 21 / 23** *(trigger source)* — Zenith II, Rapid Casting II, Pierce III, Lifetap, Projectile Acceleration III
- **Cast on Critical (trigger) 21 / 23** — **Comet 21 / 23**, Atalui's Bloodletting, Zenith II, Spell Cascade, Dialla's Desire
- **Soul Offering 21 / 20** — Sacrificial Offering, Danse Macabre, Prolonged Duration II, Minion Mastery, Efficiency II
- **Spellslinger (trigger) 18** — Arc 21 / 23, Dominus' Grasp, Cooldown Recovery II, Swift Affliction III
- **Mana Tempest 21 / 20** — Lightning Mastery, Cooldown Recovery II, Lifetap
- **Sniper's Mark 12 / 20** — Charge Profusion II, Overabundance II, Uhtred's Augury
- **Freezing Mark 18 / 20** — Cooldown Recovery II, Second Wind III, Efficiency II
- **Archmage 21 / 23** — Lightning Mastery, Uhtred's Omen
- **Voltaic Mark 12 / 20** — Uhtred's Exodus

This build has *three* trigger setups (CoC → Comet, Spellslinger → Arc, plus
the implicit Archmage scaling). The optimizer must handle multiple
simultaneous trigger chains.

## Tree

- Allocated counts: **122 passives / 3 ascendancy / 8** (likely jewel sockets).
- Specific node list NOT yet extracted.

## Quest rewards

Same selections as RsFearless except Act 4 Abandoned Prison takes Mana
Recovery from Flasks (vs. Life Recovery), consistent with this build's
mana-as-defense design.

## Vaal body parts

- Commanding Arm
- Caster Arm
- Surefooted Leg
- Calm Leg

(League-specific augmentations — relevant for the Vaal league only.)

## Base jewels (names only; mods not yet extracted)

- Megalomaniac Diamond
- Prism of Belief Diamond
- The Adorned Diamond
- Damnation Wound Sapphire
- Eagle Heart Sapphire
- Kraken Solace Sapphire
- Loath Shine Sapphire
- Loath Stone Sapphire
- Maelström Breath Sapphire
- Phoenix Curio Sapphire (×2)
- Plague Shine Sapphire

## Equipment

Parsed from the PoB import code. Full structured data in
[raw/gaobin-build.json](raw/gaobin-build.json); the raw code is in
[raw/gaobin-pob.txt](raw/gaobin-pob.txt) and decoded XML in
[raw/gaobin-pob.xml](raw/gaobin-pob.xml).

| Slot | Item | Base |
|------|------|------|
| Weapon 1 | Mind Goad | Dueling Wand |
| Weapon 2 (offhand) | Rathpith Globe | Sacred Focus |
| Weapon 1 Swap | Eagle Branch | Chiming Staff |
| Helmet | The Vertex | Tribal Mask |
| Body Armour | Atziri's Splendour | Sacrificial Regalia |
| Gloves | Carrion Caress | Sirenscale Gloves |
| Boots | Armageddon Spark | Sekhema Sandals |
| Belt | Ingenuity | Utility Belt |
| Amulet | Soul Collar | Solar Amulet |
| Ring 1 | Chimeric Turn | Breach Ring |
| Ring 2 | Kalandra's Touch | Ring (mirrored) |
| Flask 1 | Careful Ultimate Life Flask of the Brewer | — |
| Flask 2 | Caustic Ultimate Mana Flask of the Ample | — |
| Charm 1 | The Fall of the Axe | Silver Charm |
| Charm 2 | Rite of Passage | Golden Charm |
| Charm 3 | Evergreen Thawing Charm of the Ample | — |

Key uniques driving the damage: **Mind Goad** (Dueling Wand, "Grants Skill:
Level 18 Spellslinger" implicit — the trigger source), **Rathpith Globe**
(Sacred Focus offhand), **Ingenuity** (belt), **Kalandra's Touch** (mirrors
the other ring). The build is essentially uniques-only.

Example item with full mod text — Mind Goad (Dueling Wand):

```
Rarity: RARE
Mind Goad / Dueling Wand
Item Level 81, Quality 21, Sockets S S, LevelReq 78
Runes: Hedgewitch Assandra's Rune of Wisdom, Saqawal's Rune of the Sky
Implicits (6):
  +1 to Level of all Spell Skills
  Gain 5% of Damage as Extra Damage of all Elements
  12% chance when collecting an Elemental Infusion to gain an additional Elemental Infusion of the same type
  Archon recovery period expires 30% faster
  Grants Skill: Level 18 Spellslinger
Explicits:
  73% increased Critical Hit Chance for Spells (fractured)
  +6 to Level of all Cold Spell Skills (desecrated)
  Gain 33% of Damage as Extra Cold Damage
  Gain 32% of Damage as Extra Lightning Damage
  134% increased Spell Damage
  40% increased Critical Spell Damage Bonus
```

The +6 Cold Spell Skills mod is critical — combined with +1 from the
implicit, that's +7 levels to Comet, which translates to massive base damage
scaling. The fractured 73% crit chance is what makes Cast on Critical fire
constantly.

## Tree

133 allocated nodes. Full node ID list in `trees[0].nodes`. Tree version
`0_4`, classInternalId `1` (Sorceress), ascendancyInternalId `Witch2`
(Blood Mage).
