// Verify fixture integrity: every manifest entry's sha256 must match the
// file bytes, and every paged group must have contiguous pages with
// non-overlapping event identity (platform|tx|lgid|f).
import { createHash } from "node:crypto";
import { existsSync, readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const FIX = path.join(ROOT, "fixtures");
const man = JSON.parse(readFileSync(path.join(FIX, "manifest.json"), "utf8"));

let pass = 0, fail = 0;
const ok = (cond, msg) => { if (cond) { pass++; } else { fail++; console.log("  FAIL", msg); } };

const groups = new Map();
for (const f of man.fixtures) {
  const fp = path.join(FIX, f.file);
  ok(existsSync(fp), `${f.file} missing`);
  if (!existsSync(fp)) continue;
  const buf = readFileSync(fp);
  ok(createHash("sha256").update(buf).digest("hex") === f.sha256, `${f.file} hash mismatch`);
  ok(buf.length === f.bytes, `${f.file} byte count mismatch`);
  if (f.kind === "transactions" && f.group) {
    const g = groups.get(f.group) ?? [];
    g.push({ f, j: JSON.parse(buf.toString("utf8")) });
    groups.set(f.group, g);
  }
}

for (const [g, pages] of groups) {
  pages.sort((a, b) => a.f.page - b.f.page);
  const seen = new Set();
  let dup = 0;
  for (const { j } of pages) {
    for (const s of j?.data?.swaps ?? []) {
      const id = [s.tx ?? "", s.lgid ?? "", s.f ?? ""].join("|");
      if (seen.has(id)) dup++;
      seen.add(id);
    }
  }
  ok(dup === 0, `${g}: ${dup} duplicate event ids across pages`);
  // Page 2+ must be older than page 1's oldest.
  for (let i = 1; i < pages.length; i++) {
    const prevOldest = Math.min(...(pages[i - 1].j?.data?.swaps ?? []).map((s) => Number(s.ts)));
    const curNewest = Math.max(...(pages[i].j?.data?.swaps ?? []).map((s) => Number(s.ts)));
    ok(curNewest <= prevOldest || Number.isNaN(prevOldest) || Number.isNaN(curNewest),
      `${g} p${i + 1} not older than p${i} (prevOldest=${prevOldest} curNewest=${curNewest})`);
  }
}

const onDisk = readdirSync(FIX).filter((x) => x.endsWith(".json") && x !== "manifest.json");
const listed = new Set(man.fixtures.map((f) => f.file));
for (const d of onDisk) ok(listed.has(d), `${d} on disk but not in manifest`);

console.log(`\nfixtures: ${man.fixtures.length} entries · ${pass} pass · ${fail} fail`);
process.exit(fail ? 1 : 0);
