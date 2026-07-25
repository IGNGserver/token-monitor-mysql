import {
  clearSecret,
  fetchHealth,
  fetchJson,
  loadPrefs,
  loadSecret,
  openStatsStream,
  savePrefs,
  saveSecret
} from './api.js';
import { applyI18n, resolveLocale, t } from './i18n.js';
import {
  formatCompact,
  formatCost,
  formatNumber,
  formatRelative,
  formatReset,
  toDatetimeLocalValue
} from './format.js';
import {
  clientIconPath,
  clientLabel,
  deviceRows,
  historyDaily,
  limitCards,
  modelRows,
  platformLabel,
  projectRows,
  sessionRows,
  toolRows
} from './data.js';

const VIEWS = [
  { id: 'home', icon: '⌂' },
  { id: 'tool', icon: '⚒' },
  { id: 'device', icon: '▣' },
  { id: 'model', icon: '◈' },
  { id: 'project', icon: '◫' },
  { id: 'session', icon: '☰' },
  { id: 'limits', icon: '◔' },
  { id: 'trends', icon: '∿' }
];

const PERIODS = ['today', 'month', 'allTime'];

const els = {
  app: document.getElementById('app'),
  primaryNav: document.getElementById('primaryNav'),
  streamStatus: document.getElementById('streamStatus'),
  streamStatusText: document.getElementById('streamStatusText'),
  settingsOpen: document.getElementById('settingsOpen'),
  menuToggle: document.getElementById('menuToggle'),
  pageTitle: document.getElementById('pageTitle'),
  pageMeta: document.getElementById('pageMeta'),
  periodTabs: document.getElementById('periodTabs'),
  customRangeBtn: document.getElementById('customRangeBtn'),
  refreshBtn: document.getElementById('refreshBtn'),
  totalTokens: document.getElementById('totalTokens'),
  totalCost: document.getElementById('totalCost'),
  deviceCount: document.getElementById('deviceCount'),
  liveLabel: document.getElementById('liveLabel'),
  content: document.getElementById('content'),
  authGate: document.getElementById('authGate'),
  authForm: document.getElementById('authForm'),
  secretInput: document.getElementById('secretInput'),
  rememberSecret: document.getElementById('rememberSecret'),
  authError: document.getElementById('authError'),
  settingsDrawer: document.getElementById('settingsDrawer'),
  languageSelect: document.getElementById('languageSelect'),
  themeSelect: document.getElementById('themeSelect'),
  currencySelect: document.getElementById('currencySelect'),
  settingsSecret: document.getElementById('settingsSecret'),
  saveSettingsBtn: document.getElementById('saveSettingsBtn'),
  signOutBtn: document.getElementById('signOutBtn'),
  aboutLine: document.getElementById('aboutLine'),
  rangePopover: document.getElementById('rangePopover'),
  rangeFrom: document.getElementById('rangeFrom'),
  rangeTo: document.getElementById('rangeTo'),
  rangeError: document.getElementById('rangeError'),
  rangeApply: document.getElementById('rangeApply'),
  rangeClear: document.getElementById('rangeClear'),
  rangeClose: document.getElementById('rangeClose'),
  toast: document.getElementById('toast'),
  navScrim: document.getElementById('navScrim'),
  heroStrip: document.getElementById('heroStrip')
};

const state = {
  prefs: {
    language: 'auto',
    theme: 'system',
    currency: 'USD',
    view: 'home',
    period: 'today',
    trendsRange: '30',
    trendsStack: 'client',
    ...loadPrefs()
  },
  secret: loadSecret(),
  locale: 'en',
  health: null,
  stats: null,
  history: null,
  customRange: null,
  customPeriod: null,
  stream: 'offline',
  stopStream: null,
  toastTimer: null
};

function tr(key, params) {
  return t(state.locale, key, params);
}

function activePeriod() {
  if (state.customPeriod) return state.customPeriod;
  return state.stats?.periods?.[state.prefs.period] || {
    totalTokens: 0,
    costUsd: 0,
    clients: {},
    clientCosts: {},
    models: {},
    modelCosts: {},
    projects: {},
    sessions: {}
  };
}

function showToast(message) {
  els.toast.textContent = message;
  els.toast.classList.remove('hidden');
  clearTimeout(state.toastTimer);
  state.toastTimer = setTimeout(() => els.toast.classList.add('hidden'), 2200);
}

function setStreamStatus(status) {
  state.stream = status;
  const map = {
    connecting: 'status.connecting',
    live: 'status.live',
    disconnected: 'status.offline',
    offline: 'status.offline',
    unauthorized: 'status.unauthorized',
    error: 'status.error'
  };
  const live = status === 'live';
  els.streamStatus.dataset.state = live ? 'live' : (status === 'unauthorized' || status === 'error' ? 'error' : 'offline');
  els.streamStatusText.textContent = tr(map[status] || 'status.offline');
  els.liveLabel.textContent = live ? tr('stats.live.on') : tr('stats.live.off');
  if (status === 'unauthorized') showAuth(true);
}

