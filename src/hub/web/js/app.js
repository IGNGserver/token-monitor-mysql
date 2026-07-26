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
  toolRows,
  mapRows,
  modelRows,
  projectRows,
  sessionRows,
  deviceRows,
  limitCards,
  historyDaily,
  clientLabel,
  clientIconPath,
  devicePlatformLabel,
  countActiveDays,
  heatmapValue,
  deviceBreakdownRows,
  agentRuntimeLabel,
  clientStatusEntries,
  wslStatusSummary,
  statusRows,
  limitRemainingTone,
  clampHomeLimitAccountCount,
  modelColor
} from './data.js';

const VIEWS = [
  { id: 'home', icon: '⌂' },
  { id: 'tool', icon: '⚒' },
  { id: 'device', icon: '▣' },
  { id: 'model', icon: '◈' },
  { id: 'project', icon: '◫' },
  { id: 'session', icon: '☰' },
  { id: 'limits', icon: '◔' },
  { id: 'status', icon: '◉' },
  { id: 'trends', icon: '∿' }
];

const PERIODS = ['today', 'month', 'allTime'];

const els = {
  app: document.getElementById('app'),
  primaryNav: document.getElementById('primaryNav'),
  streamStatus: document.getElementById('streamStatus'),
  streamStatusText: document.getElementById('streamStatusText'),
  settingsOpen: document.getElementById('settingsOpen'),
  settingsOpenTop: document.getElementById('settingsOpenTop'),
  menuToggle: document.getElementById('menuToggle'),
  pwaBanner: document.getElementById('pwaBanner'),
  pwaBannerText: document.getElementById('pwaBannerText'),
  pwaInstallBtn: document.getElementById('pwaInstallBtn'),
  pwaDismissBtn: document.getElementById('pwaDismissBtn'),
  pageTitle: document.getElementById('pageTitle'),
  pageMeta: document.getElementById('pageMeta'),
  homeReturnBtn: document.getElementById('homeReturnBtn'),
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
  homeLimitAccountCount: document.getElementById('homeLimitAccountCount'),
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
    heatmapMetric: 'cost',
    activeDaysWindow: 'all',
    homeLimitAccountCount: 3,
    selectedDeviceId: '',
    selectedToolId: '',
    deviceDetailPeriod: 'today',
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
  toastTimer: null,
  navOpen: false,
  deferredInstall: null,
  pwaDismissed: localStorage.getItem('token-monitor.hub.pwaDismissed') === '1'
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
    if (els.homeLimitAccountCount) {
      els.homeLimitAccountCount.value = String(clampHomeLimitAccountCount(state.prefs.homeLimitAccountCount, 3));
    }
    els.settingsSecret.value = state.secret || '';
  }
}


function isMobileNav() {
  return window.matchMedia('(max-width: 860px)').matches;
}

function openNav(open) {
  state.navOpen = Boolean(open) && isMobileNav();
  els.app.classList.toggle('nav-open', state.navOpen);
  document.body.classList.toggle('nav-open', state.navOpen);
  if (els.navScrim) els.navScrim.classList.toggle('hidden', !state.navOpen);
  if (els.menuToggle) els.menuToggle.setAttribute('aria-expanded', state.navOpen ? 'true' : 'false');
}

function isStandaloneDisplay() {
  return window.matchMedia('(display-mode: standalone)').matches
    || window.navigator.standalone === true;
}

function pwaStatusText() {
  if (isStandaloneDisplay()) return tr('pwa.status.installed');
  if (!window.isSecureContext) return tr('pwa.status.insecure');
  if (!('serviceWorker' in navigator)) return tr('pwa.status.unsupported');
  if (state.deferredInstall) return tr('pwa.status.ready');
  return tr('pwa.status.hint');
}

