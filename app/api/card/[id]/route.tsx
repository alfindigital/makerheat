// OG share card — deterministic data card, not a verdict.
// Route stays a route handler so it runs under Node (SQLite access).

import { ImageResponse } from "next/og";
import { getObservation } from "@/server/store";
import { fmtPct, fmtUsd, shortAddr } from "@/components/fmt";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const o = await getObservation(id);
  if (!o) return new Response("not found", { status: 404 });
  const sm = o.concentration.sell;
  const sc = o.sellContext;
  const first = o.depthCurves.sell[0];
  const last = o.depthCurves.sell[o.depthCurves.sell.length - 1];
  const thin = o.quality.validSideEvents < 30;

  const panel = (label: string, value: string, sub: string) => (
    <div style={{ display: "flex", flexDirection: "column", flex: 1, border: "1px solid #3a352c", borderRadius: 12, padding: "18px 20px" }}>
      <div style={{ fontSize: 13, color: "#6b6355", textTransform: "uppercase", letterSpacing: 1 }}>{label}</div>
      <div style={{ fontSize: 40, color: "#e8e2d4", marginTop: 6 }}>{value}</div>
      <div style={{ fontSize: 13, color: "#9a937f", marginTop: 4 }}>{sub}</div>
    </div>
  );

  return new ImageResponse(
    (
      <div style={{
        width: "100%", height: "100%", display: "flex", flexDirection: "column",
        background: "#171511", padding: 44, fontFamily: "sans-serif",
      }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div style={{ fontSize: 30, color: "#e8e2d4", fontStyle: "italic", display: "flex" }}>
            Maker<span style={{ color: "#d8a24a" }}>Heat</span>
          </div>
          <div style={{ fontSize: 14, color: "#6b6355", display: "flex" }}>{o.mode} · {o.capturedAt}</div>
        </div>
        <div style={{ fontSize: 16, color: "#9a937f", marginTop: 18, display: "flex" }}>
          {`${o.token.symbol ?? shortAddr(o.token.address)} · ${o.token.chain} · ${o.quality.validSideEvents} observed swap events`}
        </div>
        <div style={{ display: "flex", gap: 14, marginTop: 22 }}>
          {panel(`top ${sm.topN} sellers`, sm.quality === "valid" ? fmtPct(sm.topNShare) : sm.quality,
            `${fmtUsd(sm.denominatorUsd)} attributed`)}
          {panel("no buy observed", sc.quality === "valid" ? fmtPct(sc.noBuyObservedShare) : sc.quality,
            `${sc.observedNoBuySellers ?? 0} sellers · in this sample`)}
        </div>
        <div style={{ display: "flex", justifyContent: "space-between", marginTop: 18, fontSize: 13, color: "#6b6355" }}>
          <div style={{ display: "flex" }}>
            {first && last && first.events !== last.events
              ? `depth ${first.events}→${last.events}: ${fmtPct(first.topNShare)} → ${fmtPct(last.topNShare)}`
              : "single sample — depth curve unavailable"}
            {thin ? " · thin sample — interpret carefully" : ""}
          </div>
          <div style={{ color: "#d8a24a" }}>scope-stamped observation</div>
        </div>
      </div>
    ),
    { width: 1200, height: 630 },
  );
}