function applyTheme() {
  const pref = state.prefs.theme || 'system';
  const systemDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
  const theme = pref === 'system' ? (systemDark ? 'dark' : 'light') : pref;
  document.documentElement.dataset.theme = theme;
  const meta = document.querySelector('meta[name="theme-color"]:not([media])')
    || document.querySelector('meta[name="theme-color"]');
  if (meta) meta.setAttribute('content', theme === 'dark' ? '#0b0c0e' : '#f4f5f7');
}

function applyLocale() {
  state.locale = resolveLocale(state.prefs.language);
  document.documentElement.lang = state.locale;
  applyI18n(document, state.locale);
  renderChrome();
  render();
}

function showAuth(show) {
  els.authGate.classList.toggle('hidden', !show);
  if (show) {
    els.secretInput.value = state.secret || '';
    els.authError.classList.add('hidden');
    els.secretInput.focus();
  }
}

function openSettings(open) {
  els.settingsDrawer.classList.toggle('hidden', !open);
  els.settingsDrawer.setAttribute('aria-hidden', open ? 'false' : 'true');
  if (open) {
    els.languageSelect.value = state.prefs.language || 'auto';
    els.themeSelect.value = state.prefs.theme || 'system';
    els.currencySelect.value = state.prefs.currency || 'USD';
    els.settingsSecret.value = state.secret || '';
  }
}

function openRange(open) {
  els.rangePopover.classList.toggle('hidden', !open);
  if (open) {
    const now = new Date();
    const start = state.customRange?.from
      ? new Date(state.customRange.from)
      : new Date(now.getTime() - 24 * 60 * 60 * 1000);
    const end = state.customRange?.to ? new Date(state.customRange.to) : now;
    els.rangeFrom.value = toDatetimeLocalValue(start);
    els.rangeTo.value = toDatetimeLocalValue(end);
    els.rangeError.classList.add('hidden');
  }
}

function renderChrome() {
  els.primaryNav.innerHTML = VIEWS.map((view) => `
    <button type="button" class="nav-btn ${state.prefs.view === view.id ? 'active' : ''}" data-view="${view.id}">
      <span class="nav-ico" aria-hidden="true">${view.icon}</span>
      <span class="nav-label">${tr(`nav.${view.id}`)}</span>
    </button>
  `).join('');

  els.periodTabs.innerHTML = [
    ...PERIODS.map((period) => `
      <button type="button" class="period-tab ${!state.customPeriod && state.prefs.period === period ? 'active' : ''}" data-period="${period}">
        ${tr(`period.${period}`)}
      </button>
    `),
    state.customPeriod ? `<button type="button" class="period-tab active" data-period="custom">${tr('period.custom')}</button>` : ''
  ].join('');

  els.pageTitle.textContent = tr(`nav.${state.prefs.view}`);
  const devices = state.stats?.devices?.length || 0;
  const periodLabel = state.customPeriod
    ? tr('period.custom')
    : tr(`period.${state.prefs.period}`);
  els.pageMeta.textContent = `${periodLabel} · ${devices} ${tr('stats.devices').toLowerCase()}`;
  els.aboutLine.textContent = `Token Monitor hub web · ${state.health?.now ? new Date(state.health.now).toLocaleString(state.locale) : 'ready'}`;
}

function rowHtml(row, { showIcon = false, sub } = {}) {
  const icon = showIcon && row.client
    ? `<img class="client-icon" src="${clientIconPath(row.client)}" alt="" onerror="this.style.display='none'" />`
    : (showIcon
      ? `<img class="client-icon" src="${clientIconPath(row.key)}" alt="" onerror="this.style.display='none'" />`
      : `<span class="swatch" style="background:${row.color}"></span>`);
  return `
    <div class="row">
      <div class="row-main">
        ${icon}
        <div class="row-copy">
          <div class="row-name">${escapeHtml(row.name)}</div>
          ${sub || row.sub ? `<div class="row-sub">${escapeHtml(sub || row.sub)}</div>` : ''}
        </div>
      </div>
      <div class="row-metrics">
        <div class="row-value">${formatNumber(row.value)}</div>
        <div class="row-cost">${formatCost(row.cost, state.prefs.currency)}</div>
      </div>
    </div>
  `;
}

function emptyHtml(key) {
  return `<div class="empty-card">${tr(key)}</div>`;
}

function panel(title, body, meta = '') {
  return `
    <section class="panel">
      <div class="panel-head">
        <h2 class="panel-title">${escapeHtml(title)}</h2>
        ${meta ? `<div class="panel-meta tiny">${escapeHtml(meta)}</div>` : ''}
      </div>
      ${body}
    </section>
  `;
}

function escapeHtml(value) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;');
}

function renderHero() {
  const period = activePeriod();
  els.totalTokens.textContent = formatCompact(period.totalTokens || 0);
  els.totalTokens.title = formatNumber(period.totalTokens || 0);
  els.totalCost.textContent = formatCost(period.costUsd || 0, state.prefs.currency);
  els.deviceCount.textContent = formatNumber(state.stats?.devices?.length || 0);
}


function historySource() {
  return state.history || state.stats?.historyPreview || null;
}

function historyHasBreakdown(history) {
  return (history?.daily || []).some((day) => {
    const clients = day?.perClient && Object.keys(day.perClient).length > 0;
    const models = day?.perModel && Object.keys(day.perModel).length > 0;
    return Boolean(clients || models);
  });
}

function niceCeiling(value) {
  const n = Math.max(1, Number(value) || 1);
  const exp = Math.floor(Math.log10(n));
  const base = 10 ** exp;
  const mantissa = n / base;
  const nice = mantissa <= 1 ? 1 : mantissa <= 2 ? 2 : mantissa <= 5 ? 5 : 10;
  return nice * base;
}

function yAxisScale(maxValue, tickCount = 4) {
  const top = niceCeiling(maxValue);
  const ticks = [];
  for (let i = 0; i <= tickCount; i += 1) ticks.push((top * i) / tickCount);
  return { top, ticks };
}

function renderYAxis({ pad, width, height, top, ticks }) {
  const innerH = height - pad.top - pad.bottom;
  const lines = ticks.map((value) => {
    const y = height - pad.bottom - (innerH * value) / Math.max(1, top);
    return `
      <line class="grid-line" x1="${pad.left}" y1="${y}" x2="${width - pad.right}" y2="${y}" />
      <text class="axis-label axis-y" x="${pad.left - 8}" y="${y + 3}" text-anchor="end">${escapeHtml(formatCompact(value))}</text>
    `;
  }).join('');
  return lines;
}

function tipText(parts) {
  return parts.filter(Boolean).join(' · ');
}

function renderHome() {
  const period = activePeriod();
  const tools = toolRows(period).slice(0, 5);
  const models = modelRows(period).slice(0, 5);
  const devices = deviceRows(state.stats, state.customPeriod ? 'today' : state.prefs.period).slice(0, 5);
  const limits = limitCards(state.stats).slice(0, 4);
  const daily = historyDaily(historySource(), 14);

  const toolsBody = tools.length
    ? `<div class="stack">${tools.map((row) => rowHtml({ ...row, client: row.key }, { showIcon: true, sub: `${Math.round((row.value / Math.max(1, period.totalTokens || 0)) * 100)}%` })).join('')}</div>`
    : emptyHtml('empty.usage');
  const modelsBody = models.length
    ? `<div class="stack">${models.map((row) => rowHtml(row, { sub: `${Math.round((row.value / Math.max(1, period.totalTokens || 0)) * 100)}%` })).join('')}</div>`
    : emptyHtml('empty.usage');
  const devicesBody = devices.length
    ? `<div class="stack">${devices.map((row) => rowHtml(row, { sub: `${platformLabel(row.platform)}${row.stale ? ` · ${tr('devices.stale')}` : ''}` })).join('')}</div>`
    : emptyHtml('empty.usage');
  const limitsBody = limits.length
    ? `<div class="stack">${limits.map((card) => `
        <div class="row">
          <div class="row-main">
            <span class="swatch" style="background:${card.color}"></span>
            <div class="row-copy">
              <div class="row-name">${escapeHtml(card.name)}</div>
              <div class="row-sub">${escapeHtml(clientLabel(card.provider))}${card.plan ? ` · ${escapeHtml(card.plan)}` : ''}</div>
            </div>
          </div>
          <div class="row-metrics">
            <div class="row-value">${card.lowestRemaining == null ? '—' : `${Math.round(card.lowestRemaining)}%`}</div>
            <div class="row-cost">${card.stale ? tr('devices.stale') : tr('devices.live')}</div>
          </div>
        </div>
      `).join('')}</div>`
    : emptyHtml('empty.limits');

  return `
    <div class="grid-2">
      ${panel(tr('home.tools'), toolsBody)}
      ${panel(tr('home.models'), modelsBody)}
      ${panel(tr('home.devices'), devicesBody)}
      ${panel(tr('home.limits'), limitsBody)}
    </div>
    ${panel(tr('home.activity'), renderSparkline(daily), daily.length ? `${daily.length}d` : '')}
  `;
}

function renderListView(rows, emptyKey, { showIcon = false } = {}) {
  if (!rows.length) return emptyHtml(emptyKey);
  return `<div class="stack">${rows.map((row) => rowHtml(row, {
    showIcon,
    sub: row.sub || (row.lastUsedAt ? formatRelative(row.lastUsedAt, state.locale) : '')
  })).join('')}</div>`;
}

