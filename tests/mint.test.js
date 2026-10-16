'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { createRpcClient } = require('../src/rpc');
const { MintError, fetchMint } = require('../src/mint');
const { createMockRpc } = require('./helpers/mock-rpc');

const USDC = 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v';
const TOKEN_PROGRAM = 'TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA';
const TOKEN_2022 = 'TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb';

function mintAccount({ owner = TOKEN_PROGRAM, type = 'mint', info = {}, data } = {}) {
  return {
    value: {
      owner,
      data: data || {
        program: 'spl-token',
        parsed: {
          type,
          info: {
            supply: '9876543210123',
            decimals: 6,
            mintAuthority: null,
            freezeAuthority: null,
            ...info,
          },
        },
      },
    },
  };
}

function clientFor(account) {
  const mock = createMockRpc({ getAccountInfo: account });
  return { mock, client: createRpcClient({ url: 'https://rpc.example.com', fetch: mock.fetch }) };
}

async function assertMintError(promise, pattern) {
  await assert.rejects(promise, (err) => {
    assert.ok(err instanceof MintError);
    assert.match(err.message, pattern);
    return true;
  });
}

test('fetchMint returns decoded mint info and asks for jsonParsed data', async () => {
  const { mock, client } = clientFor(mintAccount());
  const info = await fetchMint(client, USDC);
  assert.deepEqual(info, {
    mint: USDC,
    program: 'spl-token',
    programName: 'Token',
    programId: TOKEN_PROGRAM,
    decimals: 6,
    supply: { raw: '9876543210123', ui: '9876543.210123' },
    mintAuthority: null,
    freezeAuthority: null,
  });
  assert.equal(mock.calls[0].method, 'getAccountInfo');
  assert.deepEqual(mock.calls[0].params, [USDC, { encoding: 'jsonParsed', commitment: 'finalized' }]);
});

test('fetchMint recognises Token-2022 mints', async () => {
  const { client } = clientFor(mintAccount({ owner: TOKEN_2022 }));
  const info = await fetchMint(client, USDC);
  assert.equal(info.program, 'spl-token-2022');
  assert.equal(info.programName, 'Token-2022');
  assert.equal(info.programId, TOKEN_2022);
});

test('fetchMint keeps authorities when they are set', async () => {
  const { client } = clientFor(
    mintAccount({ info: { mintAuthority: 'MintAuth111', freezeAuthority: 'FreezeAuth111' } })
  );
  const info = await fetchMint(client, USDC);
  assert.equal(info.mintAuthority, 'MintAuth111');
  assert.equal(info.freezeAuthority, 'FreezeAuth111');
});

test('fetchMint reports a missing account', async () => {
  const { client } = clientFor({ value: null });
  await assertMintError(fetchMint(client, USDC), /Mint account not found/);
});

test('fetchMint rejects accounts owned by another program', async () => {
  const owner = 'NativeLoader1111111111111111111111111111111';
  const { client } = clientFor(mintAccount({ owner }));
  await assertMintError(fetchMint(client, USDC), /Not an SPL token mint/);
});

test('fetchMint rejects token accounts that are not mints', async () => {
  const { client } = clientFor(mintAccount({ type: 'account' }));
  await assertMintError(fetchMint(client, USDC), /not a token mint/);
});

test('fetchMint rejects data the RPC could not parse', async () => {
  const { client } = clientFor(mintAccount({ data: ['AQID', 'base64'] }));
  await assertMintError(fetchMint(client, USDC), /not a token mint/);
});

test('fetchMint rejects a malformed supply', async () => {
  const { client } = clientFor(mintAccount({ info: { supply: 'abc' } }));
  await assertMintError(fetchMint(client, USDC), /unexpected mint data/);
});

test('fetchMint rejects malformed decimals', async () => {
  const { client } = clientFor(mintAccount({ info: { decimals: 'six' } }));
  await assertMintError(fetchMint(client, USDC), /unexpected mint data/);
});