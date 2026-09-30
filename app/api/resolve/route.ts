// GET /api/resolve?q=<ticker> → candidate picker data.
// Raw /v1/dex/search rows, minimally normalized. Collision → user picks.
// Never auto-picks on ambiguity.

import { NextRequest, NextResponse } from "next/server";
import { cmcGet } from "@/server/cmc";

export async function GET(req: NextRequest) {
  const q = req.nextUrl.searchParams.get("q")?.trim();
  if (!q) return NextResponse.json({ error: "q required" }, { status: 400 });
  if (process.env.MAKERHEAT_LIVE_OFF === "1") {
    return NextResponse.json({ error: "live disabled" }, { status: 503 });
  }
  try {
    const r = await cmcGet("/v1/dex/search", { q });
    if (r.httpStatus !== 200) return NextResponse.json({ error: `provider ${r.httpStatus}` }, { status: 502 });
    const j = JSON.parse(r.body.toString("utf8")) as { data?: { tks?: Record<string, unknown>[] } };
    const rows = (j.data?.tks ?? []).map((t) => ({
      platform: t.plt ?? null,
      address: t.addr ?? null,
      name: t.n ?? null,
      symbol: t.s ?? null,
      liqUsd: t.liq ?? null,
      traders24h: t.ut24h ?? null,
      vol24h: t.v24h ?? null,
      cmcId: t.cid ?? null,
    }));
    return NextResponse.json({ query: q, rows, credits: r.credits });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 502 });
  }
}