function renderDevices() {
  const rows = deviceRows(state.stats, state.customPeriod ? 'today' : state.prefs.period);
  if (!rows.length) return emptyHtml('empty.usage');
  return `
    <section class="panel">
      <div class="panel-head"><h2 class="panel-title">${tr('devices.title')}</h2></div>
      <div style="overflow:auto">
        <table class="device-table">
          <thead>
            <tr>
              <th>${tr('devices.id')}</th>
              <th>${tr('devices.platform')}</th>
              <th>${tr('devices.updated')}</th>
              <th>${tr('devices.tokens')}</th>
              <th>${tr('devices.actions')}</th>
            </tr>
          </thead>
          <tbody>
            ${rows.map((row) => `
              <tr>
                <td>
                  <div class="row-name">${escapeHtml(row.name)}</div>
                  <div class="row-sub">${row.stale ? tr('devices.stale') : tr('devices.live')}${row.hostname ? ` · ${escapeHtml(row.hostname)}` : ''}</div>
                </td>
                <td>${escapeHtml(platformLabel(row.platform))}</td>
                <td>${escapeHtml(formatRelative(row.updatedAt, state.locale))}</td>
                <td>
                  <div class="row-value">${formatNumber(row.value)}</div>
                  <div class="row-cost">${formatCost(row.cost, state.prefs.currency)}</div>
                </td>
                <td>
                  <div class="device-actions">
                    <button type="button" class="danger-btn" data-delete-device="${escapeHtml(row.key)}">${tr('devices.delete')}</button>
                  </div>
                </td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>
    </section>
  `;
}

function renderLimits() {
  const cards = limitCards(state.stats);
  if (!cards.length) return emptyHtml('empty.limits');
  return `
    <div class="grid-2">
      ${cards.map((card) => `
        <article class="limit-card">
          <div class="limit-head">
            <div class="row-main">
              <span class="swatch" style="background:${card.color}"></span>
              <div class="row-copy">
                <div class="row-name">${escapeHtml(card.name)}</div>
                <div class="row-sub">${escapeHtml(clientLabel(card.provider))}${card.plan ? ` · ${escapeHtml(card.plan)}` : ''}</div>
              </div>
            </div>
            <span class="badge ${card.stale ? 'stale' : 'ok'}">${card.stale ? tr('devices.stale') : card.status}</span>
          </div>
          <div class="limit-windows">
            ${(card.windows.length ? card.windows : [{ label: '—', remaining: null }]).map((window) => `
              <div class="limit-window">
                <div class="limit-window-label">
                  <span>${escapeHtml(window.label)}</span>
                  <strong>${window.remaining == null ? (window.value || '—') : `${Math.round(window.remaining)}%`}</strong>
                </div>
                <div class="meter"><span style="width:${window.remaining == null ? 0 : Math.max(0, Math.min(100, window.remaining))}%; background:${card.color}"></span></div>
                <div class="row-sub" style="margin-top:8px">
                  ${window.value && window.remaining != null ? escapeHtml(window.value) : ''}
                  ${window.resetsAt ? `${tr('limits.reset')} ${escapeHtml(formatReset(window.resetsAt, state.locale))}` : ''}
                </div>
              </div>
            `).join('')}
          </div>
        </article>
      `).join('')}
    </div>
  `;
}

function renderSparkline(daily) {
  if (!daily.length) return emptyHtml('empty.history');
  const width = 720;
  const height = 240;
  const pad = { top: 18, right: 16, bottom: 32, left: 52 };
  const values = daily.map((day) => Number(day.tokens || 0));
  const { top, ticks } = yAxisScale(Math.max(1, ...values));
  const innerW = width - pad.left - pad.right;
  const innerH = height - pad.top - pad.bottom;
  const slot = innerW / Math.max(1, daily.length);
  const barW = Math.max(4, slot - 4);
  const bars = daily.map((day, index) => {
    const tokens = Number(day.tokens || 0);
    const cost = Number(day.cost || 0);
    const h = Math.max(tokens > 0 ? 2 : 0, (innerH * tokens) / top);
    const x = pad.left + index * slot + (slot - barW) / 2;
    const y = height - pad.bottom - h;
    const tip = tipText([
      day.date || '',
      `${formatNumber(tokens)} ${tr('stats.tokens')}`,
      cost ? formatCost(cost, state.prefs.currency) : ''
    ]);
    return `<rect class="bar-seg chart-hit" x="${x}" y="${tokens > 0 ? y : height - pad.bottom - 2}" width="${barW}" height="${tokens > 0 ? h : 2}" rx="3" fill="var(--accent)" opacity="${tokens > 0 ? 0.9 : 0.25}" data-tip="${escapeHtml(tip)}"></rect>`;
  }).join('');
  const labelDays = [daily[0], daily[Math.floor(daily.length / 2)], daily[daily.length - 1]].filter(Boolean);
  const labels = labelDays.map((day) => {
    const idx = daily.indexOf(day);
    const x = pad.left + idx * slot + slot / 2;
    return `<text class="axis-label" x="${x}" y="${height - 10}" text-anchor="middle">${escapeHtml(String(day.date || '').slice(5))}</text>`;
  }).join('');
  return `
    <div class="chart-wrap">
      <svg class="chart-svg" viewBox="0 0 ${width} ${height}" role="img" aria-label="Usage trend">
        ${renderYAxis({ pad, width, height, top, ticks })}
        <line class="axis-base" x1="${pad.left}" y1="${height - pad.bottom}" x2="${width - pad.right}" y2="${height - pad.bottom}" />
        ${bars}
        ${labels}
      </svg>
    </div>
  `;
}

function renderHeatmap(daily) {
  if (!daily.length) return emptyHtml('empty.history');
  const values = daily.map((day) => Number(day.tokens || 0));
  const max = Math.max(1, ...values);
  const cell = 12;
  const gap = 3;
  const first = daily[0]?.date;
  const startDow = first ? new Date(`${first}T00:00:00Z`).getUTCDay() : 0;
  const weeks = Math.ceil((daily.length + startDow) / 7);
  const left = 28;
  const top = 4;
  const width = left + weeks * (cell + gap) + 8;
  const height = top + 7 * (cell + gap) + 8;
  const dowLabels = ['S', 'M', 'T', 'W', 'T', 'F', 'S']
    .map((label, index) => `<text class="axis-label" x="0" y="${top + index * (cell + gap) + cell - 1}">${label}</text>`)
    .join('');
  const cells = daily.map((day, index) => {
    const pos = index + startDow;
    const week = Math.floor(pos / 7);
    const dow = pos % 7;
    const tokens = Number(day.tokens || 0);
    const cost = Number(day.cost || 0);
    const ratio = tokens / max;
    const level = tokens <= 0 ? 0 : ratio < 0.25 ? 1 : ratio < 0.5 ? 2 : ratio < 0.75 ? 3 : 4;
    const x = left + week * (cell + gap);
    const y = top + dow * (cell + gap);
    const tip = tipText([
      day.date || '',
      `${formatNumber(tokens)} ${tr('stats.tokens')}`,
      cost ? formatCost(cost, state.prefs.currency) : ''
    ]);
    return `<rect class="heat lvl-${level} chart-hit" x="${x}" y="${y}" width="${cell}" height="${cell}" rx="3" data-tip="${escapeHtml(tip)}"></rect>`;
  }).join('');
  return `
    <div class="chart-wrap chart-wrap-heat">
      <svg class="chart-svg chart-svg-heat" style="min-width:${Math.max(320, width)}px;height:${height + 12}px" viewBox="0 0 ${width} ${height}" role="img" aria-label="Activity heatmap">
        ${dowLabels}
        ${cells}
      </svg>
    </div>
  `;
}

function renderStackedBars(daily, stackBy) {
  if (!daily.length) return emptyHtml('empty.history');
  const width = 760;
  const height = 280;
  const pad = { top: 18, right: 16, bottom: 36, left: 52 };
  const seriesKeys = new Map();
  for (const day of daily) {
    const map = stackBy === 'model' ? (day.perModel || {}) : (day.perClient || {});
    for (const [key, value] of Object.entries(map)) {
      const tokens = Number(value?.tokens ?? value ?? 0);
      if (tokens > 0) seriesKeys.set(key, (seriesKeys.get(key) || 0) + tokens);
    }
  }
  let topKeys = [...seriesKeys.entries()]
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .slice(0, 8)
    .map(([key]) => key);
  const useTotalsFallback = topKeys.length === 0;
  if (useTotalsFallback) {
    topKeys = ['total'];
    for (const day of daily) {
      const tokens = Number(day.tokens || 0);
      if (tokens > 0) seriesKeys.set('total', (seriesKeys.get('total') || 0) + tokens);
    }
  }

  const dayTotals = daily.map((day) => {
    if (useTotalsFallback) return Number(day.tokens || 0);
    const map = stackBy === 'model' ? (day.perModel || {}) : (day.perClient || {});
    return topKeys.reduce((sum, key) => sum + Number(map[key]?.tokens ?? map[key] ?? 0), 0);
  });
  const { top, ticks } = yAxisScale(Math.max(1, ...dayTotals, 1));
  const slot = (width - pad.left - pad.right) / Math.max(1, daily.length);
  const barW = Math.max(4, slot - 4);
  const palette = ['#2563eb', '#0f9f6e', '#c98512', '#d6455d', '#7c3aed', '#0891b2', '#db2777', '#65a30d'];
  const colorMap = Object.fromEntries(topKeys.map((key, index) => [key, useTotalsFallback ? 'var(--accent)' : palette[index % palette.length]]));

  const bars = daily.map((day, index) => {
    const map = useTotalsFallback
      ? { total: { tokens: Number(day.tokens || 0), cost: Number(day.cost || 0) } }
      : (stackBy === 'model' ? (day.perModel || {}) : (day.perClient || {}));
    let y = height - pad.bottom;
    const x = pad.left + index * slot + (slot - barW) / 2;
    const parts = [];
    const tipLines = [];
    for (const key of topKeys) {
      const tokens = Number(map[key]?.tokens ?? map[key] ?? 0);
      if (tokens <= 0) continue;
      const h = Math.max(1, ((height - pad.top - pad.bottom) * tokens) / top);
      y -= h;
      const label = useTotalsFallback
        ? tr('stats.tokens')
        : (stackBy === 'model' ? key : clientLabel(key));
      tipLines.push(`${label}: ${formatNumber(tokens)}`);
      parts.push(`<rect class="bar-seg chart-hit" x="${x}" y="${y}" width="${barW}" height="${h}" fill="${colorMap[key]}" data-tip="${escapeHtml(tipText([day.date || '', `${label}: ${formatNumber(tokens)}`]))}"></rect>`);
    }
    const total = dayTotals[index];
    const totalTip = tipText([
      day.date || '',
      `${formatNumber(total)} ${tr('stats.tokens')}`,
      Number(day.cost || 0) ? formatCost(day.cost, state.prefs.currency) : '',
      ...tipLines
    ]);
    // Full-height invisible hit area so empty days and gaps still show the day total.
    parts.unshift(`<rect class="chart-hit chart-hit-day" x="${x}" y="${pad.top}" width="${barW}" height="${height - pad.top - pad.bottom}" fill="transparent" data-tip="${escapeHtml(totalTip)}"></rect>`);
    return parts.join('');
  }).join('');

  const labelDays = [daily[0], daily[Math.floor(daily.length / 2)], daily[daily.length - 1]].filter(Boolean);
  const labels = labelDays.map((day) => {
    const idx = daily.indexOf(day);
    const x = pad.left + idx * slot + slot / 2;
    return `<text class="axis-label" x="${x}" y="${height - 12}" text-anchor="middle">${escapeHtml(String(day.date || '').slice(5))}</text>`;
  }).join('');

  const legend = topKeys.map((key) => `
    <div class="row">
      <div class="row-main">
        <span class="swatch" style="background:${colorMap[key]}"></span>
        <div class="row-name">${escapeHtml(useTotalsFallback ? tr('stats.tokens') : (stackBy === 'model' ? key : clientLabel(key)))}</div>
      </div>
      <div class="row-value">${formatNumber(seriesKeys.get(key) || 0)}</div>
    </div>
  `).join('');

  return `
    <div class="stack">
      <div class="chart-wrap">
        <svg class="chart-svg" viewBox="0 0 ${width} ${height}" role="img" aria-label="Stacked usage">
          ${renderYAxis({ pad, width, height, top, ticks })}
          <line class="axis-base" x1="${pad.left}" y1="${height - pad.bottom}" x2="${width - pad.right}" y2="${height - pad.bottom}" />
          ${bars}
          ${labels}
        </svg>
      </div>
      <div class="stack">${legend || emptyHtml('empty.history')}</div>
    </div>
  `;
}

function renderTrends() {
  const daily = historyDaily(historySource(), state.prefs.trendsRange === 'all' ? 0 : state.prefs.trendsRange);
  return `
    <section class="panel">
      <div class="panel-head">
        <h2 class="panel-title">${tr('nav.trends')}</h2>
        <div style="display:flex;gap:10px;flex-wrap:wrap;align-items:center">
          <div class="seg" data-control="stack">
            <button type="button" class="seg-btn ${state.prefs.trendsStack === 'client' ? 'active' : ''}" data-stack="client">${tr('trends.stack.client')}</button>
            <button type="button" class="seg-btn ${state.prefs.trendsStack === 'model' ? 'active' : ''}" data-stack="model">${tr('trends.stack.model')}</button>
          </div>
          <div class="seg" data-control="range">
            ${['7', '30', '90', '365', 'all'].map((range) => `
              <button type="button" class="seg-btn ${String(state.prefs.trendsRange) === range ? 'active' : ''}" data-range="${range}">${range === 'all' ? 'All' : range}</button>
            `).join('')}
          </div>
        </div>
      </div>
      ${renderStackedBars(daily, state.prefs.trendsStack)}
    </section>
    <section class="panel">
      <div class="panel-head"><h2 class="panel-title">${tr('home.activity')}</h2></div>
      ${renderHeatmap(historyDaily(historySource(), 90))}
    </section>
  `;
}

function render() {
  renderChrome();
  renderHero();
  const period = activePeriod();
  let html;
  switch (state.prefs.view) {
    case 'tool':
      html = panel(tr('nav.tool'), renderListView(toolRows(period).map((row) => ({ ...row, client: row.key })), 'empty.usage', { showIcon: true }));
      break;
    case 'device':
      html = renderDevices();
      break;
    case 'model':
      html = panel(tr('nav.model'), renderListView(modelRows(period), 'empty.usage'));
      break;
    case 'project':
      html = panel(tr('nav.project'), renderListView(projectRows(period), 'empty.projects'));
      break;
    case 'session':
      html = panel(tr('nav.session'), renderListView(sessionRows(period).map((row) => ({ ...row, sub: `${row.sub || ''}${row.lastUsedAt ? ` · ${formatRelative(row.lastUsedAt, state.locale)}` : ''}` })), 'empty.sessions', { showIcon: true }));
      break;
    case 'limits':
      html = renderLimits();
      break;
    case 'trends':
      html = renderTrends();
      break;
    default:
      html = renderHome();
  }
  els.content.innerHTML = html;
}

async function ensureHistory({ force = false } = {}) {
  // Full /api/history includes perClient/perModel stacks needed by Trends.
  // historyPreview from /api/stats is totals-only and must NOT block this fetch.
  if (!state.secret && state.health?.secretRequired) return;
  if (!force && historyHasBreakdown(state.history)) return;
  try {
    const full = await fetchJson('/api/history', { secret: state.secret });
    if (full && Array.isArray(full.daily)) state.history = full;
  } catch {
    // Keep any previously loaded full history; charts fall back to historyPreview totals.
  }
}

async function refreshStats() {
  const stats = await fetchJson('/api/stats', { secret: state.secret });
  state.stats = stats;
  render();
}

function connectStream() {
  if (state.stopStream) {
    state.stopStream();
    state.stopStream = null;
  }
  state.stopStream = openStatsStream({
    secret: state.secret,
    onStatus: setStreamStatus,
    onStats: (stats) => {
      state.stats = stats;
      render();
    }
  });
}

async function bootstrapAuthorized() {
  showAuth(false);
  await refreshStats();
  await ensureHistory();
  connectStream();
  render();
}

async function tryConnect(secret, remember = true) {
  state.secret = String(secret || '').trim();
  try {
    await fetchJson('/api/stats', { secret: state.secret });
    saveSecret(state.secret, remember);
    els.authError.classList.add('hidden');
    await bootstrapAuthorized();
    return true;
  } catch (error) {
    if (error.status === 401) {
      els.authError.textContent = tr('auth.error');
      els.authError.classList.remove('hidden');
      showAuth(true);
      return false;
    }
    throw error;
  }
}

async function deleteDevice(deviceId) {
  if (!deviceId) return;
  if (!window.confirm(tr('devices.confirmDelete'))) return;
  await fetchJson(`/api/devices/${encodeURIComponent(deviceId)}`, {
    secret: state.secret,
    method: 'DELETE'
  });
  showToast(tr('toast.deleted'));
  await refreshStats();
}

async function applyCustomRange() {
  const fromValue = els.rangeFrom.value;
  const toValue = els.rangeTo.value;
  if (!fromValue || !toValue) {
    els.rangeError.textContent = tr('range.invalid');
    els.rangeError.classList.remove('hidden');
    return;
  }
  const from = new Date(fromValue);
  const to = new Date(toValue);
  if (!(from.getTime() < to.getTime())) {
    els.rangeError.textContent = tr('range.invalid');
    els.rangeError.classList.remove('hidden');
    return;
  }
  try {
    const payload = await fetchJson(`/api/usage/range?from=${encodeURIComponent(from.toISOString())}&to=${encodeURIComponent(to.toISOString())}`, {
      secret: state.secret
    });
    state.customRange = { from: from.toISOString(), to: to.toISOString() };
    state.customPeriod = {
      totalTokens: payload.totalTokens || 0,
      costUsd: payload.costUsd || 0,
      clients: payload.clients || {},
      clientCosts: payload.clientCosts || {},
      models: payload.models || {},
      modelCosts: payload.modelCosts || {},
      projects: payload.projects || {},
      sessions: payload.sessions || {}
    };
    openRange(false);
    render();
  } catch {
    els.rangeError.textContent = tr('range.failed');
    els.rangeError.classList.remove('hidden');
  }
}

function clearCustomRange() {
  state.customRange = null;
  state.customPeriod = null;
  openRange(false);
  render();
}

function bindEvents() {
  els.primaryNav.addEventListener('click', (event) => {
    const btn = event.target.closest('[data-view]');
    if (!btn) return;
    state.prefs.view = btn.dataset.view;
    savePrefs({ view: state.prefs.view });
    if (state.prefs.view === 'trends' || state.prefs.view === 'home') {
      void ensureHistory().then(() => render());
      return;
    }
    render();
  });

  els.periodTabs.addEventListener('click', (event) => {
    const btn = event.target.closest('[data-period]');
    if (!btn) return;
    if (btn.dataset.period === 'custom') {
      openRange(true);
      return;
    }
    state.customPeriod = null;
    state.customRange = null;
    state.prefs.period = btn.dataset.period;
    savePrefs({ period: state.prefs.period });
    render();
  });


  const chartTip = document.createElement('div');
  chartTip.id = 'chartTip';
  chartTip.className = 'chart-tip hidden';
  chartTip.setAttribute('role', 'tooltip');
  document.body.appendChild(chartTip);

  function placeChartTip(clientX, clientY) {
    const pad = 12;
    const rect = chartTip.getBoundingClientRect();
    let left = clientX + 14;
    let top = clientY + 14;
    if (left + rect.width + pad > window.innerWidth) left = clientX - rect.width - 14;
    if (top + rect.height + pad > window.innerHeight) top = clientY - rect.height - 14;
    chartTip.style.left = `${Math.max(pad, left)}px`;
    chartTip.style.top = `${Math.max(pad, top)}px`;
  }

  function showChartTip(text, clientX, clientY) {
    if (!text) {
      chartTip.classList.add('hidden');
      return;
    }
    chartTip.textContent = text;
    chartTip.classList.remove('hidden');
    placeChartTip(clientX, clientY);
  }

  els.content.addEventListener('pointerover', (event) => {
    const hit = event.target.closest('[data-tip]');
    if (!hit || !els.content.contains(hit)) return;
    showChartTip(hit.getAttribute('data-tip') || '', event.clientX, event.clientY);
  });
  els.content.addEventListener('pointermove', (event) => {
    const hit = event.target.closest('[data-tip]');
    if (!hit || !els.content.contains(hit)) {
      chartTip.classList.add('hidden');
      return;
    }
    showChartTip(hit.getAttribute('data-tip') || '', event.clientX, event.clientY);
  });
  els.content.addEventListener('pointerleave', () => {
    chartTip.classList.add('hidden');
  });

  els.content.addEventListener('click', (event) => {
    const del = event.target.closest('[data-delete-device]');
    if (del) {
      void deleteDevice(del.getAttribute('data-delete-device'));
      return;
    }
    const stack = event.target.closest('[data-stack]');
    if (stack) {
      state.prefs.trendsStack = stack.dataset.stack;
      savePrefs({ trendsStack: state.prefs.trendsStack });
      render();
      return;
    }
    const range = event.target.closest('[data-range]');
    if (range) {
      state.prefs.trendsRange = range.dataset.range;
      savePrefs({ trendsRange: state.prefs.trendsRange });
      render();
    }
  });

  els.refreshBtn.addEventListener('click', async () => {
    try {
      await refreshStats();
      state.history = null;
      await ensureHistory();
      showToast(tr('toast.refreshed'));
    } catch (error) {
      if (error.status === 401) showAuth(true);
    }
  });

  els.customRangeBtn.addEventListener('click', () => openRange(true));
  els.rangeClose.addEventListener('click', () => openRange(false));
  els.rangeApply.addEventListener('click', () => void applyCustomRange());
  els.rangeClear.addEventListener('click', () => clearCustomRange());
  els.rangePopover.addEventListener('click', (event) => {
    if (event.target === els.rangePopover) openRange(false);
  });

  els.settingsOpen.addEventListener('click', () => openSettings(true));
  els.settingsDrawer.querySelectorAll('[data-close-settings]').forEach((el) => {
    el.addEventListener('click', () => openSettings(false));
  });
  els.saveSettingsBtn.addEventListener('click', async () => {
    state.prefs.language = els.languageSelect.value;
    state.prefs.theme = els.themeSelect.value;
    state.prefs.currency = els.currencySelect.value;
    savePrefs({
      language: state.prefs.language,
      theme: state.prefs.theme,
      currency: state.prefs.currency
    });
    const nextSecret = els.settingsSecret.value.trim();
    const secretChanged = nextSecret !== state.secret;
    applyTheme();
    applyLocale();
    if (secretChanged) {
      const ok = await tryConnect(nextSecret, true);
      if (!ok) return;
    }
    openSettings(false);
    showToast(tr('toast.saved'));
  });
  els.signOutBtn.addEventListener('click', () => {
    clearSecret();
    state.secret = '';
    if (state.stopStream) state.stopStream();
    setStreamStatus('offline');
    openSettings(false);
    showAuth(true);
  });

  els.authForm.addEventListener('submit', async (event) => {
    event.preventDefault();
    await tryConnect(els.secretInput.value, els.rememberSecret.checked);
  });

  window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => {
    if ((state.prefs.theme || 'system') === 'system') applyTheme();
  });
}

async function init() {
  applyTheme();
  applyLocale();
  bindEvents();
  renderChrome();

  if ('serviceWorker' in navigator) {
    try { await navigator.serviceWorker.register('/sw.js', { scope: '/' }); }
    catch { /* optional on insecure origins */ }
  }

  try {
    state.health = await fetchHealth();
  } catch {
    state.health = { secretRequired: true };
  }

  if (!state.health.secretRequired) {
    await tryConnect('', true);
    return;
  }

  if (state.secret) {
    const ok = await tryConnect(state.secret, Boolean(localStorage.getItem('token-monitor.hub.secret')));
    if (ok) return;
  }
  showAuth(true);
}

void init();
