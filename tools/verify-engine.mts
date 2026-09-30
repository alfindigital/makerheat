// Independent engine verification: recompute headline metrics from raw
// fixture bytes with a SEPARATE code path (no engine imports), then diff
// against the engine's output. This is the audit trail — if the two paths
// disagree, the engine is wrong, not this script.
//
//   node tools/verify-engine.mts [fixturesDir] [group]

import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { replayGroup } from "../src/lib/replay";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const FIX = process.argv[2] ?? path.join(ROOT, "fixtures");
const GROUP = process.argv[3] ?? "jup-solana-keyless";

// ---- independent recomputation (no engine imports) ----
interface VRow { ts: number; side: string; usd: number | null; maker: string | null }
function independentRows(file: string): VRow[] {
  const raw = JSON.parse(readFileSync(path.join(FIX, file), "utf8"));
  const swaps = raw?.data?.swaps ?? [];
  return swaps
    .filter((s: any) => (s.tp === "buy" || s.tp === "sell") && Number(s.ts) > 0)
    .map((s: any) => ({
      ts: Number(s.ts),
      side: s.tp,
      usd: s.v == null ? null : Number(s.v),
      maker: typeof s.ma === "string" && s.ma ? (/^0x[0-9a-fA-F]{40}$/.test(s.ma) ? s.ma.toLowerCase() : s.ma) : null,
    }));
}

function independentMetrics(rows: VRow[]) {
  const sell = new Map<string, { s: number; b: boolean }>();
  for (const r of rows) {
    if (!r.maker) continue;
    const m = sell.get(r.maker) ?? { s: 0, b: false };
    if (r.side === "sell" && r.usd !== null) m.s += r.usd;
    if (r.side === "buy") m.b = true;
    sell.set(r.maker, m);
  }
  const sellers = [...sell.entries()].filter(([, m]) => m.s > 0 || [...sell.keys()].includes("")); // keep presence via observed sell rows
  // recompute observedSell properly
  const observedSell = new Set(rows.filter((r) => r.side === "sell" && r.maker).map((r) => r.maker as string));
  const observedBuy = new Set(rows.filter((r) => r.side === "buy" && r.maker).map((r) => r.maker as string));
  const S = [...sell.values()].reduce((a, m) => a + m.s, 0);
  const ranked = [...sell.entries()].filter(([a]) => observedSell.has(a)).sort((a, b) => b[1].s - a[1].s || (a[0] < b[0] ? -1 : 1));
  const top3 = ranked.slice(0, 3).reduce((a, [, m]) => a + m.s, 0);
  const noBuy = ranked.filter(([a]) => !observedBuy.has(a));
  const uSum = noBuy.reduce((a, [, m]) => a + m.s, 0);
  const top3set = new Set(ranked.slice(0, 3).map(([a]) => a));
  const xSum = noBuy.filter(([a]) => top3set.has(a)).reduce((a, [, m]) => a + m.s, 0);
  const hhi = [...sell.values()].reduce((a, m) => { const p = m.s / S; return a + p * p; }, 0);
  return {
    S, top3Share: S > 0 ? top3 / S : null,
    noBuyShare: S > 0 ? uSum / S : null,
    xShare: S > 0 ? xSum / S : null,
    noBuyCount: noBuy.length,
    effM: S > 0 && hhi > 0 ? 1 / hhi : null,
  };
}

const man = JSON.parse(readFileSync(path.join(FIX, "manifest.json"), "utf8"));
const pages = man.fixtures.filter((f: any) => f.group === GROUP).sort((a: any, b: any) => a.page - b.page);

const engine = replayGroup(FIX, GROUP);
const rows = pages.flatMap((p: any) => independentRows(p.file));
const indep = independentMetrics(rows);

const close = (a: number | null, b: number | null) =>
  a === null && b === null ? true : a !== null && b !== null && Math.abs(a - b) < 1e-9;

const checks = [
  ["sell denominator", engine.concentration.sell.denominatorUsd, indep.S],
  ["top3 sell share", engine.concentration.sell.topNShare, indep.top3Share],
  ["no-buy share", engine.sellContext.noBuyObservedShare, indep.noBuyShare],
  ["joint share", engine.sellContext.topNOverlapShareOfAllAttributedSells, indep.xShare],
  ["effective sell makers", engine.concentration.sell.effectiveMakers, indep.effM],
] as const;

let fail = 0;
for (const [name, a, b] of checks) {
  const ok = close(a, b);
  if (!ok) fail++;
  console.log(`${ok ? "OK  " : "FAIL"} ${name}: engine=${a === null ? "null" : (a as number).toFixed(6)} indep=${b === null ? "null" : (b as number).toFixed(6)}`);
}
console.log(`\nengine=${fail === 0 ? "MATCHES" : "DIVERGES"} independent recompute (${GROUP})`);
process.exit(fail ? 1 : 0);
