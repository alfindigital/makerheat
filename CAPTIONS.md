# Captions — MakerHeat launch copy

All numbers below are real outputs of replay group `jup-solana-now`
(1,000 JUP/Solana swap events, one frozen endTime, SHA-256 receipts per page).

## X/Twitter — primary post

> your dashboard says "top sellers = 52.8%".
>
> pull one more page of tape: 42.0%.
> pull nine more: 32.7%.
>
> the number was never the token's. it was the sample's.
>
> MakerHeat draws the curve instead of picking the number.
> github.com/alfindigital/makerheat

## X — alt (seller-context angle)

> JUP tape, 100 swaps: 94.7% of sell volume came from addresses with no buy
> in the sample.
>
> At 1,000 swaps: 24.1%. The "supply wall" mostly bought — just outside page 1.
>
> Evidence depth changes the answer. That's the product.

## X — thread version

1/ Every concentration metric you see is hostage to how much tape was sampled.
   MakerHeat pulls CoinMarketCap DEX swaps and shows the metric *at every
   page boundary* — so you watch it converge, or watch it swing.

2/ Real example (replayable): JUP/Solana, same endTime —
   100 events: top-3 sellers 52.8%, no-buy-observed 94.7%
   1,000 events: 32.7% / 24.1%. "Dominant sellers with no buys": gone by 300.

3/ Every page carries a sha256 receipt. Replay mode reproduces the numbers
   byte-for-byte from committed fixtures — zero credits, no key needed.

4/ Descriptive, not verdicts. "No buy observed" means *in this sample*.
   Missing data renders as unavailable, never zero.

5/ Open source: github.com/alfindigital/makerheat
   Next.js + TypeScript + node:sqlite. Live scans keyed, quota-guarded.

## LinkedIn / Farcaster short

> Most token analytics answer "who" from a 100-swap window and never say so.
> MakerHeat makes the window the product: it replays the CMC DEX tape at
> increasing depth and shows how seller concentration and no-buy share move.
> On JUP's real tape the answer flips within one page. Numbers carry their
> sample — every metric ships with events, span, stop reason, and a hash
> receipt. Descriptive only; reproducible by anyone.

## Hackathon-jury note (why it's different)

> Concentration tools exist; none show you the number being unstable.
> MakerHeat's entire UI is built around evidence depth: per-page curves,
> joint metrics (top-N ∩ no-buy), sensitivity, explicit stop reasons.
> The honest answer to "who moved the tape" is "depends how much you looked —
> here's the curve."

## Don't say (vocab policy)

insider, cabal, sybil, coordinated, wash, manipulation, safe, risky, scam,
guaranteed, "full coverage", "the seller never bought" (say: no buy *observed
in this sample*).
