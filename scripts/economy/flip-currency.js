#!/usr/bin/env node
// Currency flipping analysis over a poe.ninja economy dump.
//
// Flipping is buying from the people selling and selling to the people buying,
// pocketing the spread. poe.ninja publishes both sides of that book, so the
// margin is computable — but the numbers it publishes are *listed* prices, not
// filled trades, so the analysis has to be honest about three things:
//
//   1. A wide spread usually means nobody is trading it, not free money.
//      Every row is therefore ranked against its own liquidity, never on
//      margin alone.
//   2. Listed prices are asks. The real fill is worse, and price-fixing
//      listings sit at the top of the book. Rows built on a handful of
//      listings are flagged, not silently averaged in.
//   3. Data goes stale in hours. The dump's own timestamp is reported.
//
// Usage:
//   node scripts/economy/flip-currency.js dump.json [--min-volume 10]
//        [--min-margin 3] [--top 20] [--json]
//   curl -s '<poe.ninja endpoint>' | node scripts/economy/flip-currency.js -
//   node scripts/economy/flip-currency.js --selftest

const fs = require('fs');

const DEFAULTS = { minVolume: 8, minMargin: 2, top: 20 };

/** poe.ninja's two sides are denominated in opposite directions, and which is
 *  which has changed between site versions. Rather than trust a remembered
 *  convention, derive it: convert both sides to "chaos per one unit" and let
 *  the cheaper one be the buy. A market where that assumption breaks for most
 *  rows is reported instead of silently inverted. */
function chaosPerUnit(side) {
  if (!side || typeof side.value !== 'number' || side.value <= 0) return undefined;
  return { direct: side.value, inverted: 1 / side.value, count: side.count ?? 0 };
}

function normalizeLine(line) {
  const name = line.currencyTypeName || line.name || line.detailsId;
  if (!name) return undefined;

  const pay = chaosPerUnit(line.pay);
  const receive = chaosPerUnit(line.receive);
  if (!pay || !receive) return undefined;

  // `receive` is the chaos-denominated side on every dump shape seen so far;
  // `pay` is its reciprocal. Anchor on chaosEquivalent when it is present,
  // because that is poe.ninja's own reconciliation of the two.
  const anchor = typeof line.chaosEquivalent === 'number' ? line.chaosEquivalent : undefined;
  const candidates = [
    { label: 'receive-direct', sell: receive.direct, buy: pay.inverted },
    { label: 'receive-inverted', sell: receive.inverted, buy: pay.direct },
  ];
  const chosen = anchor
    ? candidates.reduce((a, b) =>
        (Math.abs(b.sell - anchor) < Math.abs(a.sell - anchor) ? b : a))
    : candidates[0];

  return {
    name,
    buy: chosen.buy,
    sell: chosen.sell,
    buyListings: pay.count,
    sellListings: receive.count,
    volume: Math.min(pay.count, receive.count),
    chaosEquivalent: anchor,
    sampleTime: (line.receive && line.receive.sample_time_utc)
      || (line.pay && line.pay.sample_time_utc),
    orientation: chosen.label,
  };
}

function analyse(dump, options = {}) {
  const opts = { ...DEFAULTS, ...options };
  const lines = Array.isArray(dump) ? dump : dump.lines || [];
  const rows = lines.map(normalizeLine).filter(Boolean);

  // The spread should favour the seller: buying a unit costs at least what
  // selling one returns. If most rows disagree, the two sides were read the
  // wrong way round and every margin below would be nonsense.
  const inverted = rows.filter((r) => r.sell > r.buy).length;
  const orientationSuspect = rows.length > 4 && inverted > rows.length * 0.6;

  const scored = rows.map((r) => {
    const spread = r.sell - r.buy;
    const marginPct = r.buy > 0 ? (spread / r.buy) * 100 : 0;
    return {
      ...r,
      spread,
      marginPct,
      // Margin is worthless without someone on the other side of it: weight it
      // by how many listings actually back the thinner side of the book.
      score: marginPct * Math.log10(1 + Math.max(0, r.volume)),
      lowConfidence: r.volume < opts.minVolume,
    };
  });

  const tradable = scored
    .filter((r) => !r.lowConfidence && r.marginPct >= opts.minMargin)
    .sort((a, b) => b.score - a.score);

  const thin = scored
    .filter((r) => r.lowConfidence && r.marginPct >= opts.minMargin)
    .sort((a, b) => b.marginPct - a.marginPct);

  return { rows: scored, tradable, thin, orientationSuspect, options: opts };
}

function formatReport(result) {
  const out = [];
  const { tradable, thin, rows, options, orientationSuspect } = result;

  const stamps = rows.map((r) => r.sampleTime).filter(Boolean).sort();
  if (stamps.length) out.push(`Dump sampled: ${stamps[0]} → ${stamps[stamps.length - 1]}`);
  out.push(`${rows.length} currencies parsed · liquidity floor ${options.minVolume} listings · margin floor ${options.minMargin}%`);

  if (orientationSuspect) {
    out.push('');
    out.push('!! The buy/sell sides look inverted for most rows — margins below are not trustworthy.');
    out.push('   Check the dump is a currencyoverview-shaped payload before acting on it.');
  }

  out.push('');
  out.push(`Worth flipping (${tradable.length}) — ranked by margin weighted for liquidity:`);
  out.push('  ' + 'currency'.padEnd(26) + 'buy'.padStart(10) + 'sell'.padStart(10)
    + 'margin'.padStart(9) + 'listings'.padStart(10));
  for (const r of tradable.slice(0, options.top)) {
    out.push('  ' + r.name.slice(0, 25).padEnd(26)
      + r.buy.toFixed(2).padStart(10)
      + r.sell.toFixed(2).padStart(10)
      + `${r.marginPct.toFixed(1)}%`.padStart(9)
      + `${r.buyListings}/${r.sellListings}`.padStart(10));
  }
  if (!tradable.length) out.push('  nothing clears both floors — widen them or the market is efficient today.');

  if (thin.length) {
    out.push('');
    out.push(`Wide but thin (${thin.length}) — big spread, too few listings to trust:`);
    for (const r of thin.slice(0, 8)) {
      out.push(`  ${r.name.slice(0, 25).padEnd(26)}${`${r.marginPct.toFixed(1)}%`.padStart(9)}   ${r.volume} listings on the thin side`);
    }
  }

  out.push('');
  out.push('These are listed prices, not fills. Treat every margin as an upper bound:');
  out.push('undercutting, price-fixed top-of-book listings and travel time all eat into it.');
  return out.join('\n');
}

// --- self-test ------------------------------------------------------------
// Proves the maths on a synthetic book with a known answer, since the live
// endpoint is not reachable from every environment this runs in.
const FIXTURE = {
  lines: [
    // buy at 100, sell at 110 -> 10% margin, deep book
    { currencyTypeName: 'Deep Orb', chaosEquivalent: 110,
      pay: { value: 1 / 100, count: 40 }, receive: { value: 110, count: 35 } },
    // buy at 50, sell at 52 -> 4% margin, deep book
    { currencyTypeName: 'Thin Margin Orb', chaosEquivalent: 52,
      pay: { value: 1 / 50, count: 60 }, receive: { value: 52, count: 55 } },
    // 40% margin but only 2 listings -> must be quarantined as thin
    { currencyTypeName: 'Illiquid Orb', chaosEquivalent: 140,
      pay: { value: 1 / 100, count: 2 }, receive: { value: 140, count: 3 } },
  ],
};

function selftest() {
  const result = analyse(FIXTURE, { minVolume: 8, minMargin: 2, top: 10 });
  const checks = [];
  const deep = result.rows.find((r) => r.name === 'Deep Orb');
  checks.push(['buy side read as 100', Math.abs(deep.buy - 100) < 0.001]);
  checks.push(['sell side read as 110', Math.abs(deep.sell - 110) < 0.001]);
  checks.push(['margin is 10%', Math.abs(deep.marginPct - 10) < 0.001]);
  checks.push(['deep book ranks first', result.tradable[0].name === 'Deep Orb']);
  checks.push(['thin book quarantined', result.thin.some((r) => r.name === 'Illiquid Orb')]);
  checks.push(['thin book kept out of tradable', !result.tradable.some((r) => r.name === 'Illiquid Orb')]);
  checks.push(['liquidity beats raw margin', result.tradable[0].marginPct < 40]);
  checks.push(['orientation not flagged on a sane book', result.orientationSuspect === false]);

  let failed = 0;
  for (const [label, ok] of checks) {
    console.log(`${ok ? 'ok  ' : 'FAIL'}  ${label}`);
    if (!ok) failed += 1;
  }
  console.log(`\n${checks.length - failed}/${checks.length} checks passed`);
  process.exit(failed ? 1 : 0);
}

function main() {
  const args = process.argv.slice(2);
  if (args.includes('--selftest')) return selftest();

  const input = args.find((a) => !a.startsWith('--'));
  if (!input) {
    console.log(`Currency flipping analysis over a poe.ninja economy dump.

  node scripts/economy/flip-currency.js dump.json [--min-volume N] [--min-margin N] [--top N] [--json]
  curl -s '<endpoint>' | node scripts/economy/flip-currency.js -
  node scripts/economy/flip-currency.js --selftest

Fetch a dump on a machine with network access, e.g.
  curl -s 'https://poe.ninja/api/data/currencyoverview?league=<League>&type=Currency' > dump.json`);
    process.exit(1);
  }

  const valueOf = (flag, fallback) => {
    const i = args.indexOf(flag);
    return i >= 0 ? Number(args[i + 1]) : fallback;
  };
  const options = {
    minVolume: valueOf('--min-volume', DEFAULTS.minVolume),
    minMargin: valueOf('--min-margin', DEFAULTS.minMargin),
    top: valueOf('--top', DEFAULTS.top),
  };

  const raw = input === '-' ? fs.readFileSync(0, 'utf8') : fs.readFileSync(input, 'utf8');
  const result = analyse(JSON.parse(raw), options);
  console.log(args.includes('--json')
    ? JSON.stringify(result.tradable, null, 2)
    : formatReport(result));
}

if (require.main === module) main();
module.exports = { analyse, normalizeLine, formatReport };
