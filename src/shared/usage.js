'use strict';

const PERIODS = ['today', 'month', 'allTime'];
const { aggregateLimits, normalizeLimitsSummary } = require('./limits');
const { coerceHistory, mergeHistories } = require('./history');
const TOKEN_KEYS = ['totalTokens', 'total_tokens', 'totalTokenCount', 'total_token_count', 'tokens', 'tokenCount', 'token_count'];
// Additive components for a token total. `reasoning` is deliberately excluded: OpenAI/Codex report
// reasoning_output_tokens WITHIN output_tokens (tokscale's `output` already includes it and exposes
// `reasoning` only as informational metadata), so summing it would double-count. It is still tracked
// separately via REASONING_TOKEN_KEYS for display.
const TOKEN_COMPONENT_KEYS = [
  'input', 'inputTokens', 'input_tokens', 'promptTokens', 'prompt_tokens',
  'output', 'outputTokens', 'output_tokens', 'completionTokens', 'completion_tokens',
  'cacheRead', 'cacheReadTokens', 'cache_read_tokens',
  'cacheWrite', 'cacheWriteTokens', 'cache_write_tokens',
  'cachedTokens', 'cached_tokens',
  'cacheCreationInputTokens', 'cache_creation_input_tokens',
  'cacheReadInputTokens', 'cache_read_input_tokens',
  'totalInput', 'totalOutput', 'totalCacheRead', 'totalCacheWrite'
];
const COST_KEYS = ['costUsd', 'cost_usd', 'costUSD', 'cost', 'totalCost', 'total_cost'];
const MESSAGE_COUNT_KEYS = ['messageCount', 'message_count', 'messages', 'totalMessages', 'total_messages'];
const SESSION_ID_KEYS = ['sessionId', 'session_id', 'session', 'conversationId', 'conversation_id', 'threadId', 'thread_id'];
const INPUT_TOKEN_KEYS = ['input', 'inputTokens', 'input_tokens', 'promptTokens', 'prompt_tokens', 'totalInput'];
const OUTPUT_TOKEN_KEYS = ['output', 'outputTokens', 'output_tokens', 'completionTokens', 'completion_tokens', 'totalOutput'];
const CACHE_READ_TOKEN_KEYS = ['cacheRead', 'cacheReadTokens', 'cache_read_tokens', 'cachedTokens', 'cached_tokens', 'cacheReadInputTokens', 'totalCacheRead'];
const CACHE_WRITE_TOKEN_KEYS = ['cacheWrite', 'cacheWriteTokens', 'cache_write_tokens', 'cacheCreationInputTokens', 'totalCacheWrite'];
const REASONING_TOKEN_KEYS = ['reasoning', 'reasoningTokens', 'reasoning_tokens'];
const STARTED_AT_KEYS = ['startedAt', 'started_at', 'createdAt', 'created_at'];
const LAST_USED_AT_KEYS = ['lastUsedAt', 'last_used_at', 'updatedAt', 'updated_at', 'lastActivityAt', 'last_activity_at', 'timestamp'];

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

function firstString(obj, keys) {
  if (!obj || typeof obj !== 'object') return '';
  for (const key of keys) {
    if (Object.prototype.hasOwnProperty.call(obj, key)) {
      const value = String(obj[key] || '').trim();
      if (value) return value;
    }
  }
  return '';
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

function timestampMs(value) {
  const date = value ? new Date(value) : null;
  return date && !Number.isNaN(date.getTime()) ? date.getTime() : 0;
}

function normalizeIsoTimestamp(value) {
  const ms = timestampMs(value);
  return ms > 0 ? new Date(ms).toISOString() : '';
}

function emptyPeriod() {
  return {
    totalTokens: 0,
    costUsd: 0,
    cacheReadTokens: 0,
    cacheWriteTokens: 0,
    outputTokens: 0,
    clients: {},
    clientCosts: {},
    clientCacheReads: {},
    clientCacheWrites: {},
    clientOutputs: {},
    models: {},
    modelCosts: {},
    modelCacheReads: {},
    modelCacheWrites: {},
    modelOutputs: {},
    clientModels: {},
    clientModelCosts: {},
    sessions: {}
  };
}

function normalizeClientName(value) {
  const raw = String(value || '').trim().toLowerCase();
  if (!raw) return null;
  if (raw.includes('claude')) return 'claude';
  if (raw.includes('codex')) return 'codex';
  if (raw.includes('hermes')) return 'hermes';
  if (raw.includes('gemini')) return 'gemini';
  if (raw.includes('cursor')) return 'cursor';
  if (raw.includes('antigravity')) return 'antigravity';
  if (raw.includes('opencode')) return 'opencode';
  if (raw.includes('openclaw') || raw.includes('clawd') || raw.includes('moltbot') || raw.includes('moldbot')) return 'openclaw';
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

function normalizeSessionId(value) {
  const raw = String(value || '').trim();
  return raw || null;
}

function normalizeProviderName(value) {
  const raw = String(value || '').trim().toLowerCase();
  return raw.replace(/[^a-z0-9_-]+/g, '-') || null;
}

function hasOwn(object, key) {
  return Object.prototype.hasOwnProperty.call(object || {}, key);
}

function normalizeTrackedClients(value) {
  const values = Array.isArray(value) ? value : String(value ?? '').split(',');
  return Array.from(new Set(values.map(normalizeClientName).filter(Boolean)));
}

function validDate(value) {
  const date = new Date(value || '');
  return Number.isNaN(date.getTime()) ? null : date;
}

function recordDate(record) {
  return validDate(record?.updatedAt || record?.receivedAt);
}

function utcMonthKey(date) {
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, '0')}`;
}

function utcDayKey(date) {
  return `${utcMonthKey(date)}-${String(date.getUTCDate()).padStart(2, '0')}`;
}

function detectModel(obj) {
  if (!obj || typeof obj !== 'object') return null;
  return normalizeModelName(obj.model || obj.modelName || obj.model_name || obj.deployment || obj.engine);
}

function detectSessionId(obj) {
  return normalizeSessionId(firstString(obj, SESSION_ID_KEYS));
}

function sessionKey(client, sessionId) {
  return `${client}:${sessionId}`;
}

function looksLikeUsageRow(obj) {
  if (!obj || typeof obj !== 'object' || Array.isArray(obj)) return false;
  if (tokenValue(obj) === 0 && costValue(obj) === 0) return false;
  return Boolean(obj.client || obj.clients || obj.source || obj.platform || obj.agent || obj.tool || obj.model || obj.provider || obj.date || obj.name || detectSessionId(obj));
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

function sessionTokenComponents(input) {
  return {
    inputTokens: Math.max(0, Math.round(firstNumber(input, INPUT_TOKEN_KEYS))),
    outputTokens: Math.max(0, Math.round(firstNumber(input, OUTPUT_TOKEN_KEYS))),
    cacheReadTokens: Math.max(0, Math.round(firstNumber(input, CACHE_READ_TOKEN_KEYS))),
    cacheWriteTokens: Math.max(0, Math.round(firstNumber(input, CACHE_WRITE_TOKEN_KEYS))),
    reasoningTokens: Math.max(0, Math.round(firstNumber(input, REASONING_TOKEN_KEYS)))
  };
}

function emptySession(client, id) {
  return {
    client,
    sessionId: id,
    totalTokens: 0,
    costUsd: 0,
    messageCount: 0,
    inputTokens: 0,
    outputTokens: 0,
    cacheReadTokens: 0,
    cacheWriteTokens: 0,
    reasoningTokens: 0,
    startedAt: '',
    lastUsedAt: '',
    models: {},
    modelCosts: {},
    providers: {}
  };
}

function mergeSession(target, source) {
  target.totalTokens += Math.max(0, Math.round(asNumber(source.totalTokens)));
  target.costUsd += asNumber(source.costUsd);
  target.messageCount += Math.max(0, Math.round(asNumber(source.messageCount)));
  target.inputTokens += Math.max(0, Math.round(asNumber(source.inputTokens)));
  target.outputTokens += Math.max(0, Math.round(asNumber(source.outputTokens)));
  target.cacheReadTokens += Math.max(0, Math.round(asNumber(source.cacheReadTokens)));
  target.cacheWriteTokens += Math.max(0, Math.round(asNumber(source.cacheWriteTokens)));
  target.reasoningTokens += Math.max(0, Math.round(asNumber(source.reasoningTokens)));
  const sourceStarted = timestampMs(source.startedAt);
  const targetStarted = timestampMs(target.startedAt);
  if (sourceStarted && (!targetStarted || sourceStarted < targetStarted)) target.startedAt = new Date(sourceStarted).toISOString();
  const sourceLastUsed = timestampMs(source.lastUsedAt);
  const targetLastUsed = timestampMs(target.lastUsedAt);
  if (sourceLastUsed && sourceLastUsed > targetLastUsed) target.lastUsedAt = new Date(sourceLastUsed).toISOString();
  for (const [model, tokens] of Object.entries(source.models || {})) {
    const key = normalizeModelName(model);
    if (key) target.models[key] = (target.models[key] || 0) + Math.max(0, Math.round(asNumber(tokens)));
  }
  for (const [model, cost] of Object.entries(source.modelCosts || {})) {
    const key = normalizeModelName(model);
    if (key) target.modelCosts[key] = (target.modelCosts[key] || 0) + asNumber(cost);
  }
  for (const [provider, tokens] of Object.entries(source.providers || {})) {
    const key = normalizeProviderName(provider);
    if (key) target.providers[key] = (target.providers[key] || 0) + Math.max(0, Math.round(asNumber(tokens)));
  }
  return target;
}

function addSession(period, session) {
  if (!session?.client || !session?.sessionId) return;
  const key = sessionKey(session.client, session.sessionId);
  if (!period.sessions[key]) period.sessions[key] = emptySession(session.client, session.sessionId);
  mergeSession(period.sessions[key], session);
}

function sessionFromRow(row) {
  const client = detectClient(row);
  const id = detectSessionId(row);
  if (!client || !id) return null;
  const session = emptySession(client, id);
  session.totalTokens = Math.max(0, Math.round(tokenValue(row)));
  session.costUsd = costValue(row);
  session.messageCount = Math.max(0, Math.round(firstNumber(row, MESSAGE_COUNT_KEYS)));
  Object.assign(session, sessionTokenComponents(row));
  session.startedAt = normalizeIsoTimestamp(firstString(row, STARTED_AT_KEYS));
  session.lastUsedAt = normalizeIsoTimestamp(firstString(row, LAST_USED_AT_KEYS));
  let model = detectModel(row);
  if (client === 'cursor' && model === 'auto') model = 'cursor-auto';
  if (model && session.totalTokens > 0) session.models[model] = (session.models[model] || 0) + session.totalTokens;
  if (model && session.costUsd > 0) session.modelCosts[model] = (session.modelCosts[model] || 0) + session.costUsd;
  const provider = normalizeProviderName(row.provider);
  if (provider && session.totalTokens > 0) session.providers[provider] = (session.providers[provider] || 0) + session.totalTokens;
  return session;
}

function normalizeSession(input, fallbackKey) {
  if (!input || typeof input !== 'object') return null;
  const client = normalizeClientName(input.client || input.source || input.platform || input.agent || input.tool);
  const id = normalizeSessionId(input.sessionId || input.session_id || input.session || input.conversationId || input.conversation_id || input.threadId || input.thread_id || fallbackKey);
  if (!client || !id) return null;
  const session = emptySession(client, id);
  const components = sessionTokenComponents(input);
  Object.assign(session, components);
  const componentTotal = components.inputTokens + components.outputTokens + components.cacheReadTokens + components.cacheWriteTokens; // reasoning is a subset of output — see TOKEN_COMPONENT_KEYS
  session.totalTokens = Math.max(0, Math.round(asNumber(input.totalTokens ?? input.total_tokens ?? input.tokens ?? componentTotal)));
  session.costUsd = asNumber(input.costUsd ?? input.cost_usd ?? input.cost ?? 0);
  session.messageCount = Math.max(0, Math.round(firstNumber(input, MESSAGE_COUNT_KEYS)));
  session.startedAt = normalizeIsoTimestamp(firstString(input, STARTED_AT_KEYS));
  session.lastUsedAt = normalizeIsoTimestamp(firstString(input, LAST_USED_AT_KEYS));
  if (input.models && typeof input.models === 'object') {
    for (const [model, value] of Object.entries(input.models)) {
      const key = normalizeModelName(model);
      if (key) session.models[key] = (session.models[key] || 0) + Math.max(0, Math.round(asNumber(value)));
    }
  }
  if (input.modelCosts && typeof input.modelCosts === 'object') {
    for (const [model, value] of Object.entries(input.modelCosts)) {
      const key = normalizeModelName(model);
      if (key) session.modelCosts[key] = (session.modelCosts[key] || 0) + asNumber(value);
    }
  }
  if (input.providers && typeof input.providers === 'object') {
    for (const [provider, value] of Object.entries(input.providers)) {
      const key = normalizeProviderName(provider);
      if (key) session.providers[key] = (session.providers[key] || 0) + Math.max(0, Math.round(asNumber(value)));
    }
  }
  return session;
}

function normalizePeriod(input) {
  const period = emptyPeriod();
  if (!input || typeof input !== 'object') return period;
  period.totalTokens = Math.max(0, Math.round(asNumber(input.totalTokens ?? input.total_tokens ?? 0)));
  period.costUsd = asNumber(input.costUsd ?? input.cost_usd ?? input.cost ?? 0);
  period.cacheReadTokens = Math.max(0, Math.round(asNumber(input.cacheReadTokens ?? input.cache_read_tokens ?? 0)));
  period.cacheWriteTokens = Math.max(0, Math.round(asNumber(input.cacheWriteTokens ?? input.cache_write_tokens ?? 0)));
  period.outputTokens = Math.max(0, Math.round(asNumber(input.outputTokens ?? input.output_tokens ?? 0)));
  if (input.clients && typeof input.clients === 'object') {
    for (const [client, value] of Object.entries(input.clients)) {
      const key = normalizeClientName(client);
      if (key) {
        period.clients[key] = (period.clients[key] || 0) + Math.max(0, Math.round(asNumber(value)));
        if (input.clientCacheReads?.[client]) period.clientCacheReads[key] = (period.clientCacheReads[key] || 0) + Math.max(0, Math.round(asNumber(input.clientCacheReads[client])));
        if (input.clientCacheWrites?.[client]) period.clientCacheWrites[key] = (period.clientCacheWrites[key] || 0) + Math.max(0, Math.round(asNumber(input.clientCacheWrites[client])));
        if (input.clientOutputs?.[client]) period.clientOutputs[key] = (period.clientOutputs[key] || 0) + Math.max(0, Math.round(asNumber(input.clientOutputs[client])));
      }
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
      if (key) {
        period.models[key] = (period.models[key] || 0) + Math.max(0, Math.round(asNumber(value)));
        if (input.modelCacheReads?.[model]) period.modelCacheReads[key] = (period.modelCacheReads[key] || 0) + Math.max(0, Math.round(asNumber(input.modelCacheReads[model])));
        if (input.modelCacheWrites?.[model]) period.modelCacheWrites[key] = (period.modelCacheWrites[key] || 0) + Math.max(0, Math.round(asNumber(input.modelCacheWrites[model])));
        if (input.modelOutputs?.[model]) period.modelOutputs[key] = (period.modelOutputs[key] || 0) + Math.max(0, Math.round(asNumber(input.modelOutputs[model])));
      }
    }
  }
  if (input.modelCosts && typeof input.modelCosts === 'object') {
    for (const [model, value] of Object.entries(input.modelCosts)) {
      const key = normalizeModelName(model);
      if (key) period.modelCosts[key] = (period.modelCosts[key] || 0) + asNumber(value);
    }
  }
  if (input.clientModels && typeof input.clientModels === 'object') {
    for (const [client, models] of Object.entries(input.clientModels)) {
      const clientKey = normalizeClientName(client);
      if (!clientKey || !models || typeof models !== 'object') continue;
      for (const [model, value] of Object.entries(models)) {
        const modelKey = normalizeModelName(model);
        if (!modelKey) continue;
        if (!period.clientModels[clientKey]) period.clientModels[clientKey] = {};
        period.clientModels[clientKey][modelKey] = (period.clientModels[clientKey][modelKey] || 0) + Math.max(0, Math.round(asNumber(value)));
      }
    }
  }
  if (input.clientModelCosts && typeof input.clientModelCosts === 'object') {
    for (const [client, models] of Object.entries(input.clientModelCosts)) {
      const clientKey = normalizeClientName(client);
      if (!clientKey || !models || typeof models !== 'object') continue;
      for (const [model, value] of Object.entries(models)) {
        const modelKey = normalizeModelName(model);
        if (!modelKey) continue;
        if (!period.clientModelCosts[clientKey]) period.clientModelCosts[clientKey] = {};
        period.clientModelCosts[clientKey][modelKey] = (period.clientModelCosts[clientKey][modelKey] || 0) + asNumber(value);
      }
    }
  }
  if (input.sessions && typeof input.sessions === 'object') {
    for (const [key, value] of Object.entries(input.sessions)) {
      const session = normalizeSession(value, key);
      if (session) addSession(period, session);
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
      modelCosts: {},
      clientModels: {},
      clientModelCosts: {},
      sessions: {}
    };
  }
  const period = emptyPeriod();
  for (const row of rows) {
    const tokens = tokenValue(row);
    const cost = costValue(row);
    const cacheRead = Math.max(0, Math.round(firstNumber(row, CACHE_READ_TOKEN_KEYS)));
    const cacheWrite = Math.max(0, Math.round(firstNumber(row, CACHE_WRITE_TOKEN_KEYS)));
    const output = Math.max(0, Math.round(firstNumber(row, OUTPUT_TOKEN_KEYS)));
    const client = detectClient(row);
    let model = detectModel(row);
    if (client === 'cursor' && model === 'auto') model = 'cursor-auto';
    period.totalTokens += Math.max(0, Math.round(tokens));
    period.costUsd += cost;
    period.cacheReadTokens += cacheRead;
    period.cacheWriteTokens += cacheWrite;
    period.outputTokens += output;
    if (client && tokens > 0) {
      period.clients[client] = (period.clients[client] || 0) + Math.round(tokens);
      if (cacheRead > 0) period.clientCacheReads[client] = (period.clientCacheReads[client] || 0) + cacheRead;
      if (cacheWrite > 0) period.clientCacheWrites[client] = (period.clientCacheWrites[client] || 0) + cacheWrite;
      if (output > 0) period.clientOutputs[client] = (period.clientOutputs[client] || 0) + output;
    }
    if (client && cost > 0) period.clientCosts[client] = (period.clientCosts[client] || 0) + cost;
    if (model && tokens > 0) {
      period.models[model] = (period.models[model] || 0) + Math.round(tokens);
      if (cacheRead > 0) period.modelCacheReads[model] = (period.modelCacheReads[model] || 0) + cacheRead;
      if (cacheWrite > 0) period.modelCacheWrites[model] = (period.modelCacheWrites[model] || 0) + cacheWrite;
      if (output > 0) period.modelOutputs[model] = (period.modelOutputs[model] || 0) + output;
    }
    if (model && cost > 0) period.modelCosts[model] = (period.modelCosts[model] || 0) + cost;
    if (client && model && tokens > 0) {
      if (!period.clientModels[client]) period.clientModels[client] = {};
      period.clientModels[client][model] = (period.clientModels[client][model] || 0) + Math.round(tokens);
    }
    if (client && model && cost > 0) {
      if (!period.clientModelCosts[client]) period.clientModelCosts[client] = {};
      period.clientModelCosts[client][model] = (period.clientModelCosts[client][model] || 0) + cost;
    }
    const session = sessionFromRow(row);
    if (session) addSession(period, session);
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
    agentRuntime: record.agentRuntime ? String(record.agentRuntime) : '',
    periods: {},
    limits: normalizeLimitsSummary(record.limits)
  };
  if (hasOwn(record, 'trackedClients')) normalized.trackedClients = normalizeTrackedClients(record.trackedClients);
  if (hasOwn(record, 'history')) normalized.history = coerceHistory(record.history);
  for (const periodName of PERIODS) normalized.periods[periodName] = normalizePeriod(record[periodName] || record.periods?.[periodName]);
  return normalized;
}

function addClientModelUsage(target, client, models, costs) {
  for (const [model, tokens] of Object.entries(models || {})) {
    target.models[model] = (target.models[model] || 0) + tokens;
    if (!target.clientModels[client]) target.clientModels[client] = {};
    target.clientModels[client][model] = (target.clientModels[client][model] || 0) + tokens;
  }
  for (const [model, cost] of Object.entries(costs || {})) {
    target.modelCosts[model] = (target.modelCosts[model] || 0) + cost;
    if (!target.clientModelCosts[client]) target.clientModelCosts[client] = {};
    target.clientModelCosts[client][model] = (target.clientModelCosts[client][model] || 0) + cost;
  }
}

function addClientSessionUsage(target, client, sessions) {
  for (const session of Object.values(sessions || {})) {
    if (session?.client !== client) continue;
    addSession(target, session);
  }
}

function shouldPreservePeriod(periodName, existingRecord, incomingRecord) {
  if (periodName === 'allTime') return true;
  const existingDate = recordDate(existingRecord);
  const incomingDate = recordDate(incomingRecord);
  if (!existingDate || !incomingDate) return false;
  if (periodName === 'today') return utcDayKey(existingDate) === utcDayKey(incomingDate);
  if (periodName === 'month') return utcMonthKey(existingDate) === utcMonthKey(incomingDate);
  return false;
}

function preserveUntrackedClientUsage(existingRecord, incomingRecord, trackedClients) {
  const active = new Set(trackedClients || []);
  for (const periodName of PERIODS) {
    if (!shouldPreservePeriod(periodName, existingRecord, incomingRecord)) continue;
    const source = existingRecord.periods?.[periodName] || emptyPeriod();
    const target = incomingRecord.periods?.[periodName] || emptyPeriod();
    incomingRecord.periods[periodName] = target;
    for (const [client, tokens] of Object.entries(source.clients || {})) {
      if (active.has(client) || hasOwn(target.clients, client)) continue;
      const cost = source.clientCosts?.[client] || 0;
      target.totalTokens += tokens;
      target.costUsd += cost;
      target.clients[client] = tokens;
      if (cost > 0) target.clientCosts[client] = cost;
      addClientModelUsage(target, client, source.clientModels?.[client], source.clientModelCosts?.[client]);
      addClientSessionUsage(target, client, source.sessions);
    }
  }
}

function mergeDeviceRecord(existing, incoming) {
  const hasExisting = existing && typeof existing === 'object';
  const hasIncomingLimits = incoming && typeof incoming === 'object' && Object.prototype.hasOwnProperty.call(incoming, 'limits');
  const hasIncomingHistory = incoming && typeof incoming === 'object' && Object.prototype.hasOwnProperty.call(incoming, 'history');
  const hasIncomingTrackedClients = hasOwn(incoming, 'trackedClients');
  const normalizedIncoming = normalizeDeviceRecord(incoming || {});
  if (!hasExisting) return normalizedIncoming;

  const normalizedExisting = normalizeDeviceRecord(existing);
  if (incoming?.limitsOnly === true) normalizedIncoming.periods = normalizedExisting.periods;
  if (!hasIncomingLimits) normalizedIncoming.limits = normalizedExisting.limits;
  if (!hasIncomingHistory && hasOwn(normalizedExisting, 'history')) normalizedIncoming.history = normalizedExisting.history;
  if (hasIncomingTrackedClients) {
    preserveUntrackedClientUsage(normalizedExisting, normalizedIncoming, normalizedIncoming.trackedClients || []);
  }
  return normalizedIncoming;
}

// History rides along only on interval-gated collector ticks, so a later
// history-less tick would otherwise blank the local snapshot (and the trends
// dashboard with it). Carry the prior snapshot's history forward when the
// incoming one omits the field — the same preservation the hub gets from
// mergeDeviceRecord, but without normalizing the snapshot's raw period shape.
function carryDeviceHistory(previous, incoming) {
  if (!incoming || typeof incoming !== 'object') return incoming;
  if (hasOwn(incoming, 'history')) return incoming;
  if (previous && typeof previous === 'object' && hasOwn(previous, 'history')) {
    return { ...incoming, history: previous.history };
  }
  return incoming;
}

function aggregateHistory(devices, staleAfterMs, nowMs = Date.now()) {
  const histories = [];
  for (const record of devices) {
    const normalized = normalizeDeviceRecord(record);
    if (!hasOwn(normalized, 'history')) continue;
    const ageMs = nowMs - Date.parse(normalized.receivedAt || normalized.updatedAt || 0);
    const stale = Number.isFinite(ageMs) && staleAfterMs > 0 ? ageMs > staleAfterMs : false;
    if (stale) continue;
    histories.push(normalized.history);
  }
  return mergeHistories(histories);
}

function aggregateDevices(devices, staleAfterMs, nowMs = Date.now()) {
  const aggregate = { updatedAt: new Date().toISOString(), periods: {}, devices: [] };
  for (const periodName of PERIODS) aggregate.periods[periodName] = emptyPeriod();
  const now = nowMs;
  for (const record of devices) {
    const normalized = normalizeDeviceRecord(record);
    const ageMs = now - Date.parse(normalized.receivedAt || normalized.updatedAt || 0);
    const stale = Number.isFinite(ageMs) && staleAfterMs > 0 ? ageMs > staleAfterMs : false;
    aggregate.devices.push({
      deviceId: normalized.deviceId,
      hostname: normalized.hostname,
      platform: normalized.platform,
      agentVersion: normalized.agentVersion,
      agentRuntime: normalized.agentRuntime,
      updatedAt: normalized.updatedAt,
      receivedAt: normalized.receivedAt,
      ageMs: Number.isFinite(ageMs) ? ageMs : null,
      stale,
      ...(hasOwn(normalized, 'trackedClients') ? { trackedClients: normalized.trackedClients } : {}),
      periods: normalized.periods,
      limits: normalized.limits
    });
    for (const periodName of PERIODS) {
      const source = normalized.periods[periodName];
      const target = aggregate.periods[periodName];
      target.totalTokens += source.totalTokens;
      target.costUsd += source.costUsd;
      target.cacheReadTokens += source.cacheReadTokens;
      target.cacheWriteTokens += source.cacheWriteTokens;
      target.outputTokens += source.outputTokens;
      for (const [client, tokens] of Object.entries(source.clients)) {
        target.clients[client] = (target.clients[client] || 0) + tokens;
        if (source.clientCacheReads?.[client]) target.clientCacheReads[client] = (target.clientCacheReads[client] || 0) + source.clientCacheReads[client];
        if (source.clientCacheWrites?.[client]) target.clientCacheWrites[client] = (target.clientCacheWrites[client] || 0) + source.clientCacheWrites[client];
        if (source.clientOutputs?.[client]) target.clientOutputs[client] = (target.clientOutputs[client] || 0) + source.clientOutputs[client];
      }
      for (const [client, cost] of Object.entries(source.clientCosts)) target.clientCosts[client] = (target.clientCosts[client] || 0) + cost;
      for (const [model, tokens] of Object.entries(source.models)) {
        target.models[model] = (target.models[model] || 0) + tokens;
        if (source.modelCacheReads?.[model]) target.modelCacheReads[model] = (target.modelCacheReads[model] || 0) + source.modelCacheReads[model];
        if (source.modelCacheWrites?.[model]) target.modelCacheWrites[model] = (target.modelCacheWrites[model] || 0) + source.modelCacheWrites[model];
        if (source.modelOutputs?.[model]) target.modelOutputs[model] = (target.modelOutputs[model] || 0) + source.modelOutputs[model];
      }
      for (const [model, cost] of Object.entries(source.modelCosts)) target.modelCosts[model] = (target.modelCosts[model] || 0) + cost;
      for (const [client, models] of Object.entries(source.clientModels)) {
        if (!target.clientModels[client]) target.clientModels[client] = {};
        for (const [model, tokens] of Object.entries(models)) {
          target.clientModels[client][model] = (target.clientModels[client][model] || 0) + tokens;
        }
      }
      for (const [client, models] of Object.entries(source.clientModelCosts)) {
        if (!target.clientModelCosts[client]) target.clientModelCosts[client] = {};
        for (const [model, cost] of Object.entries(models)) {
          target.clientModelCosts[client][model] = (target.clientModelCosts[client][model] || 0) + cost;
        }
      }
      for (const session of Object.values(source.sessions)) addSession(target, session);
    }
  }
  aggregate.limits = aggregateLimits(aggregate.devices, staleAfterMs, now);
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
    for (const models of Object.values(aggregate.periods[periodName].clientModelCosts)) {
      for (const [model, cost] of Object.entries(models)) {
        models[model] = Number(cost.toFixed(6));
      }
    }
    for (const session of Object.values(aggregate.periods[periodName].sessions)) {
      session.costUsd = Number(session.costUsd.toFixed(6));
      for (const [model, cost] of Object.entries(session.modelCosts)) {
        session.modelCosts[model] = Number(cost.toFixed(6));
      }
    }
  }
  return aggregate;
}

module.exports = { PERIODS, aggregateDevices, aggregateHistory, carryDeviceHistory, emptyPeriod, extractUsageFromTokscale, mergeDeviceRecord, normalizeDeviceRecord, normalizePeriod };
