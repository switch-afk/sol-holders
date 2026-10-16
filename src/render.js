'use strict';

const { formatSupply } = require('./format');

function renderMint(info, host) {
  const rows = [
    ['Mint', info.mint],
    ['Token program', `${info.programName} (${info.programId})`],
    ['Decimals', String(info.decimals)],
    ['Supply', formatSupply(info.supply.raw, info.decimals)],
    ['Mint authority', info.mintAuthority || 'none (supply is fixed)'],
    ['Freeze authority', info.freezeAuthority || 'none'],
    ['RPC', host],
  ];

  const width = Math.max(...rows.map(([label]) => label.length)) + 2;
  return `${rows.map(([label, value]) => `${`${label}:`.padEnd(width)}${value}`).join('\n')}\n`;
}

module.exports = { renderMint };