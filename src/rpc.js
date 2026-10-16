'use strict';

const DEFAULT_RPC = 'https://api.mainnet-beta.solana.com';

class RpcError extends Error {
  constructor(message, details = {}) {
    super(message);
    this.name = 'RpcError';
    this.code = details.code;
    this.status = details.status;
  }
}

function resolveRpcUrl(flag, env = process.env) {
  return flag || env.SOL_HOLDERS_RPC || DEFAULT_RPC;
}

function hostOf(url) {
  try {
    return new URL(url).hostname;
  } catch {
    return 'the RPC host';
  }
}

const defaultSleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

function retryDelay(response, attempt, baseDelayMs) {
  const header =
    response.headers && typeof response.headers.get === 'function'
      ? response.headers.get('retry-after')
      : null;
  const seconds = Number(header);
  if (header && Number.isFinite(seconds) && seconds >= 0) {
    return Math.min(seconds * 1000, 10000);
  }
  return baseDelayMs * 2 ** attempt;
}

function createRpcClient(options = {}) {
  const url = options.url || DEFAULT_RPC;
  const fetchImpl = options.fetch || globalThis.fetch;
  const maxRetries = options.maxRetries ?? 3;
  const baseDelayMs = options.baseDelayMs ?? 500;
  const sleep = options.sleep || defaultSleep;
  const host = hostOf(url);
  let nextId = 1;

  async function call(method, params = []) {
    const body = JSON.stringify({ jsonrpc: '2.0', id: nextId++, method, params });

    for (let attempt = 0; ; attempt++) {
      let response;
      try {
        response = await fetchImpl(url, {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body,
        });
      } catch {
        throw new RpcError(`Could not reach ${host}`);
      }

      if (response.status === 429) {
        if (attempt >= maxRetries) {
          throw new RpcError(`${host} rate limited the request (HTTP 429)`, { status: 429 });
        }
        await sleep(retryDelay(response, attempt, baseDelayMs));
        continue;
      }

      if (!response.ok) {
        throw new RpcError(`${host} returned HTTP ${response.status}`, {
          status: response.status,
        });
      }

      let payload;
      try {
        payload = await response.json();
      } catch {
        throw new RpcError(`${host} returned an invalid response`);
      }

      if (payload && payload.error) {
        throw new RpcError(
          `RPC error from ${host}: ${payload.error.message || 'unknown error'}`,
          { code: payload.error.code }
        );
      }

      return payload.result;
    }
  }

  return { call, host };
}

module.exports = { DEFAULT_RPC, RpcError, resolveRpcUrl, createRpcClient };