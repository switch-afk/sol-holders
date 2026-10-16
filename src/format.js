'use strict';

// Converts a raw integer amount (string or bigint) to a decimal string without floats.
function formatUnits(raw, decimals) {
  const value = BigInt(raw);
  const base = 10n ** BigInt(decimals);
  const whole = value / base;
  const fraction = decimals > 0
    ? (value % base).toString().padStart(decimals, '0').replace(/0+$/, '')
    : '';
  return fraction ? `${whole}.${fraction}` : `${whole}`;
}

function withCommas(digits) {
  return digits.replace(/\B(?=(\d{3})+(?!\d))/g, ',');
}

// Same as formatUnits, with thousands separators for display.
function formatSupply(raw, decimals) {
  const [whole, fraction] = formatUnits(raw, decimals).split('.');
  return fraction ? `${withCommas(whole)}.${fraction}` : withCommas(whole);
}

module.exports = { formatUnits, formatSupply };