export interface TablePassiveRow {
  id: string;
  name: string;
  type: 'Small' | 'Notable' | 'Keystone';
  effect: string; // raw effect text
}

// Structured data extracted from original DataTable static markup (partial sample)
export const TABLE_PASSIVES: TablePassiveRow[] = [
  { id: 'armour-break', name: 'Armour Break', type: 'Small', effect: 'Break 25% increased Armour' },
  { id: 'anvils-weight', name: "Anvil's Weight", type: 'Notable', effect: 'Break Armour equal to 10% of Hit Damage dealt' },
  { id: 'imploding-impacts', name: 'Imploding Impacts', type: 'Notable', effect: 'You can Break Enemy Armour to below 0' },
  { id: 'jade-heritage', name: 'Jade Heritage', type: 'Notable', effect: 'Encase in Jade; Gain a stack of Jade every second; additional physical damage reduction % per jade [1], max jade stacks [10]' },
  { id: 'armour-small', name: 'Armour', type: 'Small', effect: '20% increased Armour' },
  { id: 'wooden-wall', name: 'Wooden Wall', type: 'Notable', effect: '20% of Damage from Hits is taken from your nearest Totem\'s Life before you' },
  { id: 'warcry-speed', name: 'Warcry Speed', type: 'Small', effect: '20% increased Warcry Speed' },
  { id: 'totem-life', name: 'Totem Life', type: 'Small', effect: '20% increased Totem Life' },
  { id: 'answered-call', name: 'Answered Call', type: 'Notable', effect: 'Trigger Ancestral Spirits when you Summon a Totem' },
  { id: 'block-chance-small', name: 'Block Chance', type: 'Small', effect: '6% increased Block chance' },
  { id: 'warcallers-bellow', name: "Warcaller's Bellow", type: 'Notable', effect: 'Corpses in your Presence Explode when you Warcry, dealing 25% of their Life as Physical Damage' },
  { id: 'renlys-training', name: "Renly's Training", type: 'Notable', effect: 'Gain 40% Base Chance to Block from Equipped Shield instead of the Shield\'s value' },
  { id: 'turtle-charm', name: 'Turtle Charm', type: 'Notable', effect: '35% less Block chance; Can Block Damage from all Hits while Shield is not Raised' },
  { id: 'greatwolfs-howl', name: "Greatwolf's Howl", type: 'Notable', effect: 'Ignore Warcry Cooldowns' },
  { id: 'stone-skin', name: 'Stone Skin', type: 'Notable', effect: '50% more Armour from Equipped Body Armour' },
  { id: 'slam-aoe', name: 'Slam Area of Effect', type: 'Small', effect: 'Slam Skills have 12% increased Area of Effect' },
  { id: 'earthbreaker', name: 'Earthbreaker', type: 'Notable', effect: '20% chance for Slam Skills you use yourself to cause Aftershocks' },
  { id: 'ancestral-empowerment', name: 'Ancestral Empowerment', type: 'Notable', effect: 'Every second Slam Skill you use yourself is Ancestrally Boosted' },
  { id: 'surprising-strength', name: 'Surprising Strength', type: 'Notable', effect: '40% more Damage against Heavy Stunned Enemies' },
  { id: 'hulking-form', name: 'Hulking Form', type: 'Notable', effect: '50% increased effect of Small Passive Skills' },
  { id: 'stun-buildup', name: 'Stun Buildup', type: 'Small', effect: '18% increased Stun Buildup' },
  { id: 'strength-small', name: 'Strength', type: 'Small', effect: '4% increased Strength' },
  { id: 'life-regeneration', name: 'Life Regeneration', type: 'Small', effect: 'Regenerate 0.5% of Life per second' },
  { id: 'mysterious-lineage', name: 'Mysterious Lineage', type: 'Notable', effect: '15% more Maximum Life' },
  { id: 'attack-area', name: 'Attack Area', type: 'Small', effect: '8% increased Area of Effect for Attacks' },
  { id: 'primal-growth', name: 'Primal Growth', type: 'Notable', effect: '20% increased Area of Effect if you\'ve Killed Recently; 10% increased Area of Effect for Attacks' },
  { id: 'melee-damage-small', name: 'Melee Damage', type: 'Small', effect: '15% increased Melee Damage with Hits at Close Range' },
  { id: 'in-your-face', name: 'In Your Face', type: 'Notable', effect: '40% increased Melee Damage with Hits at Close Range' },
  { id: 'attack-speed-if-hit', name: 'Attack Speed if Hit', type: 'Small', effect: '5% increased Attack Speed if you\'ve been Hit Recently' },
  { id: 'revenge', name: 'Revenge', type: 'Notable', effect: '12% increased Attack Speed if you\'ve been Hit Recently' },
  { id: 'flail-crit-small', name: 'Flail Critical Chance', type: 'Small', effect: '15% increased Critical Hit Chance with Flails' },
  { id: 'morning-star', name: 'Morning Star', type: 'Notable', effect: '30% increased Critical Hit Chance with Flails; 20% increased Critical Damage Bonus with Flails' },
  { id: 'rattling-ball', name: 'Rattling Ball', type: 'Notable', effect: '25% increased Damage with Flails' },
  { id: 'spiked-whip', name: 'Spiked Whip', type: 'Notable', effect: '25% increased Damage with Flails' },
  { id: 'fulmination', name: 'Fulmination', type: 'Notable', effect: '40% increased chance to Ignite; 40% increased Damage with Hits against Ignited Enemies' },
  { id: 'ignite-effect', name: 'Ignite Effect', type: 'Small', effect: '12% increased Magnitude of Ignite you inflict' },
  { id: 'fire-damage-small', name: 'Fire Damage', type: 'Small', effect: '12% increased Fire Damage' },
  { id: 'fire-penetration-stun', name: 'Fire Penetration and Stun Buildup', type: 'Small', effect: '10% increased Stun Buildup; Damage Penetrates 5% Fire Resistance' },
  { id: 'fire-penetration', name: 'Fire Penetration', type: 'Small', effect: 'Damage Penetrates 6% Fire Resistance' },
  { id: 'shield-defences', name: 'Shield Defences', type: 'Small', effect: '25% increased Defences from Equipped Shield' },
  { id: 'flail-damage-small', name: 'Flail Damage', type: 'Small', effect: '10% increased Damage with Flails' },
  { id: 'ball-and-chain', name: 'Ball and Chain', type: 'Notable', effect: '15% increased Damage with Flails; 6% increased Attack Speed with Flails' },
];
