// Provider breadth (`sts[]`) → BreadthContext. Own timestamp/basis; never
// mixed into tape metrics. Union invariant required before overlap math.

import type { BreadthContext, BreadthWindow } from "../types";

const n = (v: unknown): number | null => {
  if (typeof v === "number") return Number.isFinite(v) ? v : null;
  if (typeof v === "string" && v !== "") { const x = Number(v); return Number.isFinite(x) ? x : null; }
  return null;
};

export function parseBreadth(tokenJson: unknown, capturedAt: string): BreadthContext | null {
  const d = (tokenJson as { data?: { sts?: unknown[]; hld?: unknown } })?.data;
  if (!d || !Array.isArray(d.sts)) return null;
  const windows: BreadthWindow[] = d.sts.map((w) => {
    const r = w as Record<string, unknown>;
    const but = n(r.but), sut = n(r.sut), ut = n(r.ut);
    const invariantOk = but !== null && sut !== null && ut !== null && Math.max(but, sut) <= ut && ut <= but + sut;
    return {
      tp: String(r.tp ?? "?"),
      uniqueTraders: ut,
      uniqueBuyers: but,
      uniqueSellers: sut,
      invariantOk,
      overlapAddresses: invariantOk ? (but as number) + (sut as number) - (ut as number) : null,
      buyCount: n(r.nb),
      sellCount: n(r.ns),
      buyUsd: n(r.bvu),
      sellUsd: n(r.svu),
      priceChange: n(r.pc),
    };
  });
  return {
    capturedAt,
    sourceEndpoint: "/v1/dex/token",
    windows,
    holdersRaw: typeof d.hld === "string" || typeof d.hld === "number" ? String(d.hld) : null,
    note: "provider-reported unique addresses over provider windows; windows overlap — not independent observations; holder count is zero-unverified",
  };
}
