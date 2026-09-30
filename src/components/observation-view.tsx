"use client";

// The one useful screen. Every number carries its sample window; nothing
// here claims intent, ownership, or safety — copy is descriptive by policy.

import { useMemo, useState } from "react";
import type { Observation, SideKey } from "@/types";
import { fmtInt, fmtPct, fmtSpan, fmtUsd, shortAddr } from "./fmt";
import { DepthChart } from "./depth-chart";

const SIDE_LABEL: Record<SideKey, string> = { sell: "sellers", buy: "buyers", all: "makers" };
const SIDE_USD = (o: Observation, s: SideKey) =>
  s === "buy" ? (m: M) => m.buyUsd : s === "sell" ? (m: M) => m.sellUsd : (m: M) => m.allUsd;
type M = Observation["makers"][number];

function explorer(chain: string, tx: string): string | null {
  const c = chain.toLowerCase();
  if (c === "solana") return `https://solscan.io/tx/${tx}`;
  if (["ethereum", "base", "bsc", "arbitrum", "optimism", "polygon", "avalanche"].includes(c))
    return `https://${c === "ethereum" ? "etherscan.io" : c === "base" ? "basescan.org" : c === "bsc" ? "bscscan.com" : c === "arbitrum" ? "arbiscan.io" : c === "optimism" ? "optimistic.etherscan.io" : c === "polygon" ? "polygonscan.com" : "snowtrace.io"}/tx/${tx}`;
  return null;
}

export function ObservationView({ o, permalink }: { o: Observation; permalink?: string }) {
  const [side, setSide] = useState<SideKey>("sell");
  const [showMethod, setShowMethod] = useState(false);
  const [expandOthers, setExpandOthers] = useState(false);
  const [inspect, setInspect] = useState<string | null>(null);

  const sm = o.concentration[side];
  const usdOf = useMemo(() => SIDE_USD(o, side), [o, side]);
  const ranked = useMemo(
    () => [...o.makers].sort((a, b) => (usdOf(b) ?? -Infinity) - (usdOf(a) ?? -Infinity) || (a.address < b.address ? -1 : 1)),
    [o.makers, usdOf],
  );
  const top = ranked.slice(0, sm.topN);
  const rest = ranked.slice(sm.topN);
  const spanSec = o.window.observedEnd && o.window.observedStart
    ? (o.window.observedEnd - o.window.observedStart) / 1000 : null;
  const curve = side === "all" ? o.depthCurves.all : o.depthCurves.sell;

  return (
    <div className="space-y-4">
      {/* header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <div className="deco text-2xl">
            {o.token.symbol ?? shortAddr(o.token.address)}
            <span className="ml-2 text-sm text-dim">{o.token.chain}</span>
          </div>
          <div className="data mt-1 text-[11px] text-faint break-all">{o.token.address}</div>
        </div>
        <div className="flex items-center gap-2">
          <span className="chip">
            <span className={`h-1.5 w-1.5 rounded-full ${o.mode === "live" ? "bg-buytone" : "bg-accent"}`} />
            {o.mode === "live" ? "live" : o.mode}
          </span>
          {permalink && (
            <button
              className="chip hover:border-linebright"
              onClick={() => navigator.clipboard.writeText(permalink)}
            >copy observation link</button>
          )}
        </div>
      </div>

      <div className="data text-[11px] text-dim">
        captured {o.capturedAt} · {o.quality.validSideEvents} observed swap events
        {o.quality.uniqueTransactions !== null ? ` · ${o.quality.uniqueTransactions} transactions` : ""}
        {spanSec !== null ? ` · ${fmtSpan(spanSec)} span` : ""} · {o.window.pagesFetched} pages ·
        stop: {o.window.stopReason}
      </div>

      {/* headline */}
      <div className="panel">
        <div className="panel-head">
          <span>contribution</span>
          <span className="flex gap-1 normal-case tracking-normal">
            {(["sell", "buy", "all"] as const).map((s) => (
              <button
                key={s}
                onClick={() => setSide(s)}
                className={`data rounded px-2 py-0.5 text-[10px] uppercase ${side === s ? "bg-accent text-paper" : "text-dim hover:text-ink"}`}
              >{s}</button>
            ))}
          </span>
        </div>
        <div className="p-4 sm:p-6">
          {sm.quality === "valid" ? (
            <>
              <div className="deco text-[clamp(1.6rem,4.5vw,2.8rem)] leading-tight">
                Top {sm.topN} {SIDE_LABEL[side]}: <span className="text-accent">{fmtPct(sm.topNShare)}</span>
              </div>
              <div className="data mt-1 text-[12px] text-dim">
                of attributed {side === "all" ? "total" : side} USD · {fmtUsd(sm.denominatorUsd)}
                {sm.unattributedUsd ? ` · ${fmtUsd(sm.unattributedUsd)} unattributed` : ""}
                {sm.missingUsdEvents ? ` · ${sm.missingUsdEvents} events missing notional` : ""}
              </div>
            </>
          ) : (
            <div className="deco text-2xl text-dim">
              {sm.quality === "unavailable"
                ? `${SIDE_LABEL[side]} observed; notional unavailable`
                : `no ${SIDE_LABEL[side]} observed in this sample`}
            </div>
          )}

          {/* contribution table */}
          {sm.quality === "valid" && (
            <table className="mt-5 w-full data text-[12px]">
              <thead>
                <tr className="text-left text-[10px] uppercase tracking-[0.15em] text-faint">
                  <th className="pb-2 font-normal">address</th>
                  <th className="pb-2 text-right font-normal">{side} usd</th>
                  <th className="pb-2 text-right font-normal">share</th>
                  <th className="pb-2 text-right font-normal">buy in sample</th>
                  <th className="pb-2 font-normal" />
                </tr>
              </thead>
              <tbody>
                {top.map((m) => (
                  <MakerRow key={m.address} m={m} side={side} denom={sm.denominatorUsd} onInspect={() => setInspect(m.address)} chain={o.token.chain} />
                ))}
                {rest.length > 0 && (
                  <>
                    <tr className="border-t border-line">
                      <td className="py-2 text-faint">others ({rest.length} addresses)</td>
                      <td className="py-2 text-right text-dim">
                        {fmtUsd(rest.reduce((a, m) => a + (usdOf(m) ?? 0), 0))}
                      </td>
                      <td className="py-2 text-right text-dim">
                        {fmtPct(rest.reduce((a, m) => a + (usdOf(m) ?? 0), 0) / (sm.denominatorUsd ?? 1))}
                      </td>
                      <td colSpan={2} className="py-2 text-right">
                        <button className="text-faint underline decoration-dotted" onClick={() => setExpandOthers(!expandOthers)}>
                          {expandOthers ? "collapse" : "expand"}
                        </button>
                      </td>
                    </tr>
                    {expandOthers && rest.map((m) => (
                      <MakerRow key={m.address} m={m} side={side} denom={sm.denominatorUsd} onInspect={() => setInspect(m.address)} chain={o.token.chain} dim />
                    ))}
                  </>
                )}
              </tbody>
            </table>
          )}

          {side !== "buy" && o.sellContext.quality === "valid" && (
            <div className="mt-4 border-t border-line pt-3 data text-[12px]">
              <span className="text-selltone">{fmtPct(o.sellContext.noBuyObservedShare)}</span>
              <span className="text-dim">
                {" "}of attributed sell USD came from addresses with{" "}
                <b className="text-ink">no buy observed in this sample</b>
                {" "}({fmtInt(o.sellContext.positiveUsdNoBuySellers)} sellers with known USD
                {o.sellContext.observedNoBuySellers !== o.sellContext.positiveUsdNoBuySellers
                  ? ` · ${fmtInt(o.sellContext.observedNoBuySellers)} incl. missing-USD` : ""})
              </span>
            </div>
          )}
          {side !== "buy" && o.sellContext.quality !== "valid" && (
            <div className="mt-4 border-t border-line pt-3 data text-[12px] text-dim">
              no-buy-observed share: {o.sellContext.quality}
            </div>
          )}
        </div>
      </div>

      {/* depth curve */}
      {curve.length > 0 && (
        <div className="panel">
          <div className="panel-head">
            <span>sample-depth sensitivity</span>
            <span>same end time · cumulative pages · not market change</span>
          </div>
          <div className="p-4">
            <DepthChart points={curve} label={side === "all" ? "all-side share" : "sell-side share"} />
            <div className="mt-3 overflow-x-auto">
              <table className="w-full data text-[11px]">
                <thead>
                  <tr className="text-left text-faint">
                    <th className="pr-4 font-normal">events</th>
                    <th className="pr-4 font-normal">span</th>
                    <th className="pr-4 font-normal">top-N</th>
                    <th className="pr-4 font-normal">HHI</th>
                    {side !== "buy" && <th className="pr-4 font-normal">no-buy</th>}
                    {side !== "buy" && <th className="font-normal">top-N∩no-buy</th>}
                  </tr>
                </thead>
                <tbody>
                  {curve.map((p, i) => (
                    <tr key={i} className="border-t border-line/50">
                      <td className="py-1 pr-4">{p.events}</td>
                      <td className="py-1 pr-4">{fmtSpan(p.spanSec)}</td>
                      <td className="py-1 pr-4">{fmtPct(p.topNShare)}</td>
                      <td className="py-1 pr-4">{p.hhi === null ? "—" : p.hhi.toFixed(3)}</td>
                      {side !== "buy" && <td className="py-1 pr-4">{fmtPct(p.noBuyShare)}</td>}
                      {side !== "buy" && <td className="py-1">{fmtPct(p.jointShare)}</td>}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* sensitivity + context */}
      <div className="grid gap-4 md:grid-cols-2">
        <div className="panel">
          <div className="panel-head"><span>single-event sensitivity</span></div>
          <div className="p-4 data text-[12px] space-y-2">
            <Row k={`largest ${side} event`} v={fmtUsd(sm.largestEventUsd)} />
            <Row k="share of attributed" v={fmtPct(sm.largestEventShare)} />
            <Row k={`top-N without largest ${SIDE_LABEL[side].replace(/s$/, "")}`} v={fmtPct(sm.leaveLargestOutShare)} />
          </div>
        </div>
        <div className="panel">
          <div className="panel-head"><span>activity observed</span></div>
          <div className="p-4 data text-[12px] space-y-2">
            <Row k="makers observed" v={fmtInt(o.makers.length)} />
            <Row k="sell events attributed" v={`${fmtUsd(o.concentration.sell.denominatorUsd)} over ${fmtInt(o.sellContext.observedNoBuySellers !== null ? o.quality.validSideEvents : null)} valid events`} />
            <Row k="sellability" v="not tested" dim />
            <Row k="history" v="unavailable — no second comparable interval" dim />
          </div>
        </div>
      </div>

      {/* breadth */}
      {o.breadth && (
        <div className="panel">
          <div className="panel-head">
            <span>provider breadth — separate basis</span>
            <span>{o.breadth.capturedAt}</span>
          </div>
          <div className="p-4">
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
              {o.breadth.windows.map((w) => (
                <div key={w.tp} className="data text-[11px]">
                  <div className="text-faint uppercase">{w.tp}</div>
                  <div>ut {fmtInt(w.uniqueTraders)} · but {fmtInt(w.uniqueBuyers)} · sut {fmtInt(w.uniqueSellers)}</div>
                  <div className="text-dim">
                    {w.invariantOk ? `${fmtInt(w.overlapAddresses)} did both` : "overlap not reported"}
                  </div>
                </div>
              ))}
            </div>
            <div className="mt-2 data text-[10px] text-faint">{o.breadth.note}</div>
          </div>
        </div>
      )}

      {/* method */}
      <div className="panel">
        <button className="panel-head w-full text-left" onClick={() => setShowMethod(!showMethod)}>
          <span>method &amp; sources</span><span>{showMethod ? "−" : "+"}</span>
        </button>
        {showMethod && (
          <div className="p-4 data text-[11px] space-y-2 text-dim">
            <div>method {o.methodVersion} · parser {o.parserVersion} · schema {o.schemaVersion}</div>
            <div>observation id <span className="text-ink">{o.id}</span></div>
            <div>attribution {o.quality.attributionStatus} · dedup {o.quality.dedupStatus} · rejected {o.quality.rejectedEvents} · duplicates removed {o.quality.duplicates}</div>
            {o.notes.map((n, i) => <div key={i}>· {n}</div>)}
            <div className="pt-2 text-faint uppercase tracking-wider">receipts</div>
            {o.sources.map((s, i) => (
              <div key={i} className="break-all">
                p{s.page ?? i + 1} · http {s.httpStatus} · {s.credits ?? "?"}cr · sha {s.bodySha256.slice(0, 16)}… · {s.completedAt}
              </div>
            ))}
            <div className="pt-2 text-faint">hash = integrity receipt: bytes unchanged since capture; not proof of provider truth</div>
          </div>
        )}
      </div>

      {/* inspector */}
      {inspect && (
        <Inspector o={o} address={inspect} onClose={() => setInspect(null)} />
      )}
    </div>
  );
}

function Row({ k, v, dim }: { k: string; v: string; dim?: boolean }) {
  return (
    <div className="flex justify-between gap-4">
      <span className="text-faint">{k}</span>
      <span className={dim ? "text-dim" : "text-ink"}>{v}</span>
    </div>
  );
}

function MakerRow({ m, side, denom, onInspect, chain, dim }: {
  m: Observation["makers"][number]; side: SideKey; denom: number | null;
  onInspect: () => void; chain: string; dim?: boolean;
}) {
  const usd = side === "buy" ? m.buyUsd : side === "sell" ? m.sellUsd : m.allUsd;
  return (
    <tr className={`border-t border-line/50 ${dim ? "text-dim" : ""}`}>
      <td className="py-2">
        <span className="text-ink">{shortAddr(m.address)}</span>
        {m.creatorObserved && <span className="ml-2 text-[9px] uppercase text-accent">creator</span>}
      </td>
      <td className="py-2 text-right">{usd === null ? "—" : fmtUsd(usd)}</td>
      <td className="py-2 text-right">{denom && usd !== null ? fmtPct(usd / denom) : "—"}</td>
      <td className="py-2 text-right">
        {m.buyObserved ? `observed ${m.buyUsd !== null ? `(${fmtUsd(m.buyUsd)})` : ""}` : "no buy observed"}
      </td>
      <td className="py-2 text-right">
        <button className="text-faint underline decoration-dotted hover:text-accent" onClick={onInspect}>
          events
        </button>
      </td>
    </tr>
  );
}

function Inspector({ o, address, onClose }: { o: Observation; address: string; onClose: () => void }) {
  const m = o.makers.find((x) => x.address === address);
  if (!m) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-paper/80 p-4 sm:items-center" onClick={onClose}>
      <div className="panel w-full max-w-lg" onClick={(e) => e.stopPropagation()}>
        <div className="panel-head">
          <span className="normal-case tracking-normal">{address}</span>
          <button onClick={onClose} className="text-dim hover:text-ink">close</button>
        </div>
        <div className="max-h-80 overflow-y-auto p-4 data text-[11px]">
          <div className="mb-3 grid grid-cols-2 gap-2">
            <Row k="sell usd" v={fmtUsd(m.sellUsd)} />
            <Row k="buy usd" v={fmtUsd(m.buyUsd)} />
            <Row k="buy observed" v={m.buyObserved ? "yes" : "no"} />
            <Row k="events" v={fmtInt(m.eventCount)} />
          </div>
          <div className="text-faint">
            {m.eventRefs.length} event refs (page:row in captured pages). Full rows are in the
            source receipts; transaction ids are shown when the provider reported them.
          </div>
        </div>
      </div>
    </div>
  );
}
