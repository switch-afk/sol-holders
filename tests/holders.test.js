'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { createRpcClient } = require('../src/rpc');
const { HoldersError, fetchHolders, selectHolders, resolveOwners } = require('../src/holders');
const { createMockRpc } = require('./helpers/mock-rpc');

const USDC = 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v';

function infoFor(raw, decimals) {
  return { mint: USDC, decimals, supply: { raw } };
}

function setup(handlers) {
  const mock = createMockRpc(handlers);
  return { mock, client: createRpcClient({ url: 'https://rpc.example.com', fetch: mock.fetch }) };
}

function holder(rank, tokenAccount, raw, percent) {
  return { rank, tokenAccount, owner: null, amount: { raw, ui: raw }, percent };
}

test('fetchHolders ranks accounts and computes the share of supply', async () => {
  const { client } = setup({
    getTokenLargestAccounts: {
      value: [
        { address: 'AccA', amount: '250000', decimals: 6 },
        { address: 'AccB', amount: '100000', decimals: 6 },
      ],
    },
  });
  const holders = await fetchHolders(client, infoFor('1000000', 6));
  assert.deepEqual(holders.accounts, [
    { rank: 1, tokenAccount: 'AccA', owner: null, amount: { raw: '250000', ui: '0.25' }, percent: 25 },
    { rank: 2, tokenAccount: 'AccB', owner: null, amount: { raw: '100000', ui: '0.1' }, percent: 10 },
  ]);
  assert.equal(holders.percent, 35);
});

test('fetchHolders asks for the mint with finalized commitment', async () => {
  const { mock, client } = setup({ getTokenLargestAccounts: { value: [] } });
  await fetchHolders(client, infoFor('1000000', 6));
  assert.equal(mock.calls[0].method, 'getTokenLargestAccounts');
  assert.deepEqual(mock.calls[0].params, [USDC, { commitment: 'finalized' }]);
});

test('fetchHolders rounds percentages to two decimals', async () => {
  const { client } = setup({
    getTokenLargestAccounts: {
      value: [
        { address: 'AccA', amount: '1' },
        { address: 'AccB', amount: '2' },
      ],
    },
  });
  const holders = await fetchHolders(client, infoFor('3', 0));
  assert.equal(holders.accounts[0].percent, 33.33);
  assert.equal(holders.accounts[1].percent, 66.67);
  assert.equal(holders.percent, 100);
});

test('fetchHolders handles an empty list', async () => {
  const { client } = setup({ getTokenLargestAccounts: { value: [] } });
  const holders = await fetchHolders(client, infoFor('1000000', 6));
  assert.deepEqual(holders, { accounts: [], percent: 0 });
});

test('fetchHolders does not divide by a zero supply', async () => {
  const { client } = setup({
    getTokenLargestAccounts: { value: [{ address: 'AccA', amount: '0' }] },
  });
  const holders = await fetchHolders(client, infoFor('0', 6));
  assert.equal(holders.accounts[0].percent, 0);
  assert.equal(holders.percent, 0);
});

test('fetchHolders rejects a non-array result', async () => {
  const { client } = setup({ getTokenLargestAccounts: { value: null } });
  await assert.rejects(fetchHolders(client, infoFor('1000000', 6)), (err) => {
    assert.ok(err instanceof HoldersError);
    assert.match(err.message, /unexpected holder data/);
    return true;
  });
});

test('fetchHolders rejects malformed entries', async () => {
  const { client } = setup({
    getTokenLargestAccounts: { value: [{ address: 'AccA', amount: 'lots' }] },
  });
  await assert.rejects(fetchHolders(client, infoFor('1000000', 6)), HoldersError);
});

const fetched = {
  accounts: [
    holder(1, 'AccA', '250000', 25),
    holder(2, 'AccB', '100000', 10),
    holder(3, 'AccC', '50000', 5),
  ],
  percent: 40,
};

test('selectHolders applies the limit and keeps original ranks', () => {
  const selected = selectHolders(fetched, infoFor('1000000', 6), { limit: 2 });
  assert.deepEqual(selected.accounts.map((a) => a.rank), [1, 2]);
  assert.equal(selected.percent, 35);
  assert.equal(selected.total, 3);
});

test('selectHolders min filter includes holders exactly at the boundary', () => {
  const info = infoFor('1000000', 6);
  assert.deepEqual(selectHolders(fetched, info, { minBp: 1000 }).accounts.map((a) => a.rank), [1, 2]);
  assert.deepEqual(selectHolders(fetched, info, { minBp: 1001 }).accounts.map((a) => a.rank), [1]);
});

test('selectHolders recomputes the total share for the selected rows only', () => {
  const selected = selectHolders(fetched, infoFor('1000000', 6), { minBp: 2000 });
  assert.equal(selected.accounts.length, 1);
  assert.equal(selected.percent, 25);
});

test('selectHolders reports how many accounts were fetched when the filter hides all', () => {
  const selected = selectHolders(fetched, infoFor('1000000', 6), { minBp: 10000 });
  assert.deepEqual(selected.accounts, []);
  assert.equal(selected.percent, 0);
  assert.equal(selected.total, 3);
});

test('resolveOwners maps parsed owners onto accounts and asks for jsonParsed data', async () => {
  const { mock, client } = setup({
    getMultipleAccounts: {
      value: [
        { owner: 'Tok', data: { parsed: { info: { owner: 'OwnerA' } } } },
        { owner: 'Tok', data: { parsed: { info: { owner: 'OwnerB' } } } },
      ],
    },
  });
  const accounts = await resolveOwners(client, fetched.accounts.slice(0, 2));
  assert.deepEqual(accounts.map((a) => a.owner), ['OwnerA', 'OwnerB']);
  assert.deepEqual(accounts.map((a) => a.rank), [1, 2]);
  assert.equal(mock.calls[0].method, 'getMultipleAccounts');
  assert.deepEqual(mock.calls[0].params, [
    ['AccA', 'AccB'],
    { encoding: 'jsonParsed', commitment: 'finalized' },
  ]);
});

test('resolveOwners leaves owner null for missing or unparsed accounts', async () => {
  const { client } = setup({
    getMultipleAccounts: { value: [null, { owner: 'Tok', data: ['AQID', 'base64'] }] },
  });
  const accounts = await resolveOwners(client, fetched.accounts.slice(0, 2));
  assert.deepEqual(accounts.map((a) => a.owner), [null, null]);
});

test('resolveOwners rejects a result with the wrong length', async () => {
  const { client } = setup({ getMultipleAccounts: { value: [null] } });
  await assert.rejects(resolveOwners(client, fetched.accounts.slice(0, 2)), (err) => {
    assert.ok(err instanceof HoldersError);
    assert.match(err.message, /unexpected owner data/);
    return true;
  });
});

test('resolveOwners makes no call for an empty list', async () => {
  const { mock, client } = setup({ getMultipleAccounts: { value: [] } });
  assert.deepEqual(await resolveOwners(client, []), []);
  assert.equal(mock.calls.length, 0);
});