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

function renderHolders(holders, decimals) {
  if (holders.accounts.length === 0) {
    return holders.total > 0
      ? 'No holders match the filters.\n'
      : 'No token accounts hold this mint.\n';
  }

  const showOwners = holders.accounts.some((h) => h.owner);
  const header = ['#', showOwners ? 'Owner' : 'Token account', 'Amount', '% of supply'];
  const rows = holders.accounts.map((h) => [
    String(h.rank),
    showOwners ? h.owner || 'unknown' : h.tokenAccount,
    formatSupply(h.amount.raw, decimals),
    `${h.percent.toFixed(2)}%`,
  ]);

  const widths = header.map((title, col) =>
    Math.max(title.length, ...rows.map((row) => row[col].length))
  );

  const line = (cells) =>
    [
      cells[0].padStart(widths[0]),
      cells[1].padEnd(widths[1]),
      cells[2].padStart(widths[2]),
      cells[3].padStart(widths[3]),
    ].join('  ');

  return `${[
    showOwners ? 'Top holders (by owner)' : 'Top holders (token accounts)',
    line(header),
    ...rows.map(line),
    `Top ${rows.length} hold ${holders.percent.toFixed(2)}% of supply`,
  ].join('\n')}\n`;
}

module.exports = { renderMint, renderHolders };