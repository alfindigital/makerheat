# fixtures/ — real provider captures (INTERNAL ONLY)

Raw CMC API response bodies. **Never committed to git** (see root
.gitignore) — redistribution rights for raw provider data are not yet
confirmed. Only `manifest.json` (sha256 + request metadata) and this
README are tracked.

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
