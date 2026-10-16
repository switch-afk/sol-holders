'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { run, parseArgs, UsageError } = require('../src/cli');
const { createMockRpc, httpError, rpcError } = require('./helpers/mock-rpc');
const pkg = require('../package.json');

const USDC = 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v';
const TOKEN_PROGRAM = 'TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA';
const FREEZE = 'FreezeAuthority1111111111111111111111111111';
const RPC_ENV = 'https://rpc.example.com/?api-key=secret';
const ACCOUNT_A = 'HolderAccountAAAA1111111111111111111111111111';
const ACCOUNT_B = 'HolderAccountBBBB1111111111111111111111111111';
const OWNER_A = 'OwnerWalletAAAA1111111111111111111111111111';
const OWNER_B = 'OwnerWalletBBBB1111111111111111111111111111';
const OWNERS = { [ACCOUNT_A]: OWNER_A, [ACCOUNT_B]: OWNER_B };

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
            supply: '1000000000000',
            decimals: 6,
            mintAuthority: null,
            freezeAuthority: FREEZE,
          },
        },
      },
    },
  };
}

function largestAccounts() {
  return {
    value: [
      { address: ACCOUNT_A, amount: '250000000000', decimals: 6, uiAmount: 250000, uiAmountString: '250000' },
      { address: ACCOUNT_B, amount: '100000000000', decimals: 6, uiAmount: 100000, uiAmountString: '100000' },
    ],
  };
}

function tokenAccount(owner) {
  return {
    owner: TOKEN_PROGRAM,
    data: { program: 'spl-token', parsed: { type: 'account', info: { owner, mint: USDC } } },
  };
}

function mockRpc(overrides = {}) {
  return createMockRpc({
    getAccountInfo: mintAccount(),
    getTokenLargestAccounts: largestAccounts(),
    getMultipleAccounts: (params) => ({
      value: params[0].map((address) => tokenAccount(OWNERS[address])),
    }),
    ...overrides,
  });
}

function depsFor(mock, env = { SOL_HOLDERS_RPC: RPC_ENV }) {
  return { fetch: mock.fetch, env };
}

