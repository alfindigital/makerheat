// Bounded cursor collector — the live twin of replay.ts.
// Contract: docs/METHOD.md §4. Frozen endTime, opaque lastId cursor,
// both-sides policy, dedup, explicit stop reason, receipts with sha256.

import { createHash } from "node:crypto";
import { cmcGet } from "./cmc";
import { dedupRows, parsePage } from "../lib/parser";
import { buildObservation } from "../lib/engine";
import type { Observation, SourceReceipt, StopReason, SwapRow } from "../types";

export interface CollectOptions {
  chain: string;
  address: string;
  maxPages: number;
  deadlineMs: number;
  endTimeMs?: number;         // frozen anchor; default now
  startTimeMs?: number | null;
  topN?: number;
  signal?: AbortSignal;
}

export interface CollectResult {
  observation: Observation;
  creditsUsed: number;
}

interface PageMeta { json: Record<string, unknown> | null }

export async function collect(opts: CollectOptions): Promise<CollectResult> {
  const endTime = opts.endTimeMs ?? Date.now();
  const deadline = Date.now() + opts.deadlineMs;
  const rows: SwapRow[] = [];
  const rejected: Observation["quality"]["rejectedRows"] = [];
  const sources: SourceReceipt[] = [];
  let lastId: string | null = null;
  let seenCursor: string | null = null;
  let stop: StopReason = "page_budget";
  let credits = 0;
  let page = 0;
  let prevOldest: number | null = null;

  while (page < opts.maxPages) {
    if (Date.now() >= deadline) { stop = "time_budget"; break; }
    if (opts.signal?.aborted) { stop = "aborted"; break; }

    const params: Record<string, string> = {
      platform: opts.chain,
      address: opts.address,
      limit: "100",
      sortBy: "time",
      sortType: "desc",
      endTime: String(endTime),
    };
    if (lastId) params.lastId = lastId;
    if (opts.startTimeMs != null) params.startTime = String(opts.startTimeMs);

    let resp;
    try {
      resp = await cmcGet("/v1/dex/tokens/transactions", params, opts.signal);
    } catch (e) {
      stop = opts.signal?.aborted ? "aborted" : "provider_error";
      break;
    }
    page++;
    const bodySha256 = createHash("sha256").update(resp.body).digest("hex");
    sources.push({
      endpoint: "/v1/dex/tokens/transactions",
      params,
      requestedAt: resp.requestedAt,
      completedAt: resp.completedAt,
      httpStatus: resp.httpStatus,
      providerError: resp.providerError,
      bodySha256,
      credits: resp.credits,
      page,
    });
    credits += resp.credits ?? 0;

    if (resp.httpStatus === 429) { stop = "quota_limit"; break; }
    if (resp.httpStatus !== 200 || resp.providerError) { stop = "provider_error"; break; }

    let json: PageMeta["json"] = null;
    try { json = JSON.parse(resp.body.toString("utf8")); } catch { stop = "provider_error"; break; }
    const swaps = (json as { data?: { swaps?: unknown[]; lastId?: string } })?.data?.swaps;
    const nextCursor = (json as { data?: { lastId?: string } })?.data?.lastId ?? null;

    if (!Array.isArray(swaps) || swaps.length === 0) { stop = "cursor_exhausted"; break; }

    const parsed = parsePage(json, page, opts.chain);
    rows.push(...parsed.rows);
    rejected.push(...parsed.rejected);

    const oldest = Math.min(...parsed.rows.map((r) => r.ts));
    // startTime bound reached — but only after boundary ties are traversed:
    // if the oldest row on this page sits exactly on startTime, keep pulling
    // one more page so a tie at the boundary cannot drop events.
    if (opts.startTimeMs != null && Number.isFinite(oldest)) {
      if (oldest < opts.startTimeMs) { stop = "target_bound_reached"; break; }
      // oldest === startTime → continue one more page
    }
    if (nextCursor === null) { stop = "cursor_exhausted"; break; }
    if (nextCursor === seenCursor) { stop = "cursor_stalled"; break; }
    seenCursor = lastId;
    lastId = nextCursor;
    prevOldest = oldest;
    void prevOldest;
  }

  const d = dedupRows(rows);
  const endMs = Math.max(...sources.map((s) => Date.parse(s.completedAt)));
  const startMs = Math.min(...sources.map((s) => Date.parse(s.requestedAt)));
  const observation = buildObservation({
    token: { chain: opts.chain, address: opts.address, symbol: null, name: null },
    mode: "live",
    capturedAt: sources[0]?.requestedAt ?? new Date().toISOString(),
    window: {
      requestedStart: opts.startTimeMs ?? null,
      requestedEnd: endTime,
      observedStart: null,
      observedEnd: null,
      pagesFetched: page,
      stopReason: stop,
    },
    sources,
    rows: d.rows,
    rejected,
    duplicates: d.duplicates,
    dedupStatus: d.status,
    sourceSkewMs: Number.isFinite(endMs - startMs) ? endMs - startMs : null,
    ...(opts.topN !== undefined ? { topN: opts.topN } : {}),
  });
  return { observation, creditsUsed: credits };
}

export async function fetchTokenMeta(chain: string, address: string) {
  const resp = await cmcGet("/v1/dex/token", { platform: chain, address });
  if (resp.httpStatus !== 200) return null;
  try {
    return { json: JSON.parse(resp.body.toString("utf8")), receipt: resp };
  } catch {
    return null;
  }
}
