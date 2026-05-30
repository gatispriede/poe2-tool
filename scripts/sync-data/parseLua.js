// Lua AST -> JS object converter, built on `luaparse`.
// Replaces the regex-based parser in src/data/pobParser.ts which silently
// dropped multi-stat mods and mis-parsed nested tables.

const fs = require('fs');
const path = require('path');
const luaparse = require('luaparse');

function nodeToValue(node) {
  switch (node.type) {
    case 'StringLiteral': {
      // luaparse sets .value=null by default and keeps the original token (with
      // surrounding quotes, plus any [[long string]] brackets) in .raw.
      if (node.value != null) return node.value;
      const r = node.raw;
      if (r.startsWith('"') || r.startsWith("'")) return r.slice(1, -1);
      // [[ ... ]] long strings (rare in PoB data but cheap to handle)
      const m = r.match(/^\[(=*)\[([\s\S]*)\]\1\]$/);
      return m ? m[2] : r;
    }
    case 'NumericLiteral':
      return node.value;
    case 'BooleanLiteral':
      return node.value;
    case 'NilLiteral':
      return null;
    case 'UnaryExpression':
      if (node.operator === '-') return -nodeToValue(node.argument);
      return null;
    case 'TableConstructorExpression':
      return tableToValue(node);
    case 'Identifier':
      return node.name;
    case 'MemberExpression':
      // Skills data uses `SkillType.Foo` extensively as table keys/values.
      // We treat these as opaque tag names — only the rightmost identifier
      // is meaningful for downstream validity rules.
      return node.identifier ? node.identifier.name : null;
    case 'CallExpression':
      // mod(...) / skill(...) helpers appear in skill statSets. We don't
      // consume their values yet, so just emit null and let the extractor
      // skip these fields.
      return null;
    default:
      return null;
  }
}

function tableToValue(table) {
  // PoB tables mix array entries (TableValue) and key=val entries (TableKeyString/TableKey).
  // We preserve both: array part becomes a regular array; named keys become object props.
  // If a table has both, we return an object with numeric keys for array entries.
  const arr = [];
  const obj = {};
  let hasNamed = false;
  let hasArray = false;

  for (const field of table.fields) {
    if (field.type === 'TableValue') {
      arr.push(nodeToValue(field.value));
      hasArray = true;
    } else if (field.type === 'TableKeyString') {
      obj[field.key.name] = nodeToValue(field.value);
      hasNamed = true;
    } else if (field.type === 'TableKey') {
      const key = nodeToValue(field.key);
      obj[String(key)] = nodeToValue(field.value);
      hasNamed = true;
    }
  }

  if (hasNamed && hasArray) {
    // PoB mod entries put stat lines as array entries alongside named keys.
    // Keep array part under a synthetic key so callers can read both.
    obj.__array = arr;
    return obj;
  }
  if (hasNamed) return obj;
  return arr;
}

// Read a PoB Lua data file and return the named tables defined at module scope.
// Handles two shapes used by PoB:
//   (a)  `return { ... }`            (ModItem.lua)
//   (b)  `itemBases["Name"] = { ... }` (Bases/*.lua)
function readLuaTables(absPath) {
  const src = fs.readFileSync(absPath, 'utf8');
  const ast = luaparse.parse(src, { comments: false, locations: false });

  const out = {};

  for (const stmt of ast.body) {
    // (a) top-level return of a table
    if (stmt.type === 'ReturnStatement' && stmt.arguments.length === 1) {
      const arg = stmt.arguments[0];
      if (arg.type === 'TableConstructorExpression') {
        const tbl = tableToValue(arg);
        // Merge into out; entries are keyed by mod id string.
        Object.assign(out, tbl);
      }
    }

    // (b) AssignmentStatement of the form `target["Name"] = { ... }`
    if (stmt.type === 'AssignmentStatement') {
      for (let i = 0; i < stmt.variables.length; i++) {
        const v = stmt.variables[i];
        const init = stmt.init[i];
        if (!init || init.type !== 'TableConstructorExpression') continue;

        let name = null;
        if (v.type === 'IndexExpression') {
          name = nodeToValue(v.index);
        } else if (v.type === 'MemberExpression') {
          name = v.identifier.name;
        }
        if (name) out[name] = tableToValue(init);
      }
    }
  }

  return out;
}

module.exports = { readLuaTables };
