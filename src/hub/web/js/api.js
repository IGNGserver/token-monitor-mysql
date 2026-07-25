const STORAGE_SECRET = 'token-monitor.hub.secret';
const STORAGE_SECRET_SESSION = 'token-monitor.hub.secret.session';
const STORAGE_PREFS = 'token-monitor.hub.prefs';

export function loadPrefs() {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_PREFS) || '{}') || {};
  } catch {
    return {};
  }
}

export function savePrefs(patch) {
  const next = { ...loadPrefs(), ...patch };
  localStorage.setItem(STORAGE_PREFS, JSON.stringify(next));
  return next;
}

export function loadSecret() {
  return sessionStorage.getItem(STORAGE_SECRET_SESSION)
    || localStorage.getItem(STORAGE_SECRET)
    || '';
}

export function saveSecret(secret, remember) {
  const value = String(secret || '').trim();
  sessionStorage.removeItem(STORAGE_SECRET_SESSION);
  localStorage.removeItem(STORAGE_SECRET);
  if (!value) return;
  if (remember) localStorage.setItem(STORAGE_SECRET, value);
  else sessionStorage.setItem(STORAGE_SECRET_SESSION, value);
}

export function clearSecret() {
  sessionStorage.removeItem(STORAGE_SECRET_SESSION);
  localStorage.removeItem(STORAGE_SECRET);
}

function authHeaders(secret, extra = {}) {
  const headers = { ...extra };
  const value = String(secret || '').trim();
  if (value) headers.authorization = `Bearer ${value}`;
  return headers;
}

export async function fetchHealth() {
  const res = await fetch('/api/health', { cache: 'no-store' });
  if (!res.ok) throw new Error(`health_${res.status}`);
  return res.json();
}

export async function fetchJson(path, { secret, method = 'GET', body, signal } = {}) {
  const res = await fetch(path, {
    method,
    signal,
    cache: 'no-store',
    headers: authHeaders(secret, body ? { 'content-type': 'application/json' } : {}),
    body: body ? JSON.stringify(body) : undefined
  });
  if (res.status === 401) {
    const error = new Error('unauthorized');
    error.status = 401;
    throw error;
  }
  if (!res.ok) {
    let detail = '';
    try { detail = (await res.json())?.error || ''; } catch { /* ignore */ }
    const error = new Error(detail || `http_${res.status}`);
    error.status = res.status;
    throw error;
  }
  if (res.status === 204) return null;
  return res.json();
}

export function openStatsStream({ secret, onStats, onStatus }) {
  const controller = new AbortController();
  let closed = false;

  async function run() {
    onStatus?.('connecting');
    try {
      const res = await fetch('/api/stats/stream', {
        headers: authHeaders(secret, { accept: 'text/event-stream' }),
        signal: controller.signal,
        cache: 'no-store'
      });
      if (res.status === 401) {
        onStatus?.('unauthorized');
        return;
      }
      if (!res.ok || !res.body) {
        onStatus?.('error');
        return;
      }
      onStatus?.('live');
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';
      while (!closed) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const chunks = buffer.split('\n\n');
        buffer = chunks.pop() || '';
        for (const chunk of chunks) {
          const lines = chunk.split('\n');
          let event = 'message';
          const dataLines = [];
          for (const line of lines) {
            if (line.startsWith('event:')) event = line.slice(6).trim();
            else if (line.startsWith('data:')) dataLines.push(line.slice(5).trim());
          }
          if (!dataLines.length) continue;
          try {
            const payload = JSON.parse(dataLines.join('\n'));
            if (event === 'snapshot' || event === 'stats' || payload?.stats) {
              onStats?.(payload.stats || payload, event);
            }
          } catch {
            /* ignore malformed frames */
          }
        }
      }
      if (!closed) onStatus?.('disconnected');
    } catch (error) {
      if (controller.signal.aborted) return;
      onStatus?.(error?.message === 'unauthorized' ? 'unauthorized' : 'error');
    }
  }

  run();
  return () => {
    closed = true;
    controller.abort();
  };
}
