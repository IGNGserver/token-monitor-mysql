'use strict';

function clone(value) {
  return value === undefined ? value : structuredClone(value);
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
}

module.exports = { MemoryRepository };
