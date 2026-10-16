# sol-holders

[![CI](https://github.com/switch-afk/sol-holders/actions/workflows/ci.yml/badge.svg)](https://github.com/switch-afk/sol-holders/actions/workflows/ci.yml)
[![npm](https://img.shields.io/npm/v/sol-holders)](https://www.npmjs.com/package/sol-holders)
[![license](https://img.shields.io/npm/l/sol-holders)](LICENSE)

Look up any Solana token from your terminal: its supply, decimals, token program and authorities, plus the largest holders as owner wallets with their share of the supply. Works for both Token and Token-2022 mints.

A token's balances live in token accounts, one per owner per mint. sol-holders asks an RPC for the mint, asks for the largest token accounts of that mint, looks up who owns each of them, and works out every share of supply with exact integer maths. No SDK, no wallet, nothing to sign.

- Supply, decimals, token program, mint authority and freeze authority
- Top holders by owner wallet, with exact amounts and share of supply
- `--limit` and `--min` trim the list, `--no-owners` skips the owner lookup
- `--json` is there for scripts
- Read-only, zero dependencies, Node 18+

## Install

```bash
npx sol-holders <mint>
```

Or install it globally:

```bash
npm install -g sol-holders
```

## Usage

```bash
sol-holders <mint> [options]
```

| Option | Description |
| --- | --- |
| `--limit <n>` | Show the top n holders, 1 to 20 (default 20) |
| `--min <pct>` | Only show holders with at least this share of supply, 0 to 100 with up to two decimals |
| `--no-owners` | Skip the owner lookup and show token accounts instead |
| `--rpc <url>` | RPC endpoint (or set `SOL_HOLDERS_RPC`) |
| `--json` | Print machine-readable JSON |
| `-h`, `--help` | Show help |
| `-v`, `--version` | Show the version |

## Look up a token

PYUSD, a Token-2022 mint, showing the top five holders that own at least 1% of the supply:

```bash
sol-holders 2b1kV6DkPAnxd5ixfnxCpjxmKwqjjaYmCZfHsFu24GXo --limit 5 --min 1
```

```
Mint:             2b1kV6DkPAnxd5ixfnxCpjxmKwqjjaYmCZfHsFu24GXo
Token program:    Token-2022 (TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb)
Decimals:         6
Supply:           673,608,120.371357
Mint authority:   AxJkHRY3puoofyj7Pn512M1SGBgWroXMkEdNPQypkzbu
Freeze authority: 2apBGMsS6ti9RyF5TwQTDswXBWskiJP2LD4cUEDqYJjk
RPC:              api.mainnet-beta.solana.com

Top holders (by owner)
#  Owner                                                     Amount  % of supply
1  5gUuDFHswKi2QMA1qJHf6FEVhNCrHnyAdfWniMaUUPE4  393,571,704.253644       58.43%
2  6m68XVvBR4oLCgM7YFgH1VqzzV5vk9UimvmVUvyKw6c2   25,000,101.028307        3.71%
3  FCQSFKkw2JPhpG4M18nvGfiNAK6N3gFBmp8pkn4CxYGs          24,993,500        3.71%
4  AMohT4QVc7ZrqVVznTFCzmujc4eewapGYYeP5bDMSmDY   21,552,841.595488        3.20%
5  AdB5E9PCHYTuo8BdQcwkVPfWPDrZss6s1nGU7WLxxL38          20,000,000        2.97%
Top 5 hold 72.02% of supply
```

`Supply` and `Amount` are exact, with trailing zeros dropped. `% of supply` is rounded to two decimals. The last line is the combined share of the rows shown. `Mint authority` says `none (supply is fixed)` when nobody can mint more, and `Freeze authority` says `none` when nobody can freeze accounts. The numbers above are a snapshot and will have moved.

### Trim the list

```bash
sol-holders <mint> --limit 3
sol-holders <mint> --min 0.5
```

Ranks keep their original numbers, so a filtered list can start at 2 or skip a rank. The combined line only counts the rows shown. If nothing passes `--min`, the output says `No holders match the filters.` and the exit code is `0`.

### Owners and token accounts

By default the table shows owners: the wallet (or program) that owns each token account, found with one extra request. With `--no-owners` that request is skipped and the table shows the token accounts themselves, under a `Token account` heading.

If the owner lookup fails, a warning goes to stderr and the table falls back to token accounts. An account the RPC cannot read shows as `unknown` next to resolved ones.

## RPC endpoint

The endpoint is picked in this order: `--rpc`, then the `SOL_HOLDERS_RPC` environment variable, then the public mainnet endpoint. Use `--rpc` for devnet or testnet. The public endpoint is rate limited, and many public endpoints block or limit `getTokenLargestAccounts`, so use your own RPC for anything serious.

```bash
export SOL_HOLDERS_RPC="https://your-rpc.example.com/?api-key=..."
```

```powershell
$env:SOL_HOLDERS_RPC = "https://your-rpc.example.com/?api-key=..."
```

Errors only ever print the RPC hostname, so API keys in the URL are not leaked. Requests that get an HTTP 429 are retried with backoff. If the holders lookup is blocked, the error says so and suggests `--rpc` with your own endpoint.

## JSON output

`--json` prints the same information as JSON:

```bash
sol-holders 2b1kV6DkPAnxd5ixfnxCpjxmKwqjjaYmCZfHsFu24GXo --limit 2 --json
```

```json
{
  "mint": "2b1kV6DkPAnxd5ixfnxCpjxmKwqjjaYmCZfHsFu24GXo",
  "program": "spl-token-2022",
  "programName": "Token-2022",
  "programId": "TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb",
  "decimals": 6,
  "supply": {
    "raw": "673608120371357",
    "ui": "673608120.371357"
  },
  "mintAuthority": "AxJkHRY3puoofyj7Pn512M1SGBgWroXMkEdNPQypkzbu",
  "freezeAuthority": "2apBGMsS6ti9RyF5TwQTDswXBWskiJP2LD4cUEDqYJjk",
  "holders": [
    {
      "rank": 1,
      "tokenAccount": "47od2TPRvqJipfPVWZdyenLEngPw8hC36nDxiLyvGsEP",
      "owner": "5gUuDFHswKi2QMA1qJHf6FEVhNCrHnyAdfWniMaUUPE4",
      "amount": {
        "raw": "393571704253644",
        "ui": "393571704.253644"
      },
      "percent": 58.43
    },
    {
      "rank": 2,
      "tokenAccount": "7RCBfgRgm3pMv42ZzvQNuXydThVatpRcYbcWUNvyMCJN",
      "owner": "6m68XVvBR4oLCgM7YFgH1VqzzV5vk9UimvmVUvyKw6c2",
      "amount": {
        "raw": "25000101028307",
        "ui": "25000101.028307"
      },
      "percent": 3.71
    }
  ],
  "topHoldersPercent": 62.14
}
```

Amounts are strings so large values never lose precision: `raw` is in the token's smallest unit and `ui` is the same amount with the decimal point placed. `program` is `spl-token` or `spl-token-2022`. `mintAuthority` and `freezeAuthority` are `null` when nobody holds that power. `owner` is `null` with `--no-owners` or when the owner could not be read. `percent` is a number with two decimals, and `topHoldersPercent` is the combined share of the holders listed.

## How it works

sol-holders asks the RPC for the mint account (`getAccountInfo` with parsed data), then for the largest token accounts of that mint (`getTokenLargestAccounts`), then for those token accounts (`getMultipleAccounts` with parsed data) to read their owners. Shares are worked out on the raw integer amounts, so nothing goes through floating point, and are rounded to two decimals at the end. `--min` compares exact amounts, so a holder sitting exactly on the threshold is included.

## Good to know

- The RPC returns at most the 20 largest token accounts of a mint, so this is a top 20 view, not a full holder list. That is why `--limit` stops at 20
- Rows are token accounts resolved to their owners, and nothing is merged. A wallet that owns two token accounts of the same mint shows up twice
- Owners are not labelled. A big owner can be an exchange, a pool, a vault or a program's address rather than a person
- Percentages are rounded, so they can differ from the combined line by a rounding step. The combined line is worked out from the exact amounts of the rows shown
- Everything is read at `finalized` commitment
- An address that is not a token mint (a wallet, a token account, a program) is reported as such, and an account that does not exist says so
- A lookup makes three requests: the mint, the largest accounts and the owners. With `--no-owners`, or when no rows are left to show, it makes two
- Use `--rpc` for devnet or testnet. Supply and holders belong to the cluster your RPC points at

## Exit codes

| Code | Meaning |
| --- | --- |
| `0` | Success. This includes a mint with no token accounts, filters that hide every row, and an owner lookup that failed (a warning is printed) |
| `1` | The mint was not found, is not a token mint or could not be read, or an RPC call for the mint or the holders failed |
| `2` | Usage error (bad or conflicting arguments) |

## Development

```bash
npm test
```

No dependencies to install. See [CONTRIBUTING.md](CONTRIBUTING.md).

## License

MIT