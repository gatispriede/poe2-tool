/**
 * PoB Lua Parser
 * Parses Path of Building Lua data files at runtime
 */

// Base path to PoB data files (copied to public/data folder)
const POB_DATA_PATH = '/data';

/**
 * Fetches a Lua file from the PoB data directory
 * Note: Files are stored with .lua.txt extension for proper serving by dev server
 */
export async function fetchLuaFile(relativePath: string): Promise<string> {
  const response = await fetch(`${POB_DATA_PATH}/${relativePath}.txt`);
  if (!response.ok) {
    throw new Error(`Failed to load Lua file: ${relativePath}`);
  }
  return response.text();
}

/**
 * Parses a Lua table value (handles nested tables, arrays, strings, numbers, booleans)
 */
function parseLuaValue(value: string): any {
  value = value.trim();

  // Boolean
  if (value === 'true') return true;
  if (value === 'false') return false;
  if (value === 'nil') return null;

  // Number
  if (/^-?\d+\.?\d*$/.test(value)) {
    return parseFloat(value);
  }

  // String (quoted)
  if ((value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))) {
    return value.slice(1, -1);
  }

  // Table/Array
  if (value.startsWith('{') && value.endsWith('}')) {
    return parseLuaTable(value);
  }

  // Return as string if nothing else matches
  return value;
}

/**
 * Parses a Lua table string into a JavaScript object or array
 */
function parseLuaTable(tableStr: string): any {
  // Remove outer braces
  let inner = tableStr.slice(1, -1).trim();
  if (!inner) return {};

  // Check if it's an array (no keys, just values) or object (key = value pairs)
  const isArray = !inner.includes('=') || inner.match(/^\s*"[^"]*"\s*,/);

  if (isArray && !inner.includes('=')) {
    // Parse as array
    return parseArrayElements(inner);
  }

  // Parse as object
  return parseObjectEntries(inner);
}

/**
 * Parses array elements from a Lua table string
 */
function parseArrayElements(inner: string): any[] {
  const result: any[] = [];
  let current = '';
  let depth = 0;
  let inString = false;
  let stringChar = '';

  for (let i = 0; i < inner.length; i++) {
    const char = inner[i];

    if (!inString && (char === '"' || char === "'")) {
      inString = true;
      stringChar = char;
      current += char;
    } else if (inString && char === stringChar && inner[i - 1] !== '\\') {
      inString = false;
      current += char;
    } else if (!inString && char === '{') {
      depth++;
      current += char;
    } else if (!inString && char === '}') {
      depth--;
      current += char;
    } else if (!inString && char === ',' && depth === 0) {
      const trimmed = current.trim();
      if (trimmed) {
        result.push(parseLuaValue(trimmed));
      }
      current = '';
    } else {
      current += char;
    }
  }

  const trimmed = current.trim();
  if (trimmed) {
    result.push(parseLuaValue(trimmed));
  }

  return result;
}

/**
 * Parses object entries from a Lua table string
 */
function parseObjectEntries(inner: string): Record<string, any> {
  const result: Record<string, any> = {};
  let current = '';
  let depth = 0;
  let inString = false;
  let stringChar = '';

  for (let i = 0; i < inner.length; i++) {
    const char = inner[i];

    if (!inString && (char === '"' || char === "'")) {
      inString = true;
      stringChar = char;
      current += char;
    } else if (inString && char === stringChar && inner[i - 1] !== '\\') {
      inString = false;
      current += char;
    } else if (!inString && char === '{') {
      depth++;
      current += char;
    } else if (!inString && char === '}') {
      depth--;
      current += char;
    } else if (!inString && char === ',' && depth === 0) {
      parseAndAddEntry(current.trim(), result);
      current = '';
    } else {
      current += char;
    }
  }

  if (current.trim()) {
    parseAndAddEntry(current.trim(), result);
  }

  return result;
}

/**
 * Parses a single key=value entry and adds it to the result object
 */
function parseAndAddEntry(entry: string, result: Record<string, any>): void {
  // Handle ["key"] = value format
  let match = entry.match(/^\["([^"]+)"\]\s*=\s*(.+)$/s);
  if (match) {
    result[match[1]] = parseLuaValue(match[2]);
    return;
  }

  // Handle key = value format
  match = entry.match(/^(\w+)\s*=\s*(.+)$/s);
  if (match) {
    result[match[1]] = parseLuaValue(match[2]);
    return;
  }

  // Handle standalone string values (unnamed array elements in mixed tables)
  if ((entry.startsWith('"') && entry.endsWith('"')) ||
      (entry.startsWith("'") && entry.endsWith("'"))) {
    // Store as special key for stat text
    if (!result._statTexts) result._statTexts = [];
    result._statTexts.push(entry.slice(1, -1));
  }
}

