'use strict';

const pkg = require('../package.json');
const { validateAddress } = require('./validate');
const { RpcError, resolveRpcUrl, createRpcClient } = require('./rpc');
const { MintError, fetchMint } = require('./mint');
const { HoldersError, fetchHolders, selectHolders, resolveOwners } = require('./holders');
const { renderMint, renderHolders } = require('./render');

const MAX_LIMIT = 20;

const USAGE = `sol-holders ${pkg.version}

Top holders of any Solana token.

Usage:
  sol-holders <mint> [options]

Options:
  --limit <n>    Show the top n holders, 1 to ${MAX_LIMIT} (default: ${MAX_LIMIT})
  --min <pct>    Only show holders with at least this % of supply (0 to 100)
  --no-owners    Skip the owner lookup and show token accounts
  --rpc <url>    RPC endpoint (default: $SOL_HOLDERS_RPC, then the public mainnet RPC)
  --json         Print JSON instead of text
  -h, --help     Show this help
  -v, --version  Show the version
`;

const HOLDERS_HINT = 'Some public RPCs limit this lookup. Try --rpc with your own endpoint.';

const VALUE_FLAGS = {
  '--rpc': 'a URL',
  '--limit': 'a number',
  '--min': 'a percentage',
};

class UsageError extends Error {}

function isHttpUrl(value) {
  try {
    const { protocol } = new URL(value);
    return protocol === 'http:' || protocol === 'https:';
  } catch {
    return false;
  }
}

// "2.5" -> 250 basis points. Returns null unless the value is 0 to 100 with up to 2 decimals.
function parseMinBasisPoints(value) {
  const match = /^(\d+)(?:\.(\d{1,2}))?$/.exec(value);
  if (!match) return null;
  const basisPoints = Number(match[1]) * 100 + Number((match[2] || '').padEnd(2, '0'));
  return basisPoints <= 10000 ? basisPoints : null;
}

function parseArgs(argv) {
  const opts = {
    mint: null,
    rpc: null,
    limit: MAX_LIMIT,
    minBp: 0,
    owners: true,
    json: false,
    help: false,
    version: false,
  };

  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    const equals = arg.startsWith('--') ? arg.indexOf('=') : -1;
    const flag = equals === -1 ? arg : arg.slice(0, equals);

    if (arg === '--help' || arg === '-h') {
      opts.help = true;
    } else if (arg === '--version' || arg === '-v') {
      opts.version = true;
    } else if (arg === '--json') {
      opts.json = true;
    } else if (arg === '--no-owners') {
      opts.owners = false;
    } else if (Object.hasOwn(VALUE_FLAGS, flag)) {
      const value = equals === -1 ? argv[++i] : arg.slice(equals + 1);
      if (!value || value.startsWith('-')) {
        throw new UsageError(`${flag} requires ${VALUE_FLAGS[flag]}`);
      }

      if (flag === '--rpc') {
        if (!isHttpUrl(value)) {
          throw new UsageError('--rpc must be an http(s) URL');
        }
        opts.rpc = value;
      } else if (flag === '--limit') {
        const limit = /^\d+$/.test(value) ? Number(value) : 0;
        if (limit < 1 || limit > MAX_LIMIT) {
          throw new UsageError(`--limit must be a whole number from 1 to ${MAX_LIMIT}`);
        }
        opts.limit = limit;
      } else {
        const basisPoints = parseMinBasisPoints(value);
        if (basisPoints === null) {
          throw new UsageError('--min must be a percentage from 0 to 100 (up to 2 decimals)');
        }
        opts.minBp = basisPoints;
      }
    } else if (arg.startsWith('-')) {
      throw new UsageError(`unknown option: ${arg}`);
    } else if (opts.mint === null) {
      opts.mint = arg;
    } else {
      throw new UsageError(`unexpected argument: ${arg}`);
    }
  }

  return opts;
}

function shouldHintAboutRpc(err) {
  return err instanceof RpcError && (err.status === 429 || err.status === 403 || err.code !== undefined);
}

async function run(argv, io = { stdout: process.stdout, stderr: process.stderr }, deps = {}) {
  let opts;
  try {
    opts = parseArgs(argv);
  } catch (err) {
    if (!(err instanceof UsageError)) throw err;
    io.stderr.write(`error: ${err.message}\n\n${USAGE}`);
    return 2;
  }

  if (opts.help) {
    io.stdout.write(USAGE);
    return 0;
  }

  if (opts.version) {
    io.stdout.write(`${pkg.version}\n`);
    return 0;
  }

  if (opts.mint === null) {
    io.stderr.write(`error: missing token mint address\n\n${USAGE}`);
    return 2;
  }

  const result = validateAddress(opts.mint);
  if (!result.ok) {
    io.stderr.write(`error: invalid mint address: ${result.error}\n`);
    return 2;
  }

  const env = deps.env || process.env;
  const client = createRpcClient({
    url: resolveRpcUrl(opts.rpc, env),
    fetch: deps.fetch,
    sleep: deps.sleep,
  });

  let info;
  try {
    info = await fetchMint(client, result.value);
  } catch (err) {
    if (err instanceof RpcError || err instanceof MintError) {
      io.stderr.write(`error: ${err.message}\n`);
      return 1;
    }
    throw err;
  }

  let holders;
  try {
    const fetched = await fetchHolders(client, info);
    holders = selectHolders(fetched, info, { limit: opts.limit, minBp: opts.minBp });
  } catch (err) {
    if (err instanceof RpcError || err instanceof HoldersError) {
      io.stderr.write(`error: ${err.message}\n`);
      if (shouldHintAboutRpc(err)) {
        io.stderr.write(`${HOLDERS_HINT}\n`);
      }
      return 1;
    }
    throw err;
  }

  if (opts.owners) {
    try {
      holders = { ...holders, accounts: await resolveOwners(client, holders.accounts) };
    } catch (err) {
      if (!(err instanceof RpcError || err instanceof HoldersError)) throw err;
      io.stderr.write(`warning: could not resolve owners: ${err.message}\n`);
    }
  }

  if (opts.json) {
    const output = { ...info, holders: holders.accounts, topHoldersPercent: holders.percent };
    io.stdout.write(`${JSON.stringify(output, null, 2)}\n`);
  } else {
    io.stdout.write(`${renderMint(info, client.host)}\n${renderHolders(holders, info.decimals)}`);
  }
  return 0;
}

module.exports = { run, parseArgs, UsageError, USAGE };