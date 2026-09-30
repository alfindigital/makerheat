// Print per-page depth curves for every replay group — real numbers for
// docs/video. Read-only.
import { replayGroup } from "../src/lib/replay";
import path from "node:path";

const FIX = path.resolve(process.cwd(), "fixtures");
const groups = process.argv[2] ? [process.argv[2]] : undefined;

import { loadManifest } from "../src/lib/replay";
const gs = groups ?? [...new Set(loadManifest(FIX).map((f) => f.group).filter(Boolean))] as string[];

for (const g of gs) {
  try {
    const o = replayGroup(FIX, g);
    console.log(`\n=== ${g}  events=${o.quality.validSideEvents}  stop=${o.window.stopReason}  span=${o.window.observedEnd && o.window.observedStart ? Math.round((o.window.observedEnd - o.window.observedStart) / 1000) + "s" : "?"}`);
    for (const p of o.depthCurves.sell) {
      const pct = (v: number | null) => (v === null ? "  n/a " : (v * 100).toFixed(1).padStart(5) + "%");
      console.log(`   ev=${String(p.events).padStart(4)}  top3=${pct(p.topNShare)}  noBuy=${pct(p.noBuyShare)}  joint=${pct(p.jointShare)}`);
    }
  } catch (e) {
    console.log(`\n=== ${g}  FAILED: ${e}`);
  }
}
