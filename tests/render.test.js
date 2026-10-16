'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { renderHolders } = require('../src/render');

const holders = {
  accounts: [
    {
      rank: 1,
      tokenAccount: 'HolderAccountAAAA',
      amount: { raw: '250000000000', ui: '250000' },
      percent: 25,
    },
    {
      rank: 2,
      tokenAccount: 'HolderAccountBBBB',
      amount: { raw: '100000000000', ui: '100000' },
      percent: 10,
    },
  ],
  percent: 35,
};

test('renderHolders prints a header, one row per account and a total', () => {
  const out = renderHolders(holders, 6);
  const lines = out.trimEnd().split('\n');
  assert.equal(lines[0], 'Top holders (token accounts)');
  assert.match(lines[1], /^#\s+Token account\s+Amount\s+% of supply$/);
  assert.match(lines[2], /^1\s+HolderAccountAAAA\s+250,000\s+25\.00%$/);
  assert.match(lines[3], /^2\s+HolderAccountBBBB\s+100,000\s+10\.00%$/);
  assert.equal(lines[4], 'Top 2 hold 35.00% of supply');
});

test('renderHolders right-aligns the amount and percent columns', () => {
  const lines = renderHolders(holders, 6).trimEnd().split('\n');
  assert.equal(lines[2].length, lines[3].length);
  assert.ok(lines[3].includes('100,000'));
  assert.ok(lines[2].endsWith('25.00%'));
});

test('renderHolders explains an empty list', () => {
  assert.equal(
    renderHolders({ accounts: [], percent: 0 }, 6),
    'No token accounts hold this mint.\n'
  );
});

test('renderHolders shows owners when they are resolved', () => {
  const withOwners = {
    ...holders,
    accounts: holders.accounts.map((h, i) => ({ ...h, owner: `OwnerWallet${i === 0 ? 'AAAA' : 'BBBB'}` })),
  };
  const lines = renderHolders(withOwners, 6).trimEnd().split('\n');
  assert.equal(lines[0], 'Top holders (by owner)');
  assert.match(lines[1], /^#\s+Owner\s+Amount\s+% of supply$/);
  assert.match(lines[2], /^1\s+OwnerWalletAAAA\s+250,000\s+25\.00%$/);
  assert.ok(!lines[2].includes('HolderAccountAAAA'));
});

test('renderHolders marks unresolved owners as unknown', () => {
  const partial = {
    ...holders,
    accounts: [
      { ...holders.accounts[0], owner: 'OwnerWalletAAAA' },
      { ...holders.accounts[1], owner: null },
    ],
  };
  const lines = renderHolders(partial, 6).trimEnd().split('\n');
  assert.match(lines[3], /^2\s+unknown\s+100,000\s+10\.00%$/);
});

test('renderHolders explains when the filters hide every holder', () => {
  assert.equal(
    renderHolders({ accounts: [], percent: 0, total: 20 }, 6),
    'No holders match the filters.\n'
  );
});