'use strict';

const fs = require('node:fs');
const path = require('node:path');
const { app, BrowserWindow, ipcMain, shell } = require('electron');
const { defaultDeviceId, loadProjectConfig, pidFilePath } = require('../shared/config');
const { startCollector } = require('../shared/collector');
const { aggregateDevices } = require('../shared/usage');

const APP_NAME = 'Token Monitor';
const APP_ICON_PATH = path.join(__dirname, '..', '..', 'assets', 'icon.png');

let mainWindow = null;
let settingsPath = null;
let settings = null;

app.setName(APP_NAME);
if (process.platform === 'win32') app.setAppUserModelId('com.javis.tokenmonitor');

function defaultSettings() {
  const projectConfig = loadProjectConfig();
  const widgetConfig = projectConfig.widget || {};
  const agentConfig = projectConfig.agent || {};
  return {
    hubUrl: process.env.TOKEN_MONITOR_HUB_URL || widgetConfig.hubUrl || '',
    secret: process.env.TOKEN_MONITOR_SECRET || widgetConfig.secret || '',
    alwaysOnTop: process.env.TOKEN_MONITOR_ALWAYS_ON_TOP !== '0' && widgetConfig.alwaysOnTop !== false,
    refreshMs: Number(process.env.TOKEN_MONITOR_WIDGET_REFRESH_MS || widgetConfig.refreshMs || 15000),
    glassOpacity: Number(widgetConfig.glassOpacity ?? 68),
    glassBlur: Number(widgetConfig.glassBlur ?? 32),
    systemGlass: widgetConfig.systemGlass !== false,
    showLiveDot: widgetConfig.showLiveDot !== false,
    deviceId: widgetConfig.deviceId || agentConfig.deviceId || defaultDeviceId(),
    lastPostedDeviceId: '',
    clients: widgetConfig.clients || agentConfig.clients || 'claude,codex,hermes',
    allTimeSince: widgetConfig.allTimeSince || agentConfig.allTimeSince || '2024-01-01'
  };
}

function readSettings() {
  settingsPath = path.join(app.getPath('userData'), 'settings.json');
  try {
    const defaults = defaultSettings();
    const saved = JSON.parse(fs.readFileSync(settingsPath, 'utf8'));
    if (!saved.secret && defaults.secret) delete saved.secret;
    return { ...defaults, ...saved };
  }
  catch (_error) { return defaultSettings(); }
}

function saveSettings() {
  fs.mkdirSync(path.dirname(settingsPath), { recursive: true });
  fs.writeFileSync(settingsPath, `${JSON.stringify(settings, null, 2)}\n`, 'utf8');
}

function applyWindowSettings() {
  if (mainWindow) mainWindow.setAlwaysOnTop(Boolean(settings.alwaysOnTop), 'floating');
}

function nativeBlurEnabled(source = settings) {
  return source?.systemGlass !== false;
}

function keepNativeBlurActive() {
  if (!mainWindow) return;
  if (!nativeBlurEnabled()) return;
  if (process.platform === 'darwin' && typeof mainWindow.setVisualEffectState === 'function') {
    mainWindow.setVisualEffectState('active');
  }
}

function applyNativeMaterial(source = settings) {
  if (!mainWindow) return;
  const enabled = nativeBlurEnabled(source);
  if (process.platform === 'darwin' && typeof mainWindow.setVibrancy === 'function') {
    mainWindow.setVibrancy(enabled ? 'hud' : null);
    if (typeof mainWindow.setVisualEffectState === 'function') {
      mainWindow.setVisualEffectState(enabled ? 'active' : 'inactive');
    }
  }
  // Windows: backgroundMaterial is locked in at window creation. setBackgroundMaterial('none')
  // does not restore layered-window transparency once DWM SystemBackdrop has been engaged,
  // so toggling is handled by rebuildWindow() instead.
}

