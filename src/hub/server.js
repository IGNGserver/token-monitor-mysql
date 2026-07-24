'use strict';

const http = require('node:http');
const { URL } = require('node:url');
const { aggregateDevices, aggregateHistory, mergeDeviceRecord } = require('../shared/usage');
const { historyPreview, historyRevision } = require('../shared/history');
const { isAuthorized, readJsonBody, sendJson, sendText } = require('../shared/http');
const { loadDotEnv, parseArgs } = require('../shared/config');
const { lookupModelPricing, normalizePromaPricing } = require('../shared/collector');
const { createMySqlPool, createRepository } = require('./repository');
const { createCatalogPricingLookup, pricingNotFound } = require('./pricing-upstream');
const { calculateUsageEventDeltas, summarizeSessions } = require('./usage-events');

const LOOPBACK_HOSTS = new Set(['127.0.0.1', 'localhost', '::1']);
const PRICE_FIELDS = [
  'inputPricePerMillion',
  'outputPricePerMillion',
  'cacheReadPricePerMillion',
  'cacheWritePricePerMillion'
];

// Without a secret the hub cannot tell its own widget from any other caller, so it
// must not expose account identity (email/plan/key) to the network. Binding to
// loopback keeps an unauthenticated hub usable locally while refusing LAN/remote
// reach; set a secret to bind a non-loopback address and accept other devices.
function resolveBindHost(host, secret) {
  const requested = String(host || '').trim() || '0.0.0.0';
  if (secret) return requested;
  return LOOPBACK_HOSTS.has(requested.toLowerCase()) ? requested : '127.0.0.1';
}

function number(value) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function emptyUsageRangePayload() {
  return {
    totalTokens: 0,
    costUsd: 0,
    clients: {},
    clientCosts: {},
    models: {},
    modelCosts: {},
    clientModels: {},
    clientModelCosts: {}
  };
}

function addRangeTokenCost(mapTokens, mapCosts, key, tokens, cost) {
  const id = String(key || '').trim() || 'unknown';
  mapTokens[id] = (mapTokens[id] || 0) + tokens;
  mapCosts[id] = (mapCosts[id] || 0) + cost;
}

// Day-level fallback when usage_events has no rows for the requested window.
// Days that overlap [from, to) (UTC day keys) are summed; hour precision is lost.
function aggregateHistoryRange(history, from, to) {
  const result = emptyUsageRangePayload();
  const fromMs = from.getTime();
  const toMs = to.getTime();
  for (const day of history?.daily || []) {
    const dayKey = String(day?.date || '').slice(0, 10);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(dayKey)) continue;
    const dayStart = Date.parse(`${dayKey}T00:00:00.000Z`);
    if (!Number.isFinite(dayStart)) continue;
    const dayEnd = dayStart + 86_400_000;
    if (dayEnd <= fromMs || dayStart >= toMs) continue;
    const tokens = Math.round(number(day.tokens));
    const cost = number(day.cost);
    result.totalTokens += tokens;
    result.costUsd += cost;
    for (const [client, value] of Object.entries(day.perClient || {})) {
      addRangeTokenCost(result.clients, result.clientCosts, client, Math.round(number(value?.tokens ?? value)), number(value?.cost));
    }
    for (const [model, value] of Object.entries(day.perModel || {})) {
      addRangeTokenCost(result.models, result.modelCosts, model, Math.round(number(value?.tokens ?? value)), number(value?.cost));
    }
  }
  return result;
}

function parseRangeBound(raw, name) {
  const text = String(raw || '').trim();
  if (!text) {
    const error = new Error(`${name}_required`);
    error.code = 'invalid_range';
    throw error;
  }
  const parsed = new Date(text);
  if (Number.isNaN(parsed.getTime())) {
    const error = new Error(`${name}_invalid`);
    error.code = 'invalid_range';
    throw error;
  }
  return parsed;
}

function priceSnapshot(event, pricing) {
  if (!pricing) {
    // A missing catalog entry must not turn a known tokscale cost into a false
    // zero. No price exists to snapshot, so the event carries its payload cost
    // and marks the provenance explicitly.
    return {
      ...event,
      priceInputPerMillion: null,
      priceOutputPerMillion: null,
      priceCacheReadPerMillion: null,
      priceCacheWritePerMillion: null,
      pricingSource: 'payload_fallback',
      pricingSnapshotAt: null,
      costUsd: number(event.payloadCostUsd)
    };
  }
  const input = number(pricing.inputPricePerMillion);
  const output = number(pricing.outputPricePerMillion);
  const cacheRead = number(pricing.cacheReadPricePerMillion);
  const cacheWrite = number(pricing.cacheWritePricePerMillion);
  return {
    ...event,
    priceInputPerMillion: input,
    priceOutputPerMillion: output,
    priceCacheReadPerMillion: cacheRead,
    priceCacheWritePerMillion: cacheWrite,
    pricingSource: pricing.source,
    pricingSnapshotAt: pricing.updatedAt,
    costUsd: ((number(event.inputTokens) * input)
      + (number(event.outputTokens) * output)
      + (number(event.cacheReadTokens) * cacheRead)
      + (number(event.cacheWriteTokens) * cacheWrite)) / 1_000_000
  };
}

function normalizePrices(body) {
  const aliases = {
    inputPricePerMillion: ['inputPricePerMillion', 'input_price_per_million'],
    outputPricePerMillion: ['outputPricePerMillion', 'output_price_per_million'],
    cacheReadPricePerMillion: ['cacheReadPricePerMillion', 'cache_read_price_per_million'],
    cacheWritePricePerMillion: ['cacheWritePricePerMillion', 'cache_write_price_per_million']
  };
  const prices = {};
  for (const field of PRICE_FIELDS) {
    const value = aliases[field].map((key) => body?.[key]).find((candidate) => candidate !== undefined);
    const parsed = Number(value);
    if (!Number.isFinite(parsed) || parsed < 0) {
      const error = new Error(`${field}_must_be_a_non_negative_number`);
      error.code = 'invalid_pricing';
      throw error;
    }
    prices[field] = parsed;
  }
  return prices;
}

function upstreamPrices(result) {
  const pricing = normalizePromaPricing(result);
  if (!pricing) return null;
  return {
    inputPricePerMillion: number(pricing.inputCostPerToken) * 1_000_000,
    outputPricePerMillion: number(pricing.outputCostPerToken) * 1_000_000,
    cacheReadPricePerMillion: number(pricing.cacheReadInputTokenCost) * 1_000_000,
    cacheWritePricePerMillion: number(pricing.cacheCreationInputTokenCost) * 1_000_000
  };
}

function isMissingPricingError(error) {
  return /not found|unknown model|no pricing|unsupported model/i.test(String(error?.message || ''));
}

function createHub({
  port = 17321,
  host = '0.0.0.0',
  secret = '',
  staleAfterMs = 10 * 60 * 1000,
  sseHeartbeatMs = 30000,
  repository = null,
  pool = null,
  lookupPricing = lookupModelPricing,
  fallbackPricing = createCatalogPricingLookup(),
  logger = console
} = {}) {
  const ownedPool = !repository && !pool;
  const activePool = pool || (repository ? null : createMySqlPool());
  const store = repository || createRepository(activePool);
  const bindHost = resolveBindHost(host, secret);
  let statsCache = null;

  async function getStats() {
    const records = await store.listDeviceRecords();
    const stats = aggregateDevices(records, staleAfterMs);
    stats.staleAfterMs = staleAfterMs;
    const history = aggregateHistory(records);
    stats.historyPreview = historyPreview(history);
    stats.historyRevision = historyRevision(history);
    statsCache = stats;
    return stats;
  }

  async function getHistory() {
    return aggregateHistory(await store.listDeviceRecords());
  }

  async function getUsageRange(fromRaw, toRaw) {
    const from = parseRangeBound(fromRaw, 'from');
    const to = parseRangeBound(toRaw, 'to');
    if (!(from.getTime() < to.getTime())) {
      const error = new Error('from_must_be_before_to');
      error.code = 'invalid_range';
      throw error;
    }
    const eventsAgg = typeof store.aggregateUsageRange === 'function'
      ? await store.aggregateUsageRange({ from, to })
      : { ...emptyUsageRangePayload(), eventCount: 0 };
    if (number(eventsAgg.eventCount) > 0) {
      return {
        from: from.toISOString(),
        to: to.toISOString(),
        source: 'usage_events',
        totalTokens: Math.round(number(eventsAgg.totalTokens)),
        costUsd: number(eventsAgg.costUsd),
        clients: eventsAgg.clients || {},
        clientCosts: eventsAgg.clientCosts || {},
        models: eventsAgg.models || {},
        modelCosts: eventsAgg.modelCosts || {},
        clientModels: eventsAgg.clientModels || {},
        clientModelCosts: eventsAgg.clientModelCosts || {}
      };
    }
    const historyAgg = aggregateHistoryRange(await getHistory(), from, to);
    return {
      from: from.toISOString(),
      to: to.toISOString(),
      source: 'history_daily',
      ...historyAgg
    };
  }

  const sseClients = new Set();
  const statsListeners = new Set();

  function sseFormat(event, data) {
    return `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
  }

  async function broadcastStats(reason = 'update') {
    if (sseClients.size === 0 && statsListeners.size === 0) return;
    const stats = await getStats();
    const at = new Date().toISOString();
    if (sseClients.size > 0) {
      const payload = sseFormat('stats', { type: 'stats', reason, stats, at });
      for (const res of sseClients) {
        try { res.write(payload); } catch (_) { sseClients.delete(res); }
      }
    }
    for (const listener of statsListeners) {
      try { listener(stats, reason, at); } catch (_) { /* listener errors must not break ingest */ }
    }
  }

  async function ingest(payload) {
    if (!payload || (!payload.deviceId && !payload.id)) {
      throw new Error('deviceId_required');
    }
    const record = await store.transaction(async (connection) => {
      const deviceId = String(payload.deviceId || payload.id);
      const existing = await store.getDeviceRecord(deviceId, connection);
      const merged = mergeDeviceRecord(existing, { ...payload, receivedAt: new Date().toISOString() });
      const { candidates, events } = calculateUsageEventDeltas(existing, merged);
      const pricingByModel = await store.getPricing(events.map((event) => event.model), connection);
      const pricedEvents = events.map((event) => priceSnapshot(event, pricingByModel.get(event.model)));
      await store.saveDevice(merged, connection);
      await store.insertUsageEvents(merged.deviceId, pricedEvents, connection);
      await store.replaceSessions(merged.deviceId, summarizeSessions(candidates), connection);
      return merged;
    });
    statsCache = null;
    await broadcastStats('ingest');
    return record;
  }

  async function deleteDevice(deviceId) {
    const deleted = await store.transaction((connection) => store.deleteDevice(deviceId, connection));
    statsCache = null;
    await broadcastStats('delete');
    return deleted;
  }

  async function setPricing(model, prices, source = 'manual') {
    const item = await store.upsertPricing(model, prices, source);
    return item;
  }

  async function fetchUpstreamPricing(model) {
    const modelId = String(model || '').trim();
    if (!modelId) {
      const error = new Error('model_required');
      error.code = 'model_required';
      throw error;
    }
    let result;
    let primaryError = null;
    try {
      result = await lookupPricing(modelId);
    } catch (error) {
      primaryError = error;
    }
    let prices = upstreamPrices(result);
    if (!prices) {
      try {
        // tokscale itself reads this public model catalog. Keep its CLI as the
        // primary source, but survive hosts where raw.githubusercontent.com is
        // blocked while models.dev remains reachable.
        prices = upstreamPrices(await fallbackPricing(modelId));
      } catch (fallbackError) {
        if (fallbackError.code === 'pricing_not_found' || isMissingPricingError(fallbackError)) {
          throw pricingNotFound(modelId);
        }
        const error = new Error(`Could not retrieve upstream pricing for ${modelId}: ${primaryError?.message || fallbackError.message}`);
        error.code = 'pricing_lookup_failed';
        throw error;
      }
    }
    if (!prices) {
      throw pricingNotFound(modelId);
    }
    return setPricing(modelId, prices, 'tokscale_upstream');
  }

  async function fetchAllUpstreamPricing() {
    const models = await store.listKnownModels();
    const results = [];
    for (const model of models) {
      try {
        results.push({ model, ok: true, pricing: await fetchUpstreamPricing(model) });
      } catch (error) {
        results.push({ model, ok: false, error: error.code || 'pricing_lookup_failed', message: error.message });
      }
    }
    return results;
  }

  function onStats(listener) {
    statsListeners.add(listener);
    return () => statsListeners.delete(listener);
  }

  async function handleRequest(req, res) {
    if (req.method === 'OPTIONS') return sendText(res, 204, '');
    const url = new URL(req.url || '/', `http://${req.headers.host || 'localhost'}`);

    if (url.pathname === '/api/health') {
      return sendJson(res, 200, {
        ok: true,
        role: 'hub',
        version: 1,
        deviceCount: await store.countDevices(),
        secretRequired: Boolean(secret),
        now: new Date().toISOString()
      });
    }

    if (!isAuthorized(req, secret)) return sendJson(res, 401, { error: 'unauthorized' });

    if (req.method === 'GET' && url.pathname === '/api/stats') return sendJson(res, 200, await getStats());
    if (req.method === 'GET' && url.pathname === '/api/devices') {
      return sendJson(res, 200, { devices: await store.listDeviceRecords() });
    }
    if (req.method === 'GET' && url.pathname === '/api/history') return sendJson(res, 200, await getHistory());
    if (req.method === 'GET' && url.pathname === '/api/usage/range') {
      try {
        return sendJson(res, 200, await getUsageRange(url.searchParams.get('from'), url.searchParams.get('to')));
      } catch (error) {
        const status = error.code === 'invalid_range' ? 400 : 500;
        return sendJson(res, status, { error: error.code || 'bad_request', message: error.message });
      }
    }
    if (req.method === 'GET' && url.pathname === '/api/pricing') return sendJson(res, 200, { pricing: await store.listPricing() });

    if (req.method === 'GET' && url.pathname === '/api/stats/stream') {
      const snapshot = await getStats();
      res.writeHead(200, {
        'content-type': 'text/event-stream',
        'cache-control': 'no-cache, no-transform',
        'connection': 'keep-alive',
        'x-accel-buffering': 'no'
      });
      res.write(sseFormat('snapshot', { type: 'stats', reason: 'snapshot', stats: snapshot, at: new Date().toISOString() }));
      sseClients.add(res);
      // Heartbeats intentionally do not query MySQL. Slow reads therefore never
      // delay the fixed 30-second SSE keepalive cadence.
      const heartbeat = setInterval(() => { try { res.write(': hb\n\n'); } catch (_) {} }, sseHeartbeatMs);
      const cleanup = () => { clearInterval(heartbeat); sseClients.delete(res); };
      req.on('close', cleanup);
      req.on('error', cleanup);
      return;
    }

    if (req.method === 'POST' && url.pathname === '/api/ingest') {
      try {
        const payload = await readJsonBody(req);
        const record = await ingest(payload);
        return sendJson(res, 200, { ok: true, deviceId: record.deviceId, stats: await getStats() });
      } catch (error) {
        if (error.message === 'deviceId_required') return sendJson(res, 400, { error: 'deviceId_required' });
        if (error.code === 'payload_too_large') {
          res.shouldKeepAlive = false;
          return sendJson(res, 413, { error: 'payload_too_large', message: error.message }, { connection: 'close' });
        }
        return sendJson(res, 400, { error: 'bad_request', message: error.message });
      }
    }

    if (req.method === 'PUT' && url.pathname.startsWith('/api/pricing/')) {
      try {
        const model = decodeURIComponent(url.pathname.slice('/api/pricing/'.length));
        if (!model) return sendJson(res, 400, { error: 'model_required' });
        const pricing = await setPricing(model, normalizePrices(await readJsonBody(req)));
        return sendJson(res, 200, { ok: true, pricing });
      } catch (error) {
        return sendJson(res, 400, { error: error.code || 'bad_request', message: error.message });
      }
    }

    if (req.method === 'POST' && url.pathname === '/api/pricing/fetch-upstream-all') {
      return sendJson(res, 200, { results: await fetchAllUpstreamPricing() });
    }

    if (req.method === 'POST' && url.pathname.startsWith('/api/pricing/') && url.pathname.endsWith('/fetch-upstream')) {
      const model = decodeURIComponent(url.pathname.slice('/api/pricing/'.length, -'/fetch-upstream'.length));
      try {
        return sendJson(res, 200, { ok: true, pricing: await fetchUpstreamPricing(model) });
      } catch (error) {
        const status = error.code === 'pricing_not_found' || error.code === 'model_required' ? 422 : 502;
        return sendJson(res, status, { error: error.code || 'pricing_lookup_failed', message: error.message });
      }
    }

    if (req.method === 'DELETE' && url.pathname.startsWith('/api/devices/')) {
      const deviceId = decodeURIComponent(url.pathname.slice('/api/devices/'.length));
      await deleteDevice(deviceId);
      return sendJson(res, 200, { ok: true, deviceId });
    }

    return sendJson(res, 404, { error: 'not_found' });
  }

  const server = http.createServer((req, res) => {
    handleRequest(req, res).catch((error) => {
      (logger.error || console.error)(error);
      sendJson(res, 500, { error: 'internal_error', message: error.message });
    });
  });

  async function start() {
    // Fail before opening the listening socket when migrations have not run or
    // MySQL credentials are unusable. The Docker entrypoint runs migrations first.
    await store.countDevices();
    return new Promise((resolve, reject) => {
      const onError = (err) => { server.off('listening', onListening); reject(err); };
      const onListening = () => { server.off('error', onError); resolve(); };
      server.once('error', onError);
      server.once('listening', onListening);
      server.listen(port, bindHost);
    });
  }

  async function stop() {
    for (const res of sseClients) { try { res.end(); } catch (_) {} }
    sseClients.clear();
    await new Promise((resolve) => server.close(() => resolve()));
    if (ownedPool && activePool) await activePool.end();
  }

  return {
    start,
    stop,
    server,
    getStats,
    getHistory,
    getUsageRange,
    ingest,
    deleteDevice,
    onStats,
    setPricing,
    fetchUpstreamPricing,
    fetchAllUpstreamPricing,
    bindHost,
    getCachedStats: () => statsCache
  };
}

if (require.main === module) {
  loadDotEnv();
  const args = parseArgs(process.argv.slice(2));
  const port = Number(args.port || process.env.TOKEN_MONITOR_PORT || 17321);
  const host = String(args.host || process.env.TOKEN_MONITOR_HOST || '0.0.0.0');
  const secret = String(args.secret || process.env.TOKEN_MONITOR_SECRET || '').trim();
  const staleAfterMs = Number(args.staleAfterMs || process.env.TOKEN_MONITOR_STALE_AFTER_MS || 10 * 60 * 1000);
  const hub = createHub({ port, host, secret, staleAfterMs });
  hub.start()
    .then(() => console.log(`Token Monitor hub listening on http://${hub.bindHost}:${port}`))
    .catch((error) => { console.error(`Could not start hub: ${error.message}`); process.exitCode = 1; });
}

module.exports = { createHub, normalizePrices, priceSnapshot, resolveBindHost, upstreamPrices, aggregateHistoryRange, emptyUsageRangePayload };
