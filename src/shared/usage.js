'use strict';

const PERIODS = ['today', 'month', 'allTime'];
const TOKEN_KEYS = ['totalTokens', 'total_tokens', 'totalTokenCount', 'total_token_count', 'tokens', 'tokenCount', 'token_count'];
const TOKEN_COMPONENT_KEYS = [
  'input', 'inputTokens', 'input_tokens', 'promptTokens', 'prompt_tokens',
  'output', 'outputTokens', 'output_tokens', 'completionTokens', 'completion_tokens',
  'reasoning', 'reasoningTokens', 'reasoning_tokens',
  'cacheRead', 'cacheReadTokens', 'cache_read_tokens',
  'cacheWrite', 'cacheWriteTokens', 'cache_write_tokens',
  'cachedTokens', 'cached_tokens',
  'cacheCreationInputTokens', 'cache_creation_input_tokens',
  'cacheReadInputTokens', 'cache_read_input_tokens',
  'totalInput', 'totalOutput', 'totalCacheRead', 'totalCacheWrite'
];
const COST_KEYS = ['costUsd', 'cost_usd', 'costUSD', 'cost', 'totalCost', 'total_cost'];

function asNumber(value) {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string' && value.trim() !== '') {
    const parsed = Number(value.replace(/[$,]/g, ''));
    if (Number.isFinite(parsed)) return parsed;
  }
  return 0;
}

function firstNumber(obj, keys) {
  if (!obj || typeof obj !== 'object') return 0;
  for (const key of keys) {
    if (Object.prototype.hasOwnProperty.call(obj, key)) {
      const value = asNumber(obj[key]);
      if (value !== 0) return value;
    }
  }
  return 0;
}

function tokenValue(obj) {
  const direct = firstNumber(obj, TOKEN_KEYS);
  if (direct !== 0) return direct;
  let sum = 0;
  for (const key of TOKEN_COMPONENT_KEYS) {
    if (Object.prototype.hasOwnProperty.call(obj, key)) sum += asNumber(obj[key]);
  }
  return sum;
}

function costValue(obj) {
  return firstNumber(obj, COST_KEYS);
}

function emptyPeriod() {
  return { totalTokens: 0, costUsd: 0, clients: {}, clientCosts: {}, models: {}, modelCosts: {} };
}

function normalizeClientName(value) {
  const raw = String(value || '').trim().toLowerCase();
  if (!raw) return null;
  if (raw.includes('claude')) return 'claude';
  if (raw.includes('codex')) return 'codex';
  if (raw.includes('hermes')) return 'hermes';
  if (raw.includes('gemini')) return 'gemini';
  if (raw.includes('cursor')) return 'cursor';
  return raw.replace(/[^a-z0-9_-]+/g, '-').replace(/^-+|-+$/g, '') || null;
}

function detectClient(obj) {
  if (!obj || typeof obj !== 'object') return null;
  return normalizeClientName(obj.client || obj.clients || obj.source || obj.platform || obj.agent || obj.tool || obj.name);
}

function normalizeModelName(value) {
  const raw = String(value || '').trim();
  return raw || null;
}

function detectModel(obj) {
  if (!obj || typeof obj !== 'object') return null;
  return normalizeModelName(obj.model || obj.modelName || obj.model_name || obj.deployment || obj.engine);
}

function looksLikeUsageRow(obj) {
  if (!obj || typeof obj !== 'object' || Array.isArray(obj)) return false;
  if (tokenValue(obj) === 0 && costValue(obj) === 0) return false;
  return Boolean(obj.client || obj.clients || obj.source || obj.platform || obj.agent || obj.tool || obj.model || obj.provider || obj.date || obj.name);
}

function collectUsageRows(node, rows) {
  if (!node) return;
  if (Array.isArray(node)) {
    for (const item of node) collectUsageRows(item, rows);
    return;
  }
  if (typeof node !== 'object') return;
  if (looksLikeUsageRow(node)) {
    rows.push(node);
    return;
  }
  for (const value of Object.values(node)) {
    if (value && (Array.isArray(value) || typeof value === 'object')) collectUsageRows(value, rows);
  }
}

function normalizePeriod(input) {
  const period = emptyPeriod();
  if (!input || typeof input !== 'object') return period;
  period.totalTokens = Math.max(0, Math.round(asNumber(input.totalTokens ?? input.total_tokens ?? 0)));
  period.costUsd = asNumber(input.costUsd ?? input.cost_usd ?? input.cost ?? 0);
  if (input.clients && typeof input.clients === 'object') {
    for (const [client, value] of Object.entries(input.clients)) {
      const key = normalizeClientName(client);
      if (key) period.clients[key] = (period.clients[key] || 0) + Math.max(0, Math.round(asNumber(value)));
    }
  }
  if (input.clientCosts && typeof input.clientCosts === 'object') {
    for (const [client, value] of Object.entries(input.clientCosts)) {
      const key = normalizeClientName(client);
      if (key) period.clientCosts[key] = (period.clientCosts[key] || 0) + asNumber(value);
    }
  }
  if (input.models && typeof input.models === 'object') {
    for (const [model, value] of Object.entries(input.models)) {
      const key = normalizeModelName(model);
      if (key) period.models[key] = (period.models[key] || 0) + Math.max(0, Math.round(asNumber(value)));
    }
  }
  if (input.modelCosts && typeof input.modelCosts === 'object') {
    for (const [model, value] of Object.entries(input.modelCosts)) {
      const key = normalizeModelName(model);
      if (key) period.modelCosts[key] = (period.modelCosts[key] || 0) + asNumber(value);
    }
  }
  return period;
}

function extractUsageFromTokscale(json) {
  const rows = [];
  collectUsageRows(json, rows);
  if (rows.length === 0 && json && typeof json === 'object') {
    return {
      totalTokens: Math.max(0, Math.round(tokenValue(json))),
      costUsd: costValue(json),
      clients: {},
      clientCosts: {},
      models: {},
      modelCosts: {}
    };
  }
  const period = emptyPeriod();
  for (const row of rows) {
    const tokens = tokenValue(row);
    const cost = costValue(row);
    const client = detectClient(row);
    const model = detectModel(row);
    period.totalTokens += Math.max(0, Math.round(tokens));
    period.costUsd += cost;
    if (client && tokens > 0) period.clients[client] = (period.clients[client] || 0) + Math.round(tokens);
    if (client && cost > 0) period.clientCosts[client] = (period.clientCosts[client] || 0) + cost;
    if (model && tokens > 0) period.models[model] = (period.models[model] || 0) + Math.round(tokens);
    if (model && cost > 0) period.modelCosts[model] = (period.modelCosts[model] || 0) + cost;
  }
  return period;
}

function normalizeDeviceRecord(record) {
  const nowIso = new Date().toISOString();
  const normalized = {
    deviceId: String(record.deviceId || record.id || 'unknown'),
    hostname: record.hostname ? String(record.hostname) : '',
    platform: record.platform ? String(record.platform) : '',
    updatedAt: record.updatedAt || nowIso,
    receivedAt: record.receivedAt || nowIso,
    agentVersion: record.agentVersion || '',
    periods: {}
  };
  for (const periodName of PERIODS) normalized.periods[periodName] = normalizePeriod(record[periodName] || record.periods?.[periodName]);
  return normalized;
}

function aggregateDevices(devices, staleAfterMs) {
  const aggregate = { updatedAt: new Date().toISOString(), periods: {}, devices: [] };
  for (const periodName of PERIODS) aggregate.periods[periodName] = emptyPeriod();
  const now = Date.now();
  for (const record of devices) {
    const normalized = normalizeDeviceRecord(record);
    const ageMs = now - Date.parse(normalized.receivedAt || normalized.updatedAt || 0);
    const stale = Number.isFinite(ageMs) && staleAfterMs > 0 ? ageMs > staleAfterMs : false;
    aggregate.devices.push({
      deviceId: normalized.deviceId,
      hostname: normalized.hostname,
      platform: normalized.platform,
      updatedAt: normalized.updatedAt,
      receivedAt: normalized.receivedAt,
      ageMs: Number.isFinite(ageMs) ? ageMs : null,
      stale,
      periods: normalized.periods
    });
    for (const periodName of PERIODS) {
      const source = normalized.periods[periodName];
      const target = aggregate.periods[periodName];
      target.totalTokens += source.totalTokens;
      target.costUsd += source.costUsd;
      for (const [client, tokens] of Object.entries(source.clients)) target.clients[client] = (target.clients[client] || 0) + tokens;
      for (const [client, cost] of Object.entries(source.clientCosts)) target.clientCosts[client] = (target.clientCosts[client] || 0) + cost;
      for (const [model, tokens] of Object.entries(source.models)) target.models[model] = (target.models[model] || 0) + tokens;
      for (const [model, cost] of Object.entries(source.modelCosts)) target.modelCosts[model] = (target.modelCosts[model] || 0) + cost;
    }
  }
  aggregate.devices.sort((a, b) => a.deviceId.localeCompare(b.deviceId));
  for (const periodName of PERIODS) {
    aggregate.periods[periodName].totalTokens = Math.round(aggregate.periods[periodName].totalTokens);
    aggregate.periods[periodName].costUsd = Number(aggregate.periods[periodName].costUsd.toFixed(6));
    for (const [client, cost] of Object.entries(aggregate.periods[periodName].clientCosts)) {
      aggregate.periods[periodName].clientCosts[client] = Number(cost.toFixed(6));
    }
    for (const [model, cost] of Object.entries(aggregate.periods[periodName].modelCosts)) {
      aggregate.periods[periodName].modelCosts[model] = Number(cost.toFixed(6));
    }
  }
  return aggregate;
}

module.exports = { PERIODS, aggregateDevices, emptyPeriod, extractUsageFromTokscale, normalizeDeviceRecord, normalizePeriod };