let mode = 'idle';
let localCollectorHandle = null;
let localDevice = null;
let localStats = null;
let sseAbortController = null;
let sseRetryTimer = null;
let streamConnected = false;
let syncCollectorHandle = null;
const AGENT_PID_PATH = pidFilePath();

function isExternalAgentActive() {
  try {
    const raw = fs.readFileSync(AGENT_PID_PATH, 'utf8').trim();
    const pid = parseInt(raw, 10);
    if (!pid || pid === process.pid) return false;
    process.kill(pid, 0);
    return true;
  } catch (_) { return false; }
}

async function deleteDeviceFromHub(deviceId) {
  const base = String(settings.hubUrl).replace(/\/$/, '');
  const response = await fetch(`${base}/api/devices/${encodeURIComponent(deviceId)}`, {
    method: 'DELETE',
    headers: settings.secret ? { authorization: `Bearer ${settings.secret}` } : {}
  });
  if (!response.ok && response.status !== 404) throw new Error(`DELETE ${response.status}`);
}

async function postToHub(summary) {
  const stale = settings.lastPostedDeviceId;
  if (stale && stale !== summary.deviceId) {
    try { await deleteDeviceFromHub(stale); }
    catch (error) { console.log(`[sync] cleanup of old deviceId ${stale} failed: ${error.message}`); }
  }
  const url = `${String(settings.hubUrl).replace(/\/$/, '')}/api/ingest`;
  const response = await fetch(url, {
    method: 'POST',
    headers: { 'content-type': 'application/json', ...(settings.secret ? { authorization: `Bearer ${settings.secret}` } : {}) },
    body: JSON.stringify(summary)
  });
  if (!response.ok) throw new Error(`Hub ${response.status}: ${(await response.text()).slice(0, 200)}`);
  if (settings.lastPostedDeviceId !== summary.deviceId) {
    settings.lastPostedDeviceId = summary.deviceId;
    saveSettings();
  }
  return response.json();
}

function stopSyncCollector() {
  if (syncCollectorHandle) { try { syncCollectorHandle.stop(); } catch (_) {} }
  syncCollectorHandle = null;
}

function startSyncCollector() {
  stopSyncCollector();
  if (!isHubConfigured()) return;
  syncCollectorHandle = startCollector({
    clients: settings.clients || 'claude,codex,hermes',
    allTimeSince: settings.allTimeSince || '2024-01-01',
    commandTimeoutMs: 120 * 1000,
    deviceId: settings.deviceId || defaultDeviceId(),
    agentVersion: '0.1.0-widget',
    intervalMs: 5 * 60 * 1000,
    watchEnabled: true,
    watchDebounceMs: 1500,
    onUpdate: (summary) => {
      if (isExternalAgentActive()) return;
      postToHub(summary).catch((error) => console.log(`[sync-collector] post failed: ${error.message}`));
    },
    onError: (error, reason) => console.log(`[sync-collector] ${reason}: ${error.message}`),
    logger: (msg) => console.log(`[sync-collector] ${msg}`)
  });
}

function isHubConfigured() {
  return Boolean(settings?.hubUrl && String(settings.hubUrl).trim());
}

function sendPush(payload) {
  if (mainWindow && !mainWindow.isDestroyed()) {
    try { mainWindow.webContents.send('stats:push', payload); } catch (_) {}
  }
}

function sendStatus(connected, extra) {
  streamConnected = Boolean(connected);
  sendPush({ event: 'status', data: { connected: streamConnected, mode, ...(extra || {}) } });
}

function stopLocalCollector() {
  if (localCollectorHandle) { try { localCollectorHandle.stop(); } catch (_) {} }
  localCollectorHandle = null;
  localDevice = null;
  localStats = null;
}

