'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { createRpcClient } = require('../src/rpc');
const { HoldersError, fetchHolders } = require('../src/holders');
const { createMockRpc } = require('./helpers/mock-rpc');

const USDC = 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v';

function infoFor(raw, decimals) {
  return { mint: USDC, decimals, supply: { raw } };
}

function clientFor(result) {
  const mock = createMockRpc({ getTokenLargestAccounts: result });
  return { mock, client: createRpcClient({ url: 'https://rpc.example.com', fetch: mock.fetch }) };
}

test('fetchHolders ranks accounts and computes the share of supply', async () => {
  const { client } = clientFor({
    value: [
      { address: 'AccA', amount: '250000', decimals: 6 },
      { address: 'AccB', amount: '100000', decimals: 6 },
    ],
  });
  const holders = await fetchHolders(client, infoFor('1000000', 6));
  assert.deepEqual(holders.accounts, [
    { rank: 1, tokenAccount: 'AccA', amount: { raw: '250000', ui: '0.25' }, percent: 25 },
    { rank: 2, tokenAccount: 'AccB', amount: { raw: '100000', ui: '0.1' }, percent: 10 },
  ]);
  assert.equal(holders.percent, 35);
});

test('fetchHolders asks for the mint with finalized commitment', async () => {
  const { mock, client } = clientFor({ value: [] });
  await fetchHolders(client, infoFor('1000000', 6));
  assert.equal(mock.calls[0].method, 'getTokenLargestAccounts');
  assert.deepEqual(mock.calls[0].params, [USDC, { commitment: 'finalized' }]);
});

test('fetchHolders rounds percentages to two decimals', async () => {
  const { client } = clientFor({
    value: [
      { address: 'AccA', amount: '1' },
      { address: 'AccB', amount: '2' },
    ],
  });
  const holders = await fetchHolders(client, infoFor('3', 0));
  assert.equal(holders.accounts[0].percent, 33.33);
  assert.equal(holders.accounts[1].percent, 66.67);
  assert.equal(holders.percent, 100);
});

test('fetchHolders handles an empty list', async () => {
  const { client } = clientFor({ value: [] });
  const holders = await fetchHolders(client, infoFor('1000000', 6));
  assert.deepEqual(holders, { accounts: [], percent: 0 });
});

test('fetchHolders does not divide by a zero supply', async () => {
  const { client } = clientFor({ value: [{ address: 'AccA', amount: '0' }] });
  const holders = await fetchHolders(client, infoFor('0', 6));
  assert.equal(holders.accounts[0].percent, 0);
  assert.equal(holders.percent, 0);
});

test('fetchHolders rejects a non-array result', async () => {
  const { client } = clientFor({ value: null });
  await assert.rejects(fetchHolders(client, infoFor('1000000', 6)), (err) => {
    assert.ok(err instanceof HoldersError);
    assert.match(err.message, /unexpected holder data/);
    return true;
  });
});

test('fetchHolders rejects malformed entries', async () => {
  const { client } = clientFor({ value: [{ address: 'AccA', amount: 'lots' }] });
  await assert.rejects(fetchHolders(client, infoFor('1000000', 6)), HoldersError);
});