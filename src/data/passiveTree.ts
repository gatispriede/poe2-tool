/**
 * Passive Tree Data Types and Loader
 * Parses the PoB tree.json to get passive nodes with connections
 */

export interface PassiveTreeNode {
  id: string;
  name: string;
  stats: string[];
  type: 'small' | 'notable' | 'keystone' | 'jewel' | 'mastery' | 'classStart' | 'ascendancyStart';
  connections: string[]; // IDs of connected nodes
  icon?: string;
  group?: number;
  ascendancyName?: string;
  isAllocated?: boolean;
}

export interface PassiveTreeClass {
  id: number;
  name: string;
  startNodeId: string;
  ascendancies: {
    id: string;
    name: string;
    startNodeId?: string;
  }[];
}

export interface PassiveTreeData {
  nodes: Map<string, PassiveTreeNode>;
  classes: PassiveTreeClass[];
  classStartNodes: Map<string, string>; // class name -> start node id
}

// Class starting node IDs (from PoB tree.json analysis)
const CLASS_START_NODES: Record<string, string> = {
  'Ranger': '50459',
  'Huntress': '44683', // SIX node
  'Warrior': '47175',  // MARAUDER
  'Mercenary': '50986', // DUELIST
  'Witch': '54447',
  'Sorceress': '61525', // TEMPLAR
  'Monk': '44683',
};

// Cache for loaded tree data
let treeCache: PassiveTreeData | null = null;

/**
 * Loads and parses the passive tree data from PoB tree.json
 */
export async function loadPassiveTree(): Promise<PassiveTreeData> {
  if (treeCache) {
    return treeCache;
  }

  try {
    // Try to load the PoB tree.json (CRA serves public/ under PUBLIC_URL,
    // which is set to "localhost" in .env.local for this project).
    const base = (process.env.PUBLIC_URL || '').replace(/\/$/, '');
    const response = await fetch(`${base}/TreeData/tree.json`);
    if (!response.ok) {
      throw new Error('Failed to load passive tree data');
    }

    const rawData = await response.json();
    treeCache = parseTreeData(rawData);
    console.log(`Loaded passive tree with ${treeCache.nodes.size} nodes`);
    return treeCache;
  } catch (error) {
    console.error('Failed to load passive tree:', error);
    // Return fallback data
    return getFallbackTreeData();
  }
}

/**
 * Parses the raw PoB tree.json into our data structure
 */
function parseTreeData(rawData: any): PassiveTreeData {
  const nodes = new Map<string, PassiveTreeNode>();
  const classStartNodes = new Map<string, string>();

  // Parse nodes
  for (const [id, rawNode] of Object.entries(rawData.nodes || {})) {
    const node = rawNode as any;
    if (!node) continue;

    // Determine node type
    let type: PassiveTreeNode['type'] = 'small';
    if (node.isKeystone) type = 'keystone';
    else if (node.isNotable) type = 'notable';
    else if (node.isJewelSocket) type = 'jewel';
    else if (node.isMastery) type = 'mastery';
    else if (node.isAscendancyStart) type = 'ascendancyStart';
    else if (!node.stats || node.stats.length === 0) {
      // Nodes without stats that have connections are likely class start nodes
      const name = node.name?.toUpperCase();
      if (['MARAUDER', 'RANGER', 'WITCH', 'DUELIST', 'TEMPLAR', 'SIX'].includes(name)) {
        type = 'classStart';
      }
    }

    // Extract connections
    const connections: string[] = [];
    if (node.connections && Array.isArray(node.connections)) {
      for (const conn of node.connections) {
        if (conn.id !== undefined) {
          connections.push(String(conn.id));
        }
      }
    }

    // Create the node
    const passiveNode: PassiveTreeNode = {
      id: String(id),
      name: node.name || '',
      stats: node.stats || [],
      type,
      connections,
      icon: node.icon,
      group: node.group,
      ascendancyName: node.ascendancyName,
    };

    nodes.set(String(id), passiveNode);

    // Track class start nodes
    if (type === 'classStart') {
      classStartNodes.set(passiveNode.name, String(id));
    }
  }

  // Parse classes
  const classes: PassiveTreeClass[] = [];
  if (rawData.classes && Array.isArray(rawData.classes)) {
    for (let i = 0; i < rawData.classes.length; i++) {
      const rawClass = rawData.classes[i];
      if (!rawClass) continue;

      const className = rawClass.name || `Class${i}`;
      const startNodeId = CLASS_START_NODES[className] || '';

      const ascendancies = (rawClass.ascendancies || []).map((asc: any) => ({
        id: asc.id,
        name: asc.name,
        startNodeId: undefined, // Will be found from isAscendancyStart nodes
      }));

      classes.push({
        id: i,
        name: className,
        startNodeId,
        ascendancies,
      });
    }
  }

  return { nodes, classes, classStartNodes };
}

/**
 * Gets all nodes reachable from a set of allocated nodes
 * This respects the tree structure - you can only select connected nodes
 */
export function getReachableNodes(
  treeData: PassiveTreeData,
  allocatedNodeIds: Set<string>,
  startNodeId: string
): Set<string> {
  const reachable = new Set<string>();

  // If nothing allocated, only the start node is reachable
  if (allocatedNodeIds.size === 0) {
    reachable.add(startNodeId);
    const startNode = treeData.nodes.get(startNodeId);
    if (startNode) {
      for (const connId of startNode.connections) {
        reachable.add(connId);
      }
    }
    return reachable;
  }

  // All allocated nodes are "reachable" (already selected)
  Array.from(allocatedNodeIds).forEach(id => {
    reachable.add(id);
  });

  // Add all nodes connected to allocated nodes
  Array.from(allocatedNodeIds).forEach(allocatedId => {
    const node = treeData.nodes.get(allocatedId);
    if (!node) return;

    node.connections.forEach(connId => {
      reachable.add(connId);
    });
  });

  return reachable;
}

/**
 * Checks if removing a node would disconnect other nodes from the tree
 */
export function canDeallocateNode(
  treeData: PassiveTreeData,
  allocatedNodeIds: Set<string>,
  nodeId: string,
  startNodeId: string
): boolean {
  // Cannot deallocate the start node
  if (nodeId === startNodeId) {
    return false;
  }

  // Create a test set without this node
  const testAllocated = new Set(allocatedNodeIds);
  testAllocated.delete(nodeId);

  // Check if all remaining nodes can reach the start
  if (testAllocated.size === 0) {
    return true;
  }

  // BFS from start to check connectivity
  const visited = new Set<string>();
  const queue = [startNodeId];
  visited.add(startNodeId);

  while (queue.length > 0) {
    const currentId = queue.shift()!;
    const currentNode = treeData.nodes.get(currentId);
    if (!currentNode) continue;

    for (const connId of currentNode.connections) {
      if (!visited.has(connId) && testAllocated.has(connId)) {
        visited.add(connId);
        queue.push(connId);
      }
    }
  }

  // All allocated nodes should be visited (connected to start)
  const testAllocatedArr = Array.from(testAllocated);
  for (let i = 0; i < testAllocatedArr.length; i++) {
    const id = testAllocatedArr[i];
    if (!visited.has(id) && id !== startNodeId) {
      return false;
    }
  }

  return true;
}

/**
 * Finds the shortest path from any allocated node to the target node
 * Returns the path (excluding already allocated nodes) or null if unreachable
 * Uses BFS for shortest path in unweighted graph
 */
export function findPathToNode(
  treeData: PassiveTreeData,
  allocatedNodeIds: Set<string>,
  targetNodeId: string,
  startNodeId: string
): string[] | null {
  // If already allocated, no path needed
  if (allocatedNodeIds.has(targetNodeId)) {
    return [];
  }

  // If nothing allocated, start from the class start node
  const startingPoints = allocatedNodeIds.size === 0
    ? [startNodeId]
    : Array.from(allocatedNodeIds);

  // BFS to find shortest path
  const visited = new Set<string>();
  const parent = new Map<string, string>(); // Track path
  const queue: string[] = [];

  // Initialize from all allocated nodes (or start node)
  for (const nodeId of startingPoints) {
    visited.add(nodeId);
    queue.push(nodeId);
  }

  while (queue.length > 0) {
    const currentId = queue.shift()!;
    const currentNode = treeData.nodes.get(currentId);
    if (!currentNode) continue;

    for (const connId of currentNode.connections) {
      if (visited.has(connId)) continue;

      visited.add(connId);
      parent.set(connId, currentId);

      if (connId === targetNodeId) {
        // Found the target - reconstruct path
        const path: string[] = [];
        let node = targetNodeId;

        while (node && !allocatedNodeIds.has(node) && node !== startNodeId) {
          path.unshift(node);
          const parentNode = parent.get(node);
          if (!parentNode) break;
          node = parentNode;
        }

        // If we started from empty allocation, include path from start
        if (allocatedNodeIds.size === 0 && node === startNodeId) {
          // Don't include the start node itself in the path
        }

        return path;
      }

      queue.push(connId);
    }
  }

  // No path found
  return null;
}

/**
 * Gets the cost (number of nodes) to reach a target node from allocated nodes
 * Returns -1 if unreachable
 */
export function getPathCost(
  treeData: PassiveTreeData,
  allocatedNodeIds: Set<string>,
  targetNodeId: string,
  startNodeId: string
): number {
  if (allocatedNodeIds.has(targetNodeId)) {
    return 0;
  }

  const path = findPathToNode(treeData, allocatedNodeIds, targetNodeId, startNodeId);
  return path ? path.length : -1;
}

/**
 * Validates that a path of nodes is connected
 */
export function isPathConnected(
  treeData: PassiveTreeData,
  nodeIds: string[],
  startNodeId: string
): boolean {
  if (nodeIds.length === 0) return true;

  const allocated = new Set<string>(nodeIds);
  allocated.add(startNodeId);

  // BFS from start
  const visited = new Set<string>();
  const queue = [startNodeId];
  visited.add(startNodeId);

  while (queue.length > 0) {
    const currentId = queue.shift()!;
    const currentNode = treeData.nodes.get(currentId);
    if (!currentNode) continue;

    for (const connId of currentNode.connections) {
      if (!visited.has(connId) && allocated.has(connId)) {
        visited.add(connId);
        queue.push(connId);
      }
    }
  }

  // All nodes should be visited
  const allocatedArr = Array.from(allocated);
  for (let i = 0; i < allocatedArr.length; i++) {
    if (!visited.has(allocatedArr[i])) {
      return false;
    }
  }

  return true;
}

/**
 * Gets nodes filtered by damage type relevance
 */
export function filterNodesByDamageType(
  nodes: PassiveTreeNode[],
  damageType: 'physical' | 'fire' | 'cold' | 'lightning' | 'chaos' | 'elemental' | 'spell' | 'attack'
): PassiveTreeNode[] {
  return nodes.filter(node => {
    if (!node.stats || node.stats.length === 0) return false;

    const statsText = node.stats.join(' ').toLowerCase();

    switch (damageType) {
      case 'physical':
        return statsText.includes('physical');
      case 'fire':
        return statsText.includes('fire') || statsText.includes('elemental');
      case 'cold':
        return statsText.includes('cold') || statsText.includes('elemental');
      case 'lightning':
        return statsText.includes('lightning') || statsText.includes('elemental');
      case 'chaos':
        return statsText.includes('chaos');
      case 'elemental':
        return statsText.includes('elemental') || statsText.includes('fire') ||
               statsText.includes('cold') || statsText.includes('lightning');
      case 'spell':
        return statsText.includes('spell') || statsText.includes('cast');
      case 'attack':
        return statsText.includes('attack') || statsText.includes('melee') ||
               statsText.includes('weapon') || statsText.includes('physical');
      default:
        return true;
    }
  });
}

/**
 * Scores a passive node for a specific build
 * Returns 0 or negative for nodes that don't benefit the skill type
 */
export function scorePassiveNode(
  node: PassiveTreeNode,
  skillElement: string | null,
  skillType: 'spell' | 'attack'
): number {
  if (!node.stats || node.stats.length === 0) return 0;

  let score = 0;
  const statsText = node.stats.join(' ').toLowerCase();

  // === CONDITIONAL-HEADER GATE ===
  // Some nodes gate all their bonuses behind a skill-type condition stated in a
  // header line, e.g. Wildsurge Incantation: "Storm and Plant Spells: / deal
  // 50% more damage / ...". The benefit applies ONLY to those skill archetypes.
  // Without this gate the scorer reads "deal 50% more damage" generically and
  // wrongly allocates/credits the node for a skill that doesn't qualify (e.g.
  // Bone Cage, a Physical Nova spell, gets nothing from Storm/Plant). If the
  // build's skill doesn't match the gated archetype, the node is worthless.
  const gatedHeader = statsText.match(/\b((?:storm|plant|fire|cold|lightning|chaos|physical|minion|totem|trap|brand|herald|projectile|melee|warcry)(?:\s+and\s+\w+)*)\s+(?:spells?|skills?):/);
  if (gatedHeader) {
    const named = gatedHeader[1].split(/\s+and\s+|\s+/).filter((w) => w !== 'and');
    const matchesElement = skillElement && named.includes(skillElement.toLowerCase());
    // 'physical spells:' matches a physical spell; 'storm and plant spells:' on
    // a physical spell matches nothing → gate it out.
    if (!matchesElement) return 0;
  }

  // === STRICT TYPE EXCLUSIONS ===
  // These patterns identify nodes that are ONLY useful for one type

  // Spell-only patterns
  const isSpellOnlyNode = statsText.includes('spell damage') ||
                           statsText.includes('spell critical') ||
                           statsText.includes('cast speed') ||
                           statsText.includes('mana cost of spells') ||
                           (statsText.includes('level of') && statsText.includes('spell'));

  // Attack-only patterns - more comprehensive list
  const isAttackOnlyNode = statsText.includes('attack damage') ||
                            statsText.includes('attack speed') ||
                            statsText.includes('increased attack') ||
                            statsText.includes('melee damage') ||
                            statsText.includes('melee critical') ||
                            statsText.includes('weapon damage') ||
                            statsText.includes('bow damage') ||
                            statsText.includes('projectile attack') ||
                            statsText.includes('accuracy rating') ||
                            statsText.includes('accuracy') ||
                            statsText.includes('with weapons') ||
                            statsText.includes('weapon critical') ||
                            statsText.includes('while wielding') ||
                            // "physical damage" without "spell" is typically attack-based
                            (statsText.includes('physical damage') &&
                             !statsText.includes('spell') &&
                             !statsText.includes('physical damage over time') &&
                             skillElement !== 'physical'); // Unless it's a physical spell

  // If node is specifically for the wrong type, return 0 immediately
  if (skillType === 'spell' && isAttackOnlyNode && !isSpellOnlyNode) {
    return 0;
  }
  if (skillType === 'attack' && isSpellOnlyNode && !isAttackOnlyNode) {
    return 0;
  }

  // === POSITIVE SCORING FOR CORRECT TYPE ===

  if (skillType === 'spell') {
    // Spell-specific bonuses
    if (statsText.includes('spell damage')) score += 15;
    if (statsText.includes('cast speed')) score += 12;
    if (statsText.includes('spell critical')) score += 10;
    // Gem levels are extremely valuable for spells
    if (statsText.includes('level of') && statsText.includes('spell')) score += 20;
    // Physical spell damage for physical spells
    if (skillElement === 'physical' && statsText.includes('physical damage')) {
      score += 12;
    }
  } else {
    // Attack-specific bonuses
    if (statsText.includes('physical damage') && !statsText.includes('spell')) score += 12;
    if (statsText.includes('attack speed')) score += 10;
    if (statsText.includes('weapon damage')) score += 10;
    if (statsText.includes('melee damage')) score += 8;
    if (statsText.includes('accuracy')) score += 5;
  }

  // Element matching - important for both spells and attacks
  if (skillElement) {
    const element = skillElement.toLowerCase();
    if (statsText.includes(element + ' damage')) {
      score += 15;
    } else if (statsText.includes(element)) {
      score += 10;
    }
    // Elemental damage benefits fire/cold/lightning
    if (element !== 'physical' && element !== 'chaos' && statsText.includes('elemental damage')) {
      score += 8;
    }
  }

  // === GENERIC BONUSES - These work for BOTH spell and attack builds ===
  // These are the key stats that small passives often have

  // Critical stats (generic, not spell/attack specific)
  if (statsText.includes('critical strike chance') && !statsText.includes('spell') && !statsText.includes('attack')) {
    score += 8;
  }
  if (statsText.includes('critical strike multiplier') || statsText.includes('critical damage')) {
    score += 8;
  }

  // Generic "increased damage" (applies to everything)
  if ((statsText.includes('increased damage') || statsText.includes('% increased damage')) &&
      !statsText.includes('minion') &&
      !statsText.includes('trap') &&
      !statsText.includes('totem') &&
      !statsText.includes('spell') &&
      !statsText.includes('attack')) {
    score += 10;
  }

  // Area damage/effects (common for both spell and attack AOE skills)
  if (statsText.includes('area damage') || statsText.includes('area of effect')) {
    score += 6;
  }

  // Projectile damage (benefits both projectile spells and attacks)
  if (statsText.includes('projectile damage') && !statsText.includes('attack')) {
    score += 6;
  }

  // Damage over time (works for both)
  if (statsText.includes('damage over time')) {
    score += 6;
  }

  // Life and survivability (everyone needs this)
  if (statsText.includes('maximum life') || statsText.includes('% increased life')) {
    score += 4;
  }
  if (statsText.includes('energy shield')) {
    score += 3;
  }

  // Mana (useful for spells especially, but also attack skills)
  if (statsText.includes('maximum mana') || statsText.includes('mana regeneration')) {
    score += skillType === 'spell' ? 4 : 2;
  }

  // Attributes (str gives melee damage, int gives ES/mana, dex gives accuracy/evasion)
  if (statsText.includes('strength') || statsText.includes('to str')) {
    score += skillType === 'attack' ? 3 : 1;
  }
  if (statsText.includes('intelligence') || statsText.includes('to int')) {
    score += skillType === 'spell' ? 3 : 1;
  }
  if (statsText.includes('dexterity') || statsText.includes('to dex')) {
    score += 2;
  }
  if (statsText.includes('all attributes')) {
    score += 3;
  }

  // Resistances (everyone needs some)
  if (statsText.includes('resistance') || statsText.includes('to all elemental')) {
    score += 2;
  }

  // Extract numeric values for scaling (higher numbers = better)
  // This helps differentiate between "10% increased" vs "20% increased"
  const percentMatches = statsText.match(/(\d+)%/g);
  if (percentMatches) {
    let totalPercent = 0;
    for (const match of percentMatches) {
      totalPercent += parseInt(match);
    }
    score += totalPercent / 10;
  }

  // Flat numeric bonuses (like "+20 to maximum life")
  const flatMatch = statsText.match(/\+(\d+)\s+to/);
  if (flatMatch) {
    score += parseInt(flatMatch[1]) / 15;
  }

  // Type multipliers for notable/keystone (they're worth more)
  if (node.type === 'notable') score *= 1.5;
  if (node.type === 'keystone') score *= 2;

  // Small passives should still get a minimum score if they have ANY stats
  // This ensures they show up as "relevant" when they have generic useful stats
  if (score === 0 && node.stats.length > 0) {
    // Check if it has any numeric stat at all
    if (statsText.match(/\d+/)) {
      score = 1; // Minimum score for passives with stats
    }
  }

  return Math.max(0, score);
}

