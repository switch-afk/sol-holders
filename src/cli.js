'use strict';

const pkg = require('../package.json');
const { validateAddress } = require('./validate');
const { RpcError, resolveRpcUrl, createRpcClient } = require('./rpc');
const { MintError, fetchMint } = require('./mint');
const { renderMint } = require('./render');

const USAGE = `sol-holders ${pkg.version}

Top holders of any Solana token.

Usage:
  sol-holders <mint> [options]

Options:
  --rpc <url>    RPC endpoint (default: $SOL_HOLDERS_RPC, then the public mainnet RPC)
  --json         Print JSON instead of text
  -h, --help     Show this help
  -v, --version  Show the version
`;

class UsageError extends Error {}

function isHttpUrl(value) {
  try {
    const { protocol } = new URL(value);
    return protocol === 'http:' || protocol === 'https:';
  } catch {
    return false;
  }
}

function parseArgs(argv) {
  const opts = { mint: null, rpc: null, json: false, help: false, version: false };

  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];

    if (arg === '--help' || arg === '-h') {
      opts.help = true;
    } else if (arg === '--version' || arg === '-v') {
      opts.version = true;
    } else if (arg === '--json') {
      opts.json = true;
    } else if (arg === '--rpc' || arg.startsWith('--rpc=')) {
      const value = arg === '--rpc' ? argv[++i] : arg.slice('--rpc='.length);
      if (!value || value.startsWith('-')) {
        throw new UsageError('--rpc requires a URL');
      }
      if (!isHttpUrl(value)) {
        throw new UsageError('--rpc must be an http(s) URL');
      }
      opts.rpc = value;
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

  if (opts.json) {
    io.stdout.write(`${JSON.stringify(info, null, 2)}\n`);
  } else {
    io.stdout.write(renderMint(info, client.host));
  }
  return 0;
}

module.exports = { run, parseArgs, UsageError, USAGE };