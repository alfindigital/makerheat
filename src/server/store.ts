// Storage, cache, quota, single-flight.
// Two backends, selected by env at boot:
//   UPSTASH_REDIS_REST_URL + UPSTASH_REDIS_REST_TOKEN → Upstash over REST
//     (shared across serverless instances — permalinks and quota durable)
//   otherwise → node:sqlite under $MAKERHEAT_DATA_DIR (or /tmp on Vercel)
// Observations are immutable: insert-only. Recompute under a new
// methodVersion creates a new id; old records remain replayable.
// Permalinks are derived-results only — raw provider bodies are never
// stored or served here.

import { DatabaseSync } from "node:sqlite";
import { existsSync, mkdirSync } from "node:fs";
import { randomBytes } from "node:crypto";
import path from "node:path";
import type { Observation } from "../types";

// ---------- backend selection ----------

const REDIS_URL = process.env.UPSTASH_REDIS_REST_URL?.replace(/\/$/, "");
const REDIS_TOKEN = process.env.UPSTASH_REDIS_REST_TOKEN;
const useRedis = Boolean(REDIS_URL && REDIS_TOKEN);

const DATA_DIR = process.env.MAKERHEAT_DATA_DIR
  ? path.resolve(process.env.MAKERHEAT_DATA_DIR)
  : path.resolve(process.env.VERCEL ? "/tmp/makerheat" : process.cwd(), "data");
const DB_PATH = path.join(DATA_DIR, "makerheat.db");

let _db: DatabaseSync | null = null;
function db(): DatabaseSync {
  if (_db) return _db;
  if (!existsSync(DATA_DIR)) mkdirSync(DATA_DIR, { recursive: true });
  _db = new DatabaseSync(DB_PATH);
  _db.exec(`
    CREATE TABLE IF NOT EXISTS observations (
      id TEXT PRIMARY KEY,
      token_chain TEXT NOT NULL,
      token_address TEXT NOT NULL,
      captured_at TEXT NOT NULL,
      mode TEXT NOT NULL,
      method_version TEXT NOT NULL,
      body TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS quota_ledger (
      ts INTEGER NOT NULL,
      ip TEXT NOT NULL,
      scan_key TEXT NOT NULL,
      credits INTEGER NOT NULL
    );
    CREATE TABLE IF NOT EXISTS cache (
      key TEXT PRIMARY KEY,
      observation_id TEXT NOT NULL,
      created_ms INTEGER NOT NULL
    );
  `);
  return _db;
}

// ---------- Upstash REST client (zero-dep) ----------

async function rcall(cmd: (string | number)[]): Promise<unknown> {
  const res = await fetch(`${REDIS_URL}/`, {
    method: "POST",
    headers: { Authorization: `Bearer ${REDIS_TOKEN}`, "content-type": "application/json" },
    body: JSON.stringify(cmd),
    cache: "no-store",
  });
  const j = (await res.json()) as { result?: unknown; error?: string };
  if (j.error) throw new Error(`redis ${cmd[0]}: ${j.error}`);
  return j.result;
}

async function rpipe(cmds: (string | number)[][]): Promise<unknown[]> {
  const res = await fetch(`${REDIS_URL}/pipeline`, {
    method: "POST",
    headers: { Authorization: `Bearer ${REDIS_TOKEN}`, "content-type": "application/json" },
    body: JSON.stringify(cmds),
    cache: "no-store",
  });
  const arr = (await res.json()) as { result?: unknown; error?: string }[];
  return arr.map((r, i) => {
    if (r.error) throw new Error(`redis pipe[${i}] ${r.error}`);
    return r.result;
  });
}

// ---------- observations ----------

const OBS_IDX = "mh:obs:index";

export async function saveObservation(o: Observation): Promise<void> {
  if (useRedis) {
    // insert-only: same id → keep existing (immutability)
    const added = await rcall(["SET", `mh:obs:${o.id}`, JSON.stringify(o), "NX"]);
    if (added) await rcall(["ZADD", OBS_IDX, Date.parse(o.capturedAt) || Date.now(), o.id]);
    return;
  }
  db().prepare(
    "INSERT OR IGNORE INTO observations (id, token_chain, token_address, captured_at, mode, method_version, body) VALUES (?,?,?,?,?,?,?)",
  ).run(o.id, o.token.chain, o.token.address, o.capturedAt, o.mode, o.methodVersion, JSON.stringify(o));
}

export async function getObservation(id: string): Promise<Observation | null> {
  if (useRedis) {
    const body = (await rcall(["GET", `mh:obs:${id}`])) as string | null;
    return body ? (JSON.parse(body) as Observation) : null;
  }
  const row = db().prepare("SELECT body FROM observations WHERE id = ?").get(id) as { body: string } | undefined;
  return row ? (JSON.parse(row.body) as Observation) : null;
}

export async function listObservations(limit = 50): Promise<Pick<Observation, "id" | "capturedAt" | "token" | "mode">[]> {
  if (useRedis) {
    const ids = (await rcall(["ZREVRANGE", OBS_IDX, 0, limit - 1])) as string[];
    if (!ids.length) return [];
    const bodies = (await rpipe(ids.map((id) => ["GET", `mh:obs:${id}`]))) as (string | null)[];
    return bodies.flatMap((b) => {
      if (!b) return [];
      const o = JSON.parse(b) as Observation;
      return [{ id: o.id, capturedAt: o.capturedAt, mode: o.mode, token: o.token }];
    });
  }
  const rows = db().prepare(
    "SELECT id, captured_at, mode, token_chain, token_address, json_extract(body,'$.token.symbol') AS sym FROM observations ORDER BY captured_at DESC LIMIT ?",
  ).all(limit) as { id: string; captured_at: string; mode: string; token_chain: string; token_address: string; sym: string | null }[];
  return rows.map((r) => ({
    id: r.id, capturedAt: r.captured_at, mode: r.mode as Observation["mode"],
    token: { chain: r.token_chain, address: r.token_address, symbol: r.sym, name: null },
  }));
}

// ---------- cache (chain|address|tier) ----------
// Key deliberately excludes the scan endTime — freshness is governed by TTL,
// and a hit returns the stored observation with its own capturedAt.

export function cacheKey(chain: string, address: string, tier: string): string {
  return `${chain}|${address.toLowerCase()}|${tier}`;
}

export async function cacheGet(key: string, ttlMs: number): Promise<Observation | null> {
  if (useRedis) {
    const v = (await rcall(["GET", `mh:cache:${key}`])) as string | null;
    if (!v) return null;
    const sep = v.lastIndexOf("|");
    const obsId = sep > 0 ? v.slice(0, sep) : "";
    if (!obsId || Date.now() - Number(v.slice(sep + 1)) > ttlMs) return null;
    return getObservation(obsId);
  }
  const row = db().prepare("SELECT observation_id, created_ms FROM cache WHERE key = ?").get(key) as
    | { observation_id: string; created_ms: number } | undefined;
  if (!row) return null;
  if (Date.now() - row.created_ms > ttlMs) return null;
  return getObservation(row.observation_id);
}

export async function cachePut(key: string, observationId: string): Promise<void> {
  if (useRedis) {
    await rcall(["SET", `mh:cache:${key}`, `${observationId}|${Date.now()}`]);
    return;
  }
  db().prepare("INSERT OR REPLACE INTO cache (key, observation_id, created_ms) VALUES (?,?,?)")
    .run(key, observationId, Date.now());
}

// ---------- quota ----------

const Q_G = "mh:q:global"; // zset: score=ts member=attempt nonce
const Q_C = "mh:q:credits"; // hash: nonce → credits (backfilled post-collection)
const Q_IP = (ip: string) => `mh:q:ip:${ip}`; // zset: score=ts member=ts:nonce

export async function globalCreditsInLast(windowMs: number): Promise<number> {
  const since = Date.now() - windowMs;
  if (useRedis) {
    const stale = (await rcall(["ZRANGEBYSCORE", Q_G, "-inf", since])) as string[];
    const cleanup: (string | number)[][] = [["ZREMRANGEBYSCORE", Q_G, "-inf", since]];
    if (stale.length) cleanup.push(["HDEL", Q_C, ...stale]);
    cleanup.push(["ZRANGEBYSCORE", Q_G, since, "+inf"]);
    const res = await rpipe(cleanup);
    const nonces = res[res.length - 1] as string[];
    if (!nonces.length) return 0;
    const credits = (await rcall(["HMGET", Q_C, ...nonces])) as (string | null)[];
    return credits.reduce((a, c) => a + (Number(c) || 0), 0);
  }
  const row = db().prepare("SELECT COALESCE(SUM(credits),0) AS c FROM quota_ledger WHERE ts > ?").get(since) as { c: number };
  return row.c;
}

export async function ipCountInLast(ip: string, windowMs: number): Promise<number> {
  const since = Date.now() - windowMs;
  if (useRedis) {
    const res = await rpipe([
      ["ZREMRANGEBYSCORE", Q_IP(ip), "-inf", since],
      ["ZCARD", Q_IP(ip)],
    ]);
    return Number(res[1]) || 0;
  }
  const row = db().prepare("SELECT COUNT(*) AS c FROM quota_ledger WHERE ts > ? AND ip = ?").get(since, ip) as { c: number };
  return row.c;
}

// Attempt is logged BEFORE the request so failed/abusive calls still count
// against the per-IP rate; credits are written back after collection so the
// global budget reflects real spend. Returns a handle for recordCredits.
export async function recordAttempt(ip: string, scanKey: string): Promise<bigint | string> {
  const ts = Date.now();
  if (useRedis) {
    const nonce = `${ts.toString(36)}${randomBytes(5).toString("hex")}`;
    await rpipe([
      ["ZADD", Q_G, ts, nonce],
      ["ZADD", Q_IP(ip), ts, `${ts}:${nonce}`],
      ["HSET", Q_C, nonce, 0],
    ]);
    return nonce;
  }
  const r = db().prepare("INSERT INTO quota_ledger (ts, ip, scan_key, credits) VALUES (?,?,?,0)")
    .run(ts, ip, scanKey);
  return r.lastInsertRowid as bigint;
}

export async function recordCredits(attempt: bigint | string, credits: number): Promise<void> {
  if (useRedis) {
    await rcall(["HSET", Q_C, String(attempt), credits]);
    return;
  }
  db().prepare("UPDATE quota_ledger SET credits = ? WHERE rowid = ?").run(credits, attempt as bigint);
}

// ---------- single-flight (in-process; cross-instance dedup not required) ----------

const inflight = new Map<string, Promise<Observation>>();

export function singleFlight<T>(key: string, fn: () => Promise<T>): Promise<T> {
  const existing = inflight.get(key);
  if (existing) return existing as Promise<T>;
  const p = fn().finally(() => inflight.delete(key));
  inflight.set(key, p as Promise<Observation>);
  return p;
}
