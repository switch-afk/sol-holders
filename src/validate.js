'use strict';

const { decodeBase58 } = require('./base58');

function validateAddress(input) {
  if (typeof input !== 'string' || input.length === 0) {
    return { ok: false, error: 'address is empty' };
  }
  if (input.length < 32 || input.length > 44) {
    return { ok: false, error: 'address must be 32 to 44 characters long' };
  }

  let bytes;
  try {
    bytes = decodeBase58(input);
  } catch (err) {
    return { ok: false, error: err.message };
  }

  if (bytes.length !== 32) {
    return { ok: false, error: 'address does not decode to 32 bytes' };
  }

  return { ok: true, value: input };
}

module.exports = { validateAddress };