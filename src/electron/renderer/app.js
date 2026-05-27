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
const LIMIT_REFRESH_OPTIONS = [60000, 120000, 300000, 900000, 1800000];
const LIMIT_SOURCE_LABELS = { oauth: 'OAuth', cli: 'CLI', web: 'Web', rpc: 'CLI' };
const deviceAccent = '#73bdf5';
const deviceStaleColor = '#8c97a7';
const fallbackModelColors = ['#6ab4f0', '#cc7c5e', '#a57df0', '#49a3b0', '#f0d66a', '#f06a7b'];
const baseBreakdownOrder = ['tool', 'device', 'model'];
const state = { period: 'today', appUpdate: null, breakdown: 'tool', settings: null, stats: null, refreshTimer: null, currentTotal: 0, rowSignature: '', streamConnected: false, mode: 'idle', appInfo: null, tokscaleStatus: null, tokscaleCheck: null, tokscaleBusy: false, hubInfo: null };
const defaultAppearance = { glassOpacity: 68, glassBlur: 32, zoomFactor: 1, systemGlass: true, showLiveDot: true, showToolIcons: true };
const els = {
  shell: document.querySelector('.shell'), status: document.getElementById('status'), liveDot: document.getElementById('liveDot'), totalTokens: document.getElementById('totalTokens'), cost: document.getElementById('cost'), breakdown: document.getElementById('breakdown'), limitsPanel: document.getElementById('limitsPanel'), breakdownToggle: document.getElementById('breakdownToggle'), pinButton: document.getElementById('pinButton'), settingsButton: document.getElementById('settingsButton'), settingsPanel: document.getElementById('settingsPanel'), hubUrlInput: document.getElementById('hubUrlInput'), secretInput: document.getElementById('secretInput'), deviceIdInput: document.getElementById('deviceIdInput'), limitProviderCheckboxes: document.getElementById('limitProviderCheckboxes'), limitsRefreshInput: document.getElementById('limitsRefreshInput'), showLimitSourceInput: document.getElementById('showLimitSourceInput'), systemGlassInput: document.getElementById('systemGlassInput'), liveDotInput: document.getElementById('liveDotInput'), toolIconsInput: document.getElementById('toolIconsInput'), discordRpcInput: document.getElementById('discordRpcInput'), trayModeInput: document.getElementById('trayModeInput'), trayContentInput: document.getElementById('trayContentInput'), glassInput: document.getElementById('glassInput'), blurInput: document.getElementById('blurInput'), zoomInput: document.getElementById('zoomInput'), resetGlassButton: document.getElementById('resetGlassButton'), resetDepthButton: document.getElementById('resetDepthButton'), resetZoomButton: document.getElementById('resetZoomButton'), saveSettingsButton: document.getElementById('saveSettingsButton'), clientCheckboxes: document.getElementById('clientCheckboxes'), openConfigButton: document.getElementById('openConfigButton'), refreshButton: document.getElementById('refreshButton'), minButton: document.getElementById('minButton'), closeButton: document.getElementById('closeButton')
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
  appUpdateMessage: document.getElementById('appUpdateMessage')
});

