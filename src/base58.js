'use strict';

const ALPHABET = '123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz';

function decodeBase58(str) {
  if (typeof str !== 'string' || str.length === 0) {
    throw new Error('empty string');
  }

  const bytes = [];
  for (const ch of str) {
    const value = ALPHABET.indexOf(ch);
    if (value === -1) {
      throw new Error(`invalid base58 character "${ch}"`);
    }
    let carry = value;
    for (let i = 0; i < bytes.length; i++) {
      carry += bytes[i] * 58;
      bytes[i] = carry & 0xff;
      carry >>= 8;
    }
    while (carry > 0) {
      bytes.push(carry & 0xff);
      carry >>= 8;
    }
  }

  for (const ch of str) {
    if (ch !== '1') break;
    bytes.push(0);
  }

  return Uint8Array.from(bytes.reverse());
}

module.exports = { decodeBase58 };