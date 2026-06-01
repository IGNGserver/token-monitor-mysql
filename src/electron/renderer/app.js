'use strict';

const clientLabels = { claude: 'Claude Code', codex: 'Codex', hermes: 'Hermes', gemini: 'Gemini', cursor: 'Cursor', opencode: 'OpenCode', openclaw: 'OpenClaw', antigravity: 'Antigravity' };
const clientColors = {
  claude: '#cc7c5e',
  codex: '#49a3b0',
  hermes: '#d4af37',
  gemini: '#4992ea',
  antigravity: '#4285f4',
  deepseek: '#3982ff',
  cursor: '#000000',
  opencode: '#24292e',
  openclaw: '#e05c2b',
  xai: '#000000',
  meta: '#0668e1',
  mistral: '#fa520f',
  qwen: '#615ced',
  moonshot: '#16191e',
  zai: '#0066ff',
  cohere: '#ff7759',
  xiaomi: '#ff6700',
  minimax: '#b4393c',
  default: '#6ab4f0'
};
const clientsWithIcon = new Set([
  'claude', 'codex', 'gemini', 'cursor', 'opencode', 'openclaw', 'hermes', 'antigravity',
  'xai', 'deepseek', 'meta', 'mistral', 'qwen', 'moonshot', 'zai', 'cohere', 'xiaomi', 'minimax'
]);

function osIconFor(platform) {
  const prefix = String(platform || '').toLowerCase().split('-')[0];
  if (prefix === 'darwin') return 'apple';
  if (prefix === 'win32') return 'windows';
  if (prefix === 'linux' || prefix === 'freebsd' || prefix === 'openbsd') return 'linux';
  return null;
}

function iconKindFor(rowData, breakdown) {
  if (!state.settings?.showToolIcons) return { kind: 'dot' };
  if (breakdown === 'device') {
    const os = osIconFor(rowData.platform);
    return os ? { kind: 'icon', iconClass: `row-icon-os-${os}` } : { kind: 'dot' };
  }
  if (breakdown === 'model') {
    const vendor = modelVendorFor(rowData.key);
    return vendor && clientsWithIcon.has(vendor)
      ? { kind: 'icon', iconClass: `row-icon-${vendor}` }
      : { kind: 'dot' };
  }
  if (breakdown === 'session') {
    return rowData.client && clientsWithIcon.has(rowData.client)
      ? { kind: 'icon', iconClass: `row-icon-${rowData.client}` }
      : { kind: 'dot' };
  }
  return clientsWithIcon.has(rowData.key)
    ? { kind: 'icon', iconClass: `row-icon-${rowData.key}` }
    : { kind: 'dot' };
}

const KNOWN_CLIENTS = [
  { id: 'claude', label: 'Claude Code' },
  { id: 'codex', label: 'Codex' },
  { id: 'hermes', label: 'Hermes' },
  { id: 'opencode', label: 'OpenCode' },
  { id: 'openclaw', label: 'OpenClaw' },
  { id: 'cursor', label: 'Cursor' },
  { id: 'antigravity', label: 'Antigravity' }
];
const LIMIT_PROVIDERS = [
  { id: 'claude', label: 'Claude', settingsLabel: 'Claude Code' },
  { id: 'codex', label: 'Codex' },
  { id: 'cursor', label: 'Cursor' },
  { id: 'antigravity', label: 'Antigravity' }
];
const DEFAULT_LIMIT_PROVIDER_ORDER = LIMIT_PROVIDERS.map((provider) => provider.id).join(',');
const limitProviderOrderApi = window.TokenMonitorLimitProviderOrder;
const i18n = window.TokenMonitorI18n;
const currencyApi = window.TokenMonitorCurrency;
const sessionRowsApi = window.TokenMonitorSessionRows;
const sessionDetailApi = window.TokenMonitorSessionDetail;
const LIMIT_REFRESH_OPTIONS = [60000, 120000, 300000, 900000, 1800000];
const WINDOW_BEHAVIOR_VALUES = ['floating', 'normal', 'desktop'];
const WINDOW_BEHAVIOR_ICONS = { floating: '⇧', normal: '○', desktop: '⇩' };
const LIMIT_SOURCE_LABELS = { oauth: 'OAuth', cli: 'CLI', web: 'Web', rpc: 'CLI' };
const deviceAccent = '#73bdf5';
const deviceStaleColor = '#8c97a7';
const fallbackModelColors = ['#6ab4f0', '#cc7c5e', '#a57df0', '#49a3b0', '#f0d66a', '#f06a7b'];
const baseBreakdownOrder = ['tool', 'device', 'model', 'session'];
const viewPeriodValues = new Set(['today', 'month', 'allTime']);
const viewBreakdownValues = new Set([...baseBreakdownOrder, 'limits']);
const initialFloatingBubble = window.__TOKEN_MONITOR_INITIAL_FLOATING_BUBBLE__ || { collapsed: false, side: null };
const initialViewState = window.__TOKEN_MONITOR_INITIAL_VIEW_STATE__ || {};

function normalizeInitialViewValue(value, allowed, fallback) {
  const raw = String(value || '').trim();
  return allowed.has(raw) ? raw : fallback;
}

const state = { period: normalizeInitialViewValue(initialViewState.period, viewPeriodValues, 'today'), appUpdate: null, breakdown: normalizeInitialViewValue(initialViewState.breakdown, viewBreakdownValues, 'tool'), settings: null, stats: null, refreshTimer: null, currentTotal: 0, rowSignature: '', streamConnected: false, mode: 'idle', appInfo: null, tokscaleStatus: null, tokscaleCheck: null, tokscaleBusy: false, hubInfo: null, cursorAccount: { status: null, error: '' }, cursorAccountExpanded: false, floatingBubble: initialFloatingBubble, suppressInitialNumberAnimation: window.__TOKEN_MONITOR_SUPPRESS_INITIAL_NUMBER_ANIMATION__ === true, openSession: null, detailSort: 'time' };
const defaultAppearance = { glassOpacity: 68, glassBlur: 32, zoomFactor: 1, systemGlass: true, showLiveDot: true, showToolIcons: true, titleIconOnly: false };
const els = {
  shell: document.querySelector('.shell'), status: document.getElementById('status'), liveDot: document.getElementById('liveDot'), totalTokens: document.getElementById('totalTokens'), cost: document.getElementById('cost'), breakdown: document.getElementById('breakdown'), limitsPanel: document.getElementById('limitsPanel'), breakdownToggle: document.getElementById('breakdownToggle'), pinButton: document.getElementById('pinButton'), settingsButton: document.getElementById('settingsButton'), settingsPanel: document.getElementById('settingsPanel'), languageInput: document.getElementById('languageInput'), currencyInput: document.getElementById('currencyInput'), hubUrlInput: document.getElementById('hubUrlInput'), secretInput: document.getElementById('secretInput'), deviceIdInput: document.getElementById('deviceIdInput'), limitProviderCheckboxes: document.getElementById('limitProviderCheckboxes'), limitsRefreshInput: document.getElementById('limitsRefreshInput'), showLimitSourceInput: document.getElementById('showLimitSourceInput'), systemGlassInput: document.getElementById('systemGlassInput'), liveDotInput: document.getElementById('liveDotInput'), toolIconsInput: document.getElementById('toolIconsInput'), floatingBubbleInput: document.getElementById('floatingBubbleInput'), floatingBubbleTriggerInput: document.getElementById('floatingBubbleTriggerInput'), floatingBubbleTriggerRow: document.getElementById('floatingBubbleTriggerRow'), floatingBubbleContentInput: document.getElementById('floatingBubbleContentInput'), floatingBubbleContentRow: document.getElementById('floatingBubbleContentRow'), floatingBubbleContent: document.getElementById('floatingBubbleContent'), discordRpcInput: document.getElementById('discordRpcInput'), windowBehaviorInput: document.getElementById('windowBehaviorInput'), trayModeInput: document.getElementById('trayModeInput'), trayContentInput: document.getElementById('trayContentInput'), glassInput: document.getElementById('glassInput'), blurInput: document.getElementById('blurInput'), zoomInput: document.getElementById('zoomInput'), resetGlassButton: document.getElementById('resetGlassButton'), resetDepthButton: document.getElementById('resetDepthButton'), resetZoomButton: document.getElementById('resetZoomButton'), saveSettingsButton: document.getElementById('saveSettingsButton'), clientCheckboxes: document.getElementById('clientCheckboxes'), openConfigButton: document.getElementById('openConfigButton'), refreshButton: document.getElementById('refreshButton'), minButton: document.getElementById('minButton'), closeButton: document.getElementById('closeButton'), floatingBubbleTab: document.getElementById('floatingBubbleTab')
};
Object.assign(els, {
  hubModeOptions: document.getElementById('hubModeOptions'),
  hubClientFields: document.getElementById('hubClientFields'),
  hubHostFields: document.getElementById('hubHostFields'),
  hubPortInput: document.getElementById('hubPortInput'),
  hubSecretInput: document.getElementById('hubSecretInput'),
  hubSecretCopyButton: document.getElementById('hubSecretCopyButton'),
  hubSecretRegenButton: document.getElementById('hubSecretRegenButton'),
  hubStatusRow: document.getElementById('hubStatusRow'),
  hubAddressList: document.getElementById('hubAddressList'),
  startupGroup: document.getElementById('startupGroup'),
  startAtLoginInput: document.getElementById('startAtLoginInput'),
  startupNote: document.getElementById('startupNote'),
  tokscaleGroup: document.getElementById('tokscaleGroup'),
  tokscaleInstalled: document.getElementById('tokscaleInstalled'),
  tokscaleBundledLine: document.getElementById('tokscaleBundledLine'),
  tokscaleBundled: document.getElementById('tokscaleBundled'),
  tokscaleNpm: document.getElementById('tokscaleNpm'),
  tokscaleMessage: document.getElementById('tokscaleMessage'),
  checkTokscaleButton: document.getElementById('checkTokscaleButton'),
  downloadTokscaleButton: document.getElementById('downloadTokscaleButton'),
  resetTokscaleButton: document.getElementById('resetTokscaleButton'),
  openTokscaleLinkButton: document.getElementById('openTokscaleLinkButton'),
  appUpdatePill: document.getElementById('appUpdatePill'),
  appUpdatePillAction: document.getElementById('appUpdatePillAction'),
  appUpdatePillLabel: document.getElementById('appUpdatePillLabel'),
  appUpdatePillDismiss: document.getElementById('appUpdatePillDismiss'),
  appUpdateInstalled: document.getElementById('appUpdateInstalled'),
  appUpdateLatest: document.getElementById('appUpdateLatest'),
  appUpdateCheckButton: document.getElementById('appUpdateCheckButton'),
  appUpdateViewReleaseButton: document.getElementById('appUpdateViewReleaseButton'),
  appUpdateMessage: document.getElementById('appUpdateMessage'),
  titleIconInput: document.getElementById('titleIconInput'),
  sessionDetail: document.getElementById('session-detail'),
  sessionDetailHead: document.getElementById('session-detail-head')
});

function preferredLanguages() {
  return navigator.languages?.length ? navigator.languages : [navigator.language || 'en'];
}

function currentLanguage() {
  return i18n.normalizeLanguage(state.settings?.language || 'auto');
}

function currentLocale() {
  return i18n.resolveLocale(currentLanguage(), preferredLanguages());
}

function t(key, params) {
  return i18n.translate(currentLocale(), key, params);
}

function applySettingsTranslations() {
  if (els.languageInput) els.languageInput.value = currentLanguage();
  i18n.applyTranslations(document, currentLocale());
}

function formatNumber(value) { return Math.round(Number(value || 0)).toLocaleString('en-US'); }
function currentCurrency() { return currencyApi.normalizeCurrency(state.settings?.currency); }
function formatCost(value) { return currencyApi.formatCurrencyFromUsd(value, currentCurrency()); }
function formatTime(value) { const date = value ? new Date(value) : new Date(); return Number.isNaN(date.getTime()) ? '--:--:--' : date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }); }
function formatPercent(value) { return Number.isFinite(Number(value)) ? `${Math.round(Number(value))}%` : '--'; }
function formatReset(value) {
  const date = value ? new Date(value) : null;
  if (!date || Number.isNaN(date.getTime())) return '';
  const diffMs = date.getTime() - Date.now();
  if (diffMs <= 0) return 'Reset now';
  return `Reset ${formatDuration(diffMs)}`;
}
function formatDuration(ms) {
  const totalMinutes = Math.max(0, Math.round(ms / 60000));
  const days = Math.floor(totalMinutes / 1440);
  const hours = Math.floor((totalMinutes % 1440) / 60);
  const minutes = totalMinutes % 60;
  if (days > 0) return `${days}d ${hours}h`;
  if (hours > 0) return `${hours}h ${minutes}m`;
  if (minutes > 0) return `${minutes}m`;
  return '<1m';
}
function formatUpdatedAge(value) {
  const date = value ? new Date(value) : null;
  if (!date || Number.isNaN(date.getTime())) return 'Update unknown';
  const diffMs = Math.max(0, Date.now() - date.getTime());
  if (diffMs < 45_000) return 'Updated just now';
  const minutes = Math.round(diffMs / 60000);
  if (minutes < 60) return `Updated ${minutes}m ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `Updated ${hours}h ago`;
  return `Updated ${Math.round(hours / 24)}d ago`;
}
function versionText(value) {
  return value ? `v${value}` : 'unknown';
}
function renderAppUpdatePill() {
  const s = state.appUpdate;
  const pill = els.appUpdatePill;
  if (!pill) return;
  if (!s || !s.hasUpdate || !s.latest) {
    pill.classList.add('hidden');
    pill.setAttribute('title', '');
    els.appUpdatePillLabel.textContent = '';
    return;
  }
  pill.classList.remove('hidden');
  pill.setAttribute('title', s.latest.name || `v${s.latest.version}`);
  els.appUpdatePillLabel.textContent = `↑ v${s.latest.version}`;
}
function renderSettingsAppUpdateRow() {
  const s = state.appUpdate;
  if (!s) {
    els.appUpdateInstalled.textContent = '—';
    els.appUpdateLatest.textContent = t('settings.common.notChecked');
    els.appUpdateCheckButton.disabled = false;
    els.appUpdateCheckButton.textContent = t('settings.appUpdate.check');
    els.appUpdateViewReleaseButton.classList.add('hidden');
    els.appUpdateMessage.textContent = '';
    els.appUpdateMessage.classList.remove('error');
    return;
  }
  els.appUpdateInstalled.textContent = `v${s.currentVersion}`;
  if (s.latest) {
    els.appUpdateLatest.textContent = !s.hasUpdate && semverLikeEqual(s.latest.version, s.currentVersion)
      ? t('settings.appUpdate.latestWithStatus', { version: s.latest.version, status: t('settings.appUpdate.upToDateShort') })
      : `v${s.latest.version}`;
    els.appUpdateViewReleaseButton.classList.toggle('hidden', !s.hasUpdate);
  } else {
    els.appUpdateLatest.textContent = s.lastCheckedAt ? t('settings.appUpdate.upToDate') : t('settings.common.notChecked');
    els.appUpdateViewReleaseButton.classList.add('hidden');
  }
  els.appUpdateCheckButton.disabled = Boolean(s.checking);
  els.appUpdateCheckButton.textContent = s.checking ? t('settings.appUpdate.checking') : t('settings.appUpdate.check');
  if (s.lastError) {
    els.appUpdateMessage.textContent = t('settings.appUpdate.githubError');
    els.appUpdateMessage.classList.add('error');
  } else {
    els.appUpdateMessage.textContent = '';
    els.appUpdateMessage.classList.remove('error');
  }
}

function semverLikeEqual(a, b) {
  return typeof a === 'string' && typeof b === 'string' && a === b;
}
function compactAge(value) {
  const date = value ? new Date(value) : null;
  if (!date || Number.isNaN(date.getTime())) return '';
  const diffMs = Math.max(0, Date.now() - date.getTime());
  if (diffMs < 45_000) return t('settings.age.justNow');
  const minutes = Math.round(diffMs / 60000);
  if (minutes < 60) return t('settings.age.minutesAgo', { minutes });
  const hours = Math.round(minutes / 60);
  if (hours < 24) return t('settings.age.hoursAgo', { hours });
  return t('settings.age.daysAgo', { days: Math.round(hours / 24) });
}
function colorWithAlpha(hex, alpha) {
  const raw = String(hex || '').replace('#', '');
  if (!/^[0-9a-f]{6}$/i.test(raw)) return `rgba(183, 234, 212, ${alpha})`;
  const r = parseInt(raw.slice(0, 2), 16);
  const g = parseInt(raw.slice(2, 4), 16);
  const b = parseInt(raw.slice(4, 6), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

function setTokscaleMessage(text = '', tone = '') {
  if (!els.tokscaleMessage) return;
  els.tokscaleMessage.textContent = text;
  els.tokscaleMessage.classList.toggle('error', tone === 'error');
  els.tokscaleMessage.classList.toggle('success', tone === 'success');
}

function mergeTokscalePayload(payload) {
  if (!payload || typeof payload !== 'object') return;
  if (payload.status) state.tokscaleStatus = payload.status;
  else if (payload.supported === false) state.tokscaleStatus = { supported: false };
  else if (payload.current || payload.bundled || payload.downloaded) {
    state.tokscaleStatus = {
      ...(state.tokscaleStatus || { supported: true }),
      supported: payload.supported !== false,
      current: payload.current ?? state.tokscaleStatus?.current ?? null,
      bundled: payload.bundled ?? state.tokscaleStatus?.bundled ?? null,
      downloaded: payload.downloaded ?? state.tokscaleStatus?.downloaded ?? null
    };
  }
  if (payload.npm || payload.checkedAt) {
    state.tokscaleCheck = {
      newer: Boolean(payload.newer),
      npm: payload.npm || state.tokscaleCheck?.npm || null,
      checkedAt: payload.checkedAt || state.tokscaleCheck?.checkedAt || null
    };
  }
  if (payload.downloaded === true && state.tokscaleCheck?.npm?.version === payload.version) {
    state.tokscaleCheck = { ...state.tokscaleCheck, newer: false };
  }
}

function renderTokscaleStatus() {
  if (!els.tokscaleGroup) return;
  const status = state.tokscaleStatus;
  if (status?.supported === false) {
    els.tokscaleGroup.classList.add('hidden');
    return;
  }
  els.tokscaleGroup.classList.remove('hidden');
  const current = status?.current;
  const source = current?.source === 'downloaded'
    ? (current.installedAt
      ? t('settings.tokscale.downloadedSourceWithAge', { age: compactAge(current.installedAt) })
      : t('settings.tokscale.downloadedSource'))
    : t('settings.tokscale.bundledSource');
  els.tokscaleInstalled.textContent = current ? `${versionText(current.version)} (${source})` : t('settings.common.notFound');
  els.tokscaleBundledLine.classList.toggle('hidden', !status?.downloaded || !status?.bundled);
  els.tokscaleBundled.textContent = status?.bundled ? versionText(status.bundled.version) : '—';
  if (state.tokscaleCheck?.npm?.version) {
    els.tokscaleNpm.textContent = state.tokscaleCheck.newer
      ? versionText(state.tokscaleCheck.npm.version)
      : t('settings.appUpdate.latestWithStatus', { version: state.tokscaleCheck.npm.version, status: t('settings.tokscale.currentSuffix') });
  } else {
    els.tokscaleNpm.textContent = t('settings.common.notChecked');
  }
  els.checkTokscaleButton.disabled = state.tokscaleBusy;
  els.downloadTokscaleButton.disabled = state.tokscaleBusy;
  els.resetTokscaleButton.disabled = state.tokscaleBusy;
  els.downloadTokscaleButton.classList.toggle('hidden', !state.tokscaleCheck?.newer);
  els.resetTokscaleButton.classList.toggle('hidden', !status?.downloaded);
}

async function refreshTokscaleStatus() {
  if (!window.tokenMonitor.getTokscaleStatus) return;
  try {
    state.tokscaleStatus = await window.tokenMonitor.getTokscaleStatus();
    renderTokscaleStatus();
  } catch (error) {
    setTokscaleMessage(error.message, 'error');
  }
}

async function checkTokscaleNpm() {
  state.tokscaleBusy = true;
  setTokscaleMessage(t('settings.tokscale.checkingNpm'));
  renderTokscaleStatus();
  try {
    const result = await window.tokenMonitor.checkTokscaleNpm();
    if (result?.error) throw new Error(result.error);
    mergeTokscalePayload(result);
    if (state.tokscaleStatus?.supported === false) return;
    setTokscaleMessage(state.tokscaleCheck?.newer ? t('settings.tokscale.newerOnNpm') : t('settings.tokscale.bundledCurrent'));
  } catch (error) {
    setTokscaleMessage(error.message, 'error');
  } finally {
    state.tokscaleBusy = false;
    renderTokscaleStatus();
  }
}

async function downloadTokscaleFromNpm() {
  state.tokscaleBusy = true;
  setTokscaleMessage(t('settings.tokscale.downloading'));
  renderTokscaleStatus();
  try {
    const result = await window.tokenMonitor.downloadTokscaleFromNpm();
    if (result?.error) throw new Error(result.error);
    mergeTokscalePayload(result);
    setTokscaleMessage(t('settings.tokscale.downloaded', { version: versionText(result.version) }), 'success');
  } catch (error) {
    setTokscaleMessage(error.message, 'error');
  } finally {
    state.tokscaleBusy = false;
    renderTokscaleStatus();
  }
}

async function resetTokscaleToBundled() {
  state.tokscaleBusy = true;
  setTokscaleMessage(t('settings.tokscale.resetting'));
  renderTokscaleStatus();
  try {
    state.tokscaleStatus = await window.tokenMonitor.resetTokscaleToBundled();
    state.tokscaleCheck = null;
    setTokscaleMessage(t('settings.tokscale.usingBundled'), 'success');
  } catch (error) {
    setTokscaleMessage(error.message, 'error');
  } finally {
    state.tokscaleBusy = false;
    renderTokscaleStatus();
  }
}
function easeOutQuart(t) { return 1 - Math.pow(1 - t, 4); }

function animateNumber(el, from, to, duration = 2200) {
  const start = performance.now();
  const delta = to - from;
  function frame(now) {
    const progress = Math.min(1, (now - start) / duration);
    el.textContent = formatNumber(from + delta * easeOutQuart(progress));
    if (progress < 1) requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);
}

function rowWidth(value, max) {
  return max > 0 ? Math.max(2, Math.min(100, (value / max) * 100)) : 0;
}

function rowTemplate(rowData) {
  const { key, name, platform, client, subtitle, detail, kind } = rowData;
  const row = document.createElement('div');
  row.dataset.key = key;
  if (platform) row.dataset.platform = platform;
  if (client) row.dataset.client = client;
  if (kind) row.dataset.kind = kind;
  row.innerHTML = '<div class="row-head"><div class="row-name"><span class="row-mark"></span><div class="row-label"><span class="row-title"></span><span class="row-subtitle"></span><span class="row-detail"></span></div></div><div class="row-metrics"><div class="row-value"></div><div class="row-cost"></div></div></div><div class="bar"><div class="bar-fill"></div></div>';
  row.querySelector('.row-title').textContent = name;
  row.querySelector('.row-subtitle').textContent = subtitle || '';
  row.querySelector('.row-detail').textContent = detail || '';
  return row;
}

function updateRow(row, { name, subtitle, detail, value, cost, max, color, stale, platform, local, client, kind, title }) {
  const width = rowWidth(value, max);
  row.className = `row${kind ? ` ${kind}-row` : ''}${stale ? ' stale' : ''}${local ? ' local' : ''}`;
  row.title = local ? 'This device' : (title || '');
  if (platform !== undefined) row.dataset.platform = platform || '';
  if (client !== undefined) row.dataset.client = client || '';
  if (kind !== undefined) row.dataset.kind = kind || '';
  const mark = row.querySelector('.row-mark');
  const iconKind = iconKindFor({ key: row.dataset.key, platform: row.dataset.platform || '', client: row.dataset.client || '' }, state.breakdown);
  if (iconKind.kind === 'icon') {
    mark.className = `row-mark row-icon ${iconKind.iconClass}`;
    mark.style.background = '';
  } else {
    mark.className = 'row-mark dot';
    mark.style.background = color;
  }
  row.querySelector('.row-title').textContent = name;
  const subtitleEl = row.querySelector('.row-subtitle');
  subtitleEl.textContent = subtitle || '';
  subtitleEl.classList.toggle('hidden', !subtitle);
  const detailEl = row.querySelector('.row-detail');
  detailEl.textContent = detail || '';
  detailEl.classList.toggle('hidden', !detail);
  row.querySelector('.row-value').textContent = formatNumber(value);
  row.querySelector('.row-cost').textContent = formatCost(cost || 0);
  const fill = row.querySelector('.bar-fill');
  fill.style.background = color;
  fill.style.width = `${width}%`;
}

function renderRows(rows) {
  if (rows.length === 0) {
    els.breakdown.replaceChildren();
    state.rowSignature = '';
    return;
  }
  const max = Math.max(1, ...rows.map((row) => row.value));
  const signature = `${state.breakdown}\n${rows.map((row) => row.key).join('\n')}`;
  const existing = new Map(Array.from(els.breakdown.children).map((child) => [child.dataset.key, child]));
  if (signature !== state.rowSignature) {
    els.breakdown.replaceChildren(...rows.map((row) => existing.get(row.key) || rowTemplate(row)));
    state.rowSignature = signature;
  }
  const current = new Map(Array.from(els.breakdown.children).map((child) => [child.dataset.key, child]));
  for (const rowData of rows) {
    const row = current.get(rowData.key);
    if (row) updateRow(row, { ...rowData, max });
  }
}

function deviceLabel(device) {
  return device.deviceId || device.hostname || 'device';
}

function deviceColor(stale) {
  return stale ? deviceStaleColor : deviceAccent;
}

function stableColor(value, colors) {
  let hash = 0;
  for (const char of String(value || '')) hash = ((hash << 5) - hash + char.charCodeAt(0)) | 0;
  return colors[Math.abs(hash) % colors.length];
}

function modelVendorFor(model) {
  const name = String(model || '').toLowerCase();
  if (/^(cursor-)?auto$/.test(name)) return 'cursor';
  if (/claude|anthropic|sonnet|opus|haiku/.test(name)) return 'claude';
  if (/gpt|openai|codex|^o[134](?:-|$)|o[134]-(mini|pro|preview)|chatgpt/.test(name)) return 'codex';
  if (/gemini|gemma|google/.test(name)) return 'gemini';
  if (/grok|xai/.test(name)) return 'xai';
  if (/deepseek/.test(name)) return 'deepseek';
  if (/llama|meta/.test(name)) return 'meta';
  if (/mistral|mixtral|codestral/.test(name)) return 'mistral';
  if (/qwen|qwq|qvq/.test(name)) return 'qwen';
  if (/kimi|moonshot/.test(name)) return 'moonshot';
  if (/chatglm|\bglm-|\bzai\b|z\.ai|zhipu/.test(name)) return 'zai';
  if (/cohere|command-r/.test(name)) return 'cohere';
  if (/mimo|xiaomi/.test(name)) return 'xiaomi';
  if (/minimax|\babab/.test(name)) return 'minimax';
  return null;
}

function modelColor(model) {
  const vendor = modelVendorFor(model);
  if (vendor && clientColors[vendor]) return clientColors[vendor];
  const name = String(model || '').toLowerCase();
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = (hash * 31 + name.charCodeAt(i)) | 0;
  return fallbackModelColors[Math.abs(hash) % fallbackModelColors.length];
}

function deviceRowsForPeriod() {
  const localId = state.settings?.deviceId || '';
  return (state.stats?.devices || []).map((device) => ({
    key: device.deviceId,
    name: deviceLabel(device),
    value: Number(device.periods?.[state.period]?.totalTokens || 0),
    cost: Number(device.periods?.[state.period]?.costUsd || 0),
    color: deviceColor(Boolean(device.stale)),
    stale: Boolean(device.stale),
    platform: device.platform || '',
    local: Boolean(localId) && device.deviceId === localId
  })).sort((a, b) => b.value - a.value);
}

function toolRowsForPeriod(period) {
  const clientRows = Object.entries(period?.clients || {}).filter(([, value]) => Number(value) > 0).map(([client, value]) => ({ key: client, name: clientLabels[client] || client, value: Number(value), cost: Number(period?.clientCosts?.[client] || 0), color: clientColors[client] || clientColors.default, stale: false }));
  if (clientRows.length > 0) return clientRows.sort((a, b) => b.value - a.value);
  if (Number(period?.totalTokens || 0) === 0) return [];
  return deviceRowsForPeriod();
}

function modelRowsForPeriod(period) {
  const modelRows = Object.entries(period?.models || {}).filter(([, value]) => Number(value) > 0).map(([model, value]) => ({
    key: model,
    name: model,
    value: Number(value),
    cost: Number(period?.modelCosts?.[model] || 0),
    color: modelColor(model),
    stale: false
  }));
  if (modelRows.length > 0) return modelRows.sort((a, b) => b.value - a.value);
  if (Number(period?.totalTokens || 0) === 0) return [];
  return toolRowsForPeriod(period);
}

function sessionRowsForPeriod(period) {
  const rows = sessionRowsApi.sessionRowsForPeriod(period, {
    clientLabels,
    clientColors,
    modelColor,
    stableColor,
    fallbackColors: fallbackModelColors
  });
  if (rows.length > 0) return rows.sort((a, b) => b.sortTime - a.sortTime || b.value - a.value || b.cost - a.cost || a.name.localeCompare(b.name));
  if (Number(period?.totalTokens || 0) === 0) return [];
  return modelRowsForPeriod(period);
}

function rowsForPeriod(period) {
  if (state.breakdown === 'device') return deviceRowsForPeriod();
  if (state.breakdown === 'model') return modelRowsForPeriod(period);
  if (state.breakdown === 'session') return sessionRowsForPeriod(period);
  return toolRowsForPeriod(period);
}

function limitViewAvailable() {
  return enabledLimitProviderSet().size > 0;
}

function limitStatusLabel(status, stale) {
  if (status === 'ok') return 'Live';
  if (status === 'disabled') return 'Disabled';
  if (status === 'notConfigured') return 'Not signed in';
  if (status === 'noSyncedData') return 'No synced data';
  if (status === 'unauthorized') return 'Sign in again';
  if (status === 'rateLimited') return 'Limited';
  if (status === 'sourceRateLimited') return 'Usage API limited';
  if (status === 'unavailable') return 'Unavailable';
  return 'Error';
}
function limitProviderMeta(provider) {
  if (provider.stale) return `Stale · ${formatUpdatedAge(provider.updatedAt).replace('Updated ', '')}`;
  if (provider.status === 'ok') {
    const source = state.settings?.showLimitSource && LIMIT_SOURCE_LABELS[provider.source] ? ` · ${LIMIT_SOURCE_LABELS[provider.source]}` : '';
    return `${formatUpdatedAge(provider.updatedAt)}${source}`;
  }
  return limitStatusLabel(provider.status, false);
}

function limitProviderPlan(provider) {
  const label = String(provider?.accountLabel || '').trim();
  if (label) return label;
  return provider?.status && provider.status !== 'ok' ? limitStatusLabel(provider.status, false) : '';
}

function configuredLimitProviderOrder() {
  const enabled = enabledLimitProviderSet();
  return limitProviderOrderApi
    .normalizeLimitProviderOrder(state.settings?.limitProviderOrder, LIMIT_PROVIDERS)
    .filter((id) => enabled.has(id));
}

function configuredLimitProviderSelection() {
  const raw = state.settings?.limitProviders;
  const source = raw === undefined || raw === null ? DEFAULT_LIMIT_PROVIDER_ORDER : raw;
  return limitProviderOrderApi.normalizeLimitProviderSelection(source, LIMIT_PROVIDERS);
}

function enabledLimitProviderSet() {
  if (state.settings?.limitsEnabled === false) return new Set();
  return new Set(configuredLimitProviderSelection());
}

function missingLimitProviderStatus() {
  return state.mode === 'sync' || String(state.settings?.hubUrl || '').trim() ? 'noSyncedData' : 'notConfigured';
}

function windowForKind(provider, kind) {
  return (provider?.windows || []).find((window) => window.kind === kind) || null;
}

function windowsForKind(provider, kind) {
  return (provider?.windows || []).filter((window) => window.kind === kind);
}

function formatLimitAmount(value) {
  const number = Number(value);
  if (!Number.isFinite(number)) return '';
  return `$${number.toFixed(2)}`;
}

function formatLimitWindowValue(window, fillPercent, hasPercent) {
  if (hasPercent) return `${formatPercent(fillPercent)} left`;
  if (!window) return '--';
  const remaining = Number(window?.remaining);
  if (Number.isFinite(remaining)) {
    return window?.showMeter === false ? formatLimitAmount(remaining) : `${formatLimitAmount(remaining)} left`;
  }
  const limit = Number(window?.limit);
  if (Number.isFinite(limit)) return `${formatLimitAmount(limit)} cap`;
  return '';
}

function limitWindowNode(label, window, color, tone = 1) {
  const remaining = Number(window?.remainingPercent);
  const used = Number(window?.usedPercent);
  const showMeter = window?.showMeter !== false;
  const hasPercent = showMeter && (Number.isFinite(remaining) || Number.isFinite(used));
  const fillPercent = Number.isFinite(remaining)
    ? remaining
    : Number.isFinite(used)
      ? 100 - used
      : 0;
  const safePercent = Math.max(0, Math.min(100, fillPercent));
  const item = document.createElement('div');
  item.className = 'limit-window';
  const text = document.createElement('div');
  text.className = 'limit-window-text';
  const name = document.createElement('span');
  name.textContent = window?.label || label;
  const value = document.createElement('span');
  value.textContent = formatLimitWindowValue(window, fillPercent, hasPercent);
  text.append(name, value);
  const meter = document.createElement('div');
  meter.className = 'limit-meter';
  meter.style.background = colorWithAlpha(color, 0.16);
  const fill = document.createElement('div');
  fill.className = 'limit-meter-fill';
  fill.style.width = `${safePercent}%`;
  fill.style.background = color;
  fill.style.opacity = tone;
  meter.append(fill);
  const reset = document.createElement('div');
  reset.className = 'limit-reset';
  reset.textContent = formatReset(window?.resetsAt) || window?.resetDescription || '';
  if (showMeter) {
    item.append(text, meter, reset);
  } else {
    item.classList.add('limit-window-note');
    item.append(text, reset);
  }
  return item;
}

function renderLimits() {
  if (!els.limitsPanel) return;
  const limitsEnabled = state.settings?.limitsEnabled !== false;
  const enabled = enabledLimitProviderSet();
  const providers = new Map((state.stats?.limits?.providers || []).map((provider) => [provider.provider, provider]));
  const nodes = [];
  const rows = limitProviderOrderApi
    .orderedLimitProviders(LIMIT_PROVIDERS, state.settings?.limitProviderOrder)
    .filter(({ id }) => limitsEnabled && enabled.has(id));
  if (rows.length === 0) {
    els.limitsPanel.replaceChildren();
    return;
  }
  for (const { id, label } of rows) {
    const providerEnabled = limitsEnabled && enabled.has(id);
    const provider = providerEnabled
      ? (providers.get(id) || { provider: id, status: state.stats ? missingLimitProviderStatus() : 'unavailable', windows: [] })
      : { provider: id, status: 'disabled', windows: [] };
    const color = clientColors[id] || clientColors.default;
    const row = document.createElement('div');
    row.className = `limit-row${provider.stale ? ' stale' : ''}`;
    const head = document.createElement('div');
    head.className = 'limit-head';
    const titleBlock = document.createElement('div');
    titleBlock.className = 'limit-title';
    const name = document.createElement('div');
    name.className = 'limit-name';
    const mark = document.createElement('span');
    if (clientsWithIcon.has(id)) {
      mark.className = `limit-icon limit-icon-${id}`;
    } else {
      mark.className = 'dot';
      mark.style.background = color;
    }
    const title = document.createElement('span');
    title.textContent = label;
    name.append(mark, title);
    const meta = document.createElement('div');
    meta.className = 'limit-meta';
    meta.textContent = provider.status === 'ok' || provider.stale ? limitProviderMeta(provider) : '';
    titleBlock.append(name, meta);
    const plan = document.createElement('div');
    plan.className = 'limit-plan';
    plan.textContent = limitProviderPlan(provider);
    head.append(titleBlock, plan);
    const windows = document.createElement('div');
    windows.className = 'limit-windows';
    if (provider.provider === 'cursor') {
      windows.classList.add('limit-windows-cursor');
      const billingWindows = windowsForKind(provider, 'billing');
      const visibleWindows = billingWindows.length > 0 ? billingWindows : [null];
      for (const billing of visibleWindows) {
        const node = limitWindowNode('Billing cycle', billing, color, 0.68);
        node.classList.add('limit-window-wide');
        windows.append(node);
      }
    } else if (provider.provider === 'antigravity') {
      windows.classList.add('limit-windows-antigravity');
      const weeklyWindows = windowsForKind(provider, 'weekly');
      const visibleWindows = weeklyWindows.length > 0 ? weeklyWindows : [null];
      for (const weekly of visibleWindows) {
        const node = limitWindowNode(weekly?.label || 'Weekly', weekly, color, 0.78);
        node.classList.add('limit-window-wide');
        windows.append(node);
      }
    } else {
      windows.append(limitWindowNode('Session', windowForKind(provider, 'session'), color, 0.95));
      windows.append(limitWindowNode('Weekly', windowForKind(provider, 'weekly'), color, 0.68));
    }
    row.append(head, windows);
    nodes.push(row);
  }
  els.limitsPanel.replaceChildren(...nodes);
}

function nextBreakdown(value) {
  const order = limitViewAvailable() ? [...baseBreakdownOrder, 'limits'] : baseBreakdownOrder;
  const index = order.indexOf(value);
  return order[(index + 1) % order.length];
}

function breakdownLabel(deviceText) {
  if (state.breakdown === 'device') return deviceText;
  if (state.breakdown === 'model') return 'Model';
  if (state.breakdown === 'session') return 'Sessions';
  if (state.breakdown === 'limits') return 'Limits';
  return 'Tools';
}

async function openSessionDetail({ client, sessionId, sessionCost, title }) {
  state.openSession = { client, sessionId, sessionCost, title, detail: null };
  renderSessionDetail({ loading: true });
  try {
    const detail = await window.tokenMonitor.getSessionDetail({ client, sessionId, period: state.period, sessionCost });
    if (state.openSession && state.openSession.sessionId === sessionId) {
      state.openSession.detail = detail;
      renderSessionDetail({ detail });
    }
  } catch (_) {
    if (state.openSession && state.openSession.sessionId === sessionId) renderSessionDetail({ error: true });
  }
}

function toggleDetailSort() {
  state.detailSort = state.detailSort === 'tokens' ? 'time' : 'tokens';
  if (state.openSession && state.openSession.detail) renderSessionDetail({ detail: state.openSession.detail });
}

function closeSessionDetail() {
  state.openSession = null;
  els.sessionDetail.classList.add('hidden');
  els.sessionDetail.replaceChildren();
  els.sessionDetailHead.classList.add('hidden');
  els.sessionDetailHead.replaceChildren();
  render();
}

function renderSessionDetail({ detail, loading, error } = {}) {
  els.breakdown.classList.add('hidden');
  els.sessionDetail.classList.remove('hidden');
  els.sessionDetailHead.classList.remove('hidden');
  const head = els.sessionDetailHead;       // static layer — rows scroll independently below it
  const container = els.sessionDetail;
  head.replaceChildren();
  container.replaceChildren();

  const back = document.createElement('button');
  back.className = 'detail-back';
  back.textContent = `‹ ${t('sessions') || 'Sessions'}`;
  back.addEventListener('click', closeSessionDetail);
  head.append(back);

  if (loading) { container.append(detailNote(t('detailLoading') || 'Loading…')); return; }
  if (error || (detail && detail.found === false)) { container.append(detailNote(t('detailNotFound') || 'Transcript not found on this machine.')); return; }

  const rows = sessionDetailApi.exchangeRows(detail, { now: new Date(), sortBy: state.detailSort });
  if (rows.length === 0) { container.append(detailNote(t('detailEmpty') || 'No activity in this period.')); return; }

  const sort = document.createElement('button');
  sort.className = 'detail-sort';
  sort.textContent = state.detailSort === 'tokens' ? (t('sortMostTokens') || '↕ Most tokens') : (t('sortNewest') || '↕ Newest');
  sort.addEventListener('click', toggleDetailSort);
  head.append(sort);

  const max = Math.max(1, ...rows.map((row) => row.value));
  for (const row of rows) container.append(exchangeNode(row, max));
}

function detailNote(text) {
  const note = document.createElement('div');
  note.className = 'detail-note';
  note.textContent = text;
  return note;
}

function exchangeNode(row, max) {
  const wrap = document.createElement('div');
  wrap.className = 'detail-exchange';
  wrap.innerHTML = '<div class="detail-ex-head"><span class="detail-chev">▸</span>'
    + '<div class="detail-ex-label"><span class="detail-ex-title"></span><span class="detail-ex-sub"></span></div>'
    + '<div class="detail-ex-metrics"><span class="detail-ex-value"></span><span class="detail-ex-cost"></span></div></div>'
    + '<div class="bar"><div class="bar-fill"></div></div>'
    + '<div class="detail-turns hidden"></div>';
  const exTitle = wrap.querySelector('.detail-ex-title');
  if (row.isPrompt) {
    const role = document.createElement('span');
    role.className = 'detail-role-user';
    role.textContent = t('roleYou') || 'You';
    const sep = document.createElement('span');
    sep.className = 'detail-role-sep';
    sep.textContent = ' › ';
    exTitle.append(role, sep);
  }
  exTitle.append(document.createTextNode(row.title));
  wrap.querySelector('.detail-ex-sub').textContent = row.subtitle;
  wrap.querySelector('.detail-ex-value').textContent = formatNumber(row.value);
  wrap.querySelector('.detail-ex-cost').textContent = formatCost(row.cost);
  wrap.querySelector('.bar-fill').style.width = `${rowWidth(row.value, max)}%`;

  const turnsEl = wrap.querySelector('.detail-turns');
  for (const turn of row.turns) turnsEl.append(turnNode(turn));

  const head = wrap.querySelector('.detail-ex-head');
  head.addEventListener('click', () => {
    const collapsed = turnsEl.classList.toggle('hidden');
    wrap.querySelector('.detail-chev').textContent = collapsed ? '▸' : '▾';
  });
  return wrap;
}

function turnNode(turn) {
  const el = document.createElement('div');
  el.className = 'detail-turn';
  const tk = turn.tokens || {};
  const split = `in ${formatNumber(tk.input || 0)} · out ${formatNumber(tk.output || 0)} · cache ${formatNumber(tk.cacheRead || 0)}`
    + (tk.reasoning ? ` · reason ${formatNumber(tk.reasoning)}` : '');
  el.innerHTML = '<div class="detail-turn-label"><span class="detail-turn-title"></span><span class="detail-turn-split"></span><span class="detail-turn-tools"></span></div>'
    + '<div class="detail-turn-metrics"><span class="detail-turn-value"></span><span class="detail-turn-cost"></span></div>';
  el.querySelector('.detail-turn-title').textContent = `AI ${turn.label}`;
  el.querySelector('.detail-turn-split').textContent = split;
  el.querySelector('.detail-turn-tools').textContent = turn.tools ? `⊢ ${turn.tools}` : '';
  el.querySelector('.detail-turn-value').textContent = formatNumber(turn.value);
  el.querySelector('.detail-turn-cost').textContent = formatCost(turn.cost);
  return el;
}

let contentReadySignaled = false;

function render() {
  if (!state.stats) return;
  if (state.breakdown === 'limits' && !limitViewAvailable()) {
    setBreakdown('tool');
  }
  if (state.openSession && state.breakdown !== 'session') { state.openSession = null; els.sessionDetail.classList.add('hidden'); els.sessionDetail.replaceChildren(); els.sessionDetailHead.classList.add('hidden'); els.sessionDetailHead.replaceChildren(); }
  if (state.openSession) { els.sessionDetail.classList.remove('hidden'); els.sessionDetailHead.classList.remove('hidden'); } else { els.sessionDetail.classList.add('hidden'); els.sessionDetailHead.classList.add('hidden'); }
  const period = state.stats.periods?.[state.period] || { totalTokens: 0, costUsd: 0, clients: {} };
  const nextTotal = Number(period.totalTokens || 0);
  if (state.suppressInitialNumberAnimation) {
    els.totalTokens.textContent = formatNumber(nextTotal);
    state.suppressInitialNumberAnimation = false;
  } else {
    animateNumber(els.totalTokens, state.currentTotal, nextTotal);
  }
  state.currentTotal = nextTotal;
  els.cost.textContent = formatCost(period.costUsd || 0);
  els.refreshButton.title = `Stats refreshed ${formatTime(state.stats.updatedAt)}`;
  const devices = state.stats.devices || [];
  const staleCount = devices.filter((device) => device.stale).length;
  const deviceText = `${devices.length} device${devices.length === 1 ? '' : 's'}`;
  els.breakdownToggle.textContent = breakdownLabel(deviceText);
  els.breakdownToggle.removeAttribute('title');
  els.shell.classList.toggle('session-mode', state.breakdown === 'session');
  if (state.breakdown === 'limits') {
    els.breakdown.classList.add('hidden');
    els.limitsPanel.classList.remove('hidden');
    renderLimits();
  } else if (state.openSession) {
    // session-detail view replaces the breakdown list; keep both the list and
    // limits hidden so a periodic re-render doesn't surface them over the detail.
    els.limitsPanel.classList.add('hidden');
    els.breakdown.classList.add('hidden');
  } else {
    els.limitsPanel.classList.add('hidden');
    els.breakdown.classList.remove('hidden');
    const rows = rowsForPeriod(period);
    renderRows(rows);
  }
  renderFloatingBubbleContent();
  // Tell main the window has painted real content (not the static "0" defaults),
  // so a recreated window can stay hidden until it's populated. See loadWindowFile.
  if (!contentReadySignaled) {
    contentReadySignaled = true;
    window.tokenMonitor.signalContentReady?.();
  }
}

function setStatus(text, isError = false) {
  els.status.textContent = text;
  els.status.classList.toggle('error', isError);
}

function statusTextFor(mode, connected) {
  if (mode === 'sync') return connected ? 'Live' : 'Offline';
  if (mode === 'local') return connected ? 'Local' : 'Collecting…';
  return 'Starting…';
}

function liveDotTitle(mode, connected) {
  if (mode === 'sync') return connected ? 'Hub stream live' : 'Hub stream offline';
  if (mode === 'local') return connected ? 'Local collector running' : 'Local collector starting…';
  return 'Idle';
}

function setLiveDot(connected) {
  els.liveDot.classList.toggle('live', Boolean(connected));
  els.liveDot.title = liveDotTitle(state.mode, connected);
}

async function refreshStats(options = {}) {
  try {
    state.stats = await window.tokenMonitor.getStats(options);
    setStatus(statusTextFor(state.mode, state.streamConnected));
    render();
    maybeUpdateBarsIcon();
  } catch (error) {
    setStatus(error.message, true);
  }
}

function publishViewState() {
  window.tokenMonitor.setViewState?.({ period: state.period, breakdown: state.breakdown });
}

function setPeriod(period) {
  const next = normalizeInitialViewValue(period, viewPeriodValues, state.period);
  if (next === state.period) {
    publishViewState();
    return false;
  }
  state.period = next;
  publishViewState();
  return true;
}

function setBreakdown(breakdown) {
  const next = normalizeInitialViewValue(breakdown, viewBreakdownValues, state.breakdown);
  if (next === state.breakdown) {
    publishViewState();
    return false;
  }
  state.breakdown = next;
  state.rowSignature = '';
  publishViewState();
  return true;
}

function restartTimer() {
  if (state.refreshTimer) clearInterval(state.refreshTimer);
  const interval = state.streamConnected
    ? 5 * 60 * 1000
    : Number(state.settings?.refreshMs || 15000);
  state.refreshTimer = setInterval(refreshStats, interval);
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, Number(value)));
}

function applyAppearanceSettings(settings) {
  const opacity = clamp(settings?.glassOpacity ?? 68, 0, 100) / 100;
  const depth = clamp(settings?.glassBlur ?? 32, 0, 100) / 100;
  document.documentElement.style.setProperty('--glass-alpha', opacity.toFixed(2));
  document.documentElement.style.setProperty('--line-alpha', (0.1 + depth * 0.09).toFixed(3));
  document.documentElement.style.setProperty('--line-strong-alpha', (0.18 + depth * 0.14).toFixed(3));
  document.documentElement.style.setProperty('--control-alpha', (0.03 + depth * 0.045).toFixed(3));
  document.documentElement.style.setProperty('--highlight-alpha', (0.045 + depth * 0.06).toFixed(3));
  els.liveDot.style.display = (settings?.showLiveDot !== false) ? '' : 'none';
  els.shell.classList.toggle('desktop-mode', settings?.windowBehavior === 'desktop');
  els.shell.classList.toggle('title-icon-only', settings?.titleIconOnly === true);
  updateTitleFit();
}

function currentWindowBehavior(source = state.settings) {
  if (WINDOW_BEHAVIOR_VALUES.includes(source?.windowBehavior)) return source.windowBehavior;
  return source?.alwaysOnTop ? 'floating' : 'normal';
}

function nextWindowBehavior(mode) {
  const index = WINDOW_BEHAVIOR_VALUES.indexOf(mode);
  return WINDOW_BEHAVIOR_VALUES[(index + 1) % WINDOW_BEHAVIOR_VALUES.length] || 'floating';
}

function syncWindowBehaviorControls() {
  const mode = currentWindowBehavior();
  const next = nextWindowBehavior(mode);
  els.windowBehaviorInput.value = mode;
  els.pinButton.textContent = WINDOW_BEHAVIOR_ICONS[mode] || WINDOW_BEHAVIOR_ICONS.normal;
  els.pinButton.classList.toggle('active', mode !== 'normal');
  const title = t('settings.windowBehavior.buttonTitle', {
    current: t(`settings.windowBehavior.${mode}`),
    next: t(`settings.windowBehavior.${next}`)
  });
  els.pinButton.title = title;
  els.pinButton.setAttribute('aria-label', title);
}

function applyFloatingBubbleState(payload = {}) {
  const side = payload?.collapsed && ['left', 'right'].includes(payload.side) ? payload.side : null;
  state.floatingBubble = { collapsed: Boolean(side), side };
  document.documentElement.classList.toggle('floating-bubble-collapsed-left', side === 'left');
  document.documentElement.classList.toggle('floating-bubble-collapsed-right', side === 'right');
  document.body.classList.toggle('floating-bubble-collapsed-left', side === 'left');
  document.body.classList.toggle('floating-bubble-collapsed-right', side === 'right');
  const title = t('floatingBubble.expand');
  if (els.floatingBubbleTab) {
    els.floatingBubbleTab.title = title;
    els.floatingBubbleTab.setAttribute('aria-label', title);
  }
  renderFloatingBubbleContent();
}

const BUBBLE_CONTENT_VALUES = ['icon', 'tokens', 'cost', 'both', 'tokensAll', 'costAll', 'bothAll', 'bars', 'barsSession', 'barsWeekly', 'barsAllSessions'];
function normalizeTrayContentValue(value) {
  return BUBBLE_CONTENT_VALUES.includes(value) ? value : 'icon';
}

const BUBBLE_CONTENT_MIN_W = 18;
const BUBBLE_CONTENT_HEIGHT = 34;
const BUBBLE_CONTENT_PAD_X = 10;
// The tray bars are black (a macOS menu-bar template); on the bubble's dark glass they need light ink.
const BUBBLE_BARS_COLORS = { track: 'rgba(255, 255, 255, 0.22)', fill: 'rgba(255, 255, 255, 0.92)' };

function isBarsMode(mode) {
  return mode === 'bars' || mode === 'barsSession' || mode === 'barsWeekly' || mode === 'barsAllSessions';
}

function renderFloatingBubbleContent() {
  const el = els.floatingBubbleContent;
  if (!el || !state.floatingBubble.collapsed) return;
  const mode = state.settings?.floatingBubbleContent || 'icon';
  if (isBarsMode(mode)) {
    const dataUrl = state.stats
      ? barsDataUrlForMode(mode, 44, BUBBLE_BARS_COLORS, { contentOnly: mode === 'barsAllSessions' })
      : null;
    if (dataUrl) {
      el.classList.add('bars');
      const img = new Image();
      img.alt = '';
      // A data-URL image has no layout width until it loads; size once it does.
      img.addEventListener('load', reportFloatingBubbleSize, { once: true });
      img.src = dataUrl;
      el.replaceChildren(img);
      return;
    }
    el.classList.remove('bars');
    el.textContent = (state.stats && window.TokenMonitorTrayText.formatTrayText(state.stats, mode, currentCurrency())) || 'Σ';
  } else if (mode === 'icon') {
    el.classList.remove('bars');
    el.textContent = 'Σ';
  } else {
    el.classList.remove('bars');
    el.textContent = state.stats ? (window.TokenMonitorTrayText.formatTrayText(state.stats, mode, currentCurrency()) || '0') : '0';
  }
  reportFloatingBubbleSize();
}

function reportFloatingBubbleSize() {
  if (!state.floatingBubble.collapsed) return;
  const el = els.floatingBubbleContent;
  const mode = state.settings?.floatingBubbleContent || 'icon';
  // Height is constant; only the width tracks the content.
  let width = BUBBLE_CONTENT_MIN_W;
  if (mode !== 'icon' && el) {
    const pad = isBarsMode(mode) ? 8 : BUBBLE_CONTENT_PAD_X * 2;
    width = Math.max(BUBBLE_CONTENT_MIN_W, Math.ceil(el.scrollWidth) + pad);
  }
  window.tokenMonitor.setFloatingBubbleCollapsedSize?.({ width, height: BUBBLE_CONTENT_HEIGHT });
}

const HOVER_REVEAL_DELAY_MS = 250;
const HOVER_COLLAPSE_GRACE_MS = 200;
let floatingBubbleHoverRevealTimer = null;
let floatingBubbleHoverCollapseTimer = null;
let suppressHoverRevealUntilReentry = false;

function floatingBubbleHoverMode() {
  return state.settings?.floatingBubbleTrigger === 'hover' && state.settings?.floatingBubbleEnabled === true;
}

function clearHoverRevealTimer() {
  if (floatingBubbleHoverRevealTimer) { clearTimeout(floatingBubbleHoverRevealTimer); floatingBubbleHoverRevealTimer = null; }
}

function clearHoverCollapseTimer() {
  if (floatingBubbleHoverCollapseTimer) { clearTimeout(floatingBubbleHoverCollapseTimer); floatingBubbleHoverCollapseTimer = null; }
}

function handleFloatingBubbleHoverEnter() {
  if (!floatingBubbleHoverMode() || !state.floatingBubble.collapsed || suppressHoverRevealUntilReentry) return;
  clearHoverRevealTimer();
  floatingBubbleHoverRevealTimer = setTimeout(() => {
    floatingBubbleHoverRevealTimer = null;
    if (!floatingBubbleHoverMode() || !state.floatingBubble.collapsed || floatingBubbleDrag) return;
    window.tokenMonitor.peekFloatingBubble?.();
  }, HOVER_REVEAL_DELAY_MS);
}

function handleFloatingBubbleHoverLeave() {
  clearHoverRevealTimer();
  suppressHoverRevealUntilReentry = false;
}

function handleDocumentHoverLeave() {
  if (!floatingBubbleHoverMode() || state.floatingBubble.collapsed) return;
  clearHoverCollapseTimer();
  floatingBubbleHoverCollapseTimer = setTimeout(() => {
    floatingBubbleHoverCollapseTimer = null;
    if (!floatingBubbleHoverMode() || state.floatingBubble.collapsed) return;
    window.tokenMonitor.collapseFloatingBubbleIfIdle?.();
  }, HOVER_COLLAPSE_GRACE_MS);
}

let floatingBubbleDrag = null;

function floatingBubblePointerOffset(event) {
  const rect = els.floatingBubbleTab?.getBoundingClientRect?.();
  const width = rect?.width || els.floatingBubbleTab?.offsetWidth || 18;
  const height = rect?.height || els.floatingBubbleTab?.offsetHeight || 34;
  const rawX = rect ? event.clientX - rect.left : width / 2;
  const rawY = rect ? event.clientY - rect.top : height / 2;
  const offsetX = Number.isFinite(rawX) ? Math.max(0, Math.min(width, rawX)) : width / 2;
  const offsetY = Number.isFinite(rawY) ? Math.max(0, Math.min(height, rawY)) : height / 2;
  return {
    offsetX: Math.round(offsetX),
    offsetY: Math.round(offsetY),
    offsetRatioX: width > 0 ? offsetX / width : 0.5,
    offsetRatioY: height > 0 ? offsetY / height : 0.5
  };
}

function finishFloatingBubbleDrag(pointerId) {
  if (!floatingBubbleDrag || floatingBubbleDrag.pointerId !== pointerId) return null;
  const drag = floatingBubbleDrag;
  floatingBubbleDrag = null;
  els.floatingBubbleTab?.classList.remove('dragging');
  try { els.floatingBubbleTab?.releasePointerCapture?.(pointerId); } catch (_) {}
  return drag;
}

function handleFloatingBubblePointerDown(event) {
  if (!state.floatingBubble.collapsed || event.button !== 0) return;
  clearHoverRevealTimer();
  floatingBubbleDrag = {
    pointerId: event.pointerId,
    startX: event.screenX,
    startY: event.screenY,
    ...floatingBubblePointerOffset(event),
    moved: false
  };
  els.floatingBubbleTab?.setPointerCapture?.(event.pointerId);
  event.preventDefault();
}

function handleFloatingBubblePointerMove(event) {
  const drag = floatingBubbleDrag;
  if (!drag || drag.pointerId !== event.pointerId) return;
  const totalDx = event.screenX - drag.startX;
  const totalDy = event.screenY - drag.startY;
  if (!drag.moved && Math.hypot(totalDx, totalDy) < 4) return;
  drag.moved = true;
  els.floatingBubbleTab?.classList.add('dragging');
  const move = window.tokenMonitor.moveFloatingBubble?.({
    offsetX: drag.offsetX,
    offsetY: drag.offsetY,
    offsetRatioX: drag.offsetRatioX,
    offsetRatioY: drag.offsetRatioY
  });
  move?.catch?.(() => {});
  event.preventDefault();
}

function handleFloatingBubblePointerUp(event) {
  const drag = finishFloatingBubbleDrag(event.pointerId);
  if (!drag) return;
  if (!drag.moved) window.tokenMonitor.expandFloatingBubble?.();
  else {
    suppressHoverRevealUntilReentry = true;
    const move = window.tokenMonitor.moveFloatingBubble?.({
      offsetX: drag.offsetX,
      offsetY: drag.offsetY,
      offsetRatioX: drag.offsetRatioX,
      offsetRatioY: drag.offsetRatioY
    });
    move?.catch?.(() => {});
  }
  event.preventDefault();
}

function appearancePatchFromControls() {
  return {
    systemGlass: Boolean(els.systemGlassInput.checked),
    showLiveDot: Boolean(els.liveDotInput.checked),
    showToolIcons: Boolean(els.toolIconsInput.checked),
    titleIconOnly: Boolean(els.titleIconInput.checked),
    glassOpacity: Number(els.glassInput.value === '' ? defaultAppearance.glassOpacity : els.glassInput.value),
    glassBlur: Number(els.blurInput.value === '' ? defaultAppearance.glassBlur : els.blurInput.value),
    zoomFactor: Number(els.zoomInput.value === '' ? defaultAppearance.zoomFactor * 100 : els.zoomInput.value) / 100
  };
}

function applyAppearanceFromControls() {
  const patch = appearancePatchFromControls();
  applyAppearanceSettings(patch);
  window.tokenMonitor.previewAppearance?.(patch).catch(() => {});
}

async function saveAppearanceFromControls() {
  await saveSettings({ ...appearancePatchFromControls(), discordRpcEnabled: Boolean(els.discordRpcInput.checked) });
}

function syncHubModeUi() {
  const mode = state.settings.hubMode || 'local';
  for (const input of els.hubModeOptions.querySelectorAll('input[name="hubMode"]')) {
    input.checked = input.value === mode;
  }
  els.hubClientFields.classList.toggle('hidden', mode !== 'client');
  els.hubHostFields.classList.toggle('hidden', mode !== 'host');
  if (mode === 'host') {
    els.hubPortInput.value = String(state.settings.hubHostPort || 17321);
    els.hubSecretInput.value = state.settings.hubHostSecret || '';
    renderHubStatus();
  }
}

function renderHubStatus() {
  if (!els.hubStatusRow || !els.hubAddressList) return;
  const info = state.hubInfo;
  const port = Number(state.settings.hubHostPort || 17321);
  if (!info) {
    els.hubStatusRow.textContent = t('settings.sync.starting');
    els.hubStatusRow.className = 'hub-status';
    els.hubAddressList.replaceChildren();
    return;
  }
  if (info.error) {
    const code = info.error.code === 'EADDRINUSE' ? t('settings.sync.portInUse', { port }) : info.error.code || t('settings.common.error');
    els.hubStatusRow.textContent = `${code} — ${info.error.message}`;
    els.hubStatusRow.className = 'hub-status error';
    els.hubAddressList.replaceChildren();
    return;
  }
  if (!info.listening) {
    els.hubStatusRow.textContent = t('settings.sync.hubStopped');
    els.hubStatusRow.className = 'hub-status';
    els.hubAddressList.replaceChildren();
    return;
  }
  els.hubStatusRow.textContent = t('settings.sync.listening', { port: info.listeningPort });
  els.hubStatusRow.className = 'hub-status ok';
  renderHubAddresses(info.lanAddresses || [], info.listeningPort);
}

function renderHubAddresses(addresses, port) {
  els.hubAddressList.replaceChildren();
  if (addresses.length === 0) {
    const empty = document.createElement('div');
    empty.className = 'hub-address-empty';
    empty.textContent = t('settings.sync.noLanAddress', { port });
    els.hubAddressList.appendChild(empty);
    return;
  }
  const header = document.createElement('div');
  header.className = 'hub-address-header';
  header.textContent = t('settings.sync.connectWith');
  els.hubAddressList.appendChild(header);
  for (const addr of addresses) {
    const url = `http://${addr.address}:${port}`;
    const row = document.createElement('div');
    row.className = 'hub-address-row';
    const code = document.createElement('code');
    code.textContent = url;
    const ifaceLabel = document.createElement('span');
    ifaceLabel.className = 'hub-address-iface';
    ifaceLabel.textContent = addr.interface;
    const copy = document.createElement('button');
    copy.type = 'button';
    copy.className = 'icon-button';
    copy.title = t('settings.sync.copyUrl', { url });
    copy.textContent = '⧉';
    copy.addEventListener('click', () => copyToClipboard(url, copy));
    row.append(code, ifaceLabel, copy);
    els.hubAddressList.appendChild(row);
  }
}

