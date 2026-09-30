// Mechanical claim-policy enforcement: scan user-visible surfaces for
// banned vocabulary. Implied claims still need human review — this is the
// floor, not the ceiling. Exit 1 on any hit outside allowlisted paths.

import { readFileSync, readdirSync, statSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

const BANNED = [
  /\binsider\b/i, /\bsybil\b|anti[- ]sybil/i, /\bcabal\b/i,
  /\bcoordinated\b|\bcoordination\b/i, /\borganic\b/i,
  /\bfull[- ]coverage\b/i, /\bhoneypot\b/i,
  /\bcan'?t sell\b|cannot sell|exit[- ](viability|constrained|blocked)|exit liquidity risk/i,
  /\bguaranteed?\b/i, /\bproves?\b|\bproof of (coordination|ownership|intent)/i,
  /\bsafe\b|\brisky\b|\belevated\b|\bdanger\b|\bwarning level\b/i,
  /\brisk (score|level|rating|band)/i, /\bmanipulat/i, /\bwash trad/i, /\bscam\b/i,
];

const SKIP_DIRS = new Set(["node_modules", ".next", ".git", "dist", "data", "fixtures", "coverage"]);
const SCAN_DIRS = ["src", "app", "tests", "tools", "fixtures-synthetic"];
const SCAN_ROOT_FILES = ["README.md"]; // public-facing docs root
const ALLOW = [
  /src[/\\]policy[/\\]claims\.ts$/,
  /docs[/\\](CLAIMS|METHOD|FRICTION|ENDPOINTS)\.md$/,
  /IMPLEMENTATION-PLAN\.md$/,
  /README\.md$/,
  /tools[/\\]scan-vocab\.mjs$/,
  /tools[/\\]verify-engine\.mts$/,
];

const files = [];
function walk(dir) {
  for (const e of readdirSync(dir)) {
    if (SKIP_DIRS.has(e)) continue;
    const p = path.join(dir, e);
    const st = statSync(p);
    if (st.isDirectory()) walk(p);
    else if (/\.(ts|tsx|mts|js|mjs|json|md|css)$/.test(e)) files.push(p);
  }
}
for (const d of SCAN_DIRS) {
  const p = path.join(ROOT, d);
  try { walk(p); } catch { /* dir may not exist yet */ }
}
for (const f of SCAN_ROOT_FILES) {
  const p = path.join(ROOT, f);
  try { statSync(p); files.push(p); } catch { /* absent */ }
}

let hits = 0;
for (const f of files) {
  const rel = path.relative(ROOT, f);
  if (ALLOW.some((re) => re.test(rel))) continue;
  const text = readFileSync(f, "utf8");
  text.split(/\r?\n/).forEach((line, i) => {
    for (const re of BANNED) {
      const m = line.match(re);
      if (m) {
        hits++;
        console.log(`HIT ${rel}:${i + 1}  [${m[0]}]  ${line.trim().slice(0, 110)}`);
      }
    }
  });
}

console.log(`\nvocab scan: ${files.length} files · ${hits} hits`);
process.exit(hits ? 1 : 0);
