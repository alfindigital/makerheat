# CMC DEX endpoints used

All calls are server-side keyed (`X-CMC_PRO_API_KEY`). Bodies are hashed
(sha256) into receipts; raw bodies are never served by the app API.
The committed `fixtures/jup-solana-*` files are the deliberate public corpus —
API-call evidence for judges and keyless replay for any clone.

## `GET /v1/dex/tokens/transactions` — the tape

Params we send:

```
platform=<chain name as provider expects: Solana|Ethereum|Base|BSC|Arbitrum|...>
address=<token contract>
limit=100
sortBy=time
sortType=desc
endTime=<ms>          # frozen for the whole scan — never re-now()'d per page
lastId=<opaque>       # returned cursor, forwarded verbatim; do not parse
startTime=<ms>        # optional lower bound
```

Verified behavior (probes 2026-09-30, keyed path):

- `limit=100` is a **page size**, not a history cap. Cursor `lastId` reached
  ≥3,000 events (30 pages) on JUP.
- `endTime` accepts historical ms timestamps (time-travel works — UNI yielded
  ~18.5h of tape).
- Page-to-page: zero overlap on event ids; each page strictly older.
- 1 credit per call (status `credits` field confirmed).

Row fields we use (verified against raw bytes — names are single letters):

| field | meaning |
|-------|---------|
| `ts`  | event time, **milliseconds** |
| `tp`  | `"b"` buy / `"s"` sell (base-token perspective) |
| `v`   | USD notional (number or string; may be missing/0) |
| `ma`  | maker/reporting address (may be missing) |
| `tx`  | transaction signature/hash (`null` if absent — never substitute `h`) |
| `h`   | block height — **not** an event identity |
| `lgid`| provider ledger/event id |
| `f`   | factory/program id (e.g. Solana AMM program) — **not** pool address |

Event id for dedup: `platform | tx ?? lgid ?? sha(canonical-row)`.
Rows missing `ma` are kept for side/USD (`unattributedUsd`) — they are not
silently dropped.

## `GET /v1/dex/token` — identity + provider breadth

```
platform=<chain>  address=<contract>
```

- `data.sym`, `data.n` — symbol/name (displayed as untrusted provider text).
- `data.sts[]` — provider-computed windows: `tp` label, `ut` unique traders,
  `but`/`sut` unique buyers/sellers, `nb`/`ns` counts, `bvu`/`svu` USD,
  `pc` price change. Shown as a **separate basis** panel with its own
  `capturedAt`; overlap `but+sut−ut` is shown only when the union invariant
  `max(but,sut) ≤ ut ≤ but+sut` holds, else "not reported".
- `data.hld` — holder count observed as `"0"` on liquid majors; treated as
  zero-unverified and labeled accordingly.
- `fpt`/`fpct` — pool-age timestamps (not publication time).

## `GET /v1/dex/search` — ticker → contract resolution

```
q=<ticker or name>
```

- `data.tks[]` rows: `plt` platform, `addr` contract, `n` name, `s` symbol,
  `liq` liquidity, `ut24h`, `v24h`, `cid`.
- Note: search uses `s` for symbol; token detail uses `sym`. Not interchangeable.
- Multiple same-symbol contracts are common → the UI always makes the user
  pick; never auto-picks on ambiguity.

## `GET /v1/dex/token/pools` — pool/creator context (fixtures only so far)

Used for fixture-field verification (`f` matched `pools[].fa` on 95/100 rows,
`pools[].addr` on 0/100). Creator bucketing is wired in types but the pools
call is not yet in the live path — noted in FRICTION.md.
