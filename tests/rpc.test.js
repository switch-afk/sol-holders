'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { DEFAULT_RPC, RpcError, resolveRpcUrl, createRpcClient } = require('../src/rpc');
const {
  createMockRpc,
  httpError,
  rpcError,
  sequence,
  makeResponse,
} = require('./helpers/mock-rpc');

const RPC_URL = 'https://rpc.example.com/?api-key=secret';

function recordSleep() {
  const delays = [];
  const sleep = async (ms) => {
    delays.push(ms);
  };
  return { delays, sleep };
}

test('resolveRpcUrl prefers the flag over the env var', () => {
  const env = { SOL_HOLDERS_RPC: 'https://env.example.com' };
  assert.equal(resolveRpcUrl('https://flag.example.com', env), 'https://flag.example.com');
});

test('resolveRpcUrl falls back to SOL_HOLDERS_RPC, then the default', () => {
  assert.equal(
    resolveRpcUrl(undefined, { SOL_HOLDERS_RPC: 'https://env.example.com' }),
    'https://env.example.com'
  );
  assert.equal(resolveRpcUrl(undefined, {}), DEFAULT_RPC);
});

test('call returns the result and sends a JSON-RPC request', async () => {
  const mock = createMockRpc({ getSlot: 123 });
  const client = createRpcClient({ url: RPC_URL, fetch: mock.fetch });
  const result = await client.call('getSlot', [{ commitment: 'finalized' }]);
  assert.equal(result, 123);
  assert.deepEqual(mock.calls[0], {
    url: RPC_URL,
    method: 'getSlot',
    params: [{ commitment: 'finalized' }],
  });
});

test('request ids increment per call', async () => {
  const ids = [];
  const client = createRpcClient({
    url: RPC_URL,
    fetch: async (url, init) => {
      const request = JSON.parse(init.body);
      ids.push(request.id);
      return makeResponse({ jsonrpc: '2.0', id: request.id, result: null });
    },
  });
  await client.call('a');
  await client.call('b');
  assert.deepEqual(ids, [1, 2]);
});

test('client exposes the hostname only', () => {
  const client = createRpcClient({ url: RPC_URL, fetch: createMockRpc().fetch });
  assert.equal(client.host, 'rpc.example.com');
});

test('retries on 429 and then succeeds', async () => {
  const { sleep } = recordSleep();
  const mock = createMockRpc({ getHealth: sequence([httpError(429), httpError(429), 'ok']) });
  const client = createRpcClient({ url: RPC_URL, fetch: mock.fetch, sleep });
  assert.equal(await client.call('getHealth'), 'ok');
  assert.equal(mock.calls.length, 3);
});

test('backs off exponentially between retries', async () => {
  const { delays, sleep } = recordSleep();
  const mock = createMockRpc({ getHealth: sequence([httpError(429), httpError(429), 'ok']) });
  const client = createRpcClient({ url: RPC_URL, fetch: mock.fetch, sleep });
  await client.call('getHealth');
  assert.deepEqual(delays, [500, 1000]);
});

test('honors the retry-after header', async () => {
  const { delays, sleep } = recordSleep();
  const mock = createMockRpc({
    getHealth: sequence([httpError(429, { 'retry-after': '2' }), 'ok']),
  });
  const client = createRpcClient({ url: RPC_URL, fetch: mock.fetch, sleep });
  await client.call('getHealth');
  assert.deepEqual(delays, [2000]);
});

test('caps retry-after at 10 seconds', async () => {
  const { delays, sleep } = recordSleep();
  const mock = createMockRpc({
    getHealth: sequence([httpError(429, { 'retry-after': '60' }), 'ok']),
  });
  const client = createRpcClient({ url: RPC_URL, fetch: mock.fetch, sleep });
  await client.call('getHealth');
  assert.deepEqual(delays, [10000]);
});

test('gives up after max retries with a hostname-only error', async () => {
  const { delays, sleep } = recordSleep();
  const mock = createMockRpc({ getHealth: () => httpError(429) });
  const client = createRpcClient({ url: RPC_URL, fetch: mock.fetch, sleep });
  await assert.rejects(client.call('getHealth'), (err) => {
    assert.ok(err instanceof RpcError);
    assert.equal(err.status, 429);
    assert.match(err.message, /rpc\.example\.com rate limited the request/);
    assert.ok(!err.message.includes('secret'));
    return true;
  });
  assert.equal(mock.calls.length, 4);
  assert.deepEqual(delays, [500, 1000, 2000]);
});

test('does not retry other HTTP errors', async () => {
  const { sleep } = recordSleep();
  const mock = createMockRpc({ getHealth: () => httpError(500) });
  const client = createRpcClient({ url: RPC_URL, fetch: mock.fetch, sleep });
  await assert.rejects(client.call('getHealth'), (err) => {
    assert.equal(err.status, 500);
    assert.equal(err.message, 'rpc.example.com returned HTTP 500');
    return true;
  });
  assert.equal(mock.calls.length, 1);
});

test('surfaces RPC error payloads with their code', async () => {
  const mock = createMockRpc({ getSlot: () => rpcError(-32602, 'Invalid param') });
  const client = createRpcClient({ url: RPC_URL, fetch: mock.fetch });
  await assert.rejects(client.call('getSlot'), (err) => {
    assert.equal(err.code, -32602);
    assert.match(err.message, /RPC error from rpc\.example\.com: Invalid param/);
    return true;
  });
});

test('network failures name the host only', async () => {
  const client = createRpcClient({
    url: RPC_URL,
    fetch: async () => {
      throw new Error('connect ECONNREFUSED secret');
    },
  });
  await assert.rejects(client.call('getSlot'), (err) => {
    assert.equal(err.message, 'Could not reach rpc.example.com');
    assert.ok(!err.message.includes('secret'));
    return true;
  });
});

test('invalid JSON responses raise a clear error', async () => {
  const client = createRpcClient({
    url: RPC_URL,
    fetch: async () => ({
      status: 200,
      ok: true,
      headers: { get: () => null },
      json: async () => {
        throw new Error('bad json');
      },
    }),
  });
  await assert.rejects(client.call('getSlot'), /rpc\.example\.com returned an invalid response/);
});

test('unknown methods come back as an RPC error', async () => {
  const mock = createMockRpc({});
  const client = createRpcClient({ url: RPC_URL, fetch: mock.fetch });
  await assert.rejects(client.call('nope'), (err) => {
    assert.equal(err.code, -32601);
    return true;
  });
});