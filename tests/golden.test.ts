// Golden replay — pinned numbers from the audit corpus.
// Source bytes: fixtures/jup-solana-keyless-p{1,2}.json
// (copied from ghosttape/research/2026-09-30/public-cursor,
//  endTime=1790778167122, captured 2026-09-30 21:22 WIB).
//
// Pinned values (spec §4 / mix-evidence-example.json):
//   100 events: top3=83.69%, noBuy=61.03%, X=46.21%, effM=3.90, noBuyCount=14
//   200 events: top3=65.12%, noBuy=19.28%, X=0.00%,  effM=5.47, noBuyCount=17
//   remove largest sell ($1,815.05): top3=56.95% (-8.17pp), noBuy=23.79%

import { describe, expect, it } from "vitest";
import path from "node:path";
import { replayGroup } from "../src/lib/replay";
import { removeLargestEvent, buildObservation } from "../src/lib/engine";

const FIX = path.resolve(__dirname, "../fixtures");
const G = "jup-solana-keyless";
const eps = 1e-4; // fraction — pinned shares are 2-decimal percentages
const near = (a: number | null, b: number, e = eps) => {
  expect(a).not.toBeNull();
  expect(Math.abs((a as number) - b)).toBeLessThan(e);
};

describe("golden: JUP keyless replay", () => {
  const o1 = replayGroup(FIX, G, { maxPages: 1 });
  const o2 = replayGroup(FIX, G);

  it("page-1 pins", () => {
    near(o1.concentration.sell.topNShare, 0.8369);
    near(o1.sellContext.noBuyObservedShare, 0.6103);
    near(o1.sellContext.topNOverlapShareOfAllAttributedSells, 0.4621);
    near(o1.concentration.sell.effectiveMakers, 3.90, 0.01);
    expect(o1.sellContext.observedNoBuySellers).toBe(14);
    expect(o1.quality.validSideEvents).toBe(100);
  });

  it("page-1+2 pins (the depth flip)", () => {
    near(o2.concentration.sell.topNShare, 0.6512);
    near(o2.sellContext.noBuyObservedShare, 0.1928);
    near(o2.sellContext.topNOverlapShareOfAllAttributedSells, 0.0);
    near(o2.concentration.sell.effectiveMakers, 5.47, 0.01);
    expect(o2.sellContext.observedNoBuySellers).toBe(17);
    expect(o2.quality.validSideEvents).toBe(200);
    expect(o2.quality.duplicates).toBe(0);
  });

  it("largest-event removal is a sample variant", () => {
    const slim = removeLargestEvent(o2RowSource(), "sell");
    const v = buildObservation({
      token: o2.token, mode: "replay", capturedAt: o2.capturedAt,
      window: { ...o2.window },
      sources: o2.sources, rows: slim,
      rejected: [], duplicates: 0, dedupStatus: "clean",
    });
    near(v.concentration.sell.topNShare, 0.5695);
    near(v.sellContext.noBuyObservedShare, 0.2379);
    expect(slim.length).toBe(o2.quality.validSideEvents - 1);
  });

  it("depth curve has one point per page, monotone prefix", () => {
    expect(o2.depthCurves.sell.map((d) => d.events)).toEqual([100, 200]);
    near(o2.depthCurves.sell[0]!.topNShare, 0.8369);
    near(o2.depthCurves.sell[1]!.topNShare, 0.6512);
  });
});

// helper: rebuild the raw deduped rows of o2 by replaying group once more
import { groupPages, loadManifest } from "../src/lib/replay";
import { parsePage, dedupRows } from "../src/lib/parser";
import { readFileSync } from "node:fs";
function o2RowSource() {
  const pages = groupPages(FIX, G);
  let rows: import("../src/types").SwapRow[] = [];
  for (const e of pages) {
    const raw = JSON.parse(readFileSync(path.join(FIX, e.file), "utf8"));
    rows = rows.concat(parsePage(raw, e.page ?? 0, "Solana").rows);
  }
  return dedupRows(rows).rows;
}
