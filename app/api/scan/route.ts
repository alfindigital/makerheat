// POST /api/scan
//   { chain, address, tier: "quick"|"deep" }  → live keyed collection
//   { replay: "<fixture-group>" }             → deterministic replay
//
// Live path order: live-off switch → per-IP + global quota → cache →
// single-flight collect → token meta (breadth context) → store → respond.
// Quota/caching protect the paid key; cached responses keep their original
// capturedAt (freshness is never faked).

import { NextRequest, NextResponse } from "next/server";
import { existsSync } from "node:fs";
import path from "node:path";
import { collect, fetchTokenMeta } from "@/server/collector";
import { parseBreadth } from "@/lib/breadth";
import { replayGroup, loadManifest } from "@/lib/replay";
import {
  cacheGet, cacheKey, cachePut, getObservation, globalCreditsInLast,
  ipCountInLast, recordAttempt, recordCredits, saveObservation, singleFlight,
} from "@/server/store";
import type { Observation } from "@/types";

const FIXTURES = path.resolve(process.cwd(), "fixtures");
const QUICK_PAGES = Number(process.env.MAKERHEAT_MAX_PAGES_QUICK ?? 2);
const DEEP_PAGES = Number(process.env.MAKERHEAT_MAX_PAGES_DEEP ?? 10);
const DEADLINE_MS = Number(process.env.MAKERHEAT_COLLECTOR_DEADLINE_MS ?? 30_000);
const CACHE_TTL = Number(process.env.MAKERHEAT_CACHE_TTL_MS ?? 45_000);
const GLOBAL_BUDGET = Number(process.env.MAKERHEAT_GLOBAL_CREDIT_BUDGET ?? 1_000);
const PER_IP_PER_MIN = Number(process.env.MAKERHEAT_PER_IP_PER_MIN ?? 10);

const TIERS = { quick: QUICK_PAGES, deep: DEEP_PAGES } as const;

function replayGroups(): string[] {
  try {
    // Only offer groups whose first page body is present — manifest may be
    // shipped without raw bodies (serverless deploys keep them private).
    const present = loadManifest(FIXTURES).filter((f) => f.group && existsSync(path.join(FIXTURES, f.file)));
    return [...new Set(present.map((f) => f.group))] as string[];
  } catch {
    return [];
  }
}

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null) as {
    chain?: string; address?: string; tier?: keyof typeof TIERS; replay?: string;
  } | null;
  if (!body) return NextResponse.json({ error: "bad json" }, { status: 400 });

  // ---- replay path ----
  if (body.replay) {
    if (!replayGroups().includes(body.replay)) {
      return NextResponse.json({ error: "unknown replay group", available: replayGroups() }, { status: 404 });
    }
    try {
      const observation = replayGroup(FIXTURES, body.replay);
      saveObservation(observation);
      return NextResponse.json({ observation, meta: { cached: false, creditsUsed: 0, mode: "replay" } });
    } catch (e) {
      return NextResponse.json({ error: `replay failed: ${String(e)}` }, { status: 500 });
    }
  }

  // ---- live path ----
  const chain = body.chain?.trim();
  const address = body.address?.trim();
  const tier = body.tier ?? "quick";
  if (!chain || !address) return NextResponse.json({ error: "chain + address required" }, { status: 400 });
  if (!(tier in TIERS)) return NextResponse.json({ error: "tier must be quick|deep" }, { status: 400 });

  if (process.env.MAKERHEAT_LIVE_OFF === "1") {
    return NextResponse.json({ error: "live disabled", replayAvailable: replayGroups() }, { status: 503 });
  }

  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "local";
  if (ipCountInLast(ip, 60_000) >= PER_IP_PER_MIN) {
    return NextResponse.json({ error: "rate limited — per-IP cap reached" }, { status: 429 });
  }
  if (globalCreditsInLast(86_400_000) >= GLOBAL_BUDGET) {
    return NextResponse.json({ error: "daily credit budget exhausted — replay still available", replayAvailable: replayGroups() }, { status: 429 });
  }

  const maxPages = TIERS[tier];
  const key = cacheKey(chain, address, tier);

  const cached = cacheGet(key, CACHE_TTL);
  if (cached) {
    return NextResponse.json({ observation: cached, meta: { cached: true, creditsUsed: 0, mode: "live" } });
  }

  const attemptRow = recordAttempt(ip, key);
  try {
    const { observation, creditsUsed } = await singleFlight(key, async () => {
      const r = await collect({ chain, address, maxPages, deadlineMs: DEADLINE_MS, endTimeMs: Date.now() });
      // token meta → symbol/name + provider breadth (separate basis)
      const meta = await fetchTokenMeta(chain, address);
      if (meta) {
        const d = (meta.json as { data?: { sym?: string; n?: string } })?.data;
        r.observation.token.symbol = typeof d?.sym === "string" ? d.sym : null;
        r.observation.token.name = typeof d?.n === "string" ? d.n : null;
        const breadth = parseBreadth(meta.json, meta.receipt.completedAt);
        if (breadth) r.observation.breadth = breadth;
        r.creditsUsed += meta.receipt.credits ?? 0;
      }
      saveObservation(r.observation);
      cachePut(key, r.observation.id);
      recordCredits(attemptRow, r.creditsUsed);
      return r;
    });
    return NextResponse.json({ observation, meta: { cached: false, creditsUsed, mode: "live" } });
  } catch (e) {
    const msg = String(e);
    if (msg.includes("CMC_API_KEY")) {
      return NextResponse.json({ error: "server has no CMC key configured" }, { status: 503 });
    }
    return NextResponse.json({ error: `scan failed: ${msg}` }, { status: 502 });
  }
}

export async function GET(req: NextRequest) {
  const id = req.nextUrl.searchParams.get("id");
  if (!id) return NextResponse.json({ error: "id required" }, { status: 400 });
  const o: Observation | null = getObservation(id);
  return o ? NextResponse.json({ observation: o }) : NextResponse.json({ error: "not found" }, { status: 404 });
}
