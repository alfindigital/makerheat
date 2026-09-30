// Engine semantics over synthetic fixtures + parser rules.

import { describe, expect, it } from "vitest";
import path from "node:path";
import { parsePage, dedupRows } from "../src/lib/parser";
import { buildObservation } from "../src/lib/engine";
import { replaySynthetic } from "../src/lib/replay";
import type { SwapRow } from "../src/types";
import { readFileSync } from "node:fs";

const SYN = path.resolve(__dirname, "../fixtures-synthetic");
const load = (f: string) => replaySynthetic(SYN, f);
const obs = (rows: SwapRow[], rejected: { index: number; page: number; reason: string }[] = []) =>
  buildObservation({
    token: { chain: "Synthetic", address: "SYN", symbol: null, name: null },
    mode: "synthetic", capturedAt: "2026-09-30T00:00:00Z",
    window: { requestedStart: null, requestedEnd: 1790778167122, observedStart: null, observedEnd: null, pagesFetched: 1, stopReason: "cursor_exhausted" },
    sources: [], rows, rejected, duplicates: 0, dedupStatus: "clean",
  });

describe("parser", () => {
  it("invalid side rejected, not counted", () => {
    const raw = { data: { swaps: [{ ts: "1", tp: "weird", v: 1, ma: "A" }] } };
    const { rows, rejected } = parsePage(raw, 1, "X");
    expect(rows.length).toBe(0);
    expect(rejected[0]?.reason).toBe("invalid-side");
  });

  it("missing tx stays null — h is never a substitute", () => {
    const raw = { data: { swaps: [{ ts: "1790778159000", tp: "sell", v: 5, ma: "A", h: "452011083" }] } };
    const { rows } = parsePage(raw, 1, "X");
    expect(rows[0]?.tx).toBeNull();
    expect(rows[0]?.h).toBe("452011083");
  });

  it("EVM makers lowercase; Solana preserved", () => {
    const raw = { data: { swaps: [
      { ts: "1", tp: "buy", v: 1, ma: "0xAbCdEf0000000000000000000000000000001234" },
      { ts: "2", tp: "buy", v: 1, ma: "SoLaNaMaKeR" },
    ] } };
    const { rows } = parsePage(raw, 1, "Ethereum");
    expect(rows[0]?.maker).toBe("0xabcdef0000000000000000000000000000001234");
    expect(rows[1]?.maker).toBe("SoLaNaMaKeR");
  });

  it("missing USD → null, never zero", () => {
    const raw = { data: { swaps: [{ ts: "1", tp: "buy", ma: "A" }] } };
    const { rows } = parsePage(raw, 1, "X");
    expect(rows[0]?.usd).toBeNull();
  });
});

describe("synthetic edge cases", () => {
  it("denominator-zero: sell events with all-null USD → unavailable", () => {
    const o = obs(load("denominator-zero.json").rows);
    expect(o.concentration.sell.quality).toBe("unavailable");
    expect(o.concentration.sell.topNShare).toBeNull();
    expect(o.sellContext.noBuyObservedShare).toBeNull();
    expect(o.sellContext.observedNoBuySellers).toBe(2); // count still reported
  });

  it("maker-null sell: counted in activity, USD unattributed", () => {
    const o = obs(load("maker-null-sell.json").rows);
    expect(o.quality.unattributedSellUsd).toBe(500);
    expect(o.quality.attributionStatus).toBe("partial");
    expect(o.concentration.sell.topNShare).toBeNull(); // no attributed sell USD
  });

  it("buy with missing USD still clears no-buy status", () => {
    const o = obs(load("buy-usd-missing.json").rows);
    expect(o.sellContext.observedNoBuySellers).toBe(0);
    const m = o.makers.find((x) => x.address === "S1");
    expect(m?.buyObserved).toBe(true);
    expect(m?.buyUsd).toBeNull();
  });

  it("zero-USD buy also clears no-buy status", () => {
    const o = obs(load("zero-usd-buy.json").rows);
    expect(o.sellContext.observedNoBuySellers).toBe(0);
  });

  it("single event → 100% of its side, other side missing", () => {
    const o = obs(load("single-event.json").rows);
    expect(o.concentration.sell.topNShare).toBe(1);
    expect(o.concentration.sell.topN).toBe(1);
    expect(o.concentration.buy.quality).toBe("missing");
  });

  it("duplicate event id deduped", () => {
    const { rows } = load("dup-boundary.json");
    const d = dedupRows(rows);
    // both rows share tx=TX1,lgid=0,f=FAC → one dropped
    expect(d.duplicates).toBe(1);
    expect(d.rows.length).toBe(1);
  });

  it("all-sells: buy side missing, sell side valid", () => {
    const o = obs(load("all-sells.json").rows);
    expect(o.concentration.buy.quality).toBe("missing");
    expect(o.concentration.sell.quality).toBe("valid");
    expect(o.sellContext.observedNoBuySellers).toBe(2);
  });

  it("untrusted text stays inert data", () => {
    const { rows } = load("untrusted-text.json");
    expect(rows[0]?.maker).toBe("<img src=x onerror=alert(1)>");
  });
});

describe("determinism", () => {
  it("same input → byte-identical observation", () => {
    const a = JSON.stringify(obs(load("all-sells.json").rows));
    const b = JSON.stringify(obs(load("all-sells.json").rows));
    expect(a).toBe(b);
  });
});
