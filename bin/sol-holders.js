#!/usr/bin/env node
'use strict';

const { run } = require('../src/cli');

run(process.argv.slice(2)).then(
  (code) => {
    process.exitCode = code;
  },
  (err) => {
    process.stderr.write(`error: ${err && err.message ? err.message : String(err)}\n`);
    process.exitCode = 1;
  }
);