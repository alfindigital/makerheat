// Replay a fixture group → Observation. Reads manifest for receipts/meta;
// parses raw bodies through the same parser the live collector feeds.

import { readFileSync } from "node:fs";
import { createHash } from "node:crypto";
import path from "node:path";
import { dedupRows, parsePage } from "./parser";
import { buildObservation } from "./engine";
import type { Observation, SourceReceipt, SwapRow } from "../types";

export interface FixtureEntry {
  file: string;
  sha256: string;
  bytes: number;
  kind: string;
  endpoint: string;
  params: Record<string, string>;
  httpStatus: number;
  providerError: string | null;
  credits: number | null;
  requestedAt: string;
  completedAt: string;
  latencyMs: number | null;
  chain?: string;
  address?: string;
  group?: string;
  page?: number;
  endTimeAnchor?: string;
}

export function loadManifest(fixturesDir: string): FixtureEntry[] {
  const man = JSON.parse(readFileSync(path.join(fixturesDir, "manifest.json"), "utf8"));
  return man.fixtures as FixtureEntry[];
}

export function groupPages(fixturesDir: string, group: string): FixtureEntry[] {
  return loadManifest(fixturesDir)
    .filter((f) => f.group === group && f.kind === "transactions")
    .sort((a, b) => (a.page ?? 0) - (b.page ?? 0));
}

export function replayGroup(fixturesDir: string, group: string, opts?: {
  maxPages?: number;
  mode?: Observation["mode"];
}): Observation {
  const entries = groupPages(fixturesDir, group);
  if (!entries.length) throw new Error(`no fixtures for group "${group}"`);
  const use = opts?.maxPages ? entries.slice(0, opts.maxPages) : entries;

  let rows: SwapRow[] = [];
  const rejected: Observation["quality"]["rejectedRows"] = [];
  const sources: SourceReceipt[] = [];

  for (const e of use) {
    const raw = JSON.parse(readFileSync(path.join(fixturesDir, e.file), "utf8"));
    const { rows: pr, rejected: rr } = parsePage(raw, e.page ?? 0, e.chain ?? e.params.platform ?? "unknown");
    rows = rows.concat(pr);
    rejected.push(...rr);
    sources.push({
      endpoint: e.endpoint,
      params: e.params,
      requestedAt: e.requestedAt,
      completedAt: e.completedAt,
      httpStatus: e.httpStatus,
      providerError: e.providerError,
      bodySha256: e.sha256 ?? createHash("sha256").update(readFileSync(path.join(fixturesDir, e.file))).digest("hex"),
      credits: e.credits,
      ...(e.page !== undefined ? { page: e.page } : {}),
    });
  }

  const d = dedupRows(rows);
  const last = use[use.length - 1]!;
  const pagesExpected = use.length;
  return buildObservation({
    token: {
      chain: last.chain ?? last.params.platform ?? "unknown",
      address: last.address ?? last.params.address ?? "unknown",
      symbol: null,
      name: null,
    },
    mode: opts?.mode ?? "replay",
    capturedAt: last.completedAt,
    window: {
      requestedStart: null,
      requestedEnd: Number(last.endTimeAnchor ?? last.params.endTime ?? 0),
      observedStart: null,
      observedEnd: null,
      pagesFetched: use.length,
      stopReason: use.length < pagesExpected ? "cursor_exhausted" : "page_budget",
    },
    sources,
    rows: d.rows,
    rejected,
    duplicates: d.duplicates,
    dedupStatus: d.status,
  });
}

export function replaySynthetic(fixturesDir: string, file: string): { rows: SwapRow[]; rejected: Observation["quality"]["rejectedRows"] } {
  const raw = JSON.parse(readFileSync(path.join(fixturesDir, file), "utf8"));
  const { rows, rejected } = parsePage(raw, 1, "Synthetic");
  return { rows, rejected };
}
