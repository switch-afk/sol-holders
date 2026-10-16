'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { run, parseArgs, UsageError } = require('../src/cli');
const { createMockRpc, httpError } = require('./helpers/mock-rpc');
const pkg = require('../package.json');

const USDC = 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v';
const TOKEN_PROGRAM = 'TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA';
const FREEZE = 'FreezeAuthority1111111111111111111111111111';
const RPC_ENV = 'https://rpc.example.com/?api-key=secret';

function capture() {
  let out = '';
  let err = '';
  return {
    io: {
      stdout: { write: (s) => { out += s; } },
      stderr: { write: (s) => { err += s; } },
    },
    out: () => out,
    err: () => err,
  };
}

function mintAccount() {
  return {
    value: {
      owner: TOKEN_PROGRAM,
      data: {
        program: 'spl-token',
        parsed: {
          type: 'mint',
          info: {
            supply: '9876543210123',
            decimals: 6,
            mintAuthority: null,
            freezeAuthority: FREEZE,
          },
        },
      },
    },
  };
}

function depsFor(mock, env = { SOL_HOLDERS_RPC: RPC_ENV }) {
  return { fetch: mock.fetch, env };
}

test('parseArgs defaults', () => {
  assert.deepEqual(parseArgs([]), {
    mint: null,
    rpc: null,
    json: false,
    help: false,
    version: false,
  });
});

test('parseArgs reads mint and flags', () => {
  const opts = parseArgs([USDC, '--json']);
  assert.equal(opts.mint, USDC);
  assert.equal(opts.json, true);
});

test('parseArgs reads --rpc in both forms', () => {
  assert.equal(parseArgs(['--rpc', 'https://a.example.com', USDC]).rpc, 'https://a.example.com');
  assert.equal(parseArgs([USDC, '--rpc=https://b.example.com']).rpc, 'https://b.example.com');
});

test('parseArgs rejects unknown options and extra arguments', () => {
  assert.throws(() => parseArgs(['--nope']), UsageError);
  assert.throws(() => parseArgs([USDC, 'another']), UsageError);
});

test('parseArgs rejects a missing or invalid --rpc value', () => {
  assert.throws(() => parseArgs(['--rpc']), /requires a URL/);
  assert.throws(() => parseArgs(['--rpc', '--json']), /requires a URL/);
  assert.throws(() => parseArgs(['--rpc=']), /requires a URL/);
  assert.throws(() => parseArgs(['--rpc', 'nonsense']), /http\(s\)/);
  assert.throws(() => parseArgs(['--rpc=ftp://example.com']), /http\(s\)/);
});

test('--help prints usage and exits 0', async () => {
  const c = capture();
  assert.equal(await run(['--help'], c.io), 0);
  assert.match(c.out(), /Usage:/);
  assert.match(c.out(), /--rpc <url>/);
});

test('--version prints the package version', async () => {
  const c = capture();
  assert.equal(await run(['--version'], c.io), 0);
  assert.equal(c.out().trim(), pkg.version);
});

test('missing mint exits 2 with usage on stderr', async () => {
  const c = capture();
  assert.equal(await run([], c.io), 2);
  assert.match(c.err(), /missing token mint address/);
  assert.equal(c.out(), '');
});

test('unknown option exits 2', async () => {
  const c = capture();
  assert.equal(await run(['--nope'], c.io), 2);
  assert.match(c.err(), /unknown option: --nope/);
});

test('invalid mint exits 2 without calling the RPC', async () => {
  const c = capture();
  const mock = createMockRpc({ getAccountInfo: mintAccount() });
  assert.equal(await run(['not-a-mint'], c.io, depsFor(mock)), 2);
  assert.match(c.err(), /invalid mint address/);
  assert.equal(mock.calls.length, 0);
});

test('prints mint details as text', async () => {
  const c = capture();
  const mock = createMockRpc({ getAccountInfo: mintAccount() });
  assert.equal(await run([USDC], c.io, depsFor(mock)), 0);
  assert.match(c.out(), new RegExp(`Mint:\\s+${USDC}`));
  assert.match(c.out(), /Token program:\s+Token \(TokenkegQ/);
  assert.match(c.out(), /Decimals:\s+6/);
  assert.match(c.out(), /Supply:\s+9,876,543\.210123/);
  assert.match(c.out(), /Mint authority:\s+none/);
  assert.match(c.out(), new RegExp(`Freeze authority:\\s+${FREEZE}`));
  assert.match(c.out(), /RPC:\s+rpc\.example\.com/);
  assert.ok(!c.out().includes('secret'));
});

test('--json prints parseable mint info', async () => {
  const c = capture();
  const mock = createMockRpc({ getAccountInfo: mintAccount() });
  assert.equal(await run([USDC, '--json'], c.io, depsFor(mock)), 0);
  assert.deepEqual(JSON.parse(c.out()), {
    mint: USDC,
    program: 'spl-token',
    programName: 'Token',
    programId: TOKEN_PROGRAM,
    decimals: 6,
    supply: { raw: '9876543210123', ui: '9876543.210123' },
    mintAuthority: null,
    freezeAuthority: FREEZE,
  });
});

test('--rpc beats SOL_HOLDERS_RPC', async () => {
  const c = capture();
  const mock = createMockRpc({ getAccountInfo: mintAccount() });
  await run([USDC, '--rpc', 'https://flag.example.com'], c.io, depsFor(mock));
  assert.equal(mock.calls[0].url, 'https://flag.example.com');
  assert.match(c.out(), /RPC:\s+flag\.example\.com/);
});

test('SOL_HOLDERS_RPC is used when --rpc is absent', async () => {
  const c = capture();
  const mock = createMockRpc({ getAccountInfo: mintAccount() });
  await run([USDC], c.io, depsFor(mock));
  assert.equal(mock.calls[0].url, RPC_ENV);
});

test('a missing mint account exits 1', async () => {
  const c = capture();
  const mock = createMockRpc({ getAccountInfo: { value: null } });
  assert.equal(await run([USDC], c.io, depsFor(mock)), 1);
  assert.match(c.err(), /error: Mint account not found/);
  assert.equal(c.out(), '');
});

test('an RPC failure exits 1 and never prints the URL', async () => {
  const c = capture();
  const mock = createMockRpc({ getAccountInfo: () => httpError(500) });
  assert.equal(await run([USDC], c.io, depsFor(mock)), 1);
  assert.match(c.err(), /error: rpc\.example\.com returned HTTP 500/);
  assert.ok(!c.err().includes('secret'));
});