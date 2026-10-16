'use strict';

const { formatUnits } = require('./format');

const TOKEN_PROGRAMS = {
  TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA: { id: 'spl-token', name: 'Token' },
  TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb: { id: 'spl-token-2022', name: 'Token-2022' },
};

class MintError extends Error {
  constructor(message) {
    super(message);
    this.name = 'MintError';
  }
}

async function fetchMint(client, mint) {
  const result = await client.call('getAccountInfo', [
    mint,
    { encoding: 'jsonParsed', commitment: 'finalized' },
  ]);

  const account = result && result.value;
  if (!account) {
    throw new MintError('Mint account not found. Check the address and the network.');
  }

  const program = TOKEN_PROGRAMS[account.owner];
  if (!program) {
    throw new MintError(`Not an SPL token mint (account is owned by ${account.owner}).`);
  }

  const parsed = account.data && account.data.parsed;
  if (!parsed || parsed.type !== 'mint' || !parsed.info) {
    throw new MintError('Account is not a token mint.');
  }

  const { supply, decimals, mintAuthority, freezeAuthority } = parsed.info;
  if (
    typeof supply !== 'string' ||
    !/^\d+$/.test(supply) ||
    !Number.isInteger(decimals) ||
    decimals < 0 ||
    decimals > 255
  ) {
    throw new MintError('RPC returned unexpected mint data.');
  }

  return {
    mint,
    program: program.id,
    programName: program.name,
    programId: account.owner,
    decimals,
    supply: { raw: supply, ui: formatUnits(supply, decimals) },
    mintAuthority: mintAuthority || null,
    freezeAuthority: freezeAuthority || null,
  };
}

module.exports = { TOKEN_PROGRAMS, MintError, fetchMint };