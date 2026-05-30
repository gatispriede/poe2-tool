# RsFearless — Triggered Arc Blood Mage

**Source:** https://poe.ninja/poe2/builds/vaal/character/RsFearless-1355/ttv_RsFearless?i=2
**Fetched:** 2026-05-15 (poe.ninja's "Last fetched" shown as 7 days ago)
**League:** Fate of the Vaal

## Header

| Field | Value |
|-------|-------|
| Account | `RsFearless#1355` |
| Character | `ttv_RsFearless` |
| Class | Blood Mage |
| Level | 100 |

## Damage mechanic (the key one)

Despite "Arc" being the headline skill, **this is a trigger build**, not
direct-cast Arc. The chain is:

```
Spark (cast often, crits often)
   → Cast on Critical (trigger gem)
       → Arc   (1.0M DPS — the actual damage)
       → Comet
```

So Arc's reported DPS is its effective damage *given the trigger frequency*,
not its tooltip per-hit value.

### Reported skill DPS (poe.ninja)

| Skill | DPS | Notes |
|-------|-----|-------|
| Arc | **1.0M** | Triggered by Spark crits |
| Orb of Storms | 562k | |
| Spark | 491k | The trigger source; its own hits count toward damage |
| Lightning Warp | 146k | |
| Ball Lightning | 66k | Average hit |

## Stats

| | Value |
|---|---|
| Attributes (Str/Dex/Int) | 122 / 47 / 186 |
| Life | 3,134 |
| Energy Shield | 7,802 |
| Mana | — (Blood Magic keystone) |
| Spirit | 170 |
| Armour / Evasion | 407 / 606 |
| Resistances (F/C/L/Chaos) | 75% / 75% / 75% / 74% |
| Movement Speed | 135% |
| Item Rarity | 136% |
| Charges (Power/Frenzy/Endurance) | 3 / 3 / 3 |
| Effective Health Pool | 28k |
| Max Hit (Phys/Fire/Cold/Lit/Chaos) | 12k / 43k / 43k / 43k / 31k |

## Keystones

- **Blood Magic** — Skill mana costs converted to life costs; no mana pool.

## Skills + supports

Format: `Skill name [level / quality if shown]` then linked supports.

- **Sigil of Power 20** — Prolonged Duration II, Second Wind III, Cooldown Recovery II, Rapid Casting II, Magnified Area II
- **Lightning Warp 9** — Efficiency II, Persistent Ground III, Rapid Casting II, Unleash, Harmonic Remnants II
- **Orb of Storms 21 / 20** — Efficiency II, Overabundance II, Unleash, Arbiter's Ignition, Xoph's Pyre
- **Elemental Weakness 21 / 23** — Efficiency II, Ritualistic Curse, Magnified Area II, Focused Curse, Cursed Ground
- **Spark 21 / 20** — Efficiency II, Fork, Projectile Acceleration III, Considered Casting, Esh's Radiance *(this is the trigger source)*
- **Cast on Critical (trigger) 21 / 20** — Arc 21 / 20, Comet 21 / 20, Boundless Energy II, Dialla's Desire, Uhtred's Augury
- **Arctic Armour 20 / 20** — Frost Nexus, Freeze, Cold Mastery, Cold Penetration, Tul's Stillness
- **Ball Lightning 11** — Efficiency II, Rapid Casting II, Multishot II, Projectile Acceleration I
- **Life Remnants 20** — Remnant Potency I, Harmonic Remnants II, Khatal's Rejuvenation
- **Siphon Elements 21 / 23** — Harmonic Remnants II, Cold Mastery
- **Time of Need 21 / 23** — Compressed Duration II, Uhtred's Omen
- **Sigil of Power 19** *(second copy)*

## Tree

- Allocated counts: **123 passives / 4 ascendancy / 8** (likely jewel sockets).
- Specific node list NOT yet extracted (requires tree-view interaction).

## Quest reward selections (relevant for stat baseline)

- Act 2 Valley of the Titans: Medallion (+30% Charm Effect Duration, +1 Charm Slot)
- Act 3 Venom Crypts: Venom Draught (+25% Stun Threshold)
- Act 4 Abandoned Prison: Goddess of Justice (+30% Life Recovery from Flasks)
- Act 4 Halls of the Dead × 3: +5% to Fire / Cold / Lightning Resistance
- Qimah Interlude: Seven Pillars (+5% to all Elemental Resistances)

## Base jewels (names only; mods not yet extracted)

- Heart of the Well Diamond
- Megalomaniac Diamond
- Blight Breath Sapphire
- Carrion Shine Sapphire
- Hypnotic Scar Sapphire
- Maelström Splinter Sapphire
- Phoenix Cut Sapphire

## Equipment

Parsed from the PoB import code. Full structured data in
[raw/rsfearless-build.json](raw/rsfearless-build.json); the raw code is in
[raw/rsfearless-pob.txt](raw/rsfearless-pob.txt) and decoded XML in
[raw/rsfearless-pob.xml](raw/rsfearless-pob.xml).

| Slot | Item | Base |
|------|------|------|
| Weapon 1 | Corpse Cry | Chiming Staff |
| Weapon 1 Swap | Rapture Call | Chiming Staff |
| Helmet | The Vertex | Tribal Mask |
| Body Armour | Atziri's Splendour | Sacrificial Regalia |
| Gloves | Sol Paw | Opulent Gloves |
| Boots | Gloom Spark | Sekhema Sandals |
| Belt | Soul Tether | Long Belt |
| Amulet | Eagle Medallion | Gold Amulet |
| Ring 1 | Seed of Cataclysm | Lazuli Ring |
| Ring 2 | Ghoul Turn | Gold Ring |
| Flask 1 | Bubbling Ultimate Life Flask of the Ample | — |
| Flask 2 | Seething Ultimate Mana Flask of the Ample | — |
| Charm 1 | The Fall of the Axe | Silver Charm |
| Charm 2 | Rite of Passage | Golden Charm |
| Charm 3 | Clinician's Thawing Charm of the Brewer | — |

Each item's implicits/explicits/runes are in the JSON. Stack of heavy unique
items: the build relies on **Atziri's Splendour** (the dual-defence body),
**The Vertex** (Tribal Mask), and two unique daggers (**Corpse Cry** / **Rapture Call**).

## Tree

156 allocated nodes (passives + ascendancy + jewel-tree). Full node ID list
in the JSON under `trees[0].nodes`. Tree version `0_4`, classId 5
(`Sorceress`→Witch ascendancy parent), ascendClassId 1 (Blood Mage).
