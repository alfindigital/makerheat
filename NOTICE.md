# Data provenance & license notes

The MIT license in `LICENSE` covers the source code of this repository only.

## Committed CoinMarketCap captures

`fixtures/jup-solana-*.json` holds real responses from the CoinMarketCap DEX
API (`/v1/dex/tokens/transactions`) for JUP on Solana, hash-pinned in
`fixtures/manifest.json`. They are committed deliberately as **replayable
evidence** for the Build with CMC: API Hackathon (2026); see
`fixtures/README.md`. The broader capture set stays local and is not
redistributed. `fixtures-synthetic/` is generated test data, not provider data.

This data is published **for evaluation and reproducibility of this
submission**, not as a redistributed market-data feed. Market data remains
© CoinMarketCap; see https://coinmarketcap.com/api/terms/. It is not covered by
the MIT license.

## No secrets

No API keys or credentials are committed. Keys are read from environment
variables only.
