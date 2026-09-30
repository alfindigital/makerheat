# MakerHeat — Method Contract

`methodVersion: "1.0.0"` · `parserVersion` lives in `src/lib/parser.ts`.

Everything here is descriptive. Nothing in this method measures intent,
ownership, coordination, safety, or whether a wallet can exit.

## 1. Basis sets

A raw row becomes a `SwapRow` only after parsing. Sets are nested:

- `baseEligible` — swap events for the exact chain+contract with a valid
  `side` and a valid timestamp inside window `W`.
- `baseEligible ∩ usdValid` — enough to sum provider-reported notional.
  `usd` must be finite and ≥ 0. Missing/null is *missing*, never zero.
- `baseEligible ∩ usdValid ∩ makerValid` — enough for per-address
  attribution. `maker` comes from the provider `ma` field.

USD or maker validity can never rescue an event with invalid identity,
timestamp, or side. A sell with no maker still counts as observed sell
activity and lands in `unattributedSellUsd`.

Per maker `i` over sample `W`:

```
B_i = Σ attributed buy USD      buyObserved_i = ∃ buy event by i in W
S_i = Σ attributed sell USD     sellObserved_i = ∃ sell event by i in W
B = Σ B_i                        S = Σ S_i
```

`buyObserved` ≠ `B_i > 0`. A buy whose USD is missing or zero still sets
`buyObserved = true`. The UI shows buy size so a dust buy doesn't read as
deep history.

## 2. Metrics

Denominators are *attributed* sums only. Unattributed USD and missing-USD
event counts are always displayed next to any share.

Concentration (per side, and combined `all` with denominator `B+S`):

```
p_i = S_i / S                 (or B_i / B, or (B_i+S_i)/(B+S))
topN = Σ largest N p_i         N defaults to 3; rendered "Top N" with
                               actual N when fewer sellers exist
HHI = Σ p_i²                   effectiveMakers = 1/HHI
```

Sell-context:

```
G_W   = { i : sellObserved_i ∧ ¬buyObserved_i }
U_W   = Σ S_i for i ∈ G_W  /  S
observedNoBuySellers     = |{ i : sellObserved_i ∧ ¬buyObserved_i }|
positiveUsdNoBuySellers  = |{ i ∈ G_W : S_i > 0 }|
X_W   = Σ S_i for i ∈ (topN(W) ∩ G_W)  /  S     (joint share)
```

`buyObserved` is window-whole: a buy anywhere in `W` — even after the
sells — removes membership in `G_W`. This is a documented semantics
choice, not "never bought".

Zero denominator → metric `unavailable`, never 0%.

## 3. Determinism

- Internal shares are fractions in `[0,1]`; `%` formatting is UI-only.
- Ranking order: USD desc, then canonical address byte-ASCII asc
  (EVM addresses normalized lowercase; Solana et al. case-preserved).
- Largest-event removal tie-break: explicit event id ordering.
- No wall-clock (`Date.now`) or RNG inside the engine; `capturedAt`
  comes from receipts.
- Event count ≠ transaction count ≠ maker count; multi-leg routing can
  emit several events per transaction.

## 4. Collection contract

Endpoint `/v1/dex/tokens/transactions`, `limit=100`, `sortBy=time`,
`sortType=desc`, frozen `endTime` (milliseconds), opaque `lastId` cursor.

Bounded by `maxPages` (product budget) and a collector deadline.
`bothSides` policy is mandatory: no side/maker/minUSD filters.

Stop reasons: `target_bound_reached` (only after boundary timestamp ties
are traversed), `cursor_exhausted`, `page_budget`, `time_budget`,
`quota_limit`, `provider_error`, `cursor_stalled`, `aborted`.

Dedup identity: `platform|tx|lgid|f`. `h` is block height — never a
transaction id. Rows lacking sufficient identity → `dedupStatus:
uncertain`, still counted, reported.

## 5. Depth curve vs persistence

- **Depth curve** — recompute all metrics per cumulative page prefix on
  the *same* frozen `endTime`. Nested samples: sensitivity, not
  persistence.
- **Largest-event sensitivity** — recompute after removing the single
  largest side event; labeled a sample variant, not new market data.
- **Temporal persistence** — separate non-overlapping windows anchored by
  explicit `endTime`; requires two comparable observations and is only
  claimed when both windows traversed to their stated bounds.

## 6. Field map (fixture-verified)

| Provider field | Meaning | Note |
|---|---|---|
| `ts` | event timestamp (ms string) | |
| `tp` | `"buy"`/`"sell"` | other values → rejected row |
| `v` | USD notional | may be missing → `usdValid=false` |
| `q` | token quantity | |
| `ma` | maker address | missing → unattributed |
| `tx` | transaction id | null stays null; **never** fall back to `h` |
| `h` | block height | ordering context only |
| `lgid` | in-tx event index | part of dedup identity |
| `f` | **factory/program** | NOT a pool address (`pools[].fa` match; `pools[].addr` never) |
| `sym` (token detail) | symbol | search rows use `s` — different field |
| `sts[]` entries | per-window provider stats | `{tp, vu, txs, nb, ns, bvu, svu, but, sut, pc, ut}` — `pc` is price change inside `sts[]`, not a `stats` object |
| `but`/`sut`/`ut` (`sts[]`) | provider breadth | overlap = `but+sut−ut` only if `max(but,sut) ≤ ut ≤ but+sut` |
| `pubAt`/`fpt`/`fpct` | distinct timestamps | not interchangeable |

`hld` is `zero-unverified` (string `"0"` in 118/125 captures and in our
fresh `jup-token.json`) — never a headline input.
