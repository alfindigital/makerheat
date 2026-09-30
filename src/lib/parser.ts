// Raw CMC swap row → SwapRow. Semantics per docs/METHOD.md §6:
//  - tp must be "buy"/"sell" (anything else → rejected row, reason recorded)
//  - v must be finite & ≥0 else usd=null (missing is not zero)
//  - tx missing stays null — h (block height) is NEVER a tx substitute
//  - ma missing → unattributed (still counted as observed activity)
//  - EVM-style 0x addresses normalize lowercase; others case-preserved

import type { RejectedRow, Side, SwapRow } from "../types";
import { PARSER_VERSION } from "../types";

export { PARSER_VERSION };

const numOrNull = (v: unknown): number | null => {
  if (typeof v === "number") return Number.isFinite(v) ? v : null;
  if (typeof v === "string" && v.trim() !== "") {
    const n = Number(v);
    return Number.isFinite(n) ? n : null;
  }
  return null;
};

const strOrNull = (v: unknown): string | null =>
  typeof v === "string" && v !== "" ? v : null;

const normalizeAddress = (a: string | null): string | null => {
  if (!a) return null;
  return /^0x[0-9a-fA-F]{40}$/.test(a) ? a.toLowerCase() : a;
};

export interface ParseResult {
  rows: SwapRow[];
  rejected: RejectedRow[];
}

export function parsePage(raw: unknown, page: number, platform: string): ParseResult {
  const swaps = (raw as { data?: { swaps?: unknown[] } })?.data?.swaps;
  const rows: SwapRow[] = [];
  const rejected: RejectedRow[] = [];
  if (!Array.isArray(swaps)) return { rows, rejected };

  swaps.forEach((s, index) => {
    const r = s as Record<string, unknown>;
    const side = r.tp === "buy" || r.tp === "sell" ? (r.tp as Side) : null;
    const ts = numOrNull(r.ts);
    if (!side) {
      rejected.push({ index, page, reason: "invalid-side" });
      return;
    }
    if (ts === null || ts <= 0) {
      rejected.push({ index, page, reason: "invalid-ts" });
      return;
    }
    const usdRaw = numOrNull(r.v);
    const usd = usdRaw !== null && usdRaw >= 0 ? usdRaw : null;
    const tx = strOrNull(r.tx);
    const lgid = strOrNull(r.lgid) ?? (r.lgid != null ? String(r.lgid) : null);
    const f = strOrNull(r.f);
    rows.push({
      index,
      page,
      ts,
      side,
      usd,
      qty: numOrNull(r.q),
      maker: normalizeAddress(strOrNull(r.ma)),
      tx,
      h: strOrNull(r.h) ?? (r.h != null ? String(r.h) : null),
      lgid,
      f,
      ex: strOrNull(r.ex ?? r.en),
      t0s: strOrNull(r.t0s),
      t1s: strOrNull(r.t1s),
      idParts: tx && lgid !== null && f ? `${platform}|${tx}|${lgid}|${f}` : null,
    });
  });
  return { rows, rejected };
}

export interface DedupResult {
  rows: SwapRow[];
  duplicates: number;
  status: "clean" | "uncertain";
}

export function dedupRows(rows: SwapRow[]): DedupResult {
  const seen = new Set<string>();
  const out: SwapRow[] = [];
  let duplicates = 0;
  let uncertain = false;
  for (const r of rows) {
    if (r.idParts === null) {
      uncertain = true;
      out.push(r); // keep — insufficient identity, reported not dropped
      continue;
    }
    if (seen.has(r.idParts)) {
      duplicates++;
      continue;
    }
    seen.add(r.idParts);
    out.push(r);
  }
  return { rows: out, duplicates, status: uncertain ? "uncertain" : "clean" };
}
