# fixtures/ — real provider captures

Two tiers:

- **Public demo corpus (committed):** `jup-solana-{now,keyless,keyed}-*.json` —
  real CMC `/v1/dex/tokens/transactions` responses for JUP on Solana. Committed
  deliberately: they are the hackathon's "visible evidence of a real API call",
  make replay runnable on any clone and any deploy, and describe data that is
  public on-chain anyway. Every body is hash-pinned in `manifest.json`.
- **Bulk corpus (local-only):** all other groups (UNI, VIRTUAL, WIF, BONK, PEPE,
  CAKE, GMX, FARTCOIN, AERO, TRUMP, SAITAMA…) stay untracked — a broader
  capture set isn't needed to evaluate the product, and wholesale
  redistribution of provider bodies is not the goal. Their sha256 + request
  metadata remain verifiable in `manifest.json`.

To reproduce fixtures on a fresh clone you need a CMC key:

```bash
# capture 5 pages of transactions
node tools/capture-fixtures.mjs tx --chain Solana --address <ca> --pages 5 --group <name>
# token detail / pools / search
node tools/capture-fixtures.mjs token|pools --chain <c> --address <a> --name <name>
node tools/capture-fixtures.mjs search --query <q> --name <name>
```

`pnpm verify:fixtures` checks every file's sha256 against the manifest and
asserts zero cross-page event duplication.

Golden-test bytes that pin the JUP depth-flip numbers come from
`jup-solana-keyless-p{1,2}.json` (copied from
`ghosttape/research/2026-09-30/public-cursor`, captured 2026-09-30
21:22 WIB, `endTime=1790778167122`).
