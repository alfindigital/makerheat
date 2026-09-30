// CMC keyed API client. Key resolution: CMC_API_KEY env → CMC_ENV_FILE →
// ../verdex/.env.local → ./.env.local. The key is never logged or returned.

import { existsSync, readFileSync } from "node:fs";
import path from "node:path";

const BASE = "https://pro-api.coinmarketcap.com";

export function resolveCmcKey(): string | null {
  if (process.env.CMC_API_KEY) return process.env.CMC_API_KEY;
  const candidates = [
    process.env.CMC_ENV_FILE,
    path.resolve(process.cwd(), "../verdex/.env.local"),
    path.resolve(process.cwd(), ".env.local"),
  ].filter(Boolean) as string[];
  for (const p of candidates) {
    if (!existsSync(p)) continue;
    for (const line of readFileSync(p, "utf8").split(/\r?\n/)) {
      const m = line.match(/^\s*CMC_API_KEY\s*=\s*(.+?)\s*$/);
      if (m && m[1] && !m[1].startsWith("#")) return m[1].replace(/^["']|["']$/g, "");
    }
  }
  return null;
}

export interface CmcResponse {
  httpStatus: number;
  body: Buffer;
  credits: number | null;
  providerError: string | null;
  requestedAt: string;
  completedAt: string;
  latencyMs: number;
}

export async function cmcGet(
  pathname: string,
  params: Record<string, string>,
  signal?: AbortSignal,
): Promise<CmcResponse> {
  const key = resolveCmcKey();
  if (!key) throw new Error("CMC_API_KEY unavailable");
  const url = new URL(`${BASE}${pathname}`);
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);

  const requestedAt = new Date().toISOString();
  const t0 = Date.now();
  const res = await fetch(url, {
    headers: { "X-CMC_PRO_API_KEY": key, Accept: "application/json" },
    ...(signal ? { signal } : {}),
  });
  const body = Buffer.from(await res.arrayBuffer());
  let credits: number | null = null;
  let providerError: string | null = null;
  try {
    const j = JSON.parse(body.toString("utf8")) as { status?: { credit_count?: number; error_code?: number | string } };
    credits = j?.status?.credit_count ?? null;
    const ec = j?.status?.error_code;
    providerError = ec === null || ec === undefined || ec === 0 || ec === "0" ? null : String(ec);
  } catch {
    providerError = "unparseable";
  }
  return {
    httpStatus: res.status,
    body,
    credits,
    providerError,
    requestedAt,
    completedAt: new Date().toISOString(),
    latencyMs: Date.now() - t0,
  };
}