function formatNumber(value) { return Math.round(Number(value || 0)).toLocaleString('en-US'); }
function formatCost(value) { const amount = Number(value || 0); return `$${amount.toFixed(amount >= 10 ? 2 : 4)}`; }
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
    els.appUpdateLatest.textContent = 'Not checked';
    els.appUpdateCheckButton.disabled = false;
    els.appUpdateCheckButton.textContent = 'Check for updates';
    els.appUpdateViewReleaseButton.classList.add('hidden');
    els.appUpdateMessage.textContent = '';
    els.appUpdateMessage.classList.remove('error');
    return;
  }
  els.appUpdateInstalled.textContent = `v${s.currentVersion}`;
  if (s.latest) {
    const tail = s.hasUpdate ? '' : (semverLikeEqual(s.latest.version, s.currentVersion) ? ' (up to date)' : '');
    els.appUpdateLatest.textContent = `v${s.latest.version}${tail}`;
    els.appUpdateViewReleaseButton.classList.toggle('hidden', !s.hasUpdate);
  } else {
    els.appUpdateLatest.textContent = s.lastCheckedAt ? 'Up to date' : 'Not checked';
    els.appUpdateViewReleaseButton.classList.add('hidden');
  }
  els.appUpdateCheckButton.disabled = Boolean(s.checking);
  els.appUpdateCheckButton.textContent = s.checking ? 'Checking…' : 'Check for updates';
  if (s.lastError) {
    els.appUpdateMessage.textContent = "Couldn't reach GitHub";
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
  const label = formatUpdatedAge(value);
  return label === 'Update unknown' ? '' : label.replace('Updated ', '');
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
    ? `downloaded from npm${current.installedAt ? `, ${compactAge(current.installedAt)}` : ''}`
    : 'bundled with this app';
  els.tokscaleInstalled.textContent = current ? `${versionText(current.version)} (${source})` : 'Not found';
  els.tokscaleBundledLine.classList.toggle('hidden', !status?.downloaded || !status?.bundled);
  els.tokscaleBundled.textContent = status?.bundled ? versionText(status.bundled.version) : '—';
  if (state.tokscaleCheck?.npm?.version) {
    els.tokscaleNpm.textContent = `${versionText(state.tokscaleCheck.npm.version)}${state.tokscaleCheck.newer ? '' : ' (current)'}`;
  } else {
    els.tokscaleNpm.textContent = 'Not checked';
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
  setTokscaleMessage('Checking npm…');
  renderTokscaleStatus();
  try {
    const result = await window.tokenMonitor.checkTokscaleNpm();
    if (result?.error) throw new Error(result.error);
    mergeTokscalePayload(result);
    if (state.tokscaleStatus?.supported === false) return;
    setTokscaleMessage(state.tokscaleCheck?.newer ? 'Newer tokscale is on npm.' : 'Bundled tokscale is current.');
  } catch (error) {
    setTokscaleMessage(error.message, 'error');
  } finally {
    state.tokscaleBusy = false;
    renderTokscaleStatus();
  }
}

async function downloadTokscaleFromNpm() {
  state.tokscaleBusy = true;
  setTokscaleMessage('Downloading from npm…');
  renderTokscaleStatus();
  try {
    const result = await window.tokenMonitor.downloadTokscaleFromNpm();
    if (result?.error) throw new Error(result.error);
    mergeTokscalePayload(result);
    setTokscaleMessage(`Downloaded ${versionText(result.version)} from npm.`, 'success');
  } catch (error) {
    setTokscaleMessage(error.message, 'error');
  } finally {
    state.tokscaleBusy = false;
    renderTokscaleStatus();
  }
}

async function resetTokscaleToBundled() {
  state.tokscaleBusy = true;
  setTokscaleMessage('Resetting…');
  renderTokscaleStatus();
  try {
    state.tokscaleStatus = await window.tokenMonitor.resetTokscaleToBundled();
    state.tokscaleCheck = null;
    setTokscaleMessage('Using bundled tokscale.', 'success');
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
  const { key, name, platform } = rowData;
  const row = document.createElement('div');
  row.dataset.key = key;
  if (platform) row.dataset.platform = platform;
  row.innerHTML = '<div class="row-head"><div class="row-name"><span class="row-mark"></span><span></span></div><div class="row-metrics"><div class="row-value"></div><div class="row-cost"></div></div></div><div class="bar"><div class="bar-fill"></div></div>';
  row.querySelector('.row-name span:last-child').textContent = name;
  return row;
}

function updateRow(row, { name, value, cost, max, color, stale, platform, local }) {
  const width = rowWidth(value, max);
  row.className = `row${stale ? ' stale' : ''}${local ? ' local' : ''}`;
  row.title = local ? 'This device' : '';
  if (platform !== undefined) row.dataset.platform = platform || '';
  const mark = row.querySelector('.row-mark');
  const kind = iconKindFor({ key: row.dataset.key, platform: row.dataset.platform || '' }, state.breakdown);
  if (kind.kind === 'icon') {
    mark.className = `row-mark row-icon ${kind.iconClass}`;
    mark.style.background = '';
  } else {
    mark.className = 'row-mark dot';
    mark.style.background = color;
  }
  row.querySelector('.row-name span:last-child').textContent = name;
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
  const signature = rows.map((row) => row.key).join('\n');
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

function rowsForPeriod(period) {
  if (state.breakdown === 'device') return deviceRowsForPeriod();
  if (state.breakdown === 'model') return modelRowsForPeriod(period);
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
  if (state.breakdown === 'limits') return 'Limits';
  return 'Tools';
}

function render() {
  if (!state.stats) return;
  if (state.breakdown === 'limits' && !limitViewAvailable()) {
    state.breakdown = 'tool';
    state.rowSignature = '';
  }
  const period = state.stats.periods?.[state.period] || { totalTokens: 0, costUsd: 0, clients: {} };
  const nextTotal = Number(period.totalTokens || 0);
  animateNumber(els.totalTokens, state.currentTotal, nextTotal);
  state.currentTotal = nextTotal;
  els.cost.textContent = formatCost(period.costUsd || 0);
  els.refreshButton.title = `Stats refreshed ${formatTime(state.stats.updatedAt)}`;
  const devices = state.stats.devices || [];
  const staleCount = devices.filter((device) => device.stale).length;
  const deviceText = `${devices.length} device${devices.length === 1 ? '' : 's'}`;
  els.breakdownToggle.textContent = breakdownLabel(deviceText);
  els.breakdownToggle.removeAttribute('title');
  if (state.breakdown === 'limits') {
    els.breakdown.classList.add('hidden');
    els.limitsPanel.classList.remove('hidden');
    renderLimits();
  } else {
    els.limitsPanel.classList.add('hidden');
    els.breakdown.classList.remove('hidden');
    const rows = rowsForPeriod(period);
    renderRows(rows);
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
}

function appearancePatchFromControls() {
  return {
    systemGlass: Boolean(els.systemGlassInput.checked),
    showLiveDot: Boolean(els.liveDotInput.checked),
    showToolIcons: Boolean(els.toolIconsInput.checked),
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
    els.hubStatusRow.textContent = 'Starting…';
    els.hubStatusRow.className = 'hub-status';
    els.hubAddressList.replaceChildren();
    return;
  }
  if (info.error) {
    const code = info.error.code === 'EADDRINUSE' ? `Port ${port} already in use` : info.error.code || 'Error';
    els.hubStatusRow.textContent = `${code} — ${info.error.message}`;
    els.hubStatusRow.className = 'hub-status error';
    els.hubAddressList.replaceChildren();
    return;
  }
  if (!info.listening) {
    els.hubStatusRow.textContent = 'Hub stopped';
    els.hubStatusRow.className = 'hub-status';
    els.hubAddressList.replaceChildren();
    return;
  }
  els.hubStatusRow.textContent = `Listening on port ${info.listeningPort}`;
  els.hubStatusRow.className = 'hub-status ok';
  renderHubAddresses(info.lanAddresses || [], info.listeningPort);
}

function renderHubAddresses(addresses, port) {
  els.hubAddressList.replaceChildren();
  if (addresses.length === 0) {
    const empty = document.createElement('div');
    empty.className = 'hub-address-empty';
    empty.textContent = 'No LAN address detected. Other devices on this machine can use http://127.0.0.1:' + port + '.';
    els.hubAddressList.appendChild(empty);
    return;
  }
  const header = document.createElement('div');
  header.className = 'hub-address-header';
  header.textContent = 'Other devices connect with:';
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
    copy.title = `Copy ${url}`;
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

function syncSettingsForm() {
  syncHubModeUi();
  els.hubUrlInput.value = state.settings.hubUrl || '';
  els.secretInput.value = state.settings.secret || '';
  els.deviceIdInput.value = state.settings.deviceId || '';
  els.limitsRefreshInput.value = String(LIMIT_REFRESH_OPTIONS.includes(Number(state.settings.limitsRefreshMs)) ? state.settings.limitsRefreshMs : 300000);
  els.showLimitSourceInput.checked = Boolean(state.settings.showLimitSource);
  els.systemGlassInput.checked = state.settings.systemGlass !== false;
  els.liveDotInput.checked = state.settings.showLiveDot !== false;
  els.toolIconsInput.checked = state.settings.showToolIcons !== false;
  els.discordRpcInput.checked = Boolean(state.settings.discordRpcEnabled);
  els.trayModeInput.checked = Boolean(state.settings.trayMode);
  els.trayContentInput.value = ['tokens', 'cost', 'both', 'tokensAll', 'costAll', 'bothAll', 'bars', 'barsSession', 'barsAllSessions', 'icon'].includes(state.settings.trayContent) ? state.settings.trayContent : 'tokens';
  els.startupGroup?.classList.toggle('hidden', !state.appInfo?.loginItemSupported);
  if (els.startAtLoginInput) els.startAtLoginInput.checked = Boolean(state.settings.startAtLogin && state.appInfo?.loginItemSupported);
  if (els.startupNote) {
    els.startupNote.textContent = state.appInfo?.loginItemSupported
      ? 'Launch Token Monitor when you sign in.'
      : 'Available in packaged macOS and Windows builds.';
  }
  els.glassInput.value = String(state.settings.glassOpacity ?? 68);
  els.blurInput.value = String(state.settings.glassBlur ?? 32);
  els.zoomInput.value = String(Math.round((Number(state.settings.zoomFactor) || 1) * 100));
  els.pinButton.classList.toggle('active', Boolean(state.settings.alwaysOnTop));
  renderClientCheckboxes();
  renderLimitProviderCheckboxes();
  applyAppearanceSettings(state.settings);
  renderTokscaleStatus();
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
    up.title = `Move ${settingsLabel || label} up`;
    up.setAttribute('aria-label', up.title);
    up.disabled = index === 0;
    up.addEventListener('click', () => onLimitProviderMove(id, 'up'));
    const down = document.createElement('button');
    down.type = 'button';
    down.className = 'limit-provider-order-button';
    down.textContent = '↓';
    down.title = `Move ${settingsLabel || label} down`;
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
    state.breakdown = 'tool';
    state.rowSignature = '';
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
    document.querySelector('.tab.active')?.classList.remove('active');
    tab.classList.add('active');
    state.period = tab.dataset.period;
    state.currentTotal = 0;
    state.rowSignature = '';
    render();
  });
}

els.pinButton.addEventListener('click', () => saveSettings({ alwaysOnTop: !state.settings.alwaysOnTop }));
els.breakdownToggle.addEventListener('click', () => {
  state.breakdown = nextBreakdown(state.breakdown);
  state.rowSignature = '';
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
els.discordRpcInput.addEventListener('change', saveAppearanceFromControls);
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

function renderBarsIcon(stats, height = 44, picker = pickWorstProvider) {
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
    ctx.fillStyle = 'rgba(0, 0, 0, 0.32)';
    ctx.fill();
    const fillW = trayBarFillWidth(percent, layout.barsWidth);
    if (!fillW) return;
    // Clip-to-track + flat fillRect: a rounded rect's tiny corners get lost when the icon is downscaled into the menubar.
    ctx.save();
    roundedRectPath(ctx, layout.barsX, y, layout.barsWidth, layout.barHeight, layout.radius);
    ctx.clip();
    ctx.fillStyle = 'rgba(0, 0, 0, 1)';
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

function renderAllSessionsIcon(stats, height = 44, configOrder) {
  const picks = pickConfiguredSessionProviders(stats, configOrder);
  if (picks.length === 0) return null;
  // Only one tool has session data → fall back to that tool's session+weekly view.
  if (picks.length === 1) return renderBarsIcon(stats, height, () => picks[0].provider);

  const { trayBarFillWidth, trayBarsLayout } = window.TokenMonitorTrayBars;
  const layout = trayBarsLayout(height);
  const canvas = document.createElement('canvas');
  canvas.width = layout.width;
  canvas.height = layout.height;
  const ctx = canvas.getContext('2d');
  ctx.clearRect(0, 0, layout.width, layout.height);

  // No per-row icons — order in the dropdown identifies which row is which tool.
  // Bars keep the same position/width as single-tool mode so the menubar item
  // doesn't visually balloon when switching modes.
  function drawBar(y, percent) {
    roundedRectPath(ctx, layout.barsX, y, layout.barsWidth, layout.barHeight, layout.radius);
    ctx.fillStyle = 'rgba(0, 0, 0, 0.32)';
    ctx.fill();
    const fillW = trayBarFillWidth(percent, layout.barsWidth);
    if (!fillW) return;
    ctx.save();
    roundedRectPath(ctx, layout.barsX, y, layout.barsWidth, layout.barHeight, layout.radius);
    ctx.clip();
    ctx.fillStyle = 'rgba(0, 0, 0, 1)';
    ctx.fillRect(layout.barsX, y, fillW, layout.barHeight);
    ctx.restore();
  }

  drawBar(layout.barsStartY, Number(picks[0].session.remainingPercent));
  drawBar(layout.barsStartY + layout.barHeight + layout.barGap, Number(picks[1].session.remainingPercent));
  return canvas.toDataURL('image/png');
}

async function maybeUpdateBarsIcon() {
  const mode = state.settings?.trayContent;
  if (mode !== 'bars' && mode !== 'barsSession' && mode !== 'barsAllSessions') return;
  if (!window.tokenMonitor.setTrayIcons) return;
  let dataUrl;
  if (mode === 'barsAllSessions') {
    dataUrl = renderAllSessionsIcon(state.stats, 44, configuredLimitProviderOrder());
  } else {
    const picker = mode === 'barsSession' ? pickWorstSessionProvider : pickWorstProvider;
    dataUrl = renderBarsIcon(state.stats, 44, picker);
  }
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
  const sources = { claude: '../../../assets/icons/tray-claude.svg', codex: '../../../assets/icons/tray-codex.svg' };
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

async function refreshCursorStatus() {
  const statusEl = document.getElementById('cursorAccountStatus');
  const loginBtn = document.getElementById('cursorLoginButton');
  const logoutBtn = document.getElementById('cursorLogoutButton');
  const refreshBtn = document.getElementById('cursorRefreshButton');
  const manualPanel = document.getElementById('cursorManualPanel');
  const errorEl = document.getElementById('cursorErrorMessage');

  errorEl.classList.add('hidden');
  errorEl.textContent = '';

  try {
    const status = await window.tokenMonitor.cursor.status();
    if (!status.loggedIn) {
      statusEl.textContent = 'Not logged in';
      loginBtn.classList.remove('hidden');
      logoutBtn.classList.add('hidden');
      refreshBtn.classList.add('hidden');
      manualPanel.classList.remove('hidden');
      setCursorCheckboxesEnabled(false);
      return;
    }
    if (status.expired) {
      statusEl.textContent = 'Session expired — please log in again';
      loginBtn.classList.remove('hidden');
      logoutBtn.classList.remove('hidden');
      refreshBtn.classList.remove('hidden');
      manualPanel.classList.remove('hidden');
      setCursorCheckboxesEnabled(false);
      return;
    }
    const parts = [];
    if (status.email) parts.push(status.email);
    if (status.membershipType) parts.push(`Cursor ${status.membershipType}`);
    if (status.billingCycleEnd) {
      const d = new Date(status.billingCycleEnd);
      parts.push(`Billing resets ${d.toLocaleDateString()}`);
    }
    statusEl.textContent = `✓ ${parts.join(' · ')}`;
    loginBtn.classList.add('hidden');
    logoutBtn.classList.remove('hidden');
    refreshBtn.classList.remove('hidden');
    manualPanel.classList.add('hidden');
    setCursorCheckboxesEnabled(true);
  } catch (err) {
    errorEl.textContent = `Status check failed: ${err.message}`;
    errorEl.classList.remove('hidden');
  }
}

function setCursorCheckboxesEnabled(enabled) {
  document.querySelectorAll('#clientCheckboxes [data-client="cursor"]').forEach((el) => {
    if (enabled) el.classList.remove('disabled');
    else el.classList.add('disabled');
    el.title = enabled ? '' : 'Login required to enable Cursor';
  });
}

function setupCursorAccountUI() {
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
      errorEl.textContent = `Login failed: ${result.error}`;
      errorEl.classList.remove('hidden');
      return;
    }
    input.value = '';
    await refreshCursorStatus();
    await refreshStats({ force: true });
  });

  refreshCursorStatus();
}

setupCursorAccountUI();
deliverTrayProviderIcons();
init();
