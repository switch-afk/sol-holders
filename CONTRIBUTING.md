# Contributing

Thanks for helping out. This is a small tool, so the rules are short.

## Setup

Node 18 or newer. There are no dependencies to install.

```bash
git clone https://github.com/switch-afk/sol-holders.git
cd sol-holders
npm test
```

## Ground rules

- Keep it zero-dependency
- Keep it read-only: no signing, no private keys, no wallet files
- Errors must never print the full RPC URL, only the hostname (URLs often hold API keys)
- Tests use the mock RPC in `tests/helpers/mock-rpc.js` and the stake account fixtures in `tests/helpers/`. Do not hit a real RPC from tests
- Changes to how accounts are read or to the status maths (warmup, cooldown, lockup) need expected values checked against real `getAccountInfo`, stake history and `getEpochInfo` responses, and against what `solana stake-account` shows for the same account, not values produced by this tool itself

## Pull requests

1. Branch off `main`
2. Add or update tests for what you change
3. Run `npm test`
4. Open a PR. CI runs on Node 18, 20 and 22

## Reporting bugs

Open an issue with the command you ran, what you expected, and what happened. Remove any API keys from URLs first. If a status or an amount does not match what another tool gives you, include the stake account address, the epoch and the RPC host.