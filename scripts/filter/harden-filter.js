#!/usr/bin/env node
// Make an item filter safe for a patch it has never seen.
//
// The danger in any mature filter is the blanket `Hide` — `Hide / Class ==
// "Amulets"`, `Hide / Rarity Rare` — which hides by category rather than by
// name. On patch day those rules quietly swallow every base type the game just
// added, and you never learn the drop happened.
//
// This rewrites each blanket Hide into an explicit blocklist by naming every
// base type that exists in the synced data. Same items hidden as before; any
// base the data has never heard of stops matching and falls through to the
// filter's catch-all instead. Only `BaseType ==` is used, which the filter
// language already relies on — no syntax that needs verifying against a patch.
//
// It can also add a "sells for quality currency" highlight: any item carrying
// Quality is worth vendoring for the currency that made it, and that is easy to
// walk past. `--vendor-quality` inserts one pink-background block per currency
// family, placed above the blanket hides so those items stop being swallowed.
//
//   node scripts/filter/harden-filter.js input.filter [-o output.filter]
//   node scripts/filter/harden-filter.js input.filter --report   (no rewrite)
//   node scripts/filter/harden-filter.js input.filter --vendor-quality [--min-quality 1]
//                                        [--before "COMMENT SUBSTRING"]

const fs = require('fs');
const { basesForClasses, manifest } = require('./baseTypes');

const MARKER = '# [auto] enumerated by scripts/filter/harden-filter.js';
const QUALITY_MARKER = '# === VENDOR QUALITY';

/** Which quality currency a class returns when you sell the item to a vendor.
 *  Grouped so each family gets one rule and one shade of pink. */
const QUALITY_FAMILIES = [
  {
    currency: "Armourer's Scrap",
    background: '90 20 60',
    classes: ['Body Armours', 'Helmets', 'Gloves', 'Boots', 'Shields', 'Bucklers'],
  },
  {
    currency: "Blacksmith's Whetstone",
    background: '120 20 70',
    classes: ['One Hand Axes', 'Two Hand Axes', 'One Hand Maces', 'Two Hand Maces',
      'One Hand Swords', 'Two Hand Swords', 'Spears', 'Flails', 'Claws', 'Daggers',
      'Bows', 'Crossbows', 'Quarterstaves'],
  },
  {
    currency: "Arcanist's Etcher",
    background: '110 20 110',
    classes: ['Wands', 'Sceptres', 'Staves', 'Foci'],
  },
  {
    currency: "Glassblower's Bauble",
    background: '140 30 90',
    classes: ['Life Flasks', 'Mana Flasks', 'Charms'],
  },
  {
    currency: "Gemcutter's Prism",
    background: '150 40 110',
    classes: ['Skill Gems', 'Support Gems'],
  },
];

function qualityBlocks(minQuality) {
  const out = [
    QUALITY_MARKER + ` — items carrying Quality sell back as quality currency ===`,
    `# Quality >= ${minQuality}. Placed above the blanket hides so these stop being swallowed.`,
    `# Pink background per currency family; anything already matched by a louder rule above keeps it.`,
    '',
  ];
  for (const family of QUALITY_FAMILIES) {
    out.push(
      `# ${family.currency}`,
      'Show',
      `    Class == ${family.classes.map((c) => `"${c}"`).join(' ')}`,
      `    Quality >= ${minQuality}`,
      '    SetFontSize 36',
      '    SetTextColor 255 190 230 255',
      '    SetBorderColor 255 105 180 255',
      `    SetBackgroundColor ${family.background} 255`,
      '',
    );
  }
  return out;
}

/** Split the file into blocks. A block is a Show/Hide/Minimal header plus the
 *  indented lines under it; everything else is passthrough text. */
function parseBlocks(text) {
  const lines = text.split(/\r?\n/);
  const parts = [];
  let current = null;
  for (const line of lines) {
    if (/^\s*(Show|Hide|Minimal)\b/.test(line)) {
      if (current) parts.push(current);
      current = { kind: 'block', header: line, body: [] };
      continue;
    }
    if (current) {
      // A block ends at the first line that is neither indented nor blank.
      if (/^\s+\S/.test(line) || /^\s*$/.test(line)) {
        current.body.push(line);
        continue;
      }
      parts.push(current);
      current = null;
    }
    parts.push({ kind: 'text', line });
  }
  if (current) parts.push(current);
  return parts;
}

function serialize(parts) {
  const out = [];
  for (const part of parts) {
    if (part.kind === 'text') out.push(part.line);
    else out.push(part.header, ...part.body);
  }
  return out.join('\n');
}

const conditionLines = (block) => block.body.filter((l) => /^\s+\S/.test(l));

function readClasses(block) {
  for (const line of conditionLines(block)) {
    const m = line.match(/^\s*Class\s*(==|=)?\s*(.*)$/);
    if (!m) continue;
    return (m[2].match(/"([^"]+)"/g) || []).map((s) => s.slice(1, -1));
  }
  return [];
}

