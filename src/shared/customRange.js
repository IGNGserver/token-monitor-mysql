'use strict';

const { emptyPeriod, projectRollupFromSessions } = require('./usage');

const DATE_RE = /^(\d{4})-(\d{2})-(\d{2})$/;

function clampHour(value) {
  const n = Number(value);
  if (!Number.isFinite(n)) return 0;
  return Math.min(23, Math.max(0, Math.trunc(n)));
}

function parseDateParts(value) {
  const match = DATE_RE.exec(String(value || '').trim());
  if (!match) return null;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const date = new Date(year, month - 1, day);
  if (
    date.getFullYear() !== year
    || date.getMonth() !== month - 1
    || date.getDate() !== day
  ) return null;
  return { year, month, day, key: `${String(year).padStart(4, '0')}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}` };
}

function localDateTimeMs(dateKey, hour, endOfHour = false) {
  const parts = parseDateParts(dateKey);
  if (!parts) return NaN;
  const h = clampHour(hour);
  if (endOfHour) return new Date(parts.year, parts.month - 1, parts.day, h, 59, 59, 999).getTime();
  return new Date(parts.year, parts.month - 1, parts.day, h, 0, 0, 0).getTime();
}

function timestampMs(value) {
  if (!value) return 0;
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  const ms = Date.parse(String(value));
  return Number.isFinite(ms) ? ms : 0;
}

function compareDateHour(aDate, aHour, bDate, bHour) {
  if (aDate < bDate) return -1;
  if (aDate > bDate) return 1;
  return clampHour(aHour) - clampHour(bHour);
}

function normalizeCustomRange(input = {}) {
  const startParts = parseDateParts(input.startDate || input.fromDate || input.since);
  const endParts = parseDateParts(input.endDate || input.toDate || input.until) || startParts;
  if (!startParts || !endParts) {
    return { ok: false, error: 'invalid-date' };
  }
  let startDate = startParts.key;
  let endDate = endParts.key;
  let startHour = clampHour(input.startHour ?? input.fromHour ?? 0);
  let endHour = clampHour(input.endHour ?? input.toHour ?? 23);
  if (compareDateHour(startDate, startHour, endDate, endHour) > 0) {
    return { ok: false, error: 'inverted-range' };
  }
  const startMs = localDateTimeMs(startDate, startHour, false);
  const endMs = localDateTimeMs(endDate, endHour, true);
  if (!Number.isFinite(startMs) || !Number.isFinite(endMs) || startMs > endMs) {
    return { ok: false, error: 'invalid-range' };
  }
  return {
    ok: true,
    startDate,
    endDate,
    startHour,
    endHour,
    startMs,
    endMs,
    since: startDate,
    until: endDate,
    isSameDay: startDate === endDate,
    coversFullDays: startHour === 0 && endHour === 23
  };
}

function sessionOverlapsRange(session, startMs, endMs) {
  const started = timestampMs(session?.startedAt);
  const lastUsed = timestampMs(session?.lastUsedAt);
  if (!started && !lastUsed) return null;
  const left = started || lastUsed;
  const right = lastUsed || started;
  return left <= endMs && right >= startMs;
}