/**
 * Parses itemBases from a Lua file (Bases/*.lua)
 * Format: itemBases["Name"] = { ... }
 */
export function parseItemBases(luaContent: string): Record<string, any> {
  const result: Record<string, any> = {};

  // Match itemBases["Name"] = { ... }
  const pattern = /itemBases\["([^"]+)"\]\s*=\s*\{/g;
  let match;

  while ((match = pattern.exec(luaContent)) !== null) {
    const name = match[1];
    const startIdx = match.index + match[0].length - 1; // Start at {

    // Find the matching closing brace
    let depth = 1;
    let endIdx = startIdx + 1;
    let inString = false;
    let stringChar = '';

    while (depth > 0 && endIdx < luaContent.length) {
      const char = luaContent[endIdx];

      if (!inString && (char === '"' || char === "'")) {
        inString = true;
        stringChar = char;
      } else if (inString && char === stringChar && luaContent[endIdx - 1] !== '\\') {
        inString = false;
      } else if (!inString && char === '{') {
        depth++;
      } else if (!inString && char === '}') {
        depth--;
      }
      endIdx++;
    }

    const tableStr = luaContent.slice(startIdx, endIdx);
    try {
      result[name] = parseLuaTable(tableStr);
    } catch (e) {
      console.warn(`Failed to parse item base: ${name}`, e);
    }
  }

  return result;
}

/**
 * Parses a return table from Gems.lua or ModItem.lua
 * Format: return { ["key"] = { ... }, ... }
 */
export function parseReturnTable(luaContent: string): Record<string, any> {
  const result: Record<string, any> = {};

  // Find the return statement
  const returnMatch = luaContent.match(/return\s*\{/);
  if (!returnMatch) {
    return result;
  }

  // Match ["key"] = { ... } entries
  const pattern = /\["([^"]+)"\]\s*=\s*\{/g;
  let match;

  while ((match = pattern.exec(luaContent)) !== null) {
    const key = match[1];
    const startIdx = match.index + match[0].length - 1; // Start at {

    // Find the matching closing brace
    let depth = 1;
    let endIdx = startIdx + 1;
    let inString = false;
    let stringChar = '';

    while (depth > 0 && endIdx < luaContent.length) {
      const char = luaContent[endIdx];

      if (!inString && (char === '"' || char === "'")) {
        inString = true;
        stringChar = char;
      } else if (inString && char === stringChar && luaContent[endIdx - 1] !== '\\') {
        inString = false;
      } else if (!inString && char === '{') {
        depth++;
      } else if (!inString && char === '}') {
        depth--;
      }
      endIdx++;
    }

    const tableStr = luaContent.slice(startIdx, endIdx);
    try {
      result[key] = parseLuaTable(tableStr);
    } catch (e) {
      console.warn(`Failed to parse entry: ${key}`, e);
    }
  }

  return result;
}

/**
 * Parses unique items from Uniques/*.lua
 * Format: return { [[ multiline string ]], ... }
 */
export function parseUniques(luaContent: string): string[] {
  const result: string[] = [];

  // Match [[ ... ]] multiline strings
  const pattern = /\[\[([\s\S]*?)\]\]/g;
  let match;

  while ((match = pattern.exec(luaContent)) !== null) {
    const content = match[1].trim();
    if (content) {
      result.push(content);
    }
  }

  return result;
}

/**
 * Extracts stat range from text like "+(5-10) to Strength"
 * Returns { min, max, text }
 */
export function parseStatRange(statText: string): { min: number; max: number; text: string } | null {
  const match = statText.match(/\((\d+)-(\d+)\)/);
  if (match) {
    return {
      min: parseInt(match[1]),
      max: parseInt(match[2]),
      text: statText
    };
  }

  // Single value like "+5 to Strength"
  const singleMatch = statText.match(/[+-]?(\d+)/);
  if (singleMatch) {
    const value = parseInt(singleMatch[1]);
    return {
      min: value,
      max: value,
      text: statText
    };
  }

  return null;
}
