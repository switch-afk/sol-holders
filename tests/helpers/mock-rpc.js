'use strict';

const RAW = Symbol('raw-response');

function makeResponse(body, { status = 200, headers = {} } = {}) {
  return {
    status,
    ok: status >= 200 && status < 300,
    headers: { get: (name) => headers[String(name).toLowerCase()] ?? null },
    json: async () => body,
  };
}

// A handler can return one of these to simulate HTTP-level or RPC-level failures.
function httpError(status, headers = {}) {
  return { [RAW]: makeResponse({}, { status, headers }) };
}

function rpcError(code, message) {
  return {
    [RAW]: makeResponse({ jsonrpc: '2.0', id: null, error: { code, message } }),
  };
}

// Returns each item in turn; the last item repeats once the list runs out.
function sequence(items) {
  let index = 0;
  return () => items[Math.min(index++, items.length - 1)];
}

// handlers: { methodName: value | (params, callCount) => value }
function createMockRpc(handlers = {}) {
  const calls = [];

  async function mockFetch(url, init) {
    const request = JSON.parse(init.body);
    calls.push({ url, method: request.method, params: request.params });

    const handler = handlers[request.method];
    if (handler === undefined) {
      return makeResponse({
        jsonrpc: '2.0',
        id: request.id,
        error: { code: -32601, message: `Method not found: ${request.method}` },
      });
    }

    const outcome =
      typeof handler === 'function' ? await handler(request.params, calls.length) : handler;

    if (outcome && outcome[RAW]) return outcome[RAW];
    return makeResponse({ jsonrpc: '2.0', id: request.id, result: outcome });
  }

  return { fetch: mockFetch, calls };
}

module.exports = { createMockRpc, httpError, rpcError, sequence, makeResponse };