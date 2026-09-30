# MakerHeat

**Who supplied the volume — and how deep does the sample go?**

MakerHeat reads the recorded DEX swap tape for a token (CoinMarketCap DEX API)
and answers three honest questions:

1. **Concentration** — which reported addresses carried the observed buy/sell USD.
2. **Seller context** — of the addresses selling, which have *no buy observed in
   the same sample* (and how much sell USD that is).
3. **Evidence depth** — how all of those numbers move as you pull more pages of
   the same tape. A metric that swings between 100 and 200 events is not a
   signal; MakerHeat shows the swing instead of hiding it.

Everything is descriptive. MakerHeat never claims an address is a person,
an insider, a bot, or safe/unsafe. `no buy observed` means exactly that —
in this sample.

## Why it exists

The headline demo: JUP on Solana, same `endTime`, same provider.

| events | top-3 seller share | sell USD w/ no buy observed | top-3 ∩ no-buy |
|-------:|-------------------:|----------------------------:|---------------:|
| 100 | 83.69% | 61.03% | 46.21% |
| 200 | 65.12% | 19.28% | 0.00% |

Two extra pages of tape flip the story completely. Tools that show one number
hide this; MakerHeat makes it the product.

## Quickstart

```bash
pnpm install
cp .env.example .env.local   # put CMC_API_KEY=... inside (live mode)
pnpm build && pnpm start     # or: pnpm dev
```

Open http://localhost:3000 — three scanner modes:

- **contract** — chain + token contract address → live scan (keyed CMC calls)
- **ticker** — resolves via `/v1/dex/search`, you pick the contract
- **replay** — replays committed fixture captures, deterministic, zero credits
  (works with no API key at all)

Quick scan = 2 pages (~3 credits incl. token meta). Deep = 10 pages.
Depth curves plot every page boundary.

## Modes & honesty rules

- `live` vs `replay` is always labeled; cached responses keep the original
  `capturedAt`.
- Numbers carry their sample window (events, span, pages, stop reason).
- `unavailable` is a first-class answer — missing USD is never silently zero.
- Receipts = sha256 of response bytes (integrity, *not* proof of provider truth).
- Raw provider bodies are **never** stored or served — permalinks contain
  derived metrics only.
- A nested 100→200 comparison is *sensitivity*, not *persistence*. History
  comparisons require separate non-overlapping intervals (Phase E).

## Stack

Next.js 15 · TypeScript · Tailwind · Vitest · `node:sqlite` · zero runtime deps
beyond Next. Deterministic engine (`src/lib/`) is UI-free and replayable.

## Demo

`video/` is a Remotion project that renders an 84 s explainer
(`video/out/makerheat-demo.mp4`, 1920×1080, voice-over included) using the
real replay numbers — the JUP depth flip from 52.8%→32.7% top-3 sell share.
`cd video && npm install && npx remotion render src/index.ts MakerHeatDemo out/makerheat-demo.mp4`
VO via `scripts/gen-vo-deepgram.py` (Deepgram Aura, needs `DEEPGRAM_API_KEY`
in env) or `scripts/gen-vo.py` (edge-tts, no key).

## Docs

- `SUBMISSION.md` — hackathon submission sheet + paste-ready description
- `CAPTIONS.md` — social copy grounded in replayable numbers
- `docs/METHOD.md` — full computation contract (fields, dedup, stops, math)
- `docs/CLAIMS.md` — vocabulary policy + forbidden framings
- `ENDPOINTS.md` — CMC endpoints used, real request/response notes
- `FRICTION.md` — honest log of what broke / what surprised us
- `IMPLEMENTATION-PLAN.md` — phased plan with per-task verification
- `fixtures/README.md` + `fixtures/manifest.json` — capture integrity policy

## Repo hygiene

- `.env*` ignored (only `.env.example` tracked); raw fixture bodies gitignored —
  the manifest holds sha256 + metadata so captures stay auditable.
- `data/` (sqlite, quota ledger, cache) ignored.
- `pnpm test` = vitest golden replay + engine invariants + vocab scan.
- `tools/verify-engine.mts` recomputes golden values independently of the
  engine and fails on any drift.

## Credits

Every live page costs 1 CMC credit. Quotas: per-IP attempt cap (default
10/min), global daily credit budget (default 1000), freshness cache
(45 s), single-flight dedup, `MAKERHEAT_LIVE_OFF=1` kill switch — replay
mode keeps working when live is off.
