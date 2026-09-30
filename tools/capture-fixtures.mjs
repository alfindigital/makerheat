// Capture real CMC API responses as raw-byte fixtures.
// Writes the verbatim response body to fixtures/<name>.json and records
// metadata + sha256 in fixtures/manifest.json.
//
// Usage:
//   node tools/capture-fixtures.mjs tx --chain Solana --address <ca> --pages 5 --group jup-solana
//   node tools/capture-fixtures.mjs token|pools --chain <c> --address <a> --name jup-token
//   node tools/capture-fixtures.mjs search --query jup --name search-jup
//
// Key resolution order: process.env.CMC_API_KEY → $CMC_ENV_FILE →
// ../verdex/.env.local → ./.env.local. The key is never printed or stored.

import { createHash } from "node:crypto";
import { appendFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const FIX = path.join(ROOT, "fixtures");
const MANIFEST = path.join(FIX, "manifest.json");
const BASE = "https://pro-api.coinmarketcap.com";

function loadKey() {
  if (process.env.CMC_API_KEY) return process.env.CMC_API_KEY;
  const candidates = [process.env.CMC_ENV_FILE, "../verdex/.env.local", "./.env.local"].filter(Boolean);
  for (const rel of candidates) {
    const p = path.resolve(ROOT, rel);
    if (!existsSync(p)) continue;
    for (const line of readFileSync(p, "utf8").split(/\r?\n/)) {
      const m = line.match(/^\s*CMC_API_KEY\s*=\s*(.+?)\s*$/);
      if (m && m[1] && !m[1].startsWith("#")) return m[1].replace(/^["']|["']$/g, "");
    }
  }
  throw new Error("CMC_API_KEY not found in env or env files");
}

function arg(flag, dflt) {
  const i = process.argv.indexOf(flag);
  return i >= 0 ? process.argv[i + 1] : dflt;
}
const sha256 = (buf) => createHash("sha256").update(buf).digest("hex");

function loadManifest() {
  return existsSync(MANIFEST) ? JSON.parse(readFileSync(MANIFEST, "utf8")) : { fixtures: [] };
}

function record(file, meta) {
  const man = loadManifest();
  man.fixtures = man.fixtures.filter((f) => f.file !== file);
  man.fixtures.push({ file, ...meta });
  man.fixtures.sort((a, b) => a.file.localeCompare(b.file));
  writeFileSync(MANIFEST, JSON.stringify(man, null, 2) + "\n");
}

async function call(url, key) {
  const requestedAt = new Date().toISOString();
  const t0 = Date.now();
  const res = await fetch(url, { headers: { "X-CMC_PRO_API_KEY": key, Accept: "application/json" } });
  const buf = Buffer.from(await res.arrayBuffer());
  return {
    requestedAt,
    completedAt: new Date().toISOString(),
    latencyMs: Date.now() - t0,
    httpStatus: res.status,
    buf,
  };
}

function parseStatus(buf) {
  try {
    const j = JSON.parse(buf.toString("utf8"));
    return { providerError: j?.status?.error_code ?? null, credits: j?.status?.credit_count ?? null, json: j };
  } catch {
    return { providerError: "unparseable", credits: null, json: null };
  }
}

async function capture(kind, url, file, extra) {
  const key = loadKey();
  const r = await call(url, key);
  writeFileSync(path.join(FIX, file), r.buf);
  const st = parseStatus(r.buf);
  record(file, {
    sha256: sha256(r.buf),
    bytes: r.buf.length,
    kind,
    endpoint: url.split("?")[0],
    params: Object.fromEntries(new URL(url).searchParams),
    httpStatus: r.httpStatus,
    providerError: st.providerError,
    credits: st.credits,
    requestedAt: r.requestedAt,
    completedAt: r.completedAt,
    latencyMs: r.latencyMs,
    ...extra,
  });
  console.log(`  ${file}  http=${r.httpStatus} bytes=${r.buf.length} credits=${st.credits}`);
  return st.json;
}

const mode = process.argv[2];
mkdirSync(FIX, { recursive: true });

if (mode === "tx") {
  const chain = arg("--chain", "Solana");
  const address = arg("--address");
  const pages = Number(arg("--pages", "1"));
  const group = arg("--group", `${chain}-${address.slice(0, 6)}`);
  const endTime = arg("--endTime", String(Date.now()));
  if (!address) throw new Error("--address required");

  let lastId = null;
  for (let p = 1; p <= pages; p++) {
    const u = new URL(`${BASE}/v1/dex/tokens/transactions`);
    u.searchParams.set("platform", chain);
    u.searchParams.set("address", address);
    u.searchParams.set("limit", "100");
    u.searchParams.set("sortBy", "time");
    u.searchParams.set("sortType", "desc");
    u.searchParams.set("endTime", endTime);
    if (lastId) u.searchParams.set("lastId", lastId);
    const file = `${group}-p${p}.json`;
    const j = await capture("transactions", u.toString(), file, {
      chain, address, group, page: p, endTimeAnchor: endTime,
    });
    lastId = j?.data?.lastId ?? null;
    const n = j?.data?.swaps?.length ?? 0;
    console.log(`    swaps=${n} lastId=${lastId ? lastId.slice(0, 12) + "…" : "none"}`);
    if (!lastId || n === 0) break;
  }
} else if (mode === "token" || mode === "pools") {
  const chain = arg("--chain");
  const address = arg("--address");
  const name = arg("--name", `${mode}-${chain}-${address?.slice(0, 6)}`);
  const u = new URL(`${BASE}/v1/dex/${mode === "token" ? "token" : "token/pools"}`);
  u.searchParams.set("platform", chain);
  u.searchParams.set("address", address);
  await capture(mode, u.toString(), `${name}.json`, { chain, address });
} else if (mode === "search") {
  const q = arg("--query");
  const name = arg("--name", `search-${q}`);
  const u = new URL(`${BASE}/v1/dex/search`);
  u.searchParams.set("q", q);
  await capture("search", u.toString(), `${name}.json`, { query: q });
} else {
  console.log("modes: tx | token | pools | search");
  process.exit(1);
}
