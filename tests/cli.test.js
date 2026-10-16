'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { run, parseArgs, UsageError } = require('../src/cli');
const pkg = require('../package.json');

const USDC = 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v';

function capture() {
  let out = '';
  let err = '';
  return {
    io: {
      stdout: { write: (s) => { out += s; } },
      stderr: { write: (s) => { err += s; } },
    },
    out: () => out,
    err: () => err,
  };
}

test('parseArgs defaults', () => {
  assert.deepEqual(parseArgs([]), {
    mint: null,
    json: false,
    help: false,
    version: false,
  });
});

test('parseArgs reads mint and flags', () => {
  const opts = parseArgs([USDC, '--json']);
  assert.equal(opts.mint, USDC);
  assert.equal(opts.json, true);
});

test('parseArgs rejects unknown options and extra arguments', () => {
  assert.throws(() => parseArgs(['--nope']), UsageError);
  assert.throws(() => parseArgs([USDC, 'another']), UsageError);
});

test('--help prints usage and exits 0', () => {
  const c = capture();
  assert.equal(run(['--help'], c.io), 0);
  assert.match(c.out(), /Usage:/);
});

test('--version prints the package version', () => {
  const c = capture();
  assert.equal(run(['--version'], c.io), 0);
  assert.equal(c.out().trim(), pkg.version);
});

test('missing mint exits 2 with usage on stderr', () => {
  const c = capture();
  assert.equal(run([], c.io), 2);
  assert.match(c.err(), /missing token mint address/);
  assert.equal(c.out(), '');
});

test('unknown option exits 2', () => {
  const c = capture();
  assert.equal(run(['--nope'], c.io), 2);
  assert.match(c.err(), /unknown option: --nope/);
});

test('invalid mint exits 2', () => {
  const c = capture();
  assert.equal(run(['not-a-mint'], c.io), 2);
  assert.match(c.err(), /invalid mint address/);
});

test('valid mint prints text and exits 0', () => {
  const c = capture();
  assert.equal(run([USDC], c.io), 0);
  assert.equal(c.out(), `Mint: ${USDC}\n`);
});

test('valid mint with --json prints parseable JSON', () => {
  const c = capture();
  assert.equal(run([USDC, '--json'], c.io), 0);
  assert.deepEqual(JSON.parse(c.out()), { mint: USDC });
});