// Storage, cache, quota, single-flight — node:sqlite (built-in, no deps).
// Observations are immutable: insert-only. Recompute under a new
// methodVersion creates a new id; old records remain replayable.
// Permalinks are derived-results only — raw provider bodies are never
// stored or served here.

import { DatabaseSync } from "node:sqlite";
import { existsSync, mkdirSync } from "node:fs";
import path from "node:path";
import type { Observation } from "../types";

const DATA_DIR = process.env.MAKERHEAT_DATA_DIR
  ? path.resolve(process.env.MAKERHEAT_DATA_DIR)
  : path.resolve(process.env.VERCEL ? "/tmp/makerheat" : process.cwd(), "data");
const DB_PATH = path.join(DATA_DIR, "makerheat.db");

let _db: DatabaseSync | null = null;
export function db(): DatabaseSync {
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

// ---------- observations ----------

export function saveObservation(o: Observation): void {
  // insert-only: same id → keep existing (immutability)
  db().prepare(
    "INSERT OR IGNORE INTO observations (id, token_chain, token_address, captured_at, mode, method_version, body) VALUES (?,?,?,?,?,?,?)",
  ).run(o.id, o.token.chain, o.token.address, o.capturedAt, o.mode, o.methodVersion, JSON.stringify(o));
}

export function getObservation(id: string): Observation | null {
  const row = db().prepare("SELECT body FROM observations WHERE id = ?").get(id) as { body: string } | undefined;
  return row ? (JSON.parse(row.body) as Observation) : null;
}

export function listObservations(limit = 50): Pick<Observation, "id" | "capturedAt" | "token" | "mode">[] {
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

export function cacheGet(key: string, ttlMs: number): Observation | null {
  const row = db().prepare("SELECT observation_id, created_ms FROM cache WHERE key = ?").get(key) as
    | { observation_id: string; created_ms: number } | undefined;
  if (!row) return null;
  if (Date.now() - row.created_ms > ttlMs) return null;
  return getObservation(row.observation_id);
}

export function cachePut(key: string, observationId: string): void {
  db().prepare("INSERT OR REPLACE INTO cache (key, observation_id, created_ms) VALUES (?,?,?)")
    .run(key, observationId, Date.now());
}

// ---------- quota ----------

export function globalCreditsInLast(windowMs: number): number {
  const since = Date.now() - windowMs;
  const row = db().prepare("SELECT COALESCE(SUM(credits),0) AS c FROM quota_ledger WHERE ts > ?").get(since) as { c: number };
  return row.c;
}

export function ipCountInLast(ip: string, windowMs: number): number {
  const since = Date.now() - windowMs;
  const row = db().prepare("SELECT COUNT(*) AS c FROM quota_ledger WHERE ts > ? AND ip = ?").get(since, ip) as { c: number };
  return row.c;
}

// atomic-ish: single writer process; documented v1 limit (single instance) —
// swap for Redis/Upstash at scale. Attempt is logged BEFORE the request so
// failed/abusive calls still count against the per-IP rate; credits are
// written back after collection so the global budget reflects real spend.
export function recordAttempt(ip: string, scanKey: string): bigint {
  const r = db().prepare("INSERT INTO quota_ledger (ts, ip, scan_key, credits) VALUES (?,?,?,0)")
    .run(Date.now(), ip, scanKey);
  return r.lastInsertRowid as bigint;
}

export function recordCredits(rowid: bigint, credits: number): void {
  db().prepare("UPDATE quota_ledger SET credits = ? WHERE rowid = ?").run(credits, rowid);
}

// ---------- single-flight ----------

const inflight = new Map<string, Promise<Observation>>();

export function singleFlight<T>(key: string, fn: () => Promise<T>): Promise<T> {
  const existing = inflight.get(key);
  if (existing) return existing as Promise<T>;
  const p = fn().finally(() => inflight.delete(key));
  inflight.set(key, p as Promise<Observation>);
  return p;
}
