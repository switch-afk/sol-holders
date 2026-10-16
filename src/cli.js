'use strict';

const pkg = require('../package.json');
const { validateAddress } = require('./validate');

const USAGE = `sol-holders ${pkg.version}

Top holders of any Solana token.

Usage:
  sol-holders <mint> [options]

Options:
  --json         Print JSON instead of text
  -h, --help     Show this help
  -v, --version  Show the version
`;

class UsageError extends Error {}

function parseArgs(argv) {
  const opts = { mint: null, json: false, help: false, version: false };

  for (const arg of argv) {
    if (arg === '--help' || arg === '-h') {
      opts.help = true;
    } else if (arg === '--version' || arg === '-v') {
      opts.version = true;
    } else if (arg === '--json') {
      opts.json = true;
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

function run(argv, io = { stdout: process.stdout, stderr: process.stderr }) {
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

  if (opts.json) {
    io.stdout.write(`${JSON.stringify({ mint: result.value })}\n`);
  } else {
    io.stdout.write(`Mint: ${result.value}\n`);
  }
  return 0;
}

module.exports = { run, parseArgs, UsageError, USAGE };