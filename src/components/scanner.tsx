"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import type { Observation } from "@/types";
import { ObservationView } from "./observation-view";
import { fmtUsd, shortAddr } from "./fmt";

const CHAINS = ["Solana", "Base", "Ethereum", "BSC", "Arbitrum", "Optimism", "Polygon", "Avalanche"];

type Candidate = { platform: string; address: string; name: string | null; symbol: string | null; liqUsd: number | null; traders24h: number | null };

export function Scanner({ replayGroups }: { replayGroups: string[] }) {
  const [mode, setMode] = useState<"contract" | "ticker" | "replay">("contract");
  const [chain, setChain] = useState("Solana");
  const [address, setAddress] = useState("");
  const [ticker, setTicker] = useState("");
  const [candidates, setCandidates] = useState<Candidate[] | null>(null);
  const [tier, setTier] = useState<"quick" | "deep">("quick");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<{ observation: Observation; meta: { creditsUsed: number; cached: boolean; mode: string } } | null>(null);
  const router = useRouter();

  async function runScan(payload: Record<string, string>) {
    setBusy(true); setError(null); setResult(null); setCandidates(null);
    try {
      const r = await fetch("/api/scan", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(payload),
      });
      const j = await r.json();
      if (!r.ok) { setError(j.error ?? `http ${r.status}`); return; }
      setResult(j);
      router.push(`/r/${j.observation.id}`, { scroll: false });
    } catch (e) {
      setError(String(e));
    } finally {
      setBusy(false);
    }
  }

  async function resolveTicker() {
    setBusy(true); setError(null); setCandidates(null);
    try {
      const r = await fetch(`/api/resolve?q=${encodeURIComponent(ticker)}`);
      const j = await r.json();
      if (!r.ok) { setError(j.error ?? `http ${r.status}`); return; }
      const rows = (j.rows as Candidate[]).filter((c) => c.address);
      setCandidates(rows);
      if (rows.length === 0) setError("no candidates — try a contract address");
    } catch (e) {
      setError(String(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-4">
      <div className="panel">
        <div className="panel-head">
          <span>scanner</span>
          <span className="normal-case tracking-normal">
            {(["contract", "ticker", "replay"] as const).map((m) => (
              <button key={m} onClick={() => setMode(m)}
                className={`data mr-1 rounded px-2 py-0.5 text-[10px] uppercase ${mode === m ? "bg-accent text-paper" : "text-dim"}`}>
                {m}
              </button>
            ))}
          </span>
        </div>
        <div className="space-y-3 p-4 sm:p-6">
          {mode === "contract" && (
            <div className="flex flex-col gap-3 sm:flex-row">
              <select value={chain} onChange={(e) => setChain(e.target.value)}
                className="data rounded border border-line bg-paper px-3 py-2 text-[12px] text-ink">
                {CHAINS.map((c) => <option key={c}>{c}</option>)}
              </select>
              <input value={address} onChange={(e) => setAddress(e.target.value)}
                placeholder="contract address"
                className="data flex-1 rounded border border-line bg-paper px-3 py-2 text-[12px] text-ink placeholder:text-faint" />
            </div>
          )}
          {mode === "ticker" && (
            <div className="flex flex-col gap-3 sm:flex-row">
              <input value={ticker} onChange={(e) => setTicker(e.target.value)}
                placeholder="ticker or name (e.g. jup)"
                className="data flex-1 rounded border border-line bg-paper px-3 py-2 text-[12px] text-ink placeholder:text-faint" />
              <button onClick={resolveTicker} disabled={busy || !ticker.trim()}
                className="stamp text-accent disabled:opacity-40">resolve</button>
            </div>
          )}
          {mode === "replay" && (
            <div className="data text-[11px] text-dim">
              replay committed captures — deterministic, zero credits:
              <div className="mt-2 flex flex-wrap gap-2">
                {replayGroups.length === 0 && <span className="text-faint">no fixtures present on this deploy</span>}
                {replayGroups.map((g) => (
                  <button key={g} onClick={() => runScan({ replay: g })} disabled={busy}
                    className="chip hover:border-linebright hover:text-accent">{g}</button>
                ))}
              </div>
            </div>
          )}
          {mode !== "replay" && (
            <div className="flex items-center justify-between gap-3">
              <div className="data text-[10px] uppercase tracking-wider text-faint">
                depth:{" "}
                {(["quick", "deep"] as const).map((t) => (
                  <button key={t} onClick={() => setTier(t)}
                    className={`mr-2 ${tier === t ? "text-accent" : "text-dim hover:text-ink"}`}>{t}</button>
                ))}
                <span className="normal-case text-faint">deep costs more credits, shows more of the tape</span>
              </div>
              {mode === "contract" && (
                <button onClick={() => runScan({ chain, address, tier })} disabled={busy || !address.trim()}
                  className="stamp text-accent disabled:opacity-40">{busy ? "scanning…" : "scan"}</button>
              )}
            </div>
          )}
          {error && <div className="data text-[12px] text-selltone">{error}</div>}
        </div>
      </div>

      {candidates && (
        <div className="panel">
          <div className="panel-head"><span>pick the contract — {candidates.length} candidates</span></div>
          <div className="max-h-72 overflow-y-auto p-2">
            {candidates.map((c, i) => (
              <button key={i} onClick={() => { setMode("contract"); setChain(c.platform); setAddress(c.address); setCandidates(null); }}
                className="flex w-full items-center justify-between gap-3 rounded px-3 py-2 text-left data text-[11px] hover:bg-panel">
                <span className="min-w-0">
                  <span className="text-ink">{c.symbol ?? "?"}</span>
                  <span className="ml-2 text-dim">{c.name ?? ""}</span>
                  <span className="ml-2 text-faint">{shortAddr(c.address)}</span>
                </span>
                <span className="shrink-0 text-dim">{c.platform} · liq {fmtUsd(c.liqUsd)}</span>
              </button>
            ))}
          </div>
        </div>
      )}

      {result && (
        <>
          <div className="data text-[10px] text-faint">
            {result.meta.mode} · credits used: {result.meta.creditsUsed}
            {result.meta.cached ? " · cached response (original capture time kept)" : ""}
          </div>
          <ObservationView o={result.observation} permalink={`${typeof window !== "undefined" ? location.origin : ""}/r/${result.observation.id}`} />
        </>
      )}
    </div>
  );
}
