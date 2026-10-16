'use strict';

const { formatUnits } = require('./format');

class HoldersError extends Error {
  constructor(message) {
    super(message);
    this.name = 'HoldersError';
  }
}

// Share of supply as a number with two decimals, using integer math.
function percentOf(raw, supply) {
  if (supply === 0n) return 0;
  const basisPoints = (raw * 20000n + supply) / (2n * supply);
  return Number(basisPoints) / 100;
}

async function fetchHolders(client, info) {
  const result = await client.call('getTokenLargestAccounts', [
    info.mint,
    { commitment: 'finalized' },
  ]);

  const entries = result && result.value;
  if (!Array.isArray(entries)) {
    throw new HoldersError('RPC returned unexpected holder data.');
  }

  const supply = BigInt(info.supply.raw);
  let total = 0n;

  const accounts = entries.map((entry, index) => {
    if (
      !entry ||
      typeof entry.address !== 'string' ||
      typeof entry.amount !== 'string' ||
      !/^\d+$/.test(entry.amount)
    ) {
      throw new HoldersError('RPC returned unexpected holder data.');
    }

    const amount = BigInt(entry.amount);
    total += amount;

    return {
      rank: index + 1,
      tokenAccount: entry.address,
      owner: null,
      amount: { raw: entry.amount, ui: formatUnits(entry.amount, info.decimals) },
      percent: percentOf(amount, supply),
    };
  });

  return { accounts, percent: percentOf(total, supply) };
}

// Applies --min (in basis points, so 1% is 100) and --limit. Ranks keep their original numbers.
function selectHolders(holders, info, { limit = holders.accounts.length, minBp = 0 } = {}) {
  const supply = BigInt(info.supply.raw);
  const accounts = holders.accounts
    .filter((holder) => BigInt(holder.amount.raw) * 10000n >= BigInt(minBp) * supply)
    .slice(0, limit);

  const total = accounts.reduce((sum, holder) => sum + BigInt(holder.amount.raw), 0n);

  return {
    accounts,
    percent: percentOf(total, supply),
    total: holders.accounts.length,
  };
}

// Looks up the wallet that owns each token account. One RPC call for the whole list.
async function resolveOwners(client, accounts) {
  if (accounts.length === 0) return accounts;

  const result = await client.call('getMultipleAccounts', [
    accounts.map((account) => account.tokenAccount),
    { encoding: 'jsonParsed', commitment: 'finalized' },
  ]);

  const values = result && result.value;
  if (!Array.isArray(values) || values.length !== accounts.length) {
    throw new HoldersError('RPC returned unexpected owner data.');
  }

  return accounts.map((account, index) => {
    const parsed = values[index] && values[index].data && values[index].data.parsed;
    const owner =
      parsed && parsed.info && typeof parsed.info.owner === 'string' ? parsed.info.owner : null;
    return { ...account, owner };
  });
}

module.exports = { HoldersError, percentOf, fetchHolders, selectHolders, resolveOwners };