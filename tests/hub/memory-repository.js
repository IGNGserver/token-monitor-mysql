'use strict';

function clone(value) {
  return value === undefined ? value : structuredClone(value);
}

function number(value) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function emptyUsageRange() {
  return {
    totalTokens: 0,
    costUsd: 0,
    clients: {},
    clientCosts: {},
    models: {},
    modelCosts: {},
    clientModels: {},
    clientModelCosts: {},
    eventCount: 0
  };
}

function addTokenCost(mapTokens, mapCosts, key, tokens, cost) {
  const id = String(key || '').trim() || 'unknown';
  mapTokens[id] = (mapTokens[id] || 0) + tokens;
  mapCosts[id] = (mapCosts[id] || 0) + cost;
}

class MemoryRepository {
  constructor() {
    this.devices = new Map();
    this.events = [];
    this.pricing = new Map();
    this.sessions = new Map();
  }

  async transaction(work) { return work(this); }

  async listDeviceRecords() { return [...this.devices.values()].map(clone); }

  async getDeviceRecord(deviceId) { return clone(this.devices.get(deviceId) || null); }

  async saveDevice(record) { this.devices.set(record.deviceId, clone(record)); }

  async countDevices() { return this.devices.size; }

  async getPricing(models) {
    return new Map(models.filter(Boolean).map((model) => [model, clone(this.pricing.get(model))]).filter(([, item]) => item));
  }

  async listPricing() { return [...this.pricing.values()].map(clone).sort((a, b) => a.model.localeCompare(b.model)); }

  async upsertPricing(model, prices, source) {
    const item = {
      id: this.pricing.get(model)?.id || this.pricing.size + 1,
      model,
      ...prices,
      source,
      updatedAt: new Date().toISOString()
    };
    this.pricing.set(model, item);
    return clone(item);
  }

  async insertUsageEvents(deviceId, events) {
    for (const event of events) this.events.push({ id: this.events.length + 1, deviceId, ...clone(event) });
  }

  async replaceSessions(deviceId, summaries) {
    for (const key of [...this.sessions.keys()]) if (key.startsWith(`${deviceId}\u0000`)) this.sessions.delete(key);
    for (const summary of summaries) this.sessions.set(`${deviceId}\u0000${summary.client}\u0000${summary.sessionId}`, clone(summary));
  }

  async deleteDevice(deviceId) {
    const deleted = this.devices.delete(deviceId);
    for (const event of this.events) if (event.deviceId === deviceId) event.deviceId = null;
    for (const key of [...this.sessions.keys()]) if (key.startsWith(`${deviceId}\u0000`)) this.sessions.delete(key);
    return deleted;
  }

  async listKnownModels() {
    return [...new Set(this.events.map((event) => event.model).filter((model) => model && model !== 'unknown'))].sort();
  }

  async aggregateUsageRange({ from, to }) {
    const fromMs = new Date(from).getTime();
    const toMs = new Date(to).getTime();
    const result = emptyUsageRange();
    if (!(fromMs < toMs)) return result;
    for (const event of this.events) {
      const at = new Date(event.recordedAt).getTime();
      if (!(at >= fromMs && at < toMs)) continue;
      result.eventCount += 1;
      const tokens = Math.round(
        number(event.inputTokens)
        + number(event.outputTokens)
        + number(event.cacheReadTokens)
        + number(event.cacheWriteTokens)
      );
      const cost = number(event.costUsd);
      const client = String(event.client || 'unknown');
      const model = String(event.model || 'unknown');
      result.totalTokens += tokens;
      result.costUsd += cost;
      addTokenCost(result.clients, result.clientCosts, client, tokens, cost);
      addTokenCost(result.models, result.modelCosts, model, tokens, cost);
      if (!result.clientModels[client]) result.clientModels[client] = {};
      if (!result.clientModelCosts[client]) result.clientModelCosts[client] = {};
      result.clientModels[client][model] = (result.clientModels[client][model] || 0) + tokens;
      result.clientModelCosts[client][model] = (result.clientModelCosts[client][model] || 0) + cost;
    }
    return result;
  }
}

module.exports = { MemoryRepository };
