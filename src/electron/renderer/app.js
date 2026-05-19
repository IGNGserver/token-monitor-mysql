'use strict';

const clientLabels = { claude: 'Claude Code', codex: 'Codex', hermes: 'Hermes', gemini: 'Gemini', cursor: 'Cursor' };
const clientColors = { claude: '#cc7c5e', codex: '#49a3b0', hermes: '#a57df0', gemini: '#6ab4f0', deepseek: '#6ab4f0', cursor: '#f0d66a', default: '#6ab4f0' };
const deviceColors = ['#49a3b0', '#6ab4f0', '#cc7c5e', '#a57df0', '#f0d66a', '#f06a7b'];
const fallbackModelColors = ['#6ab4f0', '#cc7c5e', '#a57df0', '#49a3b0', '#f0d66a', '#f06a7b'];
const breakdownOrder = ['tool', 'device', 'model'];
const state = { period: 'today', breakdown: 'tool', settings: null, stats: null, refreshTimer: null, currentTotal: 0, rowSignature: '', streamConnected: false, mode: 'idle' };
const defaultAppearance = { glassOpacity: 68, glassBlur: 32, systemGlass: true, showLiveDot: true };
const els = {
  shell: document.querySelector('.shell'), status: document.getElementById('status'), liveDot: document.getElementById('liveDot'), totalTokens: document.getElementById('totalTokens'), cost: document.getElementById('cost'), breakdown: document.getElementById('breakdown'), breakdownToggle: document.getElementById('breakdownToggle'), pinButton: document.getElementById('pinButton'), settingsButton: document.getElementById('settingsButton'), settingsPanel: document.getElementById('settingsPanel'), hubUrlInput: document.getElementById('hubUrlInput'), secretInput: document.getElementById('secretInput'), deviceIdInput: document.getElementById('deviceIdInput'), systemGlassInput: document.getElementById('systemGlassInput'), liveDotInput: document.getElementById('liveDotInput'), glassInput: document.getElementById('glassInput'), blurInput: document.getElementById('blurInput'), saveSettingsButton: document.getElementById('saveSettingsButton'), resetAppearanceButton: document.getElementById('resetAppearanceButton'), openConfigButton: document.getElementById('openConfigButton'), refreshButton: document.getElementById('refreshButton'), minButton: document.getElementById('minButton'), closeButton: document.getElementById('closeButton')
};

function formatNumber(value) { return Math.round(Number(value || 0)).toLocaleString('en-US'); }
function formatCost(value) { const amount = Number(value || 0); return `$${amount.toFixed(amount >= 10 ? 2 : 4)}`; }
function formatTime(value) { const date = value ? new Date(value) : new Date(); return Number.isNaN(date.getTime()) ? '--:--:--' : date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }); }
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
  const { key, name } = rowData;
  const row = document.createElement('div');
  row.dataset.key = key;
  row.innerHTML = '<div class="row-head"><div class="row-name"><span class="dot"></span><span></span></div><div class="row-metrics"><div class="row-value"></div><div class="row-cost"></div></div></div><div class="bar"><div class="bar-fill"></div></div>';
  row.querySelector('.row-name span:last-child').textContent = name;
  return row;
}

function updateRow(row, { name, value, cost, max, color, stale }) {
  const width = rowWidth(value, max);
  row.className = `row${stale ? ' stale' : ''}`;
  row.querySelector('.dot').style.background = color;
  row.querySelector('.row-name span:last-child').textContent = name;
  row.querySelector('.row-value').textContent = formatNumber(value);
  row.querySelector('.row-cost').textContent = formatCost(cost || 0);
  const fill = row.querySelector('.bar-fill');
  fill.style.background = color;
  fill.style.width = `${width}%`;
}