async function copyToClipboard(text, button) {
  try {
    await navigator.clipboard.writeText(text);
    if (button) {
      const previous = button.textContent;
      button.textContent = '✓';
      setTimeout(() => { button.textContent = previous; }, 900);
    }
  } catch (_) { /* clipboard blocked; no-op */ }
}

async function refreshHubInfo() {
  if (!window.tokenMonitor.getHubInfo) return;
  try {
    state.hubInfo = await window.tokenMonitor.getHubInfo();
    renderHubStatus();
  } catch (_) { /* ignore */ }
}

function syncPeriodTabs() {
  for (const tab of document.querySelectorAll('.tab')) {
    tab.classList.toggle('active', tab.dataset.period === state.period);
  }
}

function syncSettingsForm() {
  applySettingsTranslations();
  syncPeriodTabs();
  syncHubModeUi();
  if (els.languageInput) els.languageInput.value = currentLanguage();
  if (els.currencyInput) els.currencyInput.value = currentCurrency();
  els.hubUrlInput.value = state.settings.hubUrl || '';
  els.secretInput.value = state.settings.secret || '';
  els.deviceIdInput.value = state.settings.deviceId || '';
  els.limitsRefreshInput.value = String(LIMIT_REFRESH_OPTIONS.includes(Number(state.settings.limitsRefreshMs)) ? state.settings.limitsRefreshMs : 300000);
  els.showLimitSourceInput.checked = Boolean(state.settings.showLimitSource);
  els.systemGlassInput.checked = state.settings.systemGlass !== false;
  els.liveDotInput.checked = state.settings.showLiveDot !== false;
  els.toolIconsInput.checked = state.settings.showToolIcons !== false;
  els.titleIconInput.checked = state.settings.titleIconOnly === true;
  els.discordRpcInput.checked = Boolean(state.settings.discordRpcEnabled);
  syncWindowBehaviorControls();
  els.floatingBubbleInput.checked = state.settings.floatingBubbleEnabled === true;
  if (els.floatingBubbleTriggerInput) els.floatingBubbleTriggerInput.value = state.settings.floatingBubbleTrigger === 'hover' ? 'hover' : 'click';
  els.floatingBubbleTriggerRow?.classList.toggle('hidden', state.settings.floatingBubbleEnabled !== true);
  if (els.floatingBubbleContentInput) els.floatingBubbleContentInput.value = normalizeTrayContentValue(state.settings.floatingBubbleContent);
  els.floatingBubbleContentRow?.classList.toggle('hidden', state.settings.floatingBubbleEnabled !== true);
  els.trayModeInput.checked = Boolean(state.settings.trayMode);
  els.trayContentInput.value = ['tokens', 'cost', 'both', 'tokensAll', 'costAll', 'bothAll', 'bars', 'barsSession', 'barsWeekly', 'barsAllSessions', 'icon'].includes(state.settings.trayContent) ? state.settings.trayContent : 'tokens';
  els.startupGroup?.classList.toggle('hidden', !state.appInfo?.loginItemSupported);
  if (els.startAtLoginInput) els.startAtLoginInput.checked = Boolean(state.settings.startAtLogin && state.appInfo?.loginItemSupported);
  if (els.startupNote) {
    els.startupNote.textContent = state.appInfo?.loginItemSupported
      ? t('settings.startup.launchAtSignIn')
      : t('settings.startup.available');
  }
  els.glassInput.value = String(state.settings.glassOpacity ?? 68);
  els.blurInput.value = String(state.settings.glassBlur ?? 32);
  els.zoomInput.value = String(Math.round((Number(state.settings.zoomFactor) || 1) * 100));
  renderClientCheckboxes();
  renderLimitProviderCheckboxes();
  applyAppearanceSettings(state.settings);
  renderTokscaleStatus();
  renderSettingsAppUpdateRow();
  renderCursorStatus();
  applyFloatingBubbleState(state.floatingBubble);
  if (state.breakdown === 'limits') renderLimits();
  else render();
}

function enabledClientSet() {
  return new Set(String(state.settings.clients || '').split(',').map((s) => s.trim().toLowerCase()).filter(Boolean));
}

function renderClientCheckboxes() {
  if (!els.clientCheckboxes) return;
  if (els.clientCheckboxes.childElementCount === KNOWN_CLIENTS.length) {
    const enabled = enabledClientSet();
    for (const cb of els.clientCheckboxes.querySelectorAll('input[type=checkbox]')) {
      cb.checked = enabled.has(cb.dataset.client);
    }
    return;
  }
  const enabled = enabledClientSet();
  els.clientCheckboxes.replaceChildren();
  for (const { id, label } of KNOWN_CLIENTS) {
    const wrap = document.createElement('label');
    wrap.className = 'client-checkbox';
    if (id === 'cursor') wrap.dataset.client = 'cursor';
    const cb = document.createElement('input');
    cb.type = 'checkbox';
    cb.dataset.client = id;
    cb.checked = enabled.has(id);
    cb.addEventListener('change', onClientToggle);
    const text = document.createElement('span');
    text.textContent = label;
    wrap.append(cb, text);
    els.clientCheckboxes.appendChild(wrap);
  }
}

function renderLimitProviderCheckboxes() {
  if (!els.limitProviderCheckboxes) return;
  const enabled = enabledLimitProviderSet();
  const providers = limitProviderOrderApi.orderedLimitProviders(LIMIT_PROVIDERS, state.settings?.limitProviderOrder);
  els.limitProviderCheckboxes.replaceChildren();
  for (const [index, { id, label, settingsLabel }] of providers.entries()) {
    const row = document.createElement('div');
    row.className = 'limit-provider-row';
    row.dataset.provider = id;
    const wrap = document.createElement('label');
    wrap.className = 'client-checkbox limit-provider-toggle';
    const cb = document.createElement('input');
    cb.type = 'checkbox';
    cb.dataset.provider = id;
    cb.checked = enabled.has(id);
    cb.addEventListener('change', onLimitProviderToggle);
    const text = document.createElement('span');
    text.textContent = settingsLabel || label;
    wrap.append(cb, text);
    const controls = document.createElement('div');
    controls.className = 'limit-provider-order-controls';
    const up = document.createElement('button');
    up.type = 'button';
    up.className = 'limit-provider-order-button';
    up.textContent = '↑';
    up.title = t('settings.limits.moveUp', { name: settingsLabel || label });
    up.setAttribute('aria-label', up.title);
    up.disabled = index === 0;
    up.addEventListener('click', () => onLimitProviderMove(id, 'up'));
    const down = document.createElement('button');
    down.type = 'button';
    down.className = 'limit-provider-order-button';
    down.textContent = '↓';
    down.title = t('settings.limits.moveDown', { name: settingsLabel || label });
    down.setAttribute('aria-label', down.title);
    down.disabled = index === providers.length - 1;
    down.addEventListener('click', () => onLimitProviderMove(id, 'down'));
    controls.append(up, down);
    row.append(wrap, controls);
    els.limitProviderCheckboxes.appendChild(row);
  }
}

async function onClientToggle() {
  const checked = Array.from(els.clientCheckboxes.querySelectorAll('input[type=checkbox]'))
    .filter((cb) => cb.checked)
    .map((cb) => cb.dataset.client);
  await saveSettings({ clients: checked.join(',') });
  await refreshStats({ force: true });
}

async function onLimitProviderToggle() {
  const checked = Array.from(els.limitProviderCheckboxes.querySelectorAll('input[type=checkbox]'))
    .filter((cb) => cb.checked)
    .map((cb) => cb.dataset.provider);
  if (checked.length === 0 && state.breakdown === 'limits') {
    setBreakdown('tool');
  }
  await saveSettings({ limitProviders: checked.join(','), limitsEnabled: checked.length > 0 });
  await refreshStats({ force: true });
}

async function onLimitProviderMove(providerId, direction) {
  const next = limitProviderOrderApi.moveLimitProvider(state.settings?.limitProviderOrder, LIMIT_PROVIDERS, providerId, direction);
  await saveSettings({ limitProviderOrder: next });
}

async function saveSettings(patch) {
  state.settings = await window.tokenMonitor.updateSettings(patch);
  syncSettingsForm();
  restartTimer();
  maybeUpdateBarsIcon();
}

function updateTitleFit() {
  const measure = document.querySelector('.app-title-measure');
  const container = document.querySelector('.app-title');
  if (!measure || !container) return;
  if (state.settings?.titleIconOnly || els.shell.classList.contains('title-icon-only')) {
    els.shell.classList.remove('title-collapsed');
    return;
  }
  const dotSpace = (els.liveDot?.offsetWidth || 4) + 5;
  // 4px buffer so the swap happens just before clipping would visibly start.
  const collapse = measure.scrollWidth + 4 > container.clientWidth - dotSpace;
  els.shell.classList.toggle('title-collapsed', collapse);
}

if (typeof ResizeObserver === 'function') {
  const tb = document.querySelector('.titlebar');
  if (tb) new ResizeObserver(updateTitleFit).observe(tb);
}

async function init() {
  try { state.appInfo = await window.tokenMonitor.getAppInfo?.(); } catch (_) {}
  state.settings = await window.tokenMonitor.getSettings();
  state.appUpdate = await window.tokenMonitor.getAppUpdateState();
  renderAppUpdatePill();
  renderSettingsAppUpdateRow();
  window.tokenMonitor.onAppUpdatePush?.((payload) => {
    state.appUpdate = payload;
    renderAppUpdatePill();
    renderSettingsAppUpdateRow();
  });
  if (state.appInfo?.loginItemSupported) {
    state.settings.startAtLogin = Boolean(state.appInfo.loginItemOpenAtLogin);
  }
  syncSettingsForm();
  publishViewState();
  await refreshHubInfo();
  await refreshTokscaleStatus();
  restartTimer();
  try {
    const status = await window.tokenMonitor.getStreamStatus?.();
    if (status) {
      state.streamConnected = Boolean(status.connected);
      state.mode = status.mode || state.mode;
      setLiveDot(state.streamConnected);
    }
  } catch (_) {}
  await refreshStats();
  restartTimer();
  updateTitleFit();
}

for (const tab of document.querySelectorAll('.tab')) {
  tab.addEventListener('click', () => {
    setPeriod(tab.dataset.period);
    syncPeriodTabs();
    if (state.openSession) openSessionDetail(state.openSession);
    state.currentTotal = 0;
    state.rowSignature = '';
    render();
  });
}

els.breakdown.addEventListener('click', (event) => {
  if (state.breakdown !== 'session') return;
  const rowEl = event.target.closest('.row');
  if (!rowEl) return;
  const key = rowEl.dataset.key || '';            // "session:<client>:<sessionId>"
  const client = rowEl.dataset.client || '';
  if (client !== 'claude' && client !== 'codex') return;
  const match = key.match(/^session:([^:]+):(.+)$/);
  if (!match) return;
  const sessionId = match[2];
  const period = state.stats?.periods?.[state.period];
  const session = period?.sessions?.[`${client}:${sessionId}`];
  openSessionDetail({
    client,
    sessionId,
    sessionCost: Number(session?.costUsd || 0),
    title: rowEl.querySelector('.row-title')?.textContent || ''
  });
});

els.pinButton.addEventListener('click', () => {
  saveSettings({ windowBehavior: nextWindowBehavior(currentWindowBehavior()) });
});
els.breakdownToggle.addEventListener('click', () => {
  setBreakdown(nextBreakdown(state.breakdown));
  render();
});
els.settingsButton.addEventListener('click', () => {
  els.settingsPanel.classList.toggle('hidden');
  els.shell.classList.toggle('settings-open', !els.settingsPanel.classList.contains('hidden'));
  els.shell.style.transform = 'translateZ(0)';
  requestAnimationFrame(() => { els.shell.style.transform = ''; });
});
els.saveSettingsButton.addEventListener('click', async () => {
  const patch = {
    hubUrl: els.hubUrlInput.value.trim(),
    secret: els.secretInput.value,
    deviceId: els.deviceIdInput.value.trim()
  };
  if (state.settings.hubMode === 'host') {
    patch.hubHostPort = Number(els.hubPortInput.value) || 17321;
  }
  await saveSettings(patch);
  await refreshHubInfo();
  await refreshStats();
});

els.hubModeOptions.addEventListener('change', async (event) => {
  const target = event.target;
  if (!(target instanceof HTMLInputElement) || target.name !== 'hubMode') return;
  await saveSettings({ hubMode: target.value });
  await refreshHubInfo();
  await refreshStats();
});

els.languageInput?.addEventListener('change', async () => {
  await saveSettings({ language: els.languageInput.value });
});

els.currencyInput?.addEventListener('change', async () => {
  await saveSettings({ currency: els.currencyInput.value });
});

els.hubSecretCopyButton?.addEventListener('click', () => {
  copyToClipboard(els.hubSecretInput.value, els.hubSecretCopyButton);
});

els.hubSecretRegenButton?.addEventListener('click', async () => {
  if (!window.tokenMonitor.regenerateHubSecret) return;
  const info = await window.tokenMonitor.regenerateHubSecret();
  state.hubInfo = info;
  state.settings = { ...state.settings, hubHostSecret: info.secret };
  els.hubSecretInput.value = info.secret;
  renderHubStatus();
});
els.limitsRefreshInput.addEventListener('change', async () => {
  await saveSettings({ limitsRefreshMs: Number(els.limitsRefreshInput.value) });
  await refreshStats({ force: true });
});
els.showLimitSourceInput.addEventListener('change', async () => {
  await saveSettings({ showLimitSource: els.showLimitSourceInput.checked });
});
els.resetGlassButton.addEventListener('click', async () => {
  els.glassInput.value = String(defaultAppearance.glassOpacity);
  applyAppearanceFromControls();
  await saveSettings({ glassOpacity: defaultAppearance.glassOpacity });
});
els.resetDepthButton.addEventListener('click', async () => {
  els.blurInput.value = String(defaultAppearance.glassBlur);
  applyAppearanceFromControls();
  await saveSettings({ glassBlur: defaultAppearance.glassBlur });
});
els.glassInput.addEventListener('input', applyAppearanceFromControls);
els.blurInput.addEventListener('input', applyAppearanceFromControls);
els.zoomInput.addEventListener('input', applyAppearanceFromControls);
els.systemGlassInput.addEventListener('change', saveAppearanceFromControls);
els.liveDotInput.addEventListener('change', saveAppearanceFromControls);
els.toolIconsInput.addEventListener('change', saveAppearanceFromControls);
els.titleIconInput.addEventListener('change', saveAppearanceFromControls);
els.discordRpcInput.addEventListener('change', saveAppearanceFromControls);
els.windowBehaviorInput.addEventListener('change', () => saveSettings({ windowBehavior: els.windowBehaviorInput.value }));
els.floatingBubbleInput.addEventListener('change', () => {
  els.floatingBubbleTriggerRow?.classList.toggle('hidden', !els.floatingBubbleInput.checked);
  els.floatingBubbleContentRow?.classList.toggle('hidden', !els.floatingBubbleInput.checked);
  saveSettings({ floatingBubbleEnabled: els.floatingBubbleInput.checked });
});
els.floatingBubbleTriggerInput?.addEventListener('change', () => saveSettings({ floatingBubbleTrigger: els.floatingBubbleTriggerInput.value }));
els.floatingBubbleContentInput?.addEventListener('change', async () => {
  await saveSettings({ floatingBubbleContent: els.floatingBubbleContentInput.value });
  renderFloatingBubbleContent();
});
els.trayModeInput.addEventListener('change', () => saveSettings({ trayMode: els.trayModeInput.checked }));
els.trayContentInput.addEventListener('change', () => saveSettings({ trayContent: els.trayContentInput.value }));
els.startAtLoginInput?.addEventListener('change', () => saveSettings({ startAtLogin: els.startAtLoginInput.checked }));
els.glassInput.addEventListener('change', saveAppearanceFromControls);
els.blurInput.addEventListener('change', saveAppearanceFromControls);
els.zoomInput.addEventListener('change', saveAppearanceFromControls);
els.resetZoomButton.addEventListener('click', async () => {
  els.zoomInput.value = String(Math.round(defaultAppearance.zoomFactor * 100));
  await saveSettings({ zoomFactor: defaultAppearance.zoomFactor });
});
els.openConfigButton.addEventListener('click', () => window.tokenMonitor.openUserData());
els.checkTokscaleButton?.addEventListener('click', checkTokscaleNpm);
els.downloadTokscaleButton?.addEventListener('click', downloadTokscaleFromNpm);
els.resetTokscaleButton?.addEventListener('click', resetTokscaleToBundled);
els.openTokscaleLinkButton?.addEventListener('click', () => window.tokenMonitor.openExternal?.('https://github.com/junhoyeo/tokscale'));
els.refreshButton.addEventListener('click', () => refreshStats({ force: true }));
els.minButton.addEventListener('click', () => window.tokenMonitor.minimize());
els.closeButton.addEventListener('click', () => window.tokenMonitor.close());
els.floatingBubbleTab.addEventListener('pointerdown', handleFloatingBubblePointerDown);
els.floatingBubbleTab.addEventListener('pointermove', handleFloatingBubblePointerMove);
els.floatingBubbleTab.addEventListener('pointerup', handleFloatingBubblePointerUp);
els.floatingBubbleTab.addEventListener('pointercancel', (event) => { finishFloatingBubbleDrag(event.pointerId); });
els.floatingBubbleTab.addEventListener('mouseenter', handleFloatingBubbleHoverEnter);
els.floatingBubbleTab.addEventListener('mouseleave', handleFloatingBubbleHoverLeave);
document.documentElement.addEventListener('mouseleave', handleDocumentHoverLeave);
document.documentElement.addEventListener('mouseenter', clearHoverCollapseTimer);
els.floatingBubbleTab.addEventListener('keydown', (event) => {
  if (event.key !== 'Enter' && event.key !== ' ') return;
  event.preventDefault();
  window.tokenMonitor.expandFloatingBubble?.();
});

els.appUpdatePillAction.addEventListener('click', async () => {
  const latest = state.appUpdate?.latest;
  if (!latest?.htmlUrl) return;
  await window.tokenMonitor.openExternal(latest.htmlUrl);
});

els.appUpdatePillDismiss.addEventListener('click', async () => {
  const version = state.appUpdate?.latest?.version;
  if (!version) return;
  state.appUpdate = await window.tokenMonitor.dismissAppUpdate(version);
  renderAppUpdatePill();
});

els.appUpdateCheckButton.addEventListener('click', async () => {
  state.appUpdate = await window.tokenMonitor.checkAppUpdateNow();
  renderAppUpdatePill();
  renderSettingsAppUpdateRow();
});

els.appUpdateViewReleaseButton.addEventListener('click', async () => {
  const url = state.appUpdate?.latest?.htmlUrl;
  if (!url) return;
  await window.tokenMonitor.openExternal(url);
});

window.tokenMonitor.onSettingsPush?.((next) => {
  if (!next) return;
  state.settings = next;
  syncSettingsForm();
  maybeUpdateBarsIcon();
});

window.tokenMonitor.onFloatingBubbleState?.((payload) => {
  applyFloatingBubbleState(payload);
});

window.tokenMonitor.onHubPush?.((payload) => {
  if (!payload?.info) return;
  state.hubInfo = payload.info;
  // The first switch to Host mode generates the shared secret asynchronously
  // after settings:update has already returned, so mirror the freshly minted
  // value back into state + input — otherwise the Shared Secret field stays
  // blank and other devices can't pair until the user clicks Regenerate.
  if (payload.info.secret && payload.info.secret !== state.settings?.hubHostSecret) {
    state.settings = { ...state.settings, hubHostSecret: payload.info.secret };
    if (els.hubSecretInput && state.settings.hubMode === 'host') {
      els.hubSecretInput.value = payload.info.secret;
    }
  }
  renderHubStatus();
});

window.tokenMonitor.onTokscalePush?.((payload) => {
  mergeTokscalePayload(payload);
  renderTokscaleStatus();
});

window.tokenMonitor.onStatsPush?.((payload) => {
  if (!payload) return;
  if (payload.event === 'status') {
    state.streamConnected = Boolean(payload.data?.connected);
    if (payload.data?.mode) state.mode = payload.data.mode;
  } else if (payload.data?.stats) {
    state.streamConnected = true;
    if (payload.data?.mode) state.mode = payload.data.mode;
    state.stats = payload.data.stats;
  } else {
    return;
  }
  setLiveDot(state.streamConnected);
  setStatus(statusTextFor(state.mode, state.streamConnected));
  if (payload.data?.stats) {
    render();
    maybeUpdateBarsIcon();
  }
  restartTimer();
});

function pickWorstProvider(stats, windowFilter) {
  const providers = stats?.limits?.providers || [];
  let worstProvider = null;
  let worstRemaining = Infinity;
  for (const provider of providers) {
    if (provider.status !== 'ok' || provider.stale) continue;
    for (const window of provider.windows || []) {
      if (windowFilter && !windowFilter(window)) continue;
      const remaining = Number(window.remainingPercent);
      if (!Number.isFinite(remaining)) continue;
      if (remaining < worstRemaining) {
        worstRemaining = remaining;
        worstProvider = provider;
      }
    }
  }
  return worstProvider;
}

function pickWorstSessionProvider(stats) {
  return pickWorstProvider(stats, (window) => window.kind === 'session');
}

function pickWorstWeeklyProvider(stats) {
  return pickWorstProvider(stats, (window) => window.kind === 'weekly');
}

function roundedRectPath(ctx, x, y, w, h, r) {
  const rr = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + rr, y);
  ctx.arcTo(x + w, y, x + w, y + h, rr);
  ctx.arcTo(x + w, y + h, x, y + h, rr);
  ctx.arcTo(x, y + h, x, y, rr);
  ctx.arcTo(x, y, x + w, y, rr);
  ctx.closePath();
}

const trayProviderImages = {};

function renderBarsIcon(stats, height = 44, picker = pickWorstProvider, colors = {}) {
  const trackColor = colors.track || 'rgba(0, 0, 0, 0.32)';
  const fillColor = colors.fill || 'rgba(0, 0, 0, 1)';
  const provider = picker(stats);
  if (!provider) return null;
  const session = (provider.windows || []).find((w) => w.kind === 'session');
  const weekly = (provider.windows || []).find((w) => w.kind === 'weekly');
  const providerImage = trayProviderImages[provider.provider];
  const { trayBarFillWidth, trayBarsLayout } = window.TokenMonitorTrayBars;
  const layout = trayBarsLayout(height);

  const canvas = document.createElement('canvas');
  canvas.width = layout.width;
  canvas.height = layout.height;
  const ctx = canvas.getContext('2d');
  ctx.clearRect(0, 0, layout.width, layout.height);

  if (providerImage) {
    ctx.drawImage(providerImage, layout.padX, layout.iconY, layout.iconSize, layout.iconSize);
  }

  function drawBar(y, percent) {
    roundedRectPath(ctx, layout.barsX, y, layout.barsWidth, layout.barHeight, layout.radius);
    ctx.fillStyle = trackColor;
    ctx.fill();
    const fillW = trayBarFillWidth(percent, layout.barsWidth);
    if (!fillW) return;
    // Clip-to-track + flat fillRect: a rounded rect's tiny corners get lost when the icon is downscaled into the menubar.
    ctx.save();
    roundedRectPath(ctx, layout.barsX, y, layout.barsWidth, layout.barHeight, layout.radius);
    ctx.clip();
    ctx.fillStyle = fillColor;
    ctx.fillRect(layout.barsX, y, fillW, layout.barHeight);
    ctx.restore();
  }

  drawBar(layout.barsStartY, Number(session?.remainingPercent));
  drawBar(layout.barsStartY + layout.barHeight + layout.barGap, Number(weekly?.remainingPercent));
  return canvas.toDataURL('image/png');
}

function pickConfiguredSessionProviders(stats, configOrder) {
  const providers = stats?.limits?.providers || [];
  const byId = new Map(providers.map((p) => [String(p.provider).toLowerCase(), p]));
  const result = [];
  for (const id of configOrder) {
    const p = byId.get(id);
    if (!p || p.status !== 'ok' || p.stale) continue;
    const session = (p.windows || []).find((w) => w.kind === 'session');
    if (!session || !Number.isFinite(Number(session.remainingPercent))) continue;
    result.push({ provider: p, session });
    if (result.length === 2) break;
  }
  return result;
}

function renderAllSessionsIcon(stats, height = 44, configOrder, colors = {}, options = {}) {
  const trackColor = colors.track || 'rgba(0, 0, 0, 0.32)';
  const fillColor = colors.fill || 'rgba(0, 0, 0, 1)';
  const picks = pickConfiguredSessionProviders(stats, configOrder);
  if (picks.length === 0) return null;
  // Only one tool has session data → fall back to that tool's session+weekly view.
  if (picks.length === 1) return renderBarsIcon(stats, height, () => picks[0].provider, colors);

  const { trayBarFillWidth, trayBarsLayout } = window.TokenMonitorTrayBars;
  const layout = trayBarsLayout(height, { contentOnly: options.contentOnly === true });
  const canvas = document.createElement('canvas');
  canvas.width = layout.width;
  canvas.height = layout.height;
  const ctx = canvas.getContext('2d');
  ctx.clearRect(0, 0, layout.width, layout.height);

  // No per-row icons — order in the dropdown identifies which row is which tool.
  // Default layout keeps menubar width stable; the bubble can request content-only
  // output so the mini-window hugs just the visible bars.
  function drawBar(y, percent) {
    roundedRectPath(ctx, layout.barsX, y, layout.barsWidth, layout.barHeight, layout.radius);
    ctx.fillStyle = trackColor;
    ctx.fill();
    const fillW = trayBarFillWidth(percent, layout.barsWidth);
    if (!fillW) return;
    ctx.save();
    roundedRectPath(ctx, layout.barsX, y, layout.barsWidth, layout.barHeight, layout.radius);
    ctx.clip();
    ctx.fillStyle = fillColor;
    ctx.fillRect(layout.barsX, y, fillW, layout.barHeight);
    ctx.restore();
  }

  drawBar(layout.barsStartY, Number(picks[0].session.remainingPercent));
  drawBar(layout.barsStartY + layout.barHeight + layout.barGap, Number(picks[1].session.remainingPercent));
  return canvas.toDataURL('image/png');
}

function barsDataUrlForMode(mode, size = 44, colors, options = {}) {
  if (mode === 'barsAllSessions') return renderAllSessionsIcon(state.stats, size, configuredLimitProviderOrder(), colors, options);
  const pickers = { barsSession: pickWorstSessionProvider, barsWeekly: pickWorstWeeklyProvider };
  return renderBarsIcon(state.stats, size, pickers[mode] || pickWorstProvider, colors);
}

async function maybeUpdateBarsIcon() {
  const mode = state.settings?.trayContent;
  if (mode !== 'bars' && mode !== 'barsSession' && mode !== 'barsWeekly' && mode !== 'barsAllSessions') return;
  if (!window.tokenMonitor.setTrayIcons) return;
  const dataUrl = barsDataUrlForMode(mode, 44);
  if (!dataUrl) return;
  try { await window.tokenMonitor.setTrayIcons({ [mode]: dataUrl }); } catch (_) {}
}

function loadImage(src) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error(`load failed: ${src}`));
    img.src = src;
  });
}

function imageToPngDataUrl(img, size) {
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');
  ctx.drawImage(img, 0, 0, size, size);
  return canvas.toDataURL('image/png');
}

async function deliverTrayProviderIcons() {
  if (!window.tokenMonitor.setTrayIcons) return;
  const sources = window.TokenMonitorTrayProviderIcons.trayProviderIconSources(clientsWithIcon);
  const icons = {};
  for (const [id, path] of Object.entries(sources)) {
    try {
      const img = await loadImage(path);
      trayProviderImages[id] = img;
      icons[id] = imageToPngDataUrl(img, 44);
    } catch (_) { /* skip missing */ }
  }
  if (Object.keys(icons).length) await window.tokenMonitor.setTrayIcons(icons);
  // Provider images may unlock a richer bars icon now that they're cached.
  maybeUpdateBarsIcon();
}

function setCursorAccountExpanded(expanded) {
  const toggle = document.getElementById('cursorSettingsToggle');
  const details = document.getElementById('cursorSettingsDetails');
  const group = document.getElementById('cursorAccountGroup');
  if (!toggle || !details) return;
  const next = Boolean(expanded);
  state.cursorAccountExpanded = next;
  toggle.setAttribute('aria-expanded', next ? 'true' : 'false');
  details.classList.toggle('hidden', !next);
  if (group) group.classList.toggle('expanded', next);
}

function setCursorStatusText(el, text) {
  el.textContent = text;
  el.title = text;
}

function renderCursorStatus() {
  const statusEl = document.getElementById('cursorAccountStatus');
  const loginBtn = document.getElementById('cursorLoginButton');
  const logoutBtn = document.getElementById('cursorLogoutButton');
  const refreshBtn = document.getElementById('cursorRefreshButton');
  const manualPanel = document.getElementById('cursorManualPanel');
  const errorEl = document.getElementById('cursorErrorMessage');
  if (!statusEl || !loginBtn || !logoutBtn || !refreshBtn || !manualPanel || !errorEl) return;

  errorEl.classList.add('hidden');
  errorEl.textContent = '';

  if (state.cursorAccount.error) {
    setCursorStatusText(statusEl, t('settings.common.error'));
    errorEl.textContent = t('settings.cursor.statusCheckFailed', { message: state.cursorAccount.error });
    errorEl.classList.remove('hidden');
    loginBtn.classList.remove('hidden');
    logoutBtn.classList.add('hidden');
    refreshBtn.classList.remove('hidden');
    manualPanel.classList.remove('hidden');
    setCursorCheckboxesEnabled(false);
    setCursorAccountExpanded(true);
    return;
  }

  const status = state.cursorAccount.status;
  if (!status) {
    setCursorStatusText(statusEl, t('settings.common.checking'));
    return;
  }

  if (!status.loggedIn) {
    setCursorStatusText(statusEl, t('settings.cursor.notLoggedIn'));
    loginBtn.classList.remove('hidden');
    logoutBtn.classList.add('hidden');
    refreshBtn.classList.add('hidden');
    manualPanel.classList.remove('hidden');
    setCursorCheckboxesEnabled(false);
    return;
  }
  if (status.expired) {
    setCursorStatusText(statusEl, t('settings.cursor.expired'));
    loginBtn.classList.remove('hidden');
    logoutBtn.classList.remove('hidden');
    refreshBtn.classList.remove('hidden');
    manualPanel.classList.remove('hidden');
    setCursorCheckboxesEnabled(false);
    setCursorAccountExpanded(true);
    return;
  }
  const summary = status.email || t('settings.cursor.loggedIn');
  setCursorStatusText(statusEl, summary);
  loginBtn.classList.add('hidden');
  logoutBtn.classList.remove('hidden');
  refreshBtn.classList.remove('hidden');
  manualPanel.classList.add('hidden');
  setCursorCheckboxesEnabled(true);
}

async function refreshCursorStatus() {
  state.cursorAccount = { status: null, error: '' };
  renderCursorStatus();
  try {
    const status = await window.tokenMonitor.cursor.status();
    state.cursorAccount = { status, error: '' };
  } catch (err) {
    state.cursorAccount = { status: null, error: err.message };
  }
  renderCursorStatus();
}

function setCursorCheckboxesEnabled(enabled) {
  document.querySelectorAll('#clientCheckboxes [data-client="cursor"]').forEach((el) => {
    if (enabled) el.classList.remove('disabled');
    else el.classList.add('disabled');
    el.title = enabled ? '' : t('settings.cursor.loginRequired');
  });
}

function setupCursorAccountUI() {
  document.getElementById('cursorSettingsToggle').addEventListener('click', () => {
    setCursorAccountExpanded(!state.cursorAccountExpanded);
  });
  setCursorAccountExpanded(false);

  document.getElementById('cursorLoginButton').addEventListener('click', () => {
    window.tokenMonitor.openExternal('https://cursor.com/settings');
  });

  document.getElementById('cursorLogoutButton').addEventListener('click', async () => {
    await window.tokenMonitor.cursor.logout();
    await refreshCursorStatus();
    await refreshStats({ force: true });
  });

  document.getElementById('cursorRefreshButton').addEventListener('click', () => {
    refreshCursorStatus();
  });

  document.getElementById('cursorManualSubmit').addEventListener('click', async () => {
    const input = document.getElementById('cursorManualInput');
    const errorEl = document.getElementById('cursorErrorMessage');
    errorEl.classList.add('hidden');
    const result = await window.tokenMonitor.cursor.loginManual(input.value);
    if (!result.ok) {
      errorEl.textContent = t('settings.cursor.loginFailed', { message: result.error });
      errorEl.classList.remove('hidden');
      return;
    }
    input.value = '';
    await refreshCursorStatus();
    setCursorAccountExpanded(false);
    await refreshStats({ force: true });
  });

  refreshCursorStatus();
}

setupCursorAccountUI();
deliverTrayProviderIcons();
init();