function refreshPwaUi() {
  if (els.aboutLine) {
    const base = `Token Monitor hub web · ${state.health?.now ? new Date(state.health.now).toLocaleString(state.locale) : 'ready'}`;
    els.aboutLine.textContent = `${base} · ${pwaStatusText()}`;
  }
  if (!els.pwaBanner) return;
  const canPrompt = Boolean(state.deferredInstall) && !state.pwaDismissed && !isStandaloneDisplay();
  const showInsecureHint = !window.isSecureContext && !state.pwaDismissed && !isStandaloneDisplay() && isMobileNav();
  if (canPrompt) {
    if (els.pwaBannerText) els.pwaBannerText.textContent = tr('pwa.hint');
    if (els.pwaInstallBtn) els.pwaInstallBtn.classList.remove('hidden');
    els.pwaBanner.classList.remove('hidden');
  } else if (showInsecureHint) {
    if (els.pwaBannerText) els.pwaBannerText.textContent = tr('pwa.insecure');
    if (els.pwaInstallBtn) els.pwaInstallBtn.classList.add('hidden');
    els.pwaBanner.classList.remove('hidden');
  } else {
    els.pwaBanner.classList.add('hidden');
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
  if (els.homeReturnBtn) {
    const onHome = state.prefs.view === 'home';
    els.homeReturnBtn.classList.toggle('hidden', onHome);
    els.homeReturnBtn.title = tr('home.return');
    els.homeReturnBtn.setAttribute('aria-label', tr('home.return'));
  }
  refreshPwaUi();
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

function segButtons(options, current, dataAttr) {
  return options.map(([value, label]) => `
    <button type="button" class="seg-btn ${String(current) === String(value) ? 'active' : ''}" data-${dataAttr}="${value}">${label}</button>
  `).join('');
}

function shareBarHtml(rows) {
  if (!rows.length) return emptyHtml('empty.usage');
  return `<div class="stack">${rows.map((row) => `
    <div class="share-row">
      <div class="row">
        <div class="row-main">
          ${row.client || row.key
            ? `<img class="client-icon" src="${clientIconPath(row.client || row.key)}" alt="" onerror="this.style.display='none'" />`
            : `<span class="swatch" style="background:${row.color}"></span>`}
          <div class="row-copy">
            <div class="row-name">${escapeHtml(row.name)}</div>
            <div class="row-sub">${Math.round(row.percent || 0)}%</div>
          </div>
        </div>
        <div class="row-metrics">
          <div class="row-value">${formatNumber(row.value)}</div>
          <div class="row-cost">${formatCost(row.cost, state.prefs.currency)}</div>
        </div>
      </div>
      <div class="share-meter"><span style="width:${Math.max(0, Math.min(100, row.percent || 0))}%; background:${row.color}"></span></div>
    </div>
  `).join('')}</div>`;
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
  const limits = limitCards(state.stats, state.locale).slice(0, clampHomeLimitAccountCount(state.prefs.homeLimitAccountCount, 3));
  const history = historySource();
  const daily = historyDaily(history, 14);
  const heatDaily = historyDaily(history, 90);
  const heatMetric = state.prefs.heatmapMetric === 'tokens' ? 'tokens' : 'cost';
  const activeDaysWindow = state.prefs.activeDaysWindow === 'year' ? 'year' : 'all';
  const summary = history?.summary || null;
  const displayActiveDays = countActiveDays(history?.daily || [], activeDaysWindow);
  const summaryActiveDays = Number(summary?.activeDays);
  const activeDaysValue = activeDaysWindow === 'year'
    ? displayActiveDays
    : (Number.isFinite(summaryActiveDays) ? summaryActiveDays : displayActiveDays);

  const toolsBody = tools.length
    ? `<div class="stack">${tools.map((row) => rowHtml({ ...row, client: row.key }, { showIcon: true, sub: `${Math.round((row.value / Math.max(1, period.totalTokens || 0)) * 100)}%` })).join('')}</div>`
    : emptyHtml('empty.usage');
  const modelsBody = models.length
    ? `<div class="stack">${models.map((row) => rowHtml(row, { sub: `${Math.round((row.value / Math.max(1, period.totalTokens || 0)) * 100)}%` })).join('')}</div>`
    : emptyHtml('empty.usage');
  const devicesBody = devices.length
    ? `<div class="stack">${devices.map((row) => rowHtml(row, { sub: `${row.platformDisplay || devicePlatformLabel(row.platform, row.osName, row.osVersion)}${row.stale ? ` · ${tr('devices.stale')}` : ''}` })).join('')}</div>`
    : emptyHtml('empty.usage');
  const limitsBody = limits.length
    ? `<div class="stack">${limits.map((card) => `
        <div class="row">
          <div class="row-main">
            <img class="client-icon" src="${clientIconPath(card.provider)}" alt="" onerror="this.style.display='none'" />
            <div class="row-copy">
              <div class="row-name">${escapeHtml(card.name)}</div>
              <div class="row-sub">${escapeHtml(clientLabel(card.provider))}${card.plan ? ` · ${escapeHtml(card.plan)}` : ''}${card.accountEmail && card.name !== card.accountEmail ? ` · ${escapeHtml(card.accountEmail)}` : ''}</div>
            </div>
          </div>
          <div class="row-metrics">
            <div class="row-value remaining-tone remaining-tone-${card.lowestRemaining == null ? 'unknown' : limitRemainingTone(card.lowestRemaining)}">${card.lowestRemaining == null ? '—' : `${Math.round(card.lowestRemaining)}%`}</div>
            <div class="row-cost">${card.stale ? tr('devices.stale') : tr('devices.live')}</div>
          </div>
        </div>
      `).join('')}</div>`
    : emptyHtml('empty.limits');

  const summaryBody = (summary || heatDaily.length)
    ? `
      <div class="summary-grid">
        <div class="summary-chip"><span class="summary-label">${tr('home.activeDays')}</span><strong>${formatNumber(activeDaysValue)}</strong></div>
        <div class="summary-chip"><span class="summary-label">${tr('home.streak')}</span><strong>${formatNumber(summary?.currentStreak || 0)}</strong></div>
        <div class="summary-chip"><span class="summary-label">${tr('home.peakDay')}</span><strong>${formatCompact(summary?.peakDayTokens || 0)}</strong></div>
      </div>
      <div class="toolbar-row">
        <div class="seg" role="group" aria-label="${tr('home.heatmapMetric')}">
          ${segButtons([['tokens', tr('stats.tokens')], ['cost', tr('stats.cost')]], heatMetric, 'heatmap-metric')}
        </div>
        <div class="seg" role="group" aria-label="${tr('home.activeDaysWindow')}">
          ${segButtons([['all', tr('home.activeDaysWindow.all')], ['year', tr('home.activeDaysWindow.year')]], activeDaysWindow, 'active-days-window')}
        </div>
      </div>
      ${renderHeatmap(heatDaily, heatMetric)}
    `
    : emptyHtml('empty.history');

  return `
    <div class="grid-2">
      ${panel(tr('home.tools'), toolsBody)}
      ${panel(tr('home.models'), modelsBody)}
      ${panel(tr('home.devices'), devicesBody)}
      ${panel(tr('home.limits'), limitsBody)}
    </div>
    ${panel(tr('home.summary'), summaryBody)}
    ${panel(tr('home.activity'), renderSparkline(daily), daily.length ? `${daily.length}d` : '')}
  `;
}


function renderTools() {
  const period = activePeriod();
  const tools = toolRows(period).map((row) => ({ ...row, client: row.key }));
  if (!tools.length) return emptyHtml('empty.usage');
  const selectedId = state.prefs.selectedToolId || tools[0].key;
  const selected = tools.find((row) => row.key === selectedId) || tools[0];
  const modelMap = period?.clientModels?.[selected.key] || {};
  const modelCostMap = period?.clientModelCosts?.[selected.key] || {};
  const models = mapRows(modelMap, modelCostMap, {
    labelFor: (key) => key,
    colorFor: (key) => modelColor(key)
  });
  const toolList = tools.map((row) => {
    const active = row.key === selected.key ? ' selected' : '';
    return `
      <button type="button" class="tool-select-row${active}" data-select-tool="${escapeHtml(row.key)}">
        <div class="row-main">
          <img class="client-icon" src="${clientIconPath(row.key)}" alt="" onerror="this.style.display='none'" />
          <div class="row-copy">
            <div class="row-name">${escapeHtml(row.name)}</div>
            <div class="row-sub">${Math.round((row.value / Math.max(1, period.totalTokens || 0)) * 100)}%</div>
          </div>
        </div>
        <div class="row-side">
          <div class="row-value">${formatNumber(row.value)}</div>
          <div class="row-cost">${formatCost(row.cost, state.prefs.currency)}</div>
        </div>
      </button>`;
  }).join('');

  return `
    <div class="grid-2 tools-layout">
      <section class="panel">
        <div class="panel-head"><h2 class="panel-title">${tr('nav.tool')}</h2></div>
        <div class="stack tool-select-list">${toolList}</div>
      </section>
      <section class="panel">
        <div class="panel-head">
          <h2 class="panel-title">${escapeHtml(selected.name)}</h2>
          <div class="panel-meta tiny">${tr('tools.models')}</div>
        </div>
        ${models.length ? shareBarHtml(models.slice(0, 16)) : emptyHtml('empty.usage')}
      </section>
    </div>
  `;
}

function renderListView(rows, emptyKey, { showIcon = false } = {}) {
  if (!rows.length) return emptyHtml(emptyKey);
  return `<div class="stack">${rows.map((row) => rowHtml(row, {
    showIcon,
    sub: row.sub || (row.lastUsedAt ? formatRelative(row.lastUsedAt, state.locale) : '')
  })).join('')}</div>`;
}


function renderDeviceStatusBlocks(device) {
  const clientEntries = clientStatusEntries(device?.clientStatus || device?.raw?.clientStatus);
  const wsl = wslStatusSummary(device?.wslStatus || device?.raw?.wslStatus);
  const parts = [];
  if (clientEntries.length) {
    const tags = clientEntries.map((entry) => {
      const tone = entry.state === 'active' ? 'ok' : (entry.state === 'waiting' ? 'warn' : 'stale');
      const label = tr(`devices.status.${entry.state}`);
      return `<span class="badge ${tone}">${escapeHtml(clientLabel(entry.client))} · ${escapeHtml(label)}</span>`;
    }).join('');
    parts.push(`<div class="status-block"><div class="row-sub">${tr('devices.clientStatus')}</div><div class="status-tags">${tags}</div></div>`);
  }
  if (wsl) {
    const stateLabel = tr(`devices.wsl.${wsl.state}`);
    const detail = [
      wsl.detected.length ? `${tr('devices.wsl.detected')}: ${wsl.detected.map(clientLabel).join(', ')}` : '',
      wsl.withData.length ? `${tr('devices.wsl.withData')}: ${wsl.withData.map(clientLabel).join(', ')}` : ''
    ].filter(Boolean).join(' · ');
    parts.push(`<div class="status-block"><div class="row-sub">${tr('devices.wslStatus')}</div><div class="status-tags"><span class="badge ${wsl.state === 'active' ? 'ok' : 'warn'}">${escapeHtml(stateLabel)}</span></div>${detail ? `<div class="row-sub" style="margin-top:6px">${escapeHtml(detail)}</div>` : ''}</div>`);
  }
  return parts.length ? `<div class="device-status-stack">${parts.join('')}</div>` : '';
}

function renderDevices() {
  const periodKey = state.customPeriod ? 'today' : (state.prefs.deviceDetailPeriod || state.prefs.period || 'today');
  const rows = deviceRows(state.stats, periodKey);
  if (!rows.length) return emptyHtml('empty.usage');
  const selectedId = state.prefs.selectedDeviceId || rows[0].key;
  const selected = rows.find((row) => row.key === selectedId) || rows[0];
  const breakdown = deviceBreakdownRows(selected.raw || selected, periodKey);
  const detailPeriod = state.prefs.deviceDetailPeriod || 'today';

  return `
    <div class="grid-2 devices-layout">
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
                <tr class="${row.key === selected.key ? 'selected' : ''}" data-select-device="${escapeHtml(row.key)}">
                  <td>
                    <div class="row-name">${escapeHtml(row.name)}</div>
                    <div class="row-sub">${row.stale ? tr('devices.stale') : tr('devices.live')}${(row.agentRuntimeLabel || agentRuntimeLabel(row.agentRuntime)) ? ` · ${escapeHtml(row.agentRuntimeLabel || agentRuntimeLabel(row.agentRuntime))}` : ''}${row.deviceId && row.deviceId !== row.name ? ` · ${escapeHtml(row.deviceId)}` : ''}</div>
                  </td>
                  <td>${escapeHtml(row.platformDisplay || devicePlatformLabel(row.platform, row.osName, row.osVersion))}</td>
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
      <section class="panel">
        <div class="panel-head">
          <h2 class="panel-title">${escapeHtml(selected.name)}</h2>
          <div class="panel-meta tiny">${escapeHtml([
            selected.platformDisplay || devicePlatformLabel(selected.platform, selected.osName, selected.osVersion),
            selected.agentRuntimeLabel || agentRuntimeLabel(selected.agentRuntime),
            selected.stale ? tr('devices.stale') : tr('devices.live')
          ].filter(Boolean).join(' · '))}</div>
        </div>
        <div class="toolbar-row">
          <div class="seg" role="group" aria-label="${tr('devices.period')}">
            ${segButtons([['today', tr('period.today')], ['month', tr('period.month')], ['allTime', tr('period.allTime')]], detailPeriod, 'device-period')}
          </div>
        </div>
        <div class="summary-grid" style="margin:12px 0 16px">
          <div class="summary-chip"><span class="summary-label">${tr('stats.tokens')}</span><strong>${formatNumber(breakdown.totalTokens)}</strong></div>
          <div class="summary-chip"><span class="summary-label">${tr('stats.cost')}</span><strong>${formatCost(breakdown.totalCost, state.prefs.currency)}</strong></div>
        </div>
        ${renderDeviceStatusBlocks(selected)}
        ${panel(tr('devices.tools'), shareBarHtml(breakdown.tools.slice(0, 12)) + (breakdown.tools.some((t) => t.models?.length) ? `<div class="device-tool-models">${breakdown.tools.filter((t) => t.models?.length).slice(0, 6).map((tool) => `<div class="status-block" style="margin-top:12px"><div class="row-sub">${escapeHtml(tool.name)}</div>${shareBarHtml(tool.models.slice(0, 6))}</div>`).join('')}</div>` : ''))}
        ${panel(tr('devices.models'), shareBarHtml(breakdown.models.slice(0, 12)))}
      </section>
    </div>
  `;
}

function localizeWindowLabel(window) {
  if (window?.kind === 'balanceUsd') return tr('limits.balanceUsd');
  if (window?.kind === 'balance') return tr('limits.balance');
  if (window?.kind === 'resetCredits') return tr('limits.resetCredits');
  return window?.label || '—';
}

function renderLimitCards(cards, { compact = false } = {}) {
  if (!cards.length) return emptyHtml('empty.limits');
  return `
    <div class="grid-2">
      ${cards.map((card) => {
        const sub = [
          clientLabel(card.provider),
          card.plan || '',
          card.source ? String(card.source).toUpperCase() : '',
          card.accountEmail && card.name !== card.accountEmail ? card.accountEmail : ''
        ].filter(Boolean).join(' · ');
        return `
        <article class="limit-card${compact ? ' limit-card-compact' : ''}">
          <div class="limit-head">
            <div class="row-main">
              <img class="client-icon" src="${clientIconPath(card.provider)}" alt="" onerror="this.style.display='none'" />
              <div class="row-copy">
                <div class="row-name">${escapeHtml(card.name)}</div>
                <div class="row-sub">${escapeHtml(sub)}</div>
              </div>
            </div>
            <span class="badge ${card.stale ? 'stale' : (String(card.status).toLowerCase() === 'ok' ? 'ok' : 'warn')}">${card.stale ? tr('devices.stale') : escapeHtml(card.status)}</span>
          </div>
          <div class="limit-windows">
            ${(card.windows.length ? card.windows : [{ label: '—', remaining: null, showMeter: false }]).map((window) => {
              const showMeter = window.showMeter !== false && window.remaining != null;
              const tone = showMeter ? limitRemainingTone(window.remaining) : 'unknown';
              const primary = showMeter
                ? `${Math.round(window.remaining)}%`
                : (window.value || '—');
              const metricHint = window.metric === 'credits' ? tr('limits.credits') : '';
              const label = localizeWindowLabel(window);
              return `
              <div class="limit-window">
                <div class="limit-window-label">
                  <span>${escapeHtml(label)}${metricHint ? ` · ${escapeHtml(metricHint)}` : ''}</span>
                  <strong class="remaining-tone remaining-tone-${tone}">${escapeHtml(String(primary))}</strong>
                </div>
                ${showMeter ? `<div class="meter meter-${limitRemainingTone(window.remaining)}"><span style="width:${Math.max(0, Math.min(100, window.remaining))}%"></span></div>` : '<div class="limit-balance-line"></div>'}
                <div class="row-sub" style="margin-top:8px">
                  ${window.value && showMeter ? escapeHtml(window.value) : ''}
                  ${window.detail ? escapeHtml(window.detail) : ''}
                  ${window.resetsAt ? `${tr('limits.reset')} ${escapeHtml(formatReset(window.resetsAt, state.locale))}` : ''}
                </div>
              </div>`;
            }).join('')}
          </div>
        </article>`;
      }).join('')}
    </div>
  `;
}

function renderLimits() {
  return renderLimitCards(limitCards(state.stats, state.locale));
}

function renderStatus() {
  const rows = statusRows(state.stats, state.locale);
  if (!rows.length) return emptyHtml('empty.status');
  const summary = `
    <div class="summary-grid" style="margin-bottom:16px">
      <div class="summary-chip"><span class="summary-label">${tr('status.accounts')}</span><strong>${rows.length}</strong></div>
      <div class="summary-chip"><span class="summary-label">${tr('status.okCount')}</span><strong>${rows.filter((r) => r.health === 'ok').length}</strong></div>
      <div class="summary-chip"><span class="summary-label">${tr('status.warnCount')}</span><strong>${rows.filter((r) => r.health !== 'ok').length}</strong></div>
    </div>`;
  return panel(tr('nav.status'), summary + renderLimitCards(rows, { compact: true }));
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

function renderHeatmap(daily, metric = 'tokens') {
  if (!daily.length) return emptyHtml('empty.history');
  const heatMetric = metric === 'cost' ? 'cost' : 'tokens';
  const values = daily.map((day) => heatmapValue(day, heatMetric));
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
    const value = heatmapValue(day, heatMetric);
    const ratio = value / max;
    const level = value <= 0 ? 0 : ratio < 0.25 ? 1 : ratio < 0.5 ? 2 : ratio < 0.75 ? 3 : 4;
    const x = left + week * (cell + gap);
    const y = top + dow * (cell + gap);
    const tip = tipText([
      day.date || '',
      `${formatNumber(tokens)} ${tr('stats.tokens')}`,
      cost ? formatCost(cost, state.prefs.currency) : ''
    ]);
    return `<rect class="heat heat-${heatMetric} lvl-${level} chart-hit" x="${x}" y="${y}" width="${cell}" height="${cell}" rx="3" data-tip="${escapeHtml(tip)}"></rect>`;
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
  const heatMetric = state.prefs.heatmapMetric === 'tokens' ? 'tokens' : 'cost';
  const daily = historyDaily(historySource(), state.prefs.trendsRange === 'all' ? 0 : state.prefs.trendsRange);
  return `
    <div class="toolbar-row">
      <div class="seg">
        <button type="button" class="seg-btn ${state.prefs.trendsStack === 'client' ? 'active' : ''}" data-stack="client">${tr('trends.stack.client')}</button>
        <button type="button" class="seg-btn ${state.prefs.trendsStack === 'model' ? 'active' : ''}" data-stack="model">${tr('trends.stack.model')}</button>
      </div>
      <div class="seg">
        ${['7', '30', '90', 'all'].map((range) => `
          <button type="button" class="seg-btn ${String(state.prefs.trendsRange) === range ? 'active' : ''}" data-range="${range}">${range === 'all' ? 'All' : range}</button>
        `).join('')}
      </div>
      <div class="seg" role="group" aria-label="${tr('home.heatmapMetric')}">
        ${segButtons([['tokens', tr('stats.tokens')], ['cost', tr('stats.cost')]], heatMetric, 'heatmap-metric')}
      </div>
    </div>
    ${panel(tr('nav.trends'), renderStackedBars(daily, state.prefs.trendsStack))}
    ${panel(tr('home.heatmap'), renderHeatmap(historyDaily(historySource(), 90), heatMetric))}
  `;
}

function render() {
  renderChrome();
  renderHero();
  const period = activePeriod();
  let html;
  switch (state.prefs.view) {
    case 'tool':
      html = renderTools();
      break;
    case 'device':
      html = renderDevices();
      break;
    case 'model':
      html = panel(tr('nav.model'), renderListView(modelRows(period), 'empty.usage'));
      break;
    case 'project': {
      const projectData = projectRows(period, { incomplete: Boolean(state.stats?.projectsIncomplete) && state.prefs.period === 'allTime' });
      const incompleteBanner = projectData.incomplete
        ? `<div class="notice warn" style="margin-bottom:12px">${escapeHtml(tr('projects.incomplete'))}</div>`
        : '';
      html = panel(tr('nav.project'), incompleteBanner + renderListView(projectData.rows, 'empty.projects'));
      break;
    }
    case 'session': {
      const sessionData = sessionRows(period);
      const truncated = sessionData.truncated
        ? `<div class="notice" style="margin-bottom:12px">${escapeHtml(tr('sessions.truncated', { shown: sessionData.rows.length, total: sessionData.total }))}</div>`
        : '';
      html = panel(
        tr('nav.session'),
        truncated + renderListView(
          sessionData.rows.map((row) => ({
            ...row,
            sub: `${row.sub || ''}${row.lastUsedAt ? ` · ${formatRelative(row.lastUsedAt, state.locale)}` : ''}`
          })),
          'empty.sessions',
          { showIcon: true }
        )
      );
      break;
    }
    case 'limits':
      html = renderLimits();
      break;
    case 'status':
      html = renderStatus();
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
  if (els.homeReturnBtn) {
    els.homeReturnBtn.addEventListener('click', () => {
      if (state.prefs.view === 'home') return;
      state.prefs.view = 'home';
      savePrefs({ view: 'home' });
      openNav(false);
      void ensureHistory().then(() => render());
    });
  }
  els.primaryNav.addEventListener('click', (event) => {
    const btn = event.target.closest('[data-view]');
    if (!btn) return;
    state.prefs.view = btn.dataset.view;
    savePrefs({ view: state.prefs.view });
    openNav(false);
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
    const heatmapMetric = event.target.closest('[data-heatmap-metric]');
    if (heatmapMetric) {
      state.prefs.heatmapMetric = heatmapMetric.dataset.heatmapMetric === 'tokens' ? 'tokens' : 'cost';
      savePrefs({ heatmapMetric: state.prefs.heatmapMetric });
      render();
      return;
    }
    const activeDaysWindow = event.target.closest('[data-active-days-window]');
    if (activeDaysWindow) {
      state.prefs.activeDaysWindow = activeDaysWindow.dataset.activeDaysWindow === 'year' ? 'year' : 'all';
      savePrefs({ activeDaysWindow: state.prefs.activeDaysWindow });
      render();
      return;
    }
    const selectTool = event.target.closest('[data-select-tool]');
    if (selectTool) {
      state.prefs.selectedToolId = selectTool.dataset.selectTool || '';
      savePrefs({ selectedToolId: state.prefs.selectedToolId });
      render();
      return;
    }
    const selectDevice = event.target.closest('[data-select-device]');
    if (selectDevice && !event.target.closest('[data-delete-device]')) {
      state.prefs.selectedDeviceId = selectDevice.dataset.selectDevice || '';
      savePrefs({ selectedDeviceId: state.prefs.selectedDeviceId });
      render();
      return;
    }
    const devicePeriod = event.target.closest('[data-device-period]');
    if (devicePeriod) {
      state.prefs.deviceDetailPeriod = devicePeriod.dataset.devicePeriod || 'today';
      savePrefs({ deviceDetailPeriod: state.prefs.deviceDetailPeriod });
      render();
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

  if (els.menuToggle) {
    els.menuToggle.addEventListener('click', () => openNav(!state.navOpen));
  }
  if (els.navScrim) {
    els.navScrim.addEventListener('click', () => openNav(false));
  }
  window.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') openNav(false);
  });
  window.addEventListener('resize', () => {
    if (!isMobileNav()) openNav(false);
    refreshPwaUi();
  });

  const openSettingsAndCloseNav = () => {
    openNav(false);
    openSettings(true);
  };
  els.settingsOpen.addEventListener('click', openSettingsAndCloseNav);
  if (els.settingsOpenTop) {
    els.settingsOpenTop.addEventListener('click', openSettingsAndCloseNav);
  }
  els.settingsDrawer.querySelectorAll('[data-close-settings]').forEach((el) => {
    el.addEventListener('click', () => openSettings(false));
  });

  window.addEventListener('beforeinstallprompt', (event) => {
    event.preventDefault();
    state.deferredInstall = event;
    refreshPwaUi();
  });
  window.addEventListener('appinstalled', () => {
    state.deferredInstall = null;
    state.pwaDismissed = true;
    localStorage.setItem('token-monitor.hub.pwaDismissed', '1');
    refreshPwaUi();
    showToast(tr('pwa.installed'));
  });
  if (els.pwaInstallBtn) {
    els.pwaInstallBtn.addEventListener('click', async () => {
      if (!state.deferredInstall) return;
      const promptEvent = state.deferredInstall;
      state.deferredInstall = null;
      try {
        await promptEvent.prompt();
        await promptEvent.userChoice;
      } catch {
        /* user dismissed native sheet */
      }
      refreshPwaUi();
    });
  }
  if (els.pwaDismissBtn) {
    els.pwaDismissBtn.addEventListener('click', () => {
      state.pwaDismissed = true;
      localStorage.setItem('token-monitor.hub.pwaDismissed', '1');
      refreshPwaUi();
    });
  }
  els.saveSettingsBtn.addEventListener('click', async () => {
    state.prefs.language = els.languageSelect.value;
    state.prefs.theme = els.themeSelect.value;
    state.prefs.currency = els.currencySelect.value;
    if (els.homeLimitAccountCount) {
      state.prefs.homeLimitAccountCount = clampHomeLimitAccountCount(els.homeLimitAccountCount.value, 3);
      els.homeLimitAccountCount.value = String(state.prefs.homeLimitAccountCount);
    }
    savePrefs({
      language: state.prefs.language,
      theme: state.prefs.theme,
      currency: state.prefs.currency,
      homeLimitAccountCount: state.prefs.homeLimitAccountCount
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

  if ('serviceWorker' in navigator && window.isSecureContext) {
    try {
      const reg = await navigator.serviceWorker.register('/sw.js', { scope: '/' });
      if (reg?.update) void reg.update();
    } catch {
      /* optional when the browser rejects the worker */
    }
  }
  refreshPwaUi();

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