const hasBaseType = (block) => conditionLines(block).some((l) => /^\s*BaseType\b/.test(l));
const isHide = (block) => /^\s*Hide\b/.test(block.header);

/** Wrap a long BaseType list so the filter stays readable in an editor. */
function baseTypeLines(bases, indent) {
  const quoted = bases.map((b) => `"${b}"`);
  const lines = [];
  let line = `${indent}BaseType ==`;
  for (const item of quoted) {
    if (line.length + item.length + 1 > 300) { lines.push(line); line = `${indent}    `; }
    line += ` ${item}`;
  }
  lines.push(line);
  return lines;
}

function harden(text, options = {}) {
  const parts = parseBlocks(text);
  const changes = [];
  const skipped = [];
  let qualityInsertedBefore;

  if (options.vendorQuality) {
    // Land the block above the hides it is meant to survive. An explicit anchor
    // comment wins; otherwise it goes in front of the first blanket Hide.
    let index = -1;
    if (options.before) {
      index = parts.findIndex((p) => p.kind === 'text' && p.line.includes(options.before));
    }
    if (index < 0) {
      index = parts.findIndex((p) => p.kind === 'block' && isHide(p) && !hasBaseType(p));
    }
    if (index >= 0) {
      qualityInsertedBefore = parts[index].kind === 'text'
        ? parts[index].line.trim()
        : parts[index].header.trim();
      const lines = qualityBlocks(options.minQuality ?? 1);
      parts.splice(index, 0, ...lines.map((line) => ({ kind: 'text', line })));
    }
  }

  for (const part of parts) {
    if (part.kind !== 'block' || !isHide(part)) continue;
    if (hasBaseType(part)) continue;               // already an explicit blocklist

    const classes = readClasses(part);
    const { bases, missing } = basesForClasses(classes);

    if (missing.length) {
      // A class the data cannot enumerate (gems, currency, relics). Naming only
      // some of its bases would change what the rule hides, so leave it alone
      // and report it instead of half-fixing it.
      skipped.push({ header: part.header.trim(), classes, missing });
      continue;
    }

    const indent = (conditionLines(part)[0] || '    ').match(/^\s*/)[0] || '    ';
    const insertAt = part.body.findIndex((l) => /^\s+\S/.test(l));
    const injected = [`${indent}${MARKER}`, ...baseTypeLines(bases, indent)];
    part.body.splice(insertAt < 0 ? 0 : insertAt, 0, ...injected);
    changes.push({
      header: part.header.trim(),
      classes: classes.length ? classes : ['(every class)'],
      baseCount: bases.length,
    });
  }

  return { text: serialize(parts), changes, skipped, qualityInsertedBefore };
}

function main() {
  const args = process.argv.slice(2);
  const input = args.find((a) => !a.startsWith('-'));
  if (!input) {
    console.log('usage: node scripts/filter/harden-filter.js <input.filter> [-o output.filter] [--report]');
    process.exit(1);
  }
  const valueOf = (flag) => {
    const i = args.indexOf(flag);
    return i >= 0 ? args[i + 1] : undefined;
  };
  const output = valueOf('-o');
  const reportOnly = args.includes('--report');
  const options = {
    vendorQuality: args.includes('--vendor-quality'),
    minQuality: Number(valueOf('--min-quality') ?? 1),
    before: valueOf('--before'),
  };

  const source = fs.readFileSync(input, 'utf8');
  if (source.includes(MARKER)) {
    console.log('This filter has already been hardened. Re-run against the original to refresh it.');
  }
  const { text, changes, skipped, qualityInsertedBefore } = harden(source, options);

  const info = manifest();
  console.log(`Base data: PoB commit ${(info.sourceCommit || '?').slice(0, 8)} (${info.generatedAt || 'unknown'})\n`);

  console.log(`Blanket Hide rules made explicit: ${changes.length}`);
  for (const c of changes) {
    console.log(`  ${c.header.padEnd(6)} ${c.classes.join(', ').slice(0, 70).padEnd(72)} +${c.baseCount} bases`);
  }
  if (options.vendorQuality) {
    console.log(qualityInsertedBefore
      ? `\nVendor-quality highlight (Quality >= ${options.minQuality}) inserted before: ${qualityInsertedBefore}`
      : '\nVendor-quality highlight requested but no insertion point was found — nothing added.');
  }
  if (skipped.length) {
    console.log(`\nLeft alone — the data cannot enumerate these classes, so they still hide new content:`);
    for (const s of skipped) {
      console.log(`  ${s.header} → ${s.missing.join(', ')}`);
    }
  }

  if (reportOnly) return;
  const destination = output || input.replace(/(\.filter|\.txt)?$/, '-hardened.filter');
  fs.writeFileSync(destination, text);
  console.log(`\nWritten: ${destination}`);
}

main();