test('parseArgs defaults', () => {
  assert.deepEqual(parseArgs([]), {
    mint: null,
    rpc: null,
    limit: 20,
    minBp: 0,
    owners: true,
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

test('parseArgs reads --limit, --min and --no-owners', () => {
  const opts = parseArgs([USDC, '--limit', '5', '--min=0.5', '--no-owners']);
  assert.equal(opts.limit, 5);
  assert.equal(opts.minBp, 50);
  assert.equal(opts.owners, false);
  assert.equal(parseArgs(['--min', '2.5']).minBp, 250);
  assert.equal(parseArgs(['--min', '100']).minBp, 10000);
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

test('parseArgs rejects invalid --limit and --min values', () => {
  assert.throws(() => parseArgs(['--limit']), /--limit requires a number/);
  assert.throws(() => parseArgs(['--limit', '0']), /1 to 20/);
  assert.throws(() => parseArgs(['--limit=21']), /1 to 20/);
  assert.throws(() => parseArgs(['--limit', 'abc']), /1 to 20/);
  assert.throws(() => parseArgs(['--min']), /--min requires a percentage/);
  assert.throws(() => parseArgs(['--min', '101']), /0 to 100/);
  assert.throws(() => parseArgs(['--min=1.234']), /0 to 100/);
  assert.throws(() => parseArgs(['--min', 'abc']), /0 to 100/);
});

test('--help prints usage and exits 0', async () => {
  const c = capture();
  assert.equal(await run(['--help'], c.io), 0);
  assert.match(c.out(), /Usage:/);
  assert.match(c.out(), /--rpc <url>/);
  assert.match(c.out(), /--limit <n>/);
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
  const mock = mockRpc();
  assert.equal(await run(['not-a-mint'], c.io, depsFor(mock)), 2);
  assert.match(c.err(), /invalid mint address/);
  assert.equal(mock.calls.length, 0);
});

test('prints mint details and top holders by owner as text', async () => {
  const c = capture();
  const mock = mockRpc();
  assert.equal(await run([USDC], c.io, depsFor(mock)), 0);
  assert.match(c.out(), new RegExp(`Mint:\\s+${USDC}`));
  assert.match(c.out(), /Token program:\s+Token \(TokenkegQ/);
  assert.match(c.out(), /Decimals:\s+6/);
  assert.match(c.out(), /Supply:\s+1,000,000/);
  assert.match(c.out(), /Mint authority:\s+none/);
  assert.match(c.out(), new RegExp(`Freeze authority:\\s+${FREEZE}`));
  assert.match(c.out(), /RPC:\s+rpc\.example\.com/);
  assert.match(c.out(), /Top holders \(by owner\)/);
  assert.match(c.out(), new RegExp(`${OWNER_A}\\s+250,000\\s+25\\.00%`));
  assert.match(c.out(), new RegExp(`${OWNER_B}\\s+100,000\\s+10\\.00%`));
  assert.match(c.out(), /Top 2 hold 35\.00% of supply/);
  assert.ok(!c.out().includes('secret'));
});

test('--json prints mint info with holders and owners', async () => {
  const c = capture();
  const mock = mockRpc();
  assert.equal(await run([USDC, '--json'], c.io, depsFor(mock)), 0);
  assert.deepEqual(JSON.parse(c.out()), {
    mint: USDC,
    program: 'spl-token',
    programName: 'Token',
    programId: TOKEN_PROGRAM,
    decimals: 6,
    supply: { raw: '1000000000000', ui: '1000000' },
    mintAuthority: null,
    freezeAuthority: FREEZE,
    holders: [
      {
        rank: 1,
        tokenAccount: ACCOUNT_A,
        owner: OWNER_A,
        amount: { raw: '250000000000', ui: '250000' },
        percent: 25,
      },
      {
        rank: 2,
        tokenAccount: ACCOUNT_B,
        owner: OWNER_B,
        amount: { raw: '100000000000', ui: '100000' },
        percent: 10,
      },
    ],
    topHoldersPercent: 35,
  });
});

test('asks for the mint, then the largest accounts, then their owners', async () => {
  const c = capture();
  const mock = mockRpc();
  await run([USDC], c.io, depsFor(mock));
  assert.deepEqual(
    mock.calls.map((call) => call.method),
    ['getAccountInfo', 'getTokenLargestAccounts', 'getMultipleAccounts']
  );
});

test('--limit trims the table and the owner lookup', async () => {
  const c = capture();
  const mock = mockRpc();
  assert.equal(await run([USDC, '--limit', '1'], c.io, depsFor(mock)), 0);
  assert.ok(c.out().includes(OWNER_A));
  assert.ok(!c.out().includes(OWNER_B));
  assert.match(c.out(), /Top 1 hold 25\.00% of supply/);
  assert.deepEqual(mock.calls[2].params[0], [ACCOUNT_A]);
});

test('--min hides holders below the threshold', async () => {
  const c = capture();
  const mock = mockRpc();
  assert.equal(await run([USDC, '--min', '20'], c.io, depsFor(mock)), 0);
  assert.ok(c.out().includes(OWNER_A));
  assert.ok(!c.out().includes(OWNER_B));
  assert.match(c.out(), /Top 1 hold 25\.00% of supply/);
});

test('--min that hides everyone says so and skips the owner lookup', async () => {
  const c = capture();
  const mock = mockRpc();
  assert.equal(await run([USDC, '--min', '50'], c.io, depsFor(mock)), 0);
  assert.match(c.out(), /No holders match the filters\./);
  assert.deepEqual(
    mock.calls.map((call) => call.method),
    ['getAccountInfo', 'getTokenLargestAccounts']
  );
});

test('--no-owners skips the owner lookup and shows token accounts', async () => {
  const text = capture();
  const mock = mockRpc();
  assert.equal(await run([USDC, '--no-owners'], text.io, depsFor(mock)), 0);
  assert.match(text.out(), /Top holders \(token accounts\)/);
  assert.ok(text.out().includes(ACCOUNT_A));
  assert.ok(!text.out().includes(OWNER_A));
  assert.ok(!mock.calls.some((call) => call.method === 'getMultipleAccounts'));

  const json = capture();
  assert.equal(await run([USDC, '--no-owners', '--json'], json.io, depsFor(mockRpc())), 0);
  assert.equal(JSON.parse(json.out()).holders[0].owner, null);
});

test('a failed owner lookup warns and falls back to token accounts', async () => {
  const c = capture();
  const mock = mockRpc({ getMultipleAccounts: () => httpError(500) });
  assert.equal(await run([USDC], c.io, depsFor(mock)), 0);
  assert.match(c.err(), /warning: could not resolve owners: rpc\.example\.com returned HTTP 500/);
  assert.ok(!c.err().includes('secret'));
  assert.match(c.out(), /Top holders \(token accounts\)/);
  assert.ok(c.out().includes(ACCOUNT_A));
});

test('--rpc beats SOL_HOLDERS_RPC', async () => {
  const c = capture();
  const mock = mockRpc();
  await run([USDC, '--rpc', 'https://flag.example.com'], c.io, depsFor(mock));
  assert.equal(mock.calls[0].url, 'https://flag.example.com');
  assert.match(c.out(), /RPC:\s+flag\.example\.com/);
});

test('SOL_HOLDERS_RPC is used when --rpc is absent', async () => {
  const c = capture();
  const mock = mockRpc();
  await run([USDC], c.io, depsFor(mock));
  assert.equal(mock.calls[0].url, RPC_ENV);
});

test('a missing mint account exits 1 before asking for holders', async () => {
  const c = capture();
  const mock = mockRpc({ getAccountInfo: { value: null } });
  assert.equal(await run([USDC], c.io, depsFor(mock)), 1);
  assert.match(c.err(), /error: Mint account not found/);
  assert.equal(c.out(), '');
  assert.equal(mock.calls.length, 1);
});

test('an RPC failure exits 1 and never prints the URL', async () => {
  const c = capture();
  const mock = mockRpc({ getAccountInfo: () => httpError(500) });
  assert.equal(await run([USDC], c.io, depsFor(mock)), 1);
  assert.match(c.err(), /error: rpc\.example\.com returned HTTP 500/);
  assert.ok(!c.err().includes('secret'));
});

test('a blocked holders lookup exits 1 with a hint about --rpc', async () => {
  const c = capture();
  const mock = mockRpc({ getTokenLargestAccounts: () => rpcError(-32010, 'Too many accounts') });
  assert.equal(await run([USDC], c.io, depsFor(mock)), 1);
  assert.match(c.err(), /error: RPC error from rpc\.example\.com: Too many accounts/);
  assert.match(c.err(), /Try --rpc with your own endpoint/);
  assert.equal(c.out(), '');
});

test('a failing holders lookup without an RPC-level error has no hint', async () => {
  const c = capture();
  const mock = mockRpc({ getTokenLargestAccounts: () => httpError(500) });
  assert.equal(await run([USDC], c.io, depsFor(mock)), 1);
  assert.match(c.err(), /error: rpc\.example\.com returned HTTP 500/);
  assert.ok(!c.err().includes('Try --rpc'));
});