import { aggregateDevices, normalizeDeviceRecord } from '../../src/shared/usage.js';

const CORS_HEADERS = {
  'access-control-allow-origin': '*',
  'access-control-allow-methods': 'GET,POST,DELETE,OPTIONS',
  'access-control-allow-headers': 'authorization,content-type,x-token-monitor-secret'
};

function jsonResponse(status, payload, extra = {}) {
  return new Response(JSON.stringify(payload, null, 2), {
    status,
    headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store, no-transform', ...CORS_HEADERS, ...extra }
  });
}

function textResponse(status, body, contentType = 'text/plain; charset=utf-8') {
  return new Response(body, { status, headers: { 'content-type': contentType, ...CORS_HEADERS } });
}

function requestSecret(request) {
  const auth = request.headers.get('authorization') || '';
  if (auth.toLowerCase().startsWith('bearer ')) return auth.slice(7).trim();
  const headerSecret = String(request.headers.get('x-token-monitor-secret') || '').trim();
  if (headerSecret) return headerSecret;
  try {
    const url = new URL(request.url);
    return String(url.searchParams.get('secret') || '').trim();
  } catch (_) { return ''; }
}

function isAuthorized(request, expectedSecret) {
  if (!expectedSecret) return true;
  return requestSecret(request) === expectedSecret;
}

function sseFormat(event, data) {
  return `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
}

export default {
  async fetch(request, env) {
    if (request.method === 'OPTIONS') return textResponse(204, '');
    const id = env.HUB.idFromName('hub');
    const stub = env.HUB.get(id);
    return stub.fetch(request);
  }
};

export class HubDO {
  constructor(state, env) {
    this.state = state;
    this.env = env;
    this.sseClients = new Set();
    this.heartbeatTimer = null;
    this.encoder = new TextEncoder();
  }

  get secret() {
    return String(this.env.TOKEN_MONITOR_SECRET || '').trim();
  }

  get staleAfterMs() {
    return Number(this.env.STALE_AFTER_MS || 10 * 60 * 1000);
  }

  async listDevices() {
    const entries = await this.state.storage.list({ prefix: 'dev:' });
    return Array.from(entries.values());
  }

  async getStats() {
    return aggregateDevices(await this.listDevices(), this.staleAfterMs);
  }

  ensureHeartbeat() {
    if (this.heartbeatTimer || this.sseClients.size === 0) return;
    this.heartbeatTimer = setInterval(() => {
      const chunk = this.encoder.encode(': hb\n\n');
      for (const writer of this.sseClients) {
        writer.write(chunk).catch(() => this.dropClient(writer));
      }
      if (this.sseClients.size === 0 && this.heartbeatTimer) {
        clearInterval(this.heartbeatTimer);
        this.heartbeatTimer = null;
      }
    }, 30000);
  }

  dropClient(writer) {
    this.sseClients.delete(writer);
    try { writer.close(); } catch (_) {}
    if (this.sseClients.size === 0 && this.heartbeatTimer) {
      clearInterval(this.heartbeatTimer);
      this.heartbeatTimer = null;
    }
  }

  async broadcast(reason = 'update') {
    if (this.sseClients.size === 0) return;
    const stats = await this.getStats();
    const payload = this.encoder.encode(sseFormat('stats', {
      type: 'stats', reason, stats, at: new Date().toISOString()
    }));
    for (const writer of this.sseClients) {
      writer.write(payload).catch(() => this.dropClient(writer));
    }
  }

  async fetch(request) {
    const url = new URL(request.url);

    if (url.pathname === '/api/health') {
      const devices = await this.listDevices();
      return jsonResponse(200, {
        ok: true,
        role: 'hub',
        runtime: 'cloudflare-worker',
        version: 1,
        deviceCount: devices.length,
        secretRequired: Boolean(this.secret),
        now: new Date().toISOString()
      });
    }

    if (!isAuthorized(request, this.secret)) return jsonResponse(401, { error: 'unauthorized' });

    if ((request.method === 'GET' || request.method === 'HEAD') && url.pathname === '/api/stats') {
      return jsonResponse(200, await this.getStats());
    }

    if ((request.method === 'GET' || request.method === 'HEAD') && url.pathname === '/api/devices') {
      const devices = await this.listDevices();
      return jsonResponse(200, { devices });
    }

    if (request.method === 'GET' && url.pathname === '/api/stats/stream') {
      const stats = await this.getStats();
      const { readable, writable } = new TransformStream();
      const writer = writable.getWriter();
      writer.write(this.encoder.encode(sseFormat('snapshot', {
        type: 'stats', reason: 'snapshot', stats, at: new Date().toISOString()
      }))).catch(() => {});
      this.sseClients.add(writer);
      this.ensureHeartbeat();
      request.signal.addEventListener('abort', () => this.dropClient(writer));
      return new Response(readable, {
        status: 200,
        headers: {
          'content-type': 'text/event-stream',
          'cache-control': 'no-cache, no-transform',
          'connection': 'keep-alive',
          'x-accel-buffering': 'no',
          ...CORS_HEADERS
        }
      });
    }

    if (request.method === 'POST' && url.pathname === '/api/ingest') {
      let payload;
      try { payload = await request.json(); }
      catch (error) { return jsonResponse(400, { error: 'bad_request', message: error.message }); }
      if (!payload.deviceId && !payload.id) return jsonResponse(400, { error: 'deviceId_required' });
      const record = normalizeDeviceRecord({ ...payload, receivedAt: new Date().toISOString() });
      await this.state.storage.put(`dev:${record.deviceId}`, record);
      this.broadcast('ingest').catch(() => {});
      return jsonResponse(200, { ok: true, deviceId: record.deviceId, stats: await this.getStats() });
    }

    if (request.method === 'DELETE' && url.pathname.startsWith('/api/devices/')) {
      const deviceId = decodeURIComponent(url.pathname.slice('/api/devices/'.length));
      await this.state.storage.delete(`dev:${deviceId}`);
      this.broadcast('delete').catch(() => {});
      return jsonResponse(200, { ok: true, deviceId });
    }

    return jsonResponse(404, { error: 'not_found' });
  }
}
