'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { formatUnits, formatSupply } = require('../src/format');

test('formatUnits drops trailing zeros and the decimal point', () => {
  assert.equal(formatUnits('1500000', 6), '1.5');
  assert.equal(formatUnits('1000000', 6), '1');
  assert.equal(formatUnits('0', 6), '0');
});

test('formatUnits keeps leading fractional zeros', () => {
  assert.equal(formatUnits('1', 9), '0.000000001');
  assert.equal(formatUnits('1050000', 6), '1.05');
});

test('formatUnits handles zero decimals and u64 max without precision loss', () => {
  assert.equal(formatUnits('123', 0), '123');
  assert.equal(formatUnits('18446744073709551615', 9), '18446744073.709551615');
});

test('formatSupply adds thousands separators', () => {
  assert.equal(formatSupply('9876543210123', 6), '9,876,543.210123');
  assert.equal(formatSupply('1000', 0), '1,000');
  assert.equal(formatSupply('999', 0), '999');
  assert.equal(formatSupply('0', 6), '0');
});