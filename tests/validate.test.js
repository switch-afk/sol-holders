'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { validateAddress } = require('../src/validate');

test('accepts the USDC mint', () => {
  const r = validateAddress('EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v');
  assert.equal(r.ok, true);
});

test('accepts wrapped SOL', () => {
  const r = validateAddress('So11111111111111111111111111111111111111112');
  assert.equal(r.ok, true);
});

test('accepts the system program (32 ones, all-zero bytes)', () => {
  const r = validateAddress('11111111111111111111111111111111');
  assert.equal(r.ok, true);
});

test('rejects empty and non-string input', () => {
  assert.equal(validateAddress('').ok, false);
  assert.equal(validateAddress(undefined).ok, false);
  assert.equal(validateAddress(42).ok, false);
});

test('rejects too short and too long', () => {
  assert.equal(validateAddress('abc').ok, false);
  assert.equal(validateAddress('A'.repeat(45)).ok, false);
});

test('rejects characters outside the base58 alphabet', () => {
  const r = validateAddress('EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt10');
  assert.equal(r.ok, false);
  assert.match(r.error, /invalid base58 character/);
});

test('rejects strings that do not decode to 32 bytes', () => {
  assert.equal(validateAddress('z'.repeat(44)).ok, false);
  assert.equal(validateAddress('2'.repeat(32)).ok, false);
});