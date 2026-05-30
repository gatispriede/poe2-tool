# zeolet — Ice Shot Amazon (attack-based bow build)

**Source:** https://poe.ninja/poe2/builds/vaal/character/zeolet-9674/InwJokerJrZaaa?i=0
**Fetched:** 2026-05-15 (poe.ninja's "Last fetched" shown as 7 days ago)
**League:** Fate of the Vaal

## Header

| Field | Value |
|-------|-------|
| Account | `zeolet#9674` |
| Character | `InwJokerJrZaaa` |
| Class | Huntress |
| Ascendancy | Amazon |
| Level | 97 |

## Why this fixture matters

This is the **third damage profile** in our baseline set, and structurally
different from the two Blood Mage spell builds:

- RsFearless: spell + trigger chain (Spark → CoC → Arc)
- Gaobin: spell + trigger chain at scale (Spark → CoC → Comet, 180M DPS)
- **zeolet: attack + self-cast (no trigger)** — fire Ice Shot, hit deals damage
  directly using the bow's base damage

The user's words: this is "USE not CAST" — pressing the button activates the
skill, which uses the weapon to deal damage. There is no spell scaling. The
weapon's physical damage line is the foundation; everything else is a
multiplier on top.

Ice Shot is a projectile attack skill. Its damage formula starts from:
```
(weapon physical damage × N% effectiveness) → converted/added cold → multipliers
```
Not:
```
(gem base damage at level L) × spell multipliers
```

The optimizer must classify this differently from spell builds.

## Reported skill DPS (poe.ninja)

| Skill | DPS |
|-------|-----|
| Ice Shot | **17M** |

Only one DPS line shown — this is genuinely a single-skill build. No
trigger chain.

## Stats

| | Value |
|---|---|
| Attributes (Str/Dex/Int) | 52 / 163 / 87 |
| Life | 1,369 |
| Energy Shield | 72 |
| Mana | 622 |
| Spirit | 189 |
| Armour / Evasion | — / 10,075 |
| Deflect Chance | 37% |
| Physical taken as | 6% |
| Resistances (F/C/L/Chaos) | 75% / 75% / 75% / 58% |
| Movement Speed | 139% |
| Effective Health Pool | 7.6k |
| Max Hit (Phys/Fire/Cold/Lit/Chaos) | 1.5k / 5.1k / 5.1k / 5.1k / 3.3k |

Classic evasion-stacking glass cannon. 17M DPS at 1,369 life and 7.6k EHP —
defensive layers are deflect (37%) + evasion (10k) + the unique armor
(Hyrri's Ire) absorbing phys damage.

## Equipment

Parsed from the PoB import code. Full structured data in
[raw/zeolet-build.json](raw/zeolet-build.json).

| Slot | Rarity | Item | Base |
|------|--------|------|------|
| Weapon 1 | RARE | Behemoth Arch | Obliterator Bow |
| Weapon 2 | RARE | Rage Skewer | Visceral Quiver |
| Helmet | UNIQUE | The Vertex | Tribal Mask |
| Body Armour | UNIQUE | Hyrri's Ire | Armoured Vest |
| Gloves | RARE | Gloom Grasp | Polished Bracers |
| Boots | RARE | Rage Hoof | Drakeskin Boots |
| Belt | UNIQUE | Ingenuity | Utility Belt |
| Amulet | RARE | Bramble Charm | Solar Amulet |
| Ring 1 | RARE | Blight Eye | Breach Ring |
| Ring 2 | UNIQUE | Kalandra's Touch | Ring (mirrored) |
| Flask 1 | UNIQUE | Olroth's Resolve | Ultimate Life Flask |
| Flask 2 | MAGIC | Substantial Ultimate Mana Flask of the Practitioner | — |
| Charm 1 | UNIQUE | For Utopia | Stone Charm |
| Charm 2 | MAGIC | Evergreen Dousing Charm of the Ample | — |
| Charm 3 | MAGIC | Drizzling Thawing Charm of the Verdant | — |

PoB exported with `useSecondWeaponSet=true` — the parser normalises this so
"Weapon N Swap" appears here as "Weapon N".

### Behemoth Arch (Obliterator Bow) — the damage source

This is where attack builds diverge from spell builds: the weapon's own
damage is the foundation, not a gem-level scaling curve.

```
Implicits (6 + 1 base):
  Bow Attacks fire an additional Arrow
  50% increased Attack Damage against Rare or Unique Enemies
  Gain 5% of Damage as Extra Damage of all Elements
  Bonded: 20% increased Projectile Speed
  Bonded: +1 to Level of all Attack Skills
  Bonded: 8% chance to gain an additional random Charge when you gain a Charge
  50% reduced Projectile Range

Explicits:
  Adds 39 to 66 Physical Damage (fractured)
  19% increased Attack Speed (desecrated)
  258% increased Physical Damage
  +197 to Accuracy Rating
  +5% to Critical Hit Chance
  +5 to Level of all Projectile Skills

Runes:
  Saqawal's Rune of the Sky
  Farrul's Rune of the Hunt
  Countess Seske's Rune of Archery
```

258% increased physical damage + 39-66 added phys + 19% attack speed is the
damage core. The +5 levels to Projectile Skills on a rare weapon is huge.
The fractured mod ("Adds 39 to 66 Physical Damage") is the key — it forces
the random crafting to keep this roll. Compare to spell builds where the
critical roll is "+X to Level of cold spell skills" — different category of
crafting target, same underlying logic of finding the right multiplier.

## Skills + supports

- **Ice Shot 21/23** *(the main attack)* — Minion Pact II, Overextend, Rigwald's Ferocity, Rakiata's Flow, Garukhan's Resolve
- Barrage 21/20 — Second Wind III, Cooldown Recovery II, Heightened Charges, Deliberation, Rapid Casting II
- Herald of Thunder 21/20 — Magnified Area II, Elemental Armament II, Embitter, Freeze, Oisín's Oath
- Herald of Ice 21/23 — Magnified Area II, Armour Explosion (trigger), Shock, Uul-Netol's Embrace, Uruk's Smelting
- Wind Dancer (trigger) 21/23 — Blind II, Maim, Freeze, Life Leech III, Mana Leech
- Mana Remnants 12 — Remnant Potency III, Harmonic Remnants II, Khatal's Rejuvenation
- Ice-Tipped Arrows (trigger) 20/20 — Rising Tempest, Second Wind III, Magnified Area II
- Wolf Pack 11/20 — Uhtred's Omen, Dialla's Desire
- Freezing Mark 19/20 — Mark of Siphoning II, Cold Mastery

Two trigger setups (Armour Explosion via Herald of Ice, Wind Dancer) but
they're defensive/utility, NOT damage routes. The damage genuinely comes
from Ice Shot direct-fire.

## Tree

130 allocated nodes. Tree version `0_4`, classInternalId `7` (Huntress),
ascendancyInternalId — see JSON. Headline count `120 / 1 / 8` on poe.ninja
(passives / ascendancy / jewel sockets).

## Base jewels — note the cornerstone candidates

```
Against the Darkness Time-Lost Diamond
Heart of the Well Diamond
Prism of Belief Diamond
Chimeric Splinter Emerald
Eagle Wound Time-Lost Emerald
```

Cornerstone-style unique jewels (e.g. Time-Lost variants) can rewrite how a
build operates — they're not just "a small stat bonus", they can flip
defensive layers or unlock damage interactions. See
[poe2-mechanics.md](../poe2-mechanics.md) "Cornerstone unique jewels".

## Vaal body parts

- Combat Arm
- Evasive Leg
