'use strict';

const assert = require('node:assert/strict');
const test = require('node:test');

const {
  filterPeriodByCustomRange,
  formatCustomRangeLabel,
  normalizeCustomRange,
  periodFromSessions
} = require('../../src/shared/customRange');
const { emptyPeriod } = require('../../src/shared/usage');
const picker = require('../../src/electron/renderer/customRangePicker');

test('normalizeCustomRange accepts same-day hour windows', () => {
  const range = normalizeCustomRange({
    startDate: '2026-07-24',
    endDate: '2026-07-24',
    startHour: 9,
    endHour: 11
  });
  assert.equal(range.ok, true);
  assert.equal(range.isSameDay, true);
  assert.equal(range.coversFullDays, false);
  assert.ok(range.startMs < range.endMs);
});

test('normalizeCustomRange rejects inverted ranges', () => {
  const range = normalizeCustomRange({
    startDate: '2026-07-24',
    endDate: '2026-07-24',
    startHour: 18,
    endHour: 9
  });
  assert.equal(range.ok, false);
  assert.equal(range.error, 'inverted-range');
});

test('filterPeriodByCustomRange keeps overlapping sessions only', () => {
  const period = emptyPeriod();
  period.sessions = {
    'codex:a': {
      client: 'codex',
      sessionId: 'a',
      totalTokens: 100,
      costUsd: 1,
      startedAt: '2026-07-24T01:00:00.000Z',
      lastUsedAt: '2026-07-24T02:00:00.000Z',
      models: { 'gpt-5': 100 },
      modelCosts: { 'gpt-5': 1 },
      cacheReadTokens: 0,
      cacheWriteTokens: 0,
      outputTokens: 10
    },
    'codex:b': {
      client: 'codex',
      sessionId: 'b',
      totalTokens: 50,
      costUsd: 0.5,
      startedAt: '2026-07-25T10:00:00.000Z',
      lastUsedAt: '2026-07-25T11:00:00.000Z',
      models: { 'gpt-5': 50 },
      modelCosts: { 'gpt-5': 0.5 },
      cacheReadTokens: 0,
      cacheWriteTokens: 0,
      outputTokens: 5
    }
  };

  // Build a local range that covers only the first session by using its local day/hour.
  const start = new Date('2026-07-24T01:30:00.000Z');
  const end = new Date('2026-07-24T02:30:00.000Z');
  const startDate = `${start.getFullYear()}-${String(start.getMonth() + 1).padStart(2, '0')}-${String(start.getDate()).padStart(2, '0')}`;
  const endDate = `${end.getFullYear()}-${String(end.getMonth() + 1).padStart(2, '0')}-${String(end.getDate()).padStart(2, '0')}`;
  const filtered = filterPeriodByCustomRange(period, {
    startDate,
    endDate,
    startHour: start.getHours(),
    endHour: end.getHours()
  });
  assert.equal(Object.keys(filtered.sessions).length, 1);
  assert.equal(filtered.sessions['codex:a'].totalTokens, 100);
  assert.equal(filtered.totalTokens, 100);
  assert.equal(filtered.clients.codex, 100);
});

test('periodFromSessions rebuilds totals from session maps', () => {
  const period = periodFromSessions({
    'claude:1': {
      client: 'claude',
      sessionId: '1',
      totalTokens: 20,
      costUsd: 0.2,
      models: { sonnet: 20 },
      modelCosts: { sonnet: 0.2 },
      cacheReadTokens: 2,
      cacheWriteTokens: 1,
      outputTokens: 4
    }
  });
  assert.equal(period.totalTokens, 20);
  assert.equal(period.costUsd, 0.2);
  assert.equal(period.models.sonnet, 20);
  assert.equal(period.clientModels.claude.sonnet, 20);
});

test('formatCustomRangeLabel supports compact same-day form', () => {
  const label = formatCustomRangeLabel({
    startDate: '2026-07-24',
    endDate: '2026-07-24',
    startHour: 8,
    endHour: 20
  }, { compact: true });
  assert.equal(label, '2026-07-24 08–20h');
});

test('picker applyCalendarDayClick supports same-day then multi-day selection', () => {
  let draft = picker.normalizeDraft({
    startDate: '2026-07-01',
    endDate: '2026-07-01',
    startHour: 0,
    endHour: 23
  });
  draft = picker.applyCalendarDayClick(draft, '2026-07-10');
  assert.equal(draft.startDate, '2026-07-10');
  assert.equal(draft.endDate, '2026-07-10');
  assert.equal(draft._pickPhase, 'end');
  draft = picker.applyCalendarDayClick(draft, '2026-07-12');
  assert.equal(draft.startDate, '2026-07-10');
  assert.equal(draft.endDate, '2026-07-12');
  assert.equal(draft._pickPhase, 'done');
});

test('picker weekdayLabels returns seven Sunday-first labels', () => {
  const labels = picker.weekdayLabels('en');
  assert.equal(labels.length, 7);
  // English narrow weekdays are single letters or short glyphs; ensure non-empty.
  assert.equal(labels.every((label) => String(label).trim().length > 0), true);
});
