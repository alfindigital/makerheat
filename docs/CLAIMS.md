# MakerHeat — Claims Policy

What this product may and may not say. Enforced by `pnpm scan:vocab`
(mechanical) plus human review of generated copy (a sentence can imply an
accusation without using a banned word).

## We may say

- "X% of attributed sell USD came from N addresses in this sample."
- "No buy event by this address was observed within this sample."
- "The share changed from A% to B% when the sample deepened." (with the
  event counts, spans, and identical `endTime` shown)
- "This capture's bytes hash to `<sha>` and replay to the same numbers."
- "Provider reports N unique buyer/seller addresses over its own window."

## We may not say

- That an address is an insider, bot, sybil, cabal, coordinated actor, or
  any entity/person — `ma` is an address field, not an identity.
- That a token is safe, risky, elevated, dangerous, a scam, or a
  honeypot — no verdicts, no risk bands, no scores.
- That a wallet "can't sell" or that exit is blocked — zero observed
  sells is an absence in the sample, not a capability test.
- That coverage is complete — there is no FULL-COVERAGE badge; we show
  pages fetched, event count, span, and stop reason.
- That a hash proves the provider told the truth — it proves the stored
  bytes are unchanged since capture.
- That two lenses agreeing is independent confirmation — concentration
  and sell-context are transforms of overlapping data.
- That deeper data is "the truth" — it is more evidence, still
  provider-scoped and possibly incomplete.

## Data rights

Raw provider response bodies are internal-only until redistribution
rights are confirmed. Public surfaces carry derived metrics, request
metadata, timestamps, and integrity hashes. Public permalinks store
derived results only, behind acknowledged writes. No raw JSON downloads.

## Untrusted text

Token names, symbols, and any provider strings are untrusted input —
rendered escaped, never as HTML.