function startLocalCollector() {
  stopLocalCollector();
  mode = 'local';
  sendStatus(false, { reason: 'collecting' });
  localCollectorHandle = startCollector({
    clients: settings.clients || 'claude,codex,hermes',
    allTimeSince: settings.allTimeSince || '2024-01-01',
    commandTimeoutMs: 120 * 1000,
    deviceId: settings.deviceId || defaultDeviceId(),
    agentVersion: '0.1.0',
    intervalMs: 5 * 60 * 1000,
    watchEnabled: true,
    watchDebounceMs: 1500,
    onUpdate: (summary, reason) => {
      localDevice = { ...summary, receivedAt: new Date().toISOString() };
      localStats = aggregateDevices([localDevice], 0);
      sendPush({ event: 'stats', data: { type: 'stats', reason, stats: localStats, at: new Date().toISOString() } });
      sendStatus(true, { reason });
    },
    onError: (error, reason) => {
      sendStatus(false, { reason: `${reason}:${error.message}` });
    },
    logger: (msg) => console.log(`[collector] ${msg}`)
  });
}

function scheduleStreamRetry(delayMs = 3000) {
  if (sseRetryTimer) return;
  sseRetryTimer = setTimeout(() => { sseRetryTimer = null; startStatsStream(); }, delayMs);
}

function stopStatsStream() {
  if (sseAbortController) { try { sseAbortController.abort(); } catch (_) {} }
  sseAbortController = null;
  if (sseRetryTimer) { clearTimeout(sseRetryTimer); sseRetryTimer = null; }
}

function parseSseChunk(chunk) {
  let event = 'message';
  const dataLines = [];
  for (const line of chunk.split('\n')) {
    if (!line || line.startsWith(':')) continue;
    if (line.startsWith('event:')) event = line.slice(6).trim();
    else if (line.startsWith('data:')) dataLines.push(line.slice(5).trim());
  }
  if (dataLines.length === 0) return null;
  try { return { event, data: JSON.parse(dataLines.join('\n')) }; } catch (_) { return null; }
}

async function startStatsStream() {
  stopStatsStream();
  if (!isHubConfigured()) return;
  mode = 'sync';
  const url = `${String(settings.hubUrl).replace(/\/$/, '')}/api/stats/stream`;
  const controller = new AbortController();
  sseAbortController = controller;
  try {
    const response = await fetch(url, {
      headers: { accept: 'text/event-stream', ...(settings.secret ? { authorization: `Bearer ${settings.secret}` } : {}) },
      signal: controller.signal
    });
    if (!response.ok || !response.body) {
      sendStatus(false, { code: response.status });
      scheduleStreamRetry();
      return;
    }
    sendStatus(true);
    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';
    for (;;) {
      const { value, done } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      let idx;
      while ((idx = buffer.indexOf('\n\n')) !== -1) {
        const chunk = buffer.slice(0, idx);
        buffer = buffer.slice(idx + 2);
        const parsed = parseSseChunk(chunk);
        if (parsed) sendPush(parsed);
      }
    }
    sendStatus(false, { reason: 'eof' });
    scheduleStreamRetry();
  } catch (error) {
    if (controller.signal.aborted) return;
    sendStatus(false, { reason: error.message });
    scheduleStreamRetry();
  }
}

function startMode() {
  if (isHubConfigured()) {
    stopLocalCollector();
    startStatsStream();
    startSyncCollector();
  } else {
    stopStatsStream();
    stopSyncCollector();
    startLocalCollector();
  }
}

function stopAll() {
  stopLocalCollector();
  stopStatsStream();
  stopSyncCollector();
}

async function fetchStats() {
  if (mode === 'local') {
    if (localStats) return localStats;
    return aggregateDevices(localDevice ? [localDevice] : [], 0);
  }
  const url = `${String(settings.hubUrl || '').replace(/\/$/, '')}/api/stats`;
  const response = await fetch(url, { headers: settings.secret ? { authorization: `Bearer ${settings.secret}` } : {} });
  if (!response.ok) throw new Error(`Hub ${response.status}: ${(await response.text()).slice(0, 200)}`);
  return response.json();
}

