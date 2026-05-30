// Extract passive tree nodes from PathOfBuilding tree.json
const fs = require('fs');
const path = require('path');

const treePath = path.join(__dirname, '../PathOfBuilding-PoE2/src/TreeData/0_1/tree.json');

try {
  console.log('Reading tree.json...');
  const treeData = JSON.parse(fs.readFileSync(treePath, 'utf8'));

  console.log('Tree data structure keys:', Object.keys(treeData));

  if (treeData.nodes) {
    const nodes = Object.values(treeData.nodes);
    console.log(`\nTotal nodes: ${nodes.length}`);

    // Analyze node types
    const nodeTypes = {};
    const damageTypes = {
      spell: [],
      elemental: [],
      fire: [],
      cold: [],
      lightning: [],
      chaos: [],
      physical: [],
      attack: [],
      critical: [],
      castSpeed: [],
      attackSpeed: []
    };

    nodes.forEach(node => {
      if (!node.stats || node.stats.length === 0) return;

      const statsText = node.stats.join(' ').toLowerCase();

      // Categorize by damage type
      if (statsText.includes('spell damage') || statsText.includes('spell crit')) {
        damageTypes.spell.push(node);
      }
      if (statsText.includes('elemental damage')) {
        damageTypes.elemental.push(node);
      }
      if (statsText.includes('fire damage')) {
        damageTypes.fire.push(node);
      }
      if (statsText.includes('cold damage')) {
        damageTypes.cold.push(node);
      }
      if (statsText.includes('lightning damage')) {
        damageTypes.lightning.push(node);
      }
      if (statsText.includes('chaos damage')) {
        damageTypes.chaos.push(node);
      }
      if (statsText.includes('physical damage') || statsText.includes('melee damage')) {
        damageTypes.physical.push(node);
      }
      if (statsText.includes('attack damage') || statsText.includes('attack crit')) {
        damageTypes.attack.push(node);
      }
      if (statsText.includes('critical') || statsText.includes('crit')) {
        damageTypes.critical.push(node);
      }
      if (statsText.includes('cast speed')) {
        damageTypes.castSpeed.push(node);
      }
      if (statsText.includes('attack speed')) {
        damageTypes.attackSpeed.push(node);
      }
    });

    console.log('\n=== Damage Type Breakdown ===');
    for (const [type, nodeList] of Object.entries(damageTypes)) {
      console.log(`${type}: ${nodeList.length} nodes`);
    }

    // Sample nodes for each type
    console.log('\n=== Sample Nodes ===');

    console.log('\nSpell Damage Nodes (first 10):');
    damageTypes.spell.slice(0, 10).forEach(node => {
      console.log(`  ${node.dn || node.name || 'Unknown'}: ${node.stats ? node.stats.join(', ') : 'No stats'}`);
    });

    console.log('\nFire Damage Nodes (first 10):');
    damageTypes.fire.slice(0, 10).forEach(node => {
      console.log(`  ${node.dn || node.name || 'Unknown'}: ${node.stats ? node.stats.join(', ') : 'No stats'}`);
    });

    console.log('\nCold Damage Nodes (first 10):');
    damageTypes.cold.slice(0, 10).forEach(node => {
      console.log(`  ${node.dn || node.name || 'Unknown'}: ${node.stats ? node.stats.join(', ') : 'No stats'}`);
    });

    console.log('\nLightning Damage Nodes (first 10):');
    damageTypes.lightning.slice(0, 10).forEach(node => {
      console.log(`  ${node.dn || node.name || 'Unknown'}: ${node.stats ? node.stats.join(', ') : 'No stats'}`);
    });

    // Export useful nodes
    const exportNodes = [];
    const processedNodes = new Set();

    for (const [type, nodeList] of Object.entries(damageTypes)) {
      nodeList.forEach(node => {
        if (processedNodes.has(node.id)) return;
        processedNodes.add(node.id);

        exportNodes.push({
          id: node.id,
          name: node.dn || node.name || `Node_${node.id}`,
          stats: node.stats || [],
          isNotable: node.isNotable || false,
          isKeystone: node.isKeystone || false,
          categories: []
        });
      });
    }

    // Save to file
    const outputPath = path.join(__dirname, '../src/passives/pobPassiveNodes.json');
    fs.writeFileSync(outputPath, JSON.stringify(exportNodes, null, 2));
    console.log(`\nExported ${exportNodes.length} nodes to ${outputPath}`);

  } else {
    console.log('No nodes found in tree data');
  }

} catch (error) {
  console.error('Error:', error.message);
}