function addSessionIntoPeriod(period, session) {
  if (!session?.client || !session?.sessionId) return;
  const key = `${session.client}:${session.sessionId}`;
  period.sessions[key] = session;
  const tokens = Math.max(0, Math.round(Number(session.totalTokens) || 0));
  const cost = Number(session.costUsd) || 0;
  const cacheRead = Math.max(0, Math.round(Number(session.cacheReadTokens) || 0));
  const cacheWrite = Math.max(0, Math.round(Number(session.cacheWriteTokens) || 0));
  const output = Math.max(0, Math.round(Number(session.outputTokens) || 0));
  period.totalTokens += tokens;
  period.costUsd += cost;
  period.cacheReadTokens += cacheRead;
  period.cacheWriteTokens += cacheWrite;
  period.outputTokens += output;
  if (tokens > 0) {
    period.clients[session.client] = (period.clients[session.client] || 0) + tokens;
    if (cacheRead > 0) period.clientCacheReads[session.client] = (period.clientCacheReads[session.client] || 0) + cacheRead;
    if (cacheWrite > 0) period.clientCacheWrites[session.client] = (period.clientCacheWrites[session.client] || 0) + cacheWrite;
    if (output > 0) period.clientOutputs[session.client] = (period.clientOutputs[session.client] || 0) + output;
  }
  if (cost > 0) period.clientCosts[session.client] = (period.clientCosts[session.client] || 0) + cost;
  for (const [model, modelTokens] of Object.entries(session.models || {})) {
    const t = Math.max(0, Math.round(Number(modelTokens) || 0));
    if (!t) continue;
    period.models[model] = (period.models[model] || 0) + t;
    if (!period.clientModels[session.client]) period.clientModels[session.client] = {};
    period.clientModels[session.client][model] = (period.clientModels[session.client][model] || 0) + t;
  }
  for (const [model, modelCost] of Object.entries(session.modelCosts || {})) {
    const c = Number(modelCost) || 0;
    if (!c) continue;
    period.modelCosts[model] = (period.modelCosts[model] || 0) + c;
    if (!period.clientModelCosts[session.client]) period.clientModelCosts[session.client] = {};
    period.clientModelCosts[session.client][model] = (period.clientModelCosts[session.client][model] || 0) + c;
  }
}

function periodFromSessions(sessions, options = {}) {
  const period = emptyPeriod();
  for (const session of Object.values(sessions || {})) {
    addSessionIntoPeriod(period, session);
  }
  period.projects = options.projectsEnabled === false
    ? Object.create(null)
    : projectRollupFromSessions(period.sessions);
  return period;
}

function filterPeriodByCustomRange(period, rangeInput, options = {}) {
  const range = rangeInput?.ok === true ? rangeInput : normalizeCustomRange(rangeInput);
  if (!range.ok) return emptyPeriod();
  // Full local-day windows already match tokscale --since/--until, so keep the
  // day-level aggregates as-is (session timestamps can lag or span midnight).
  if (range.coversFullDays && period && typeof period === 'object') {
    const copy = periodFromSessions(period.sessions || {}, options);
    // Prefer original non-session aggregates when present — they include rows that
    // never formed a session entry.
    if (Number(period.totalTokens) > 0) {
      return {
        ...period,
        projects: options.projectsEnabled === false
          ? Object.create(null)
          : (period.projects && Object.keys(period.projects).length
            ? period.projects
            : projectRollupFromSessions(period.sessions || {}))
      };
    }
    return copy;
  }
  const sourceSessions = period?.sessions || {};
  const kept = Object.create(null);
  let missingTimestamp = 0;
  for (const [key, session] of Object.entries(sourceSessions)) {
    const overlap = sessionOverlapsRange(session, range.startMs, range.endMs);
    if (overlap === null) {
      missingTimestamp += 1;
      continue;
    }
    if (overlap) kept[key] = session;
  }
  const filtered = periodFromSessions(kept, options);
  filtered._meta = {
    sourceSessions: Object.keys(sourceSessions).length,
    keptSessions: Object.keys(kept).length,
    missingTimestamp
  };
  return filtered;
}

function formatCustomRangeLabel(rangeInput, options = {}) {
  const range = rangeInput?.ok === true ? rangeInput : normalizeCustomRange(rangeInput);
  if (!range.ok) return '';
  const pad = (n) => String(n).padStart(2, '0');
  const start = `${range.startDate} ${pad(range.startHour)}:00`;
  const end = `${range.endDate} ${pad(range.endHour)}:00`;
  if (options.compact && range.isSameDay) {
    return `${range.startDate} ${pad(range.startHour)}–${pad(range.endHour)}h`;
  }
  return `${start} → ${end}`;
}

function localDayKey(date = new Date()) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function defaultCustomRange(now = new Date()) {
  return normalizeCustomRange({
    startDate: localDayKey(now),
    endDate: localDayKey(now),
    startHour: 0,
    endHour: Math.min(23, now.getHours())
  });
}

module.exports = {
  clampHour,
  compareDateHour,
  defaultCustomRange,
  filterPeriodByCustomRange,
  formatCustomRangeLabel,
  localDateTimeMs,
  localDayKey,
  normalizeCustomRange,
  parseDateParts,
  periodFromSessions,
  sessionOverlapsRange
};