function createWindow(bounds) {
  if (!settings) settings = readSettings();
  const glass = nativeBlurEnabled();
  mainWindow = new BrowserWindow({
    width: bounds?.width ?? 360,
    height: bounds?.height ?? 500,
    ...(bounds && typeof bounds.x === 'number' ? { x: bounds.x, y: bounds.y } : {}),
    minWidth: 300,
    minHeight: 170,
    frame: false,
    transparent: true,
    resizable: true,
    show: false,
    backgroundColor: '#00000000',
    icon: APP_ICON_PATH,
    ...(process.platform === 'darwin' && glass ? { vibrancy: 'hud', visualEffectState: 'active' } : {}),
    ...(process.platform === 'win32' && glass ? { backgroundMaterial: 'acrylic' } : {}),
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false
    }
  });
  applyWindowSettings();
  applyNativeMaterial();
  keepNativeBlurActive();
  mainWindow.on('focus', keepNativeBlurActive);
  mainWindow.on('blur', keepNativeBlurActive);
  mainWindow.loadFile(path.join(__dirname, 'renderer', 'index.html'));
  mainWindow.once('ready-to-show', () => mainWindow.show());
}

function rebuildWindow() {
  if (!mainWindow) return;
  const bounds = mainWindow.getBounds();
  const wasFocused = mainWindow.isFocused();
  const old = mainWindow;
  old.removeAllListeners('close');
  // Build the new window first so total window count never drops to 0
  // (otherwise window-all-closed fires and quits the app on Windows).
  createWindow(bounds);
  mainWindow.once('ready-to-show', () => {
    if (!old.isDestroyed()) old.destroy();
    if (wasFocused && !mainWindow.isDestroyed()) mainWindow.focus();
  });
}

app.whenReady().then(() => {
  if (process.platform === 'darwin' && app.dock) app.dock.setIcon(APP_ICON_PATH);
  createWindow();
  startMode();
  ipcMain.handle('settings:get', () => settings);
  ipcMain.handle('settings:update', (_event, patch) => {
    const previousSystemGlass = settings.systemGlass;
    const previousHubUrl = settings.hubUrl;
    const previousSecret = settings.secret;
    const previousDeviceId = settings.deviceId;
    settings = {
      ...settings,
      ...patch,
      deviceId: (patch.deviceId !== undefined ? String(patch.deviceId).trim() : settings.deviceId) || defaultDeviceId(),
      refreshMs: Math.max(5000, Number(patch.refreshMs ?? settings.refreshMs ?? 15000)),
      glassOpacity: Math.max(0, Math.min(100, Number(patch.glassOpacity ?? settings.glassOpacity ?? 68))),
      glassBlur: Math.max(0, Math.min(100, Number(patch.glassBlur ?? settings.glassBlur ?? 32))),
      systemGlass: patch.systemGlass ?? settings.systemGlass ?? true,
      showLiveDot: patch.showLiveDot ?? settings.showLiveDot ?? true
    };
    saveSettings();
    applyWindowSettings();
    if (process.platform === 'win32' && previousSystemGlass !== settings.systemGlass) {
      rebuildWindow();
    } else {
      applyNativeMaterial();
    }
    if (settings.hubUrl !== previousHubUrl || settings.secret !== previousSecret || settings.deviceId !== previousDeviceId) {
      startMode();
    }
    return settings;
  });
  ipcMain.handle('appearance:preview', (_event, patch) => {
    applyNativeMaterial({ ...settings, ...patch });
    return true;
  });
  ipcMain.handle('stats:get', () => fetchStats());
  ipcMain.handle('stream:status', () => ({ connected: streamConnected, mode }));
  ipcMain.handle('app:openUserData', () => shell.openPath(app.getPath('userData')));
  ipcMain.on('window:minimize', () => mainWindow?.minimize());
  ipcMain.on('window:close', () => mainWindow?.close());
  app.on('activate', () => { if (BrowserWindow.getAllWindows().length === 0) createWindow(); });
});

app.on('window-all-closed', () => { if (process.platform !== 'darwin') app.quit(); });
app.on('before-quit', stopAll);
