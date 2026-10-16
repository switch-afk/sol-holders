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
      amount: { raw: entry.amount, ui: formatUnits(entry.amount, info.decimals) },
      percent: percentOf(amount, supply),
    };
  });

  return { accounts, percent: percentOf(total, supply) };
}

module.exports = { HoldersError, percentOf, fetchHolders };