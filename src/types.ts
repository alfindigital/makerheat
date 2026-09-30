// Observation contract — canonical spec: ideas/MakerHeat-GhostTape-concept.md §8
// All shares are fractions in [0,1]; % formatting is UI-only.

export const METHOD_VERSION = "1.0.0";
export const PARSER_VERSION = "1.0.0";

export type QualityState =
  | "valid"
  | "missing"
  | "zero-unverified"
  | "inconsistent"
  | "unavailable";

export type StopReason =
  | "target_bound_reached"
  | "cursor_exhausted"
  | "page_budget"
  | "time_budget"
  | "quota_limit"
  | "provider_error"
  | "cursor_stalled"
  | "aborted";

export type ScanMode = "live" | "replay" | "synthetic";
export type Side = "buy" | "sell";
export type SideKey = "buy" | "sell" | "all";

export interface SwapRow {
  index: number;               // raw row index in its page
  page: number;                // 1-based page this row arrived on
  ts: number;                  // ms epoch
  side: Side;
  usd: number | null;          // null = missing/invalid (never silently 0)
  qty: number | null;
  maker: string | null;        // normalized per-chain (EVM lowercase; Solana case-preserved)
  tx: string | null;           // NEVER falls back to block height h
  h: string | null;            // block height — ordering context only
  lgid: string | null;
  f: string | null;            // factory/program id, NOT a pool address
  ex: string | null;           // venue label
  t0s: string | null;
  t1s: string | null;
  idParts: string | null;      // dedup identity "platform|tx|lgid|f" when sufficient
}

export interface RejectedRow {
  index: number;
  page: number;
  reason: string;              // e.g. "invalid-side", "invalid-ts", "bad-usd"
}

export interface SourceReceipt {
  endpoint: string;
  params: Record<string, string>;   // sanitized — never contains keys
  requestedAt: string;
  completedAt: string;
  httpStatus: number;
  providerError: string | null;
  bodySha256: string;
  credits: number | null;
  page?: number;
}

export interface FilterPolicy {
  bothSides: true;                  // mandatory — no side/maker/minUsd filters
  makerFilter: string | null;
  minimumUsd: number | null;
  providerFilterStatus: "none-declared" | "unknown";
}

export interface WindowInfo {
  requestedStart: number | null;
  requestedEnd: number;             // frozen endTime anchor (ms)
  observedStart: number | null;
  observedEnd: number | null;
  pagesFetched: number;
  stopReason: StopReason;
}

export interface MakerContribution {
  address: string;
  buyUsd: number | null;
  sellUsd: number | null;
  allUsd: number | null;
  buyObserved: boolean;             // presence — independent of USD availability
  sellObserved: boolean;
  eventCount: number;
  creatorObserved: boolean;         // separate bucket — never silently excluded
  eventRefs: string[];              // "p<page>:<index>" locators
}

export interface SideMetrics {
  quality: QualityState;
  denominatorUsd: number | null;    // attributed USD for this side
  uniqueMakers: number | null;
  topN: number;                     // actual N (<= requested)
  topNShare: number | null;         // fraction 0..1
  hhi: number | null;
  effectiveMakers: number | null;
  largestEventUsd: number | null;
  largestEventShare: number | null; // of attributed side USD
  leaveLargestOutShare: number | null; // topN share with largest maker removed
  unattributedUsd: number | null;
  missingUsdEvents: number;
}

export interface DepthPoint {
  events: number;
  spanSec: number | null;
  topNShare: number | null;
  hhi: number | null;
  noBuyShare: number | null;
  jointShare: number | null;        // X_W
  uniqueMakers: number | null;
}

export interface SellContext {
  quality: QualityState;
  noBuyObservedShare: number | null;         // U_W — fraction of attributed sell USD
  observedNoBuySellers: number | null;       // sellObserved && !buyObserved
  positiveUsdNoBuySellers: number | null;    // in G_W with S_i > 0
  topNOverlapShareOfAllAttributedSells: number | null; // X_W
}

export interface ObservationQuality {
  validSideEvents: number;
  attributedUsdEvents: number;
  uniqueTransactions: number | null;
  rejectedEvents: number;
  rejectedRows: RejectedRow[];
  missingUsdEvents: number;
  unattributedSellUsd: number | null;
  duplicates: number;
  dedupStatus: "clean" | "uncertain";
  attributionStatus: "complete" | "partial" | "unavailable";
  sourceSkewMs: number | null;
}

export interface Observation {
  schemaVersion: "1.0.0";
  id: string;
  capturedAt: string;
  mode: ScanMode;
  token: { chain: string; address: string; symbol: string | null; name: string | null };
  window: WindowInfo;
  filterPolicy: FilterPolicy;
  quality: ObservationQuality;
  concentration: Record<SideKey, SideMetrics>;
  sellContext: SellContext;
  makers: MakerContribution[];
  depthCurves: { sell: DepthPoint[]; all: DepthPoint[] }; // per cumulative page boundary
  sources: SourceReceipt[];
  methodVersion: string;
  parserVersion: string;
  notes: string[];
}
