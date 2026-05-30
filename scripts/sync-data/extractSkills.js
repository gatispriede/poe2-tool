// Reads PathOfBuilding-PoE2/src/Data/Skills/*.lua and extracts the identity +
// Layer-3 compatibility fields for every active and support skill.
//
// Per-level damage tables, statSets, and quality stats are intentionally NOT
// extracted here — those belong to Layer 5 (damage composition) and will live
// in a separate JSON to keep this file focused on validity.

const fs = require('fs');
const path = require('path');
const { readLuaTables } = require('./parseLua');
const { Skill } = require('./schemas');

const SKILL_FILES = [
  // Active skills (player-castable)
  'act_str.lua', 'act_dex.lua', 'act_int.lua',
  // Support gems
  'sup_str.lua', 'sup_dex.lua', 'sup_int.lua',
  // Minion / spectre / misc skills — included because supports can reference
  // them, and a skill the player doesn't directly cast may still appear in a
  // build (totems, spectres, summoned skills).
  'minion.lua', 'spectre.lua', 'other.lua',
];

// PoB stores skill type tags as `[SkillType.Foo] = true` table entries. After
// parseLua's MemberExpression handling these come through as plain keys, e.g.
// { OngoingSkill: true, Aura: true }. Extract the keys whose value is true.
function tagsFromTable(t) {
  if (!t || typeof t !== 'object') return [];
  // PoB sometimes encodes arrays (`{ SkillType.X, SkillType.Y }`) and
  // sometimes named keys. After parseLua arrays come through as arrays of
  // strings; named-key tables come through as { Name: true }.
  if (Array.isArray(t)) {
    return t.filter(x => typeof x === 'string');
  }
  const out = [];
  for (const [k, v] of Object.entries(t)) {
    if (v === true) out.push(k);
  }
  return out;
}

function extractFromFile(absPath) {
  const tables = readLuaTables(absPath);
  const out = [];
  const errors = [];

  for (const [id, raw] of Object.entries(tables)) {
    if (typeof raw !== 'object' || raw === null) continue;

    // levels comes through parseLua as an object keyed by "1", "2", ... since
    // Lua tables `[1]` parse to numeric-string keys. Flatten to an array of
    // SkillLevel objects with the gem level included.
    const levels = [];
    if (raw.levels && typeof raw.levels === 'object' && !Array.isArray(raw.levels)) {
      for (const [k, v] of Object.entries(raw.levels)) {
        const lv = parseInt(k, 10);
        if (!Number.isFinite(lv) || !v || typeof v !== 'object') continue;
        const entry = { level: lv };
        if (typeof v.baseMultiplier === 'number')          entry.baseMultiplier = v.baseMultiplier;
        if (typeof v.attackSpeedMultiplier === 'number')   entry.attackSpeedMultiplier = v.attackSpeedMultiplier;
        if (typeof v.levelRequirement === 'number')        entry.levelRequirement = v.levelRequirement;
        // Cooldown (seconds) + stored uses gate a skill's firing frequency —
        // critical so the composer doesn't treat a cooldown skill (Barrage,
        // Escape Shot, Comet) as a spammable main skill at weapon rate.
        if (typeof v.cooldown === 'number')                entry.cooldown = v.cooldown;
        if (typeof v.storedUses === 'number')              entry.storedUses = v.storedUses;
        // cost = { Mana = N } — the mana cost is the most useful field; spirit
        // / life / es costs can be added later if needed.
        if (v.cost && typeof v.cost === 'object' && typeof v.cost.Mana === 'number') {
          entry.manaCost = v.cost.Mana;
        }
        levels.push(entry);
      }
      levels.sort((a, b) => a.level - b.level);
    }

    // weaponTypes table → array of type names.
    const weaponTypes = tagsFromTable(raw.weaponTypes);

    // constantStats + perLevelStats — both pulled from the first statSet
    // (most skills have a single set). PoB shape per set:
    //   constantStats: [["stat_id", value], ...]   (always-on stats)
    //   stats:         ["stat_id", "stat_id", ...]  (positional names)
    //   levels: { [N]: [val_for_stat_0, val_for_stat_1, ...], ... }
    //     The Nth entry's positional values map IN ORDER to stats[i].
    // After parseLua, integer-keyed Lua tables come through as object
    // properties with string keys ("0", "1", ...), so we read both shapes.
    const constantStats = [];
    const perLevelStats = [];
    if (raw.statSets && typeof raw.statSets === 'object') {
      const firstSet = raw.statSets['1'] || (Array.isArray(raw.statSets.__array) ? raw.statSets.__array[0] : null);
      if (firstSet) {
        // constantStats
        if (Array.isArray(firstSet.constantStats)) {
          for (const entry of firstSet.constantStats) {
            if (Array.isArray(entry) && typeof entry[0] === 'string' && typeof entry[1] === 'number') {
              constantStats.push([entry[0], entry[1]]);
            }
          }
        }
        // Per-level positional stats
        const statNames = Array.isArray(firstSet.stats) ? firstSet.stats.filter(s => typeof s === 'string') : [];
        if (statNames.length && firstSet.levels && typeof firstSet.levels === 'object') {
          for (const [k, v] of Object.entries(firstSet.levels)) {
            const lvl = parseInt(k, 10);
            if (!Number.isFinite(lvl)) continue;
            // The level entry may be either an array (Lua array) or an
            // object with numeric-string keys + named keys (parseLua
            // stashes mixed-shape arrays under __array).
            const values = Array.isArray(v)
              ? v
              : (v && Array.isArray(v.__array) ? v.__array : []);
            if (values.length === 0) continue;
            const statsHere = {};
            for (let i = 0; i < statNames.length && i < values.length; i++) {
              if (typeof values[i] === 'number') statsHere[statNames[i]] = values[i];
            }
            if (Object.keys(statsHere).length) perLevelStats.push({ level: lvl, stats: statsHere });
          }
          perLevelStats.sort((a, b) => a.level - b.level);
        }
      }
    }

    const candidate = {
      id,
      name: typeof raw.name === 'string' ? raw.name : (typeof raw.baseTypeName === 'string' ? raw.baseTypeName : id),
      color: typeof raw.color === 'number' ? raw.color : undefined,
      isSupport: raw.support === true,
      skillTypes:        tagsFromTable(raw.skillTypes),
      requireSkillTypes: tagsFromTable(raw.requireSkillTypes),
      addSkillTypes:     tagsFromTable(raw.addSkillTypes),
      excludeSkillTypes: tagsFromTable(raw.excludeSkillTypes),
      gemFamily:         tagsFromTable(raw.gemFamily),
      levels,
      weaponTypes,
      constantStats,
      perLevelStats,
      castTime: typeof raw.castTime === 'number' ? raw.castTime : undefined,
      description: typeof raw.description === 'string' ? raw.description : undefined,
    };

    const parsed = Skill.safeParse(candidate);
    if (parsed.success) {
      out.push(parsed.data);
    } else {
      errors.push({ id, file: path.basename(absPath), issues: parsed.error.issues.slice(0, 3) });
    }
  }

  return { skills: out, errors };
}

function extractSkills(pobDataDir) {
  const allSkills = [];
  const allErrors = [];
  for (const file of SKILL_FILES) {
    const abs = path.join(pobDataDir, 'Skills', file);
    if (!fs.existsSync(abs)) {
      allErrors.push({ file, reason: 'missing' });
      continue;
    }
    const { skills, errors } = extractFromFile(abs);
    allSkills.push(...skills);
    allErrors.push(...errors);
  }
  return { skills: allSkills, errors: allErrors };
}

module.exports = { extractSkills };
