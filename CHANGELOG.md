# Changelog

## [0.1.0] - 2026-10-17

First release.

### Added
- Mint lookup: supply, decimals, token program (Token or Token-2022), mint authority and freeze authority. Supply is exact, with thousands separators in the text output
- Largest holders via `getTokenLargestAccounts`, each with its exact amount and share of supply, plus the combined share of the rows shown. Shares use integer maths on the raw amounts and are rounded to two decimals
- Owner wallets resolved with one `getMultipleAccounts` call. `--no-owners` skips it, and a failed lookup falls back to token accounts with a warning on stderr
- `--limit <n>` (1 to 20) and `--min <percent>` to trim the list. `--min` compares exact amounts
- `--json` output
- RPC client with 429 retry and backoff, `--rpc` and `SOL_HOLDERS_RPC`, hostname-only error messages, and a hint to use your own endpoint when the holders lookup is blocked
- Exit codes: `0` ok, `1` not found, not a token mint or RPC failure, `2` usage error