# MakerHeat — submission sheet

| Field | Value |
|---|---|
| Project | MakerHeat |
| One-liner | Who supplied the volume — and how deep does the sample go? |
| Category / track | Data & Visualisation |
| GitHub | https://github.com/alfindigital/makerheat — public |
| Demo video | `video/out/makerheat-demo.mp4` (~84 s, 1920×1080, VO incl.) |
| Live app | local-first: `pnpm build && pnpm start`; live scans need `CMC_API_KEY`, replay mode needs nothing |
| Stack | Next.js 15 · TypeScript · Tailwind · Vitest · node:sqlite · Remotion (video) |

## Paste-ready description

MakerHeat reads the recorded DEX swap tape for a token — via CoinMarketCap's
`/v1/dex/tokens/transactions` endpoint — and answers three questions other
dashboards skip:

1. **Concentration.** Which reported addresses carried the observed buy/sell
   USD, and what share did the top N hold?
2. **Seller context.** Of the addresses selling, which have *no buy observed
   in the same sample* — and how much volume is that?
3. **Evidence depth.** How do those numbers move when you pull more pages of
   the same tape?

That third one is the product. On a real JUP capture, the first 100 swaps say
the top 3 sellers carried 52.8% of sell volume and 94.7% of it came from
addresses with no observed buy. At 1,000 events the same tape says 32.7% and
24.1% — and the "dominant sellers who never bought" disappear entirely by
event 300. Tools that show one number hide this; MakerHeat plots the metric at
every page boundary so you can watch a conclusion converge — or watch it swing.

Every number carries its sample: event count, span, pages fetched, and an
explicit stop reason (`page_budget`, `cursor_exhausted`, `quota_limit`, …).
Missing USD is shown as *unavailable*, never zero. Provider breadth
(`sts[]` unique-trader windows) is rendered as a separate basis with its own
timestamp — never blended into tape math.

Integrity: every API response is SHA-256 receipted at capture; replay mode
recomputes the published numbers from committed fixtures byte-for-byte (the
golden JUP fixture reproduces 83.69%→65.12% top-3 and 61.03%→19.28% no-buy
exactly). Receipts prove reproducibility, not provider truth.

Built defensively: server-only key, per-IP attempt caps, global daily credit
budget, freshness cache, single-flight dedup, kill switch (`MAKERHEAT_LIVE_OFF=1`
keeps replay working).

## CMC endpoints used

| Endpoint | Use |
|---|---|
| `GET /v1/dex/tokens/transactions` | swap tape; `lastId` cursor pagination, frozen `endTime`, 1 credit/page |
| `GET /v1/dex/token` | symbol/name + provider breadth windows (`sts[]`) |
| `GET /v1/dex/search` | ticker → contract resolution (collision-safe picker) |
| `GET /v1/dex/token/pools` | fixture-captured; field verification (`f` = factory) |

## Honesty notes (worth saying out loud)

- An address is not a person. "No buy observed" ≠ "never bought".
- A nested 100→200 comparison is sensitivity, not persistence; real history
  needs separate non-overlapping windows (Phase E).
- `hld` is zero-unverified in observed data — shown, not trusted.
- Raw provider bodies are never served by the app; permalinks carry derived
  metrics only. The `fixtures/jup-solana-*` corpus is committed on purpose as
  the required real-API-call evidence — other bulk captures stay untracked.

## Demo beats (matches the video)

1. Paste `JUPyiwrYJFskUPiHa7hkeR8VUtAeFoSYbKedZNsDvCN` on Solana → scan.
2. Read the naive story: 52.8% / 94.7% / 52.8% at 100 events.
3. Press **deep** — watch the curve: 52.8→32.7, 94.7→24.1, joint → 0.
4. Open *method & sources* — per-page sha256 receipts.
5. Replay `jup-solana-now` — same numbers, zero credits.