/**
 * Fallback tree data when PoB data isn't available
 */
function getFallbackTreeData(): PassiveTreeData {
  const nodes = new Map<string, PassiveTreeNode>();

  // Create a simple connected tree structure
  const fallbackNodes: PassiveTreeNode[] = [
    // Start node
    { id: 'start', name: 'Start', stats: [], type: 'classStart', connections: ['phys1', 'spell1', 'crit1'] },

    // Physical branch
    { id: 'phys1', name: 'Brute Force', stats: ['10% increased Physical Damage'], type: 'small', connections: ['start', 'phys2', 'phys_notable'] },
    { id: 'phys2', name: 'Heavy Strikes', stats: ['15% increased Physical Damage'], type: 'small', connections: ['phys1', 'phys_notable'] },
    { id: 'phys_notable', name: 'Crushing Blows', stats: ['25% increased Physical Damage', '5% increased Attack Speed'], type: 'notable', connections: ['phys1', 'phys2', 'as1'] },

    // Attack speed branch
    { id: 'as1', name: 'Swift Strikes', stats: ['5% increased Attack Speed'], type: 'small', connections: ['phys_notable', 'as2'] },
    { id: 'as2', name: 'Rapid Assault', stats: ['8% increased Attack Speed'], type: 'small', connections: ['as1', 'as_notable'] },
    { id: 'as_notable', name: 'Blade Flurry', stats: ['12% increased Attack Speed', '10% increased Physical Damage'], type: 'notable', connections: ['as2'] },

    // Spell branch
    { id: 'spell1', name: 'Spell Potency', stats: ['10% increased Spell Damage'], type: 'small', connections: ['start', 'spell2', 'spell_notable'] },
    { id: 'spell2', name: 'Arcane Focus', stats: ['15% increased Spell Damage'], type: 'small', connections: ['spell1', 'spell_notable'] },
    { id: 'spell_notable', name: 'Arcane Surge', stats: ['25% increased Spell Damage', '5% increased Cast Speed'], type: 'notable', connections: ['spell1', 'spell2', 'cast1'] },

    // Cast speed branch
    { id: 'cast1', name: 'Quick Casting', stats: ['5% increased Cast Speed'], type: 'small', connections: ['spell_notable', 'cast2'] },
    { id: 'cast2', name: 'Rapid Incantation', stats: ['8% increased Cast Speed'], type: 'small', connections: ['cast1', 'cast_notable'] },
    { id: 'cast_notable', name: 'Spell Echo', stats: ['12% increased Cast Speed', '10% increased Spell Damage'], type: 'notable', connections: ['cast2'] },

    // Critical branch
    { id: 'crit1', name: 'Precision', stats: ['20% increased Critical Strike Chance'], type: 'small', connections: ['start', 'crit2', 'crit_notable'] },
    { id: 'crit2', name: 'Deadly Precision', stats: ['25% increased Critical Strike Chance'], type: 'small', connections: ['crit1', 'crit_notable'] },
    { id: 'crit_notable', name: 'Assassin\'s Mark', stats: ['40% increased Critical Strike Chance', '+15% Critical Strike Multiplier'], type: 'notable', connections: ['crit1', 'crit2', 'crit_keystone'] },

    // Keystone
    { id: 'crit_keystone', name: 'Perfect Agony', stats: ['Ailments from Critical Strikes deal 40% more Damage', 'Critical Strike Multiplier applies to Ailment Damage'], type: 'keystone', connections: ['crit_notable'] },

    // Elemental branches
    { id: 'fire1', name: 'Fire Mastery', stats: ['15% increased Fire Damage'], type: 'small', connections: ['spell_notable', 'fire_notable'] },
    { id: 'fire_notable', name: 'Immolation', stats: ['30% increased Fire Damage', '15% chance to Ignite'], type: 'notable', connections: ['fire1'] },

    { id: 'cold1', name: 'Cold Mastery', stats: ['15% increased Cold Damage'], type: 'small', connections: ['spell_notable', 'cold_notable'] },
    { id: 'cold_notable', name: 'Frozen Path', stats: ['30% increased Cold Damage', '15% chance to Freeze'], type: 'notable', connections: ['cold1'] },

    { id: 'lightning1', name: 'Lightning Mastery', stats: ['15% increased Lightning Damage'], type: 'small', connections: ['spell_notable', 'lightning_notable'] },
    { id: 'lightning_notable', name: 'Storm Walker', stats: ['30% increased Lightning Damage', '15% chance to Shock'], type: 'notable', connections: ['lightning1'] },
  ];

  for (const node of fallbackNodes) {
    nodes.set(node.id, node);
  }

  return {
    nodes,
    classes: [
      { id: 0, name: 'Ranger', startNodeId: 'start', ascendancies: [] },
      { id: 1, name: 'Huntress', startNodeId: 'start', ascendancies: [] },
      { id: 2, name: 'Warrior', startNodeId: 'start', ascendancies: [] },
      { id: 3, name: 'Mercenary', startNodeId: 'start', ascendancies: [] },
      { id: 4, name: 'Witch', startNodeId: 'start', ascendancies: [] },
      { id: 5, name: 'Sorceress', startNodeId: 'start', ascendancies: [] },
      { id: 6, name: 'Monk', startNodeId: 'start', ascendancies: [] },
    ],
    classStartNodes: new Map([['Start', 'start']]),
  };
}

/**
 * Gets aggregated stats from selected nodes
 */
export function aggregateNodeStats(nodes: PassiveTreeNode[]): Record<string, number> {
  const stats: Record<string, number> = {};

  for (const node of nodes) {
    if (!node.stats) continue;

    for (const stat of node.stats) {
      // Parse stat text like "15% increased Physical Damage"
      const match = stat.match(/(\d+)%?\s+(?:increased\s+)?(.+)/i);
      if (match) {
        const value = parseInt(match[1]);
        const statName = match[2].trim();
        stats[statName] = (stats[statName] || 0) + value;
      }
    }
  }

  return stats;
}
