// Test script for passive tree optimizer
const { optimizePassiveAllocation, aggregatePassiveNodes } = require('../src/passives/passiveTreeOptimizer.ts');
const { MOCK_PASSIVE_TREE } = require('../src/passives/mockPassiveTreeData.ts');

console.log('=== Passive Tree Optimizer Test ===\n');

// Test parameters
const skillElement = 'fire';
const baseDamage = 500;
const baseCastSpeed = 0.8; // casts per second
const baseCritChance = 5;
const maxPoints = 120;

console.log('Test Parameters:');
console.log(`- Skill Element: ${skillElement}`);
console.log(`- Base Damage: ${baseDamage}`);
console.log(`- Base Cast Speed: ${baseCastSpeed}/s`);
console.log(`- Base Crit Chance: ${baseCritChance}%`);
console.log(`- Max Passive Points: ${maxPoints}\n`);

console.log(`Available Passive Nodes: ${MOCK_PASSIVE_TREE.length}\n`);

// Run optimization
console.log('Running optimization...\n');
const optimizedNodes = optimizePassiveAllocation(
  MOCK_PASSIVE_TREE,
  maxPoints,
  skillElement,
  baseDamage,
  baseCastSpeed,
  baseCritChance
);

console.log(`Optimized Allocation: ${optimizedNodes.length} nodes selected\n`);

// Aggregate stats
const stats = aggregatePassiveNodes(optimizedNodes);

console.log('=== Aggregated Stats ===');
Object.entries(stats).forEach(([key, value]) => {
  if (typeof value === 'number') {
    console.log(`  ${key}: +${value}`);
  }
});

// Group by type
const byType = {
  keystone: optimizedNodes.filter(n => n.type === 'keystone'),
  notable: optimizedNodes.filter(n => n.type === 'notable'),
  small: optimizedNodes.filter(n => n.type === 'small')
};

console.log('\n=== Nodes by Type ===');
console.log(`Keystones: ${byType.keystone.length}`);
byType.keystone.forEach(n => console.log(`  - ${n.name}`));

console.log(`\nNotables: ${byType.notable.length}`);
byType.notable.slice(0, 10).forEach(n => console.log(`  - ${n.name}`));
if (byType.notable.length > 10) {
  console.log(`  ... and ${byType.notable.length - 10} more`);
}

console.log(`\nSmall Passives: ${byType.small.length}`);

console.log('\n=== Test Complete ===');

