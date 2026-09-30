// Deterministic metric engine. Pure functions over SwapRow[].
// Contract: docs/METHOD.md + spec §5. No wall-clock, no RNG, no locale.

import { createHash } from "node:crypto";
import type {
  DepthPoint,
  FilterPolicy,
  MakerContribution,
  Observation,
  ObservationQuality,
  QualityState,
  RejectedRow,
  ScanMode,
  SellContext,
  SideKey,
  SideMetrics,
  SourceReceipt,
  SwapRow,
  WindowInfo,
} from "../types";
import { METHOD_VERSION, PARSER_VERSION } from "../types";

interface MakerAcc {
  buyUsd: number;
  sellUsd: number;
  buyUsdKnown: boolean;
  sellUsdKnown: boolean;
  buyObserved: boolean;
  sellObserved: boolean;
  eventCount: number;
  eventRefs: string[];
}

const addrKey = (a: string): string => a; // already normalized by parser

function aggregate(rows: SwapRow[]) {
  const makers = new Map<string, MakerAcc>();
  let unattributedBuyUsd = 0;
  let unattributedSellUsd = 0;
  let missingUsdEvents = 0;
  const txSet = new Set<string>();

  for (const r of rows) {
    if (r.tx) txSet.add(r.tx);
    if (r.usd === null) missingUsdEvents++;
    if (r.maker === null) {
      if (r.usd !== null) {
        if (r.side === "buy") unattributedBuyUsd += r.usd;
        else unattributedSellUsd += r.usd;
      }
      continue;
    }
    const m = makers.get(addrKey(r.maker)) ?? {
      buyUsd: 0, sellUsd: 0, buyUsdKnown: false, sellUsdKnown: false,
      buyObserved: false, sellObserved: false, eventCount: 0, eventRefs: [],
    };
    m.eventCount++;
    m.eventRefs.push(`p${r.page}:${r.index}`);
    if (r.side === "buy") {
      m.buyObserved = true;
      if (r.usd !== null) { m.buyUsd += r.usd; m.buyUsdKnown = true; }
    } else {
      m.sellObserved = true;
      if (r.usd !== null) { m.sellUsd += r.usd; m.sellUsdKnown = true; }
    }
    makers.set(addrKey(r.maker), m);
  }
  return { makers, unattributedBuyUsd, unattributedSellUsd, missingUsdEvents, uniqueTransactions: txSet.size };
}

// Canonical ranking: USD desc → byte-ASCII asc on normalized address.
function rankMakers(entries: [string, MakerAcc][], side: "buy" | "sell" | "all") {
  const usd = (m: MakerAcc) =>
    side === "buy" ? (m.buyUsdKnown ? m.buyUsd : -Infinity)
    : side === "sell" ? (m.sellUsdKnown ? m.sellUsd : -Infinity)
    : (m.buyUsdKnown || m.sellUsdKnown ? m.buyUsd + m.sellUsd : -Infinity);
  return [...entries].sort((a, b) => {
    const d = usd(b[1]) - usd(a[1]);
    if (d !== 0) return d;
    return a[0] < b[0] ? -1 : a[0] > b[0] ? 1 : 0;
  });
}

function sideMetrics(rows: SwapRow[], makers: Map<string, MakerAcc>, side: SideKey, topNReq = 3): SideMetrics {
  const sideRows = side === "all" ? rows : rows.filter((r) => r.side === side);
  if (sideRows.length === 0) {
    return {
      quality: "missing", denominatorUsd: null, uniqueMakers: 0, topN: 0,
      topNShare: null, hhi: null, effectiveMakers: null,
      largestEventUsd: null, largestEventShare: null, leaveLargestOutShare: null,
      unattributedUsd: null, missingUsdEvents: 0,
    };
  }
  const usdOf = (m: MakerAcc): number | null =>
    side === "buy" ? (m.buyUsdKnown ? m.buyUsd : null)
    : side === "sell" ? (m.sellUsdKnown ? m.sellUsd : null)
    : m.buyUsdKnown || m.sellUsdKnown ? m.buyUsd + m.sellUsd : null;

  const present = [...makers.entries()].filter(([, m]) =>
    side === "buy" ? m.buyObserved : side === "sell" ? m.sellObserved : true);
  const valued = present.filter(([, m]) => usdOf(m) !== null);
  const denominator = valued.reduce((a, [, m]) => a + (usdOf(m) ?? 0), 0);
  const unattributed = sideRows.reduce((a, r) => a + (r.maker === null && r.usd !== null ? r.usd : 0), 0);
  const missingUsd = sideRows.filter((r) => r.usd === null).length;
  const usdVals = sideRows.map((r) => r.usd).filter((v): v is number => v !== null);
  const largestEventUsd = usdVals.length ? Math.max(...usdVals) : null;

  if (denominator <= 0) {
    return {
      quality: "unavailable", denominatorUsd: 0, uniqueMakers: present.length, topN: 0,
      topNShare: null, hhi: null, effectiveMakers: null,
      largestEventUsd, largestEventShare: null, leaveLargestOutShare: null,
      unattributedUsd: unattributed, missingUsdEvents: missingUsd,
    };
  }

  const ranked = rankMakers(present, side);
  const topN = Math.min(topNReq, ranked.length);
  const topSum = ranked.slice(0, topN).reduce((a, [, m]) => a + (usdOf(m) ?? 0), 0);
  const hhi = valued.reduce((a, [, m]) => {
    const p = (usdOf(m) ?? 0) / denominator;
    return a + p * p;
  }, 0);
  const withoutTop = ranked.slice(1);
  const topNm1 = Math.min(topNReq, withoutTop.length);
  const leaveOut = withoutTop.slice(0, topNm1).reduce((a, [, m]) => a + (usdOf(m) ?? 0), 0);

  return {
    quality: "valid",
    denominatorUsd: denominator,
    uniqueMakers: present.length,
    topN,
    topNShare: topSum / denominator,
    hhi,
    effectiveMakers: hhi > 0 ? 1 / hhi : null,
    largestEventUsd,
    largestEventShare: largestEventUsd !== null ? largestEventUsd / denominator : null,
    leaveLargestOutShare: ranked.length > 1 ? leaveOut / denominator : null,
    unattributedUsd: unattributed,
    missingUsdEvents: missingUsd,
  };
}

function sellContext(rows: SwapRow[], makers: Map<string, MakerAcc>, sell: SideMetrics, topNReq = 3): SellContext {
  const sellRanked = rankMakers([...makers.entries()].filter(([, m]) => m.sellObserved), "sell");
  const S = sell.denominatorUsd;
  const noBuyAll = sellRanked.filter(([, m]) => !m.buyObserved);
  const positiveUsdNoBuy = noBuyAll.filter(([, m]) => m.sellUsdKnown && m.sellUsd > 0);
  if (S === null || S <= 0) {
    return {
      quality: sell.quality === "missing" ? "missing" : "unavailable",
      noBuyObservedShare: null,
      observedNoBuySellers: noBuyAll.length,
      positiveUsdNoBuySellers: positiveUsdNoBuy.length,
      topNOverlapShareOfAllAttributedSells: null,
    };
  }
  const topNSet = new Set(sellRanked.slice(0, Math.min(topNReq, sellRanked.length)).map(([a]) => a));
  const uSum = positiveUsdNoBuy.reduce((a, [, m]) => a + m.sellUsd, 0);
  const xSum = positiveUsdNoBuy.filter(([a]) => topNSet.has(a)).reduce((a, [, m]) => a + m.sellUsd, 0);
  return {
    quality: "valid",
    noBuyObservedShare: uSum / S,
    observedNoBuySellers: noBuyAll.length,
    positiveUsdNoBuySellers: positiveUsdNoBuy.length,
    topNOverlapShareOfAllAttributedSells: xSum / S,
  };
}

function depthPoint(rows: SwapRow[], topNReq = 3): DepthPoint {
  const { makers } = aggregate(rows);
  const sell = sideMetrics(rows, makers, "sell", topNReq);
  const ctx = sellContext(rows, makers, sell, topNReq);
  const ts = rows.map((r) => r.ts);
  return {
    events: rows.length,
    spanSec: ts.length ? (Math.max(...ts) - Math.min(...ts)) / 1000 : null,
    topNShare: sell.topNShare,
    hhi: sell.hhi,
    noBuyShare: ctx.noBuyObservedShare,
    jointShare: ctx.topNOverlapShareOfAllAttributedSells,
    uniqueMakers: sell.uniqueMakers,
  };
}

export function depthCurve(rows: SwapRow[], topNReq = 3): { sell: DepthPoint[]; all: DepthPoint[] } {
  const pages = [...new Set(rows.map((r) => r.page))].sort((a, b) => a - b);
  const sell: DepthPoint[] = [];
  const all: DepthPoint[] = [];
  for (const p of pages) {
    const prefix = rows.filter((r) => r.page <= p);
    sell.push(depthPoint(prefix, topNReq));
    const { makers } = aggregate(prefix);
    const allM = sideMetrics(prefix, makers, "all", topNReq);
    const ts = prefix.map((r) => r.ts);
    all.push({
      events: prefix.length,
      spanSec: ts.length ? (Math.max(...ts) - Math.min(...ts)) / 1000 : null,
      topNShare: allM.topNShare,
      hhi: allM.hhi,
      noBuyShare: null,
      jointShare: null,
      uniqueMakers: allM.uniqueMakers,
    });
  }
  return { sell, all };
}

export function removeLargestEvent(rows: SwapRow[], side: "buy" | "sell"): SwapRow[] {
  const sideRows = rows.filter((r) => r.side === side && r.usd !== null);
  if (!sideRows.length) return rows;
  // deterministic pick: max usd, then earliest ts, then smallest eventRef
  const target = sideRows.reduce((a, b) => {
    if ((b.usd ?? 0) !== (a.usd ?? 0)) return (b.usd ?? 0) > (a.usd ?? 0) ? b : a;
    if (b.ts !== a.ts) return b.ts < a.ts ? b : a;
    const ra = `p${a.page}:${a.index}`, rb = `p${b.page}:${b.index}`;
    return rb < ra ? b : a;
  });
  return rows.filter((r) => r !== target);
}

export interface BuildInput {
  id?: string;
  token: Observation["token"];
  mode: ScanMode;
  capturedAt: string;
  window: WindowInfo;
  sources: SourceReceipt[];
  rows: SwapRow[];              // already parsed + deduped
  rejected: RejectedRow[];
  duplicates: number;
  dedupStatus: "clean" | "uncertain";
  creatorAddresses?: Set<string>;
  sourceSkewMs?: number | null;
  topN?: number;
}

export function buildObservation(input: BuildInput): Observation {
  const { rows } = input;
  const topNReq = input.topN ?? 3;
  const creators = input.creatorAddresses ?? new Set<string>();
  const { makers, unattributedSellUsd, missingUsdEvents, uniqueTransactions } = aggregate(rows);

  const ts = rows.map((r) => r.ts);
  const window: WindowInfo = {
    ...input.window,
    observedStart: ts.length ? Math.min(...ts) : null,
    observedEnd: ts.length ? Math.max(...ts) : null,
  };

  const contributions: MakerContribution[] = [...makers.entries()].map(([address, m]) => ({
    address,
    buyUsd: m.buyUsdKnown ? m.buyUsd : null,
    sellUsd: m.sellUsdKnown ? m.sellUsd : null,
    allUsd: m.buyUsdKnown || m.sellUsdKnown ? m.buyUsd + m.sellUsd : null,
    buyObserved: m.buyObserved,
    sellObserved: m.sellObserved,
    eventCount: m.eventCount,
    creatorObserved: creators.has(address),
    eventRefs: m.eventRefs,
  }));

  const concentration = {
    buy: sideMetrics(rows, makers, "buy", topNReq),
    sell: sideMetrics(rows, makers, "sell", topNReq),
    all: sideMetrics(rows, makers, "all", topNReq),
  };
  const sellCtx = sellContext(rows, makers, concentration.sell, topNReq);
  const attributed = rows.filter((r) => r.maker !== null && r.usd !== null).length;
  const quality: ObservationQuality = {
    validSideEvents: rows.length,
    attributedUsdEvents: attributed,
    uniqueTransactions,
    rejectedEvents: input.rejected.length,
    rejectedRows: input.rejected,
    missingUsdEvents,
    unattributedSellUsd,
    duplicates: input.duplicates,
    dedupStatus: input.dedupStatus,
    attributionStatus: attributed === 0 ? "unavailable" : attributed === rows.length ? "complete" : "partial",
    sourceSkewMs: input.sourceSkewMs ?? null,
  };

  const notes: string[] = [];
  if (input.dedupStatus === "uncertain") notes.push("dedup uncertain: some rows lack full identity");
  if (unattributedSellUsd) notes.push(`${unattributedSellUsd.toFixed(2)} USD sell volume is unattributed (missing maker)`);
  if (missingUsdEvents) notes.push(`${missingUsdEvents} events missing USD notional`);

  const idBase = `${input.token.chain}|${input.token.address}|${window.requestedEnd}|${window.pagesFetched}|${input.sources.map((s) => s.bodySha256.slice(0, 12)).join(",")}`;
  return {
    schemaVersion: "1.0.0",
    id: input.id ?? createHash("sha256").update(idBase).digest("hex").slice(0, 16),
    capturedAt: input.capturedAt,
    mode: input.mode,
    token: input.token,
    window,
    filterPolicy: { bothSides: true, makerFilter: null, minimumUsd: null, providerFilterStatus: "none-declared" } satisfies FilterPolicy,
    quality,
    concentration,
    sellContext: sellCtx,
    makers: contributions.sort((a, b) => (b.sellUsd ?? -Infinity) - (a.sellUsd ?? -Infinity) || (a.address < b.address ? -1 : 1)),
    depthCurves: depthCurve(rows, topNReq),
    sources: input.sources,
    methodVersion: METHOD_VERSION,
    parserVersion: PARSER_VERSION,
    notes,
  };
}
