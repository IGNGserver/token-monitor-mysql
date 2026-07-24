'use strict';

(function exposeCustomRangePicker(root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) root.TokenMonitorCustomRangePicker = api;
})(typeof window !== 'undefined' ? window : null, function createCustomRangePickerApi() {
  const DATE_RE = /^(\d{4})-(\d{2})-(\d{2})$/;

  function pad2(n) {
    return String(n).padStart(2, '0');
  }

  function clampHour(value) {
    const n = Number(value);
    if (!Number.isFinite(n)) return 0;
    return Math.min(23, Math.max(0, Math.trunc(n)));
  }

  function parseDateKey(value) {
    const match = DATE_RE.exec(String(value || '').trim());
    if (!match) return null;
    const year = Number(match[1]);
    const month = Number(match[2]);
    const day = Number(match[3]);
    const date = new Date(year, month - 1, day);
    if (date.getFullYear() !== year || date.getMonth() !== month - 1 || date.getDate() !== day) return null;
    return `${String(year).padStart(4, '0')}-${pad2(month)}-${pad2(day)}`;
  }

  function localDayKey(date = new Date()) {
    return `${date.getFullYear()}-${pad2(date.getMonth() + 1)}-${pad2(date.getDate())}`;
  }

  function compareDateHour(aDate, aHour, bDate, bHour) {
    if (aDate < bDate) return -1;
    if (aDate > bDate) return 1;
    return clampHour(aHour) - clampHour(bHour);
  }

  function normalizeDraft(input = {}, now = new Date()) {
    const today = localDayKey(now);
    const startDate = parseDateKey(input.startDate) || today;
    const endDate = parseDateKey(input.endDate) || startDate;
    const startHour = clampHour(input.startHour ?? 0);
    const endHour = clampHour(input.endHour ?? Math.min(23, now.getHours()));
    if (compareDateHour(startDate, startHour, endDate, endHour) > 0) {
      return { ok: false, error: 'inverted-range', startDate, endDate, startHour, endHour, _pickPhase: input._pickPhase };
    }
    return {
      ok: true,
      startDate,
      endDate,
      startHour,
      endHour,
      isSameDay: startDate === endDate,
      _pickPhase: input._pickPhase || 'done'
    };
  }

  function formatHourLabel(hour) {
    return `${pad2(clampHour(hour))}:00`;
  }

  function formatRangeLabel(range, options = {}) {
    const draft = normalizeDraft(range || {});
    if (!draft.startDate || !draft.endDate) return '';
    if (options.compact && draft.startDate === draft.endDate) {
      return `${draft.startDate} ${pad2(draft.startHour)}–${pad2(draft.endHour)}h`;
    }
    return `${draft.startDate} ${formatHourLabel(draft.startHour)} → ${draft.endDate} ${formatHourLabel(draft.endHour)}`;
  }

  function shiftMonth(year, monthIndex, delta) {
    const date = new Date(year, monthIndex + delta, 1);
    return { year: date.getFullYear(), monthIndex: date.getMonth() };
  }

  function monthLabel(year, monthIndex, locale = 'en') {
    try {
      return new Intl.DateTimeFormat(locale, { month: 'long', year: 'numeric' }).format(new Date(year, monthIndex, 1));
    } catch (_) {
      return `${year}-${pad2(monthIndex + 1)}`;
    }
  }

  // Sunday-first labels matching the calendar grid's getDay() ordering.
  function weekdayLabels(locale = 'en') {
    const fallback = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'];
    try {
      // 2024-01-07 is a Sunday in local time for this fixed Y-M-D constructor.
      const formatter = new Intl.DateTimeFormat(locale, { weekday: 'narrow' });
      return Array.from({ length: 7 }, (_, index) => {
        const label = formatter.format(new Date(2024, 0, 7 + index));
        return label || fallback[index];
      });
    } catch (_) {
      return fallback;
    }
  }

  function buildMonthCells(year, monthIndex, draft = {}) {
    const first = new Date(year, monthIndex, 1);
    const startWeekday = first.getDay();
    const daysInMonth = new Date(year, monthIndex + 1, 0).getDate();
    const startDate = parseDateKey(draft.startDate);
    const endDate = parseDateKey(draft.endDate) || startDate;
    const cells = [];
    const leading = startWeekday;
    const total = Math.ceil((leading + daysInMonth) / 7) * 7;
    for (let i = 0; i < total; i += 1) {
      const dayNumber = i - leading + 1;
      const inMonth = dayNumber >= 1 && dayNumber <= daysInMonth;
      const date = localDayKey(new Date(year, monthIndex, dayNumber));
      const isStart = Boolean(startDate && date === startDate);
      const isEnd = Boolean(endDate && date === endDate);
      const inRange = Boolean(startDate && endDate && date >= startDate && date <= endDate);
      cells.push({
        date,
        dayNumber: Number(date.slice(-2)),
        inMonth,
        isStart,
        isEnd,
        inRange,
        isEndpoint: isStart || isEnd
      });
    }
    return cells;
  }

  function applyCalendarDayClick(draft, dateKey) {
    const nextDate = parseDateKey(dateKey);
    if (!nextDate) return { ...draft };
    const current = normalizeDraft(draft);
    const phase = draft._pickPhase || 'done';
    if (phase !== 'end') {
      return {
        ...current,
        ok: true,
        startDate: nextDate,
        endDate: nextDate,
        error: undefined,
        _pickPhase: 'end'
      };
    }
    if (nextDate < current.startDate) {
      return {
        ...current,
        ok: true,
        startDate: nextDate,
        endDate: current.startDate,
        error: undefined,
        _pickPhase: 'done'
      };
    }
    return {
      ...current,
      ok: true,
      endDate: nextDate,
      error: undefined,
      _pickPhase: 'done'
    };
  }

  function hourOptions() {
    return Array.from({ length: 24 }, (_, hour) => ({ value: hour, label: formatHourLabel(hour) }));
  }

  return {
    applyCalendarDayClick,
    buildMonthCells,
    clampHour,
    compareDateHour,
    formatHourLabel,
    formatRangeLabel,
    hourOptions,
    localDayKey,
    monthLabel,
    normalizeDraft,
    parseDateKey,
    shiftMonth,
    weekdayLabels
  };
});