function renderRows(rows) {
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

function deviceColor(index, stale) {
  return stale ? '#8c97a7' : deviceColors[index % deviceColors.length];
}

function stableColor(value, colors) {
  let hash = 0;
  for (const char of String(value || '')) hash = ((hash << 5) - hash + char.charCodeAt(0)) | 0;
  return colors[Math.abs(hash) % colors.length];
}

function modelColor(model) {
  const name = String(model || '').toLowerCase();
  if (/(claude|anthropic|sonnet|opus|haiku)/.test(name)) return clientColors.claude;
  if (/(hermes)/.test(name)) return clientColors.hermes;
  if (/(deepseek)/.test(name)) return clientColors.deepseek;
  if (/(gemini|google)/.test(name)) return clientColors.gemini;
  if (/(cursor)/.test(name)) return clientColors.cursor;
  if (/(gpt|openai|codex|^o[134](?:-|$)|o[134]-(mini|pro|preview)|chatgpt)/.test(name)) return clientColors.codex;
  return stableColor(name, fallbackModelColors);
}

function deviceRowsForPeriod() {
  return (state.stats?.devices || []).map((device, index) => ({
    key: device.deviceId,
    name: deviceLabel(device),
    value: Number(device.periods?.[state.period]?.totalTokens || 0),
    cost: Number(device.periods?.[state.period]?.costUsd || 0),
    color: deviceColor(index, Boolean(device.stale)),
    stale: Boolean(device.stale)
  })).sort((a, b) => b.value - a.value);
}

function toolRowsForPeriod(period) {
  const clientRows = Object.entries(period?.clients || {}).filter(([, value]) => Number(value) > 0).map(([client, value]) => ({ key: client, name: clientLabels[client] || client, value: Number(value), cost: Number(period?.clientCosts?.[client] || 0), color: clientColors[client] || clientColors.default, stale: false }));
  if (clientRows.length > 0) return clientRows.sort((a, b) => b.value - a.value);
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
  return toolRowsForPeriod(period);
}

function rowsForPeriod(period) {
  if (state.breakdown === 'device') return deviceRowsForPeriod();
  if (state.breakdown === 'model') return modelRowsForPeriod(period);
  return toolRowsForPeriod(period);
}

function nextBreakdown(value) {
  const index = breakdownOrder.indexOf(value);
  return breakdownOrder[(index + 1) % breakdownOrder.length];
}

function breakdownLabel(deviceText) {
  if (state.breakdown === 'device') return deviceText;
  if (state.breakdown === 'model') return 'Model';
  return 'Tools';
}

function render() {
  if (!state.stats) return;
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
  const rows = rowsForPeriod(period);
  renderRows(rows);
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

async function refreshStats() {
  try {
    state.stats = await window.tokenMonitor.getStats();
    setStatus(statusTextFor(state.mode, state.streamConnected));
    render();
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

function applyAppearanceFromControls() {
  const patch = {
    systemGlass: Boolean(els.systemGlassInput.checked),
    showLiveDot: Boolean(els.liveDotInput.checked),
    glassOpacity: Number(els.glassInput.value === '' ? defaultAppearance.glassOpacity : els.glassInput.value),
    glassBlur: Number(els.blurInput.value === '' ? defaultAppearance.glassBlur : els.blurInput.value)
  };
  applyAppearanceSettings(patch);
  window.tokenMonitor.previewAppearance?.(patch).catch(() => {});
}

async function saveAppearanceFromControls() {
  await saveSettings({
    systemGlass: Boolean(els.systemGlassInput.checked),
    showLiveDot: Boolean(els.liveDotInput.checked),
    glassOpacity: Number(els.glassInput.value === '' ? defaultAppearance.glassOpacity : els.glassInput.value),
    glassBlur: Number(els.blurInput.value === '' ? defaultAppearance.glassBlur : els.blurInput.value)
  });
}

function syncSettingsForm() {
  els.hubUrlInput.value = state.settings.hubUrl || '';
  els.secretInput.value = state.settings.secret || '';
  els.deviceIdInput.value = state.settings.deviceId || '';
  els.systemGlassInput.checked = state.settings.systemGlass !== false;
  els.liveDotInput.checked = state.settings.showLiveDot !== false;
  els.glassInput.value = String(state.settings.glassOpacity ?? 68);
  els.blurInput.value = String(state.settings.glassBlur ?? 32);
  els.pinButton.classList.toggle('active', Boolean(state.settings.alwaysOnTop));
  applyAppearanceSettings(state.settings);
}

async function saveSettings(patch) {
  state.settings = await window.tokenMonitor.updateSettings(patch);
  syncSettingsForm();
  restartTimer();
}

async function init() {
  state.settings = await window.tokenMonitor.getSettings();
  syncSettingsForm();
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
  await saveSettings({ hubUrl: els.hubUrlInput.value.trim(), secret: els.secretInput.value, deviceId: els.deviceIdInput.value.trim() });
  await refreshStats();
});
els.resetAppearanceButton.addEventListener('click', async () => {
  await saveSettings(defaultAppearance);
});
els.glassInput.addEventListener('input', applyAppearanceFromControls);
els.blurInput.addEventListener('input', applyAppearanceFromControls);
els.systemGlassInput.addEventListener('change', saveAppearanceFromControls);
els.liveDotInput.addEventListener('change', saveAppearanceFromControls);
els.glassInput.addEventListener('change', saveAppearanceFromControls);
els.blurInput.addEventListener('change', saveAppearanceFromControls);
els.openConfigButton.addEventListener('click', () => window.tokenMonitor.openUserData());
els.refreshButton.addEventListener('click', refreshStats);
els.minButton.addEventListener('click', () => window.tokenMonitor.minimize());
els.closeButton.addEventListener('click', () => window.tokenMonitor.close());

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
  if (payload.data?.stats) render();
  restartTimer();
});

init();
