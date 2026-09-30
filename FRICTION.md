# FRICTION.md — what actually happened building this

Honest log. Every entry cost time or taught something structural.

## Provider quirks (verified, not assumed)

1. **`offset` is silently ignored** on the transactions endpoint. First probe
   concluded "hard cap at 100 events" — wrong. `lastId` is the real cursor;
   it paginates fine (3,000+ events verified). Lesson: an ignored parameter
   fails *silently* — absence of an error is not absence of a bug.
2. **`endTime` is milliseconds.** Early probe sent seconds → got nonsense
   windows. The API does not reject wrong units; it just answers a different
   question.
3. **Single-letter field names everywhere** (`v`, `ma`, `tp`, `f`, `lgid`).
   Docs are loose; we verified mappings against raw response bytes:
   `f` = factory/program (matched `pools[].fa` 95/100, `pools[].addr` 0/100),
   `h` = block height (never an event id), `sym` (token detail) ≠ `s` (search).
4. **`hld` is `"0"`** even on JUP — holder count is zero-unverified, shown as
   such rather than trusted.
5. **Timestamps on one page disagree in scale** in legacy captures (mixed
   s/ms seen historically). Parser normalizes defensively and *rejects* rows
   it cannot make sense of — rejection count is surfaced in `quality`.
6. **`/v1/` keyed path works; the keyless path throttles fast** (429 under
   a shared IP). Fixture capture uses keyed calls and budgets them.
7. **Breadth (`sts[]`) has its own time basis** — provider windows are
   overlapping aggregates, not independent samples. Union invariant
   `max(but,sut) ≤ ut ≤ but+sut` is checked before we show overlap; it held
   on every captured fixture so far, but the check stays.

## Engineering friction

8. **pnpm 11 moved `onlyBuiltDependencies`** out of `package.json` into
   `pnpm-workspace.yaml`. Silently ignored → `@tailwindcss/oxide`, `esbuild`,
   `sharp` builds skipped. Symptom was a warning, not a failure — check
   build-script approval after install on pnpm ≥10.
9. **`next@15.5.4` shipped with a CVE**; pin moved to `15.5.26`. Always check
   `pnpm audit`-level warnings at scaffold time, not later.
10. **Satori (`next/og`) requires `display:flex` on every multi-child div** —
    including divs whose "children" are multiple JSX expressions. Failure mode
    is a 500 with `failed to pipe response`, not a helpful error.
11. **Freshness cache keys must not include request time.** First version
    embedded `endTime` in the cache key → zero hits ever. Cache keys describe
    the *question* (chain|address|tier); TTL describes freshness; the stored
    observation carries its own `capturedAt`.
12. **Quota counting must include failed attempts.** Recording only successful
    scans lets an attacker burn paid calls while staying under the rate cap —
    the ledger now writes the attempt before the request and back-fills credits.
13. **Windows + `node:sqlite` + `next dev`** — SQLite file lives in `data/`
    (gitignored). Single-writer process assumption is documented in
    `store.ts`; multi-instance deploys need Redis/Upstash.
14. **`verbatimModuleSyntax`** + Next — type imports must be `import type`.
    tsconfig strictness caught this early; kept on.

## Product honesty friction (deliberate)

15. A **$10 dust buy flips `buyObserved` to true** for a wallet selling $2k.
    Presence ≠ size — the UI always shows the buy USD next to the flag.
16. **Count and share disagree**: JUP's no-buy seller *count* rose 14→17 while
    no-buy *share* fell 61%→19%. Both numbers are shown; collapsing them into
    one would lie.
17. "No buy observed" **cannot** be phrased as "never bought" without lying —
    copy review is ongoing; `docs/CLAIMS.md` is the contract.
18. **Creator exclusion was tempting and wrong** — the most interesting seller
    is often the deployer. Creators get a labeled bucket, never silent removal.

## Deferred (known incomplete)

- Pools/creator live call (creators are typed but not yet resolved live).
- True history comparisons (needs ≥2 non-overlapping windows — Phase E).
- Distributed quota store (SQLite is single-instance).
- AI summaries (Jev/DeepSeek) — deferred per spec; deterministic output only.
- Full event-row inspector (rows live in private receipts; public permalink
  carries derived data only — pending data-rights review).
