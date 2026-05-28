'use strict';

const fs = require('node:fs');
const path = require('node:path');
const { app, BrowserWindow, ipcMain, nativeImage, screen, session, shell } = require('electron');
const { defaultDeviceId, generateHubSecret, lanIpv4Addresses, loadDotEnv, pidFilePath, sharedDataDir } = require('../shared/config');
const { startCollector } = require('../shared/collector');
const { createHub } = require('../hub/server');
const { normalizeLimitsRefreshMs, parseBoolean, parseLimitProviders } = require('../shared/limitCollector');
const {
  checkNpmForNewer,
  cleanupStaleStaging,
  downloadFromNpm,
  getTokscaleStatus,
  resetToBundled
} = require('../shared/tokscaleUpdater');
const { checkLatestRelease } = require('../shared/appUpdater');
const cursorAuth = require('../shared/cursorAuth');
const cursorProbe = require('../shared/cursorProbe');
const semver = require('semver');
const { normalizeCurrency } = require('../shared/currency');
const { aggregateDevices } = require('../shared/usage');
const { startDiscordRpc, stopDiscordRpc, updateDiscordRpc } = require('./discordRpc');
const { buildTrayIcon, createTray, formatTrayText, pickUsageTrayIconId, popoverBounds } = require('./tray');
const { describeWindowBehavior, normalizeWindowBehaviorSettings } = require('./windowBehavior');

if (!app.isPackaged) loadDotEnv();

const APP_NAME = 'Token Monitor';
const APP_ICON_PATH = path.join(__dirname, '..', '..', 'assets', 'icon.png');

const DEFAULT_WINDOW = { width: 360, height: 500 };
const WINDOW_LIMITS = { minWidth: 240, minHeight: 140, maxWidth: 1200, maxHeight: 1400 };
const ZOOM_LIMITS = { min: 0.7, max: 1.6, step: 0.1 };
const CSP_HEADER = [
  "default-src 'self'",
  "script-src 'self'",
  "style-src 'self'",
  "img-src 'self' data:",
  "font-src 'self'",
  "connect-src 'self'",
  "object-src 'none'",
  "base-uri 'none'",
  "form-action 'none'",
  "frame-ancestors 'none'"
].join('; ');
const TRAY_CONTENT_VALUES = new Set(['tokens', 'cost', 'both', 'tokensAll', 'costAll', 'bothAll', 'bars', 'barsSession', 'barsWeekly', 'barsAllSessions', 'icon']);
const HUB_MODE_VALUES = new Set(['local', 'client', 'host']);
const LANGUAGE_VALUES = new Set(['auto', 'en', 'zh-TW', 'zh-CN']);
const HUB_DEFAULT_PORT = 17321;

let mainWindow = null;
let settingsPath = null;
let settings = null;

app.setName(APP_NAME);
if (process.platform === 'win32') app.setAppUserModelId('com.javis.tokenmonitor');

const gotLock = app.requestSingleInstanceLock();
if (!gotLock) app.exit(0);

function defaultSettings() {
  const envHubUrl = process.env.TOKEN_MONITOR_HUB_URL || '';
  const windowBehavior = process.env.TOKEN_MONITOR_ALWAYS_ON_TOP === '0' ? 'normal' : 'floating';
  return {
    hubMode: envHubUrl ? 'client' : 'local',
    hubUrl: envHubUrl,
    hubHostPort: Math.max(1, Math.min(65535, Number(process.env.TOKEN_MONITOR_PORT) || HUB_DEFAULT_PORT)),
    // Default to TOKEN_MONITOR_SECRET so agents that already trust this env
    // value (matching what the CLI hub uses) can connect to the widget's
    // embedded hub without a fresh round of credential sharing. Falls back
    // to a random secret generated in startEmbeddedHub() if env is empty.
    hubHostSecret: process.env.TOKEN_MONITOR_SECRET || '',
    secret: process.env.TOKEN_MONITOR_SECRET || '',
    windowBehavior,
    alwaysOnTop: windowBehavior === 'floating',
    refreshMs: Number(process.env.TOKEN_MONITOR_WIDGET_REFRESH_MS || 15000),
    glassOpacity: 68,
    glassBlur: 32,
    systemGlass: true,
    showLiveDot: true,
    showToolIcons: true,
    titleIconOnly: false,
    discordRpcEnabled: false,
    deviceId: process.env.TOKEN_MONITOR_DEVICE_ID || defaultDeviceId(),
    lastPostedDeviceId: '',
    clients: process.env.TOKEN_MONITOR_CLIENTS || 'claude,codex,hermes,opencode,openclaw,cursor,antigravity',
    allTimeSince: process.env.TOKEN_MONITOR_ALL_TIME_SINCE || '2024-01-01',
    limitsEnabled: parseBoolean(process.env.TOKEN_MONITOR_LIMITS_ENABLED, true),
    limitProviders: parseLimitProviders(process.env.TOKEN_MONITOR_LIMIT_PROVIDERS).join(','),
    limitProviderOrder: defaultLimitProviderOrder(),
    limitsRefreshMs: normalizeLimitsRefreshMs(process.env.TOKEN_MONITOR_LIMITS_REFRESH_MS),
    showLimitSource: parseBoolean(process.env.TOKEN_MONITOR_SHOW_LIMIT_SOURCE, false),
    windowBounds: null,
    zoomFactor: 1,
    trayMode: false,
    trayContent: 'tokens',
    currency: normalizeCurrency(process.env.TOKEN_MONITOR_CURRENCY || 'USD'),
    startAtLogin: false,
    language: 'auto',
    appUpdate: {
      lastCheckedAt: null,
      lastKnownLatest: null,
      dismissedVersion: null
    }
  };
}

function defaultLimitProviders() {
  return parseLimitProviders(process.env.TOKEN_MONITOR_LIMIT_PROVIDERS).join(',');
}

function defaultLimitProviderOrder() {
  return parseLimitProviders().join(',');
}

function migrateLimitProviders(value) {
  const normalized = parseLimitProviders(value).join(',');
  if (normalized === 'claude,codex') return defaultLimitProviders();
  return normalized;
}

function migrateLimitProviderOrder(value) {
  return parseLimitProviders(value).join(',') || defaultLimitProviderOrder();
}

function normalizeTrayContent(value, fallback = 'tokens') {
  const v = String(value || '').trim();
  return TRAY_CONTENT_VALUES.has(v) ? v : fallback;
}

function normalizeHubMode(value, fallback = 'local') {
  const v = String(value || '').trim();
  return HUB_MODE_VALUES.has(v) ? v : fallback;
}

function normalizeLanguageSetting(value, fallback = 'auto') {
  const raw = String(value || '').replace(/_/g, '-').trim();
  const lower = raw.toLowerCase();
  if (lower === 'auto') return 'auto';
  if (lower === 'en' || lower.startsWith('en-')) return 'en';
  if (lower === 'zh-tw' || lower.startsWith('zh-hant') || /-(tw|hk|mo)\b/i.test(raw)) return 'zh-TW';
  if (lower === 'zh-cn' || lower.startsWith('zh-hans') || /-(cn|sg|my)\b/i.test(raw)) return 'zh-CN';
  return LANGUAGE_VALUES.has(raw) ? raw : fallback;
}

function normalizeHubPort(value, fallback = HUB_DEFAULT_PORT) {
  const n = Math.floor(Number(value));
  if (!Number.isFinite(n) || n < 1 || n > 65535) return fallback;
  return n;
}

function clampZoom(value) {
  const n = Number(value);
  if (!Number.isFinite(n)) return 1;
  return Math.min(ZOOM_LIMITS.max, Math.max(ZOOM_LIMITS.min, Number(n.toFixed(2))));
}

function isBoundsOnScreen(bounds) {
  if (!bounds || typeof bounds.x !== 'number' || typeof bounds.y !== 'number') return false;
  try {
    const display = screen.getDisplayMatching({
      x: bounds.x, y: bounds.y, width: bounds.width || 1, height: bounds.height || 1
    });
    const wa = display.workArea;
    return bounds.x + bounds.width > wa.x &&
      bounds.x < wa.x + wa.width &&
      bounds.y + bounds.height > wa.y &&
      bounds.y < wa.y + wa.height;
  } catch (_) { return false; }
}

function restoredBounds() {
  const saved = settings?.windowBounds;
  if (!saved || typeof saved.width !== 'number' || typeof saved.height !== 'number') return null;
  const width = Math.min(WINDOW_LIMITS.maxWidth, Math.max(WINDOW_LIMITS.minWidth, saved.width));
  const height = Math.min(WINDOW_LIMITS.maxHeight, Math.max(WINDOW_LIMITS.minHeight, saved.height));
  if (!isBoundsOnScreen({ ...saved, width, height })) return { width, height };
  return { x: saved.x, y: saved.y, width, height };
}

let persistBoundsTimer = null;
function stopPersistBoundsTimer() {
  if (persistBoundsTimer) clearTimeout(persistBoundsTimer);
  persistBoundsTimer = null;
}

function persistBoundsSoon() {
  if (!mainWindow || mainWindow.isDestroyed()) return;
  if (mainWindow.isMinimized() || mainWindow.isFullScreen()) return;
  stopPersistBoundsTimer();
  persistBoundsTimer = setTimeout(() => {
    persistBoundsTimer = null;
    if (!mainWindow || mainWindow.isDestroyed()) return;
    const next = mainWindow.getBounds();
    const prev = settings.windowBounds || {};
    if (settings?.trayMode) {
      // Popover x/y is anchored to the tray icon each open; only the size carries over.
      if (prev.width === next.width && prev.height === next.height) return;
      settings.windowBounds = { ...prev, width: next.width, height: next.height };
    } else {
      if (prev.x === next.x && prev.y === next.y && prev.width === next.width && prev.height === next.height) return;
      settings.windowBounds = next;
    }
    saveSettings();
  }, 400);
}

function applyZoomFactor(target = mainWindow) {
  if (!target || target.isDestroyed()) return;
  target.webContents.setZoomFactor(clampZoom(settings.zoomFactor));
}

function setZoomFactor(value) {
  const next = clampZoom(value);
  if (next === clampZoom(settings.zoomFactor)) return;
  settings.zoomFactor = next;
  saveSettings();
  applyZoomFactor();
}

function adjustZoom(delta) {
  setZoomFactor(clampZoom(settings.zoomFactor) + delta);
}

function readSettings() {
  settingsPath = path.join(app.getPath('userData'), 'settings.json');
  try {
    const defaults = defaultSettings();
    const saved = JSON.parse(fs.readFileSync(settingsPath, 'utf8'));
    if (!saved.secret && defaults.secret) delete saved.secret;
    const merged = { ...defaults, ...saved };
    // Migrate older configs that predate hubMode: infer from hubUrl.
    if (saved.hubMode === undefined) {
      merged.hubMode = (saved.hubUrl && String(saved.hubUrl).trim()) ? 'client' : 'local';
    }
    if (saved.limitProviders !== undefined) {
      merged.limitProviders = migrateLimitProviders(saved.limitProviders);
    }
    if (saved.limitProviderOrder !== undefined) {
      merged.limitProviderOrder = migrateLimitProviderOrder(saved.limitProviderOrder);
    }
    if (saved.windowBehavior === undefined && saved.alwaysOnTop !== undefined) {
      merged.windowBehavior = saved.alwaysOnTop ? 'floating' : 'normal';
    }
    merged.hubMode = normalizeHubMode(merged.hubMode);
    merged.language = normalizeLanguageSetting(merged.language);
    merged.currency = normalizeCurrency(merged.currency);
    merged.hubHostPort = normalizeHubPort(merged.hubHostPort);
    merged.hubHostSecret = typeof merged.hubHostSecret === 'string' ? merged.hubHostSecret : '';
    return normalizeWindowBehaviorSettings(merged);
  }
  catch (_error) { return normalizeWindowBehaviorSettings(defaultSettings()); }
}

function saveSettings() {
  fs.mkdirSync(path.dirname(settingsPath), { recursive: true });
  fs.writeFileSync(settingsPath, `${JSON.stringify(settings, null, 2)}\n`, 'utf8');
}

function loginItemEnabledHere() {
  return app.isPackaged && process.platform !== 'linux';
}

function currentLoginItemState() {
  if (!loginItemEnabledHere()) return false;
  try { return Boolean(app.getLoginItemSettings().openAtLogin); }
  catch (_) { return false; }
}

function applyLoginItem(startAtLogin) {
  if (!loginItemEnabledHere()) return false;
  app.setLoginItemSettings({ openAtLogin: Boolean(startAtLogin) });
  return currentLoginItemState();
}

function syncLoginItemSettingFromOs() {
  if (!settings) return;
  const actual = currentLoginItemState();
  if (settings.startAtLogin === actual) return;
  settings.startAtLogin = actual;
  saveSettings();
}

function applyMacActivationPolicy() {
  if (process.platform !== 'darwin') return;
  const trayMode = Boolean(settings?.trayMode);
  if (typeof app.setActivationPolicy === 'function') {
    try { app.setActivationPolicy(trayMode ? 'accessory' : 'regular'); } catch (_) {}
  }
  if (!app.dock) return;
  if (trayMode) app.dock.hide();
  else app.dock.show();
}

function applyWindowSettings() {
  if (!mainWindow) return;
  const behavior = describeWindowBehavior(settings);
  mainWindow.setAlwaysOnTop(behavior.alwaysOnTop, 'floating');
  if (typeof mainWindow.setMovable === 'function') mainWindow.setMovable(behavior.draggable);
  if (typeof mainWindow.setResizable === 'function') mainWindow.setResizable(behavior.resizable);
  if (typeof mainWindow.setIgnoreMouseEvents === 'function') {
    mainWindow.setIgnoreMouseEvents(behavior.mousePassthrough);
  }
  if (typeof mainWindow.setFocusable === 'function') mainWindow.setFocusable(behavior.focusable);
  if (!behavior.focusable && typeof mainWindow.blur === 'function') mainWindow.blur();
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
let tray = null;
let latestStats = null;
let suppressNextBlurHide = false;
const providerTrayIcons = {};
let defaultTrayIcon = null;
let tokScaleNpmMetadata = null;
let tokScaleUpdaterBusy = false;
function getDefaultTrayIcon() {
  if (!defaultTrayIcon) defaultTrayIcon = buildTrayIcon();
  return defaultTrayIcon;
}
const AGENT_PID_PATH = pidFilePath();
let embeddedHub = null;
let embeddedHubError = null;
let modeQueue = Promise.resolve();

function effectiveHubConfig() {
  if (settings?.hubMode === 'host') {
    return {
      url: `http://127.0.0.1:${normalizeHubPort(settings.hubHostPort)}`,
      secret: settings.hubHostSecret || ''
    };
  }
  if (settings?.hubMode === 'client') {
    const url = String(settings.hubUrl || '').trim();
    return { url: url || null, secret: settings.secret || '' };
  }
  return { url: null, secret: '' };
}

function hubDataFile() {
  return path.join(app.getPath('userData'), 'hub-devices.json');
}

function sendHubPush(payload) {
  if (mainWindow && !mainWindow.isDestroyed()) {
    try { mainWindow.webContents.send('hub:push', payload); } catch (_) {}
  }
}

function getHubInfo() {
  const port = normalizeHubPort(settings?.hubHostPort);
  return {
    mode: settings?.hubMode || 'local',
    port,
    secret: settings?.hubHostSecret || '',
    listening: Boolean(embeddedHub),
    listeningPort: embeddedHub ? embeddedHub.port : null,
    error: embeddedHubError,
    lanAddresses: lanIpv4Addresses()
  };
}

async function startEmbeddedHub() {
  if (embeddedHub) return embeddedHub;
  embeddedHubError = null;
  if (!settings.hubHostSecret) {
    settings.hubHostSecret = generateHubSecret();
    saveSettings();
  }
  const port = normalizeHubPort(settings.hubHostPort);
  try {
    const hub = createHub({
      port,
      host: '0.0.0.0',
      secret: settings.hubHostSecret,
      dataFile: hubDataFile(),
      logger: { error: (err) => console.log(`[hub] ${err?.message || err}`) }
    });
    await hub.start();
    embeddedHub = { hub, port };
    console.log(`[hub] listening on 0.0.0.0:${port}`);
    sendHubPush({ type: 'listening', info: getHubInfo() });
    return embeddedHub;
  } catch (error) {
    embeddedHubError = { code: error.code || 'error', message: error.message, port };
    console.log(`[hub] failed to start on port ${port}: ${error.message}`);
    sendHubPush({ type: 'error', info: getHubInfo() });
    return null;
  }
}

async function stopEmbeddedHub() {
  if (!embeddedHub) return;
  const handle = embeddedHub;
  embeddedHub = null;
  try { await handle.hub.stop(); } catch (_) {}
  sendHubPush({ type: 'stopped', info: getHubInfo() });
}

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
  const { url: hubUrl, secret } = effectiveHubConfig();
  if (!hubUrl) return;
  const base = hubUrl.replace(/\/$/, '');
  const response = await fetch(`${base}/api/devices/${encodeURIComponent(deviceId)}`, {
    method: 'DELETE',
    headers: secret ? { authorization: `Bearer ${secret}` } : {}
  });
  if (!response.ok && response.status !== 404) throw new Error(`DELETE ${response.status}`);
}

async function postToHub(summary) {
  const { url: hubUrl, secret } = effectiveHubConfig();
  if (!hubUrl) throw new Error('hub not configured');
  const stale = settings.lastPostedDeviceId;
  if (stale && stale !== summary.deviceId) {
    try { await deleteDeviceFromHub(stale); }
    catch (error) { console.log(`[sync] cleanup of old deviceId ${stale} failed: ${error.message}`); }
  }
  const url = `${hubUrl.replace(/\/$/, '')}/api/ingest`;
  const response = await fetch(url, {
    method: 'POST',
    headers: { 'content-type': 'application/json', ...(secret ? { authorization: `Bearer ${secret}` } : {}) },
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
  if (!effectiveHubConfig().url) return;
  syncCollectorHandle = startCollector({
    clients: settings.clients || 'claude,codex,hermes,opencode,openclaw,cursor,antigravity',
    allTimeSince: settings.allTimeSince || '2024-01-01',
    commandTimeoutMs: 120 * 1000,
    deviceId: settings.deviceId || defaultDeviceId(),
    agentVersion: '0.1.0-widget',
    intervalMs: 5 * 60 * 1000,
    watchEnabled: true,
    watchDebounceMs: 1500,
    limitsEnabled: settings.limitsEnabled !== false,
    limitProviders: settings.limitProviders ?? defaultLimitProviders(),
    limitsRefreshMs: normalizeLimitsRefreshMs(settings.limitsRefreshMs),
    onUpdate: async (summary) => {
      if (isExternalAgentActive()) return;
      try {
        await postToHub(summary);
      } catch (error) {
        console.log(`[sync-collector] post failed: ${error.message}`);
      }
    },
    onError: (error, reason) => console.log(`[sync-collector] ${reason}: ${error.message}`),
    logger: (msg) => console.log(`[sync-collector] ${msg}`)
  });
}

function isHubConfigured() {
  return Boolean(effectiveHubConfig().url);
}

function sendPush(payload) {
  if (payload?.data?.stats) {
    latestStats = payload.data.stats;
    updateTrayDisplay();
  }
  if (mainWindow && !mainWindow.isDestroyed()) {
    try { mainWindow.webContents.send('stats:push', payload); } catch (_) {}
  }
}

function updateTrayDisplay() {
  if (!tray || tray.isDestroyed()) return;
  const mode = settings?.trayContent || 'tokens';
  const currency = normalizeCurrency(settings?.currency);
  const text = formatTrayText(latestStats, mode, currency);
  if (process.platform === 'darwin') tray.setTitle(text);
  // Tooltip always shows a useful summary, even in icon-only mode where setTitle is blank.
  const tip = formatTrayText(latestStats, 'both', currency);
  tray.setToolTip(`Token Monitor - ${tip}`);
  // Icon: rendered bars image in bar modes, otherwise the app icon.
  let icon = null;
  if ((mode === 'bars' || mode === 'barsSession' || mode === 'barsWeekly' || mode === 'barsAllSessions') && providerTrayIcons[mode]) {
    icon = providerTrayIcons[mode];
  } else {
    const usageIconId = pickUsageTrayIconId(latestStats, mode, Object.keys(providerTrayIcons));
    if (usageIconId) icon = providerTrayIcons[usageIconId];
  }
  tray.setImage(icon || getDefaultTrayIcon());
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
    clients: settings.clients || 'claude,codex,hermes,opencode,openclaw,cursor,antigravity',
    allTimeSince: settings.allTimeSince || '2024-01-01',
    commandTimeoutMs: 120 * 1000,
    deviceId: settings.deviceId || defaultDeviceId(),
    agentVersion: '0.1.0',
    intervalMs: 5 * 60 * 1000,
    watchEnabled: true,
    watchDebounceMs: 1500,
    limitsEnabled: settings.limitsEnabled !== false,
    limitProviders: settings.limitProviders ?? defaultLimitProviders(),
    limitsRefreshMs: normalizeLimitsRefreshMs(settings.limitsRefreshMs),
    onUpdate: (summary, reason) => {
      localDevice = { ...summary, receivedAt: new Date().toISOString() };
      localStats = aggregateDevices([localDevice], 0);
      updateDiscordRpc(localStats, settings.currency);
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
  const { url: hubUrl, secret } = effectiveHubConfig();
  if (!hubUrl) return;
  mode = 'sync';
  const url = `${hubUrl.replace(/\/$/, '')}/api/stats/stream`;
  const controller = new AbortController();
  sseAbortController = controller;
  try {
    const response = await fetch(url, {
      headers: { accept: 'text/event-stream', ...(secret ? { authorization: `Bearer ${secret}` } : {}) },
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
        if (parsed) {
          if (parsed.event === 'stats' && parsed.data?.stats) updateDiscordRpc(parsed.data.stats, settings.currency);
          sendPush(parsed);
        }
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

function showPopover() {
  if (!mainWindow || mainWindow.isDestroyed() || !tray) return;
  applyMacActivationPolicy();
  applyWindowSettings();
  const current = mainWindow.getBounds();
  const target = popoverBounds(tray, current.width, current.height);
  mainWindow.setBounds(target);
  suppressNextBlurHide = true;
  mainWindow.show();
  mainWindow.focus();
  // The focus event itself may not fire a blur; the suppress flag covers the
  // case where macOS fires blur immediately after show because the click that
  // opened us still has the menu bar as the focused element.
  setTimeout(() => { suppressNextBlurHide = false; }, 250);
}

function hidePopover() {
  if (!mainWindow || mainWindow.isDestroyed()) return;
  if (mainWindow.isVisible()) mainWindow.hide();
}

function togglePopover() {
  if (!mainWindow || mainWindow.isDestroyed()) return;
  if (mainWindow.isVisible() && mainWindow.isFocused()) hidePopover();
  else showPopover();
}

function focusExistingWindow() {
  if (!mainWindow || mainWindow.isDestroyed()) return;
  if (mainWindow.isMinimized()) mainWindow.restore();
  if (settings?.trayMode) showPopover();
  else {
    mainWindow.show();
    mainWindow.focus();
  }
}

function ensureTray() {
  if (tray && !tray.isDestroyed()) return;
  tray = createTray({
    onToggle: togglePopover,
    onQuit: requestAppQuit,
    onSwitchToWindowMode: () => {
      settings.trayMode = false;
      saveSettings();
      exitTrayMode();
      if (mainWindow && !mainWindow.isDestroyed()) {
        try { mainWindow.webContents.send('settings:push', settings); } catch (_) {}
      }
    }
  });
}

function enterTrayMode() {
  applyMacActivationPolicy();
  ensureTray();
  updateTrayDisplay();
  applyWindowSettings();
  applyMacActivationPolicy();
  if (mainWindow && !mainWindow.isDestroyed()) {
    if (typeof mainWindow.setSkipTaskbar === 'function') mainWindow.setSkipTaskbar(true);
    // Without this, .show() yanks the user back to the Space the window was last
    // shown on instead of popping over the current Space / fullscreen app.
    if (typeof mainWindow.setVisibleOnAllWorkspaces === 'function') {
      mainWindow.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true });
    }
    mainWindow.hide();
  }
}

function exitTrayMode() {
  if (tray && !tray.isDestroyed()) tray.destroy();
  tray = null;
  applyMacActivationPolicy();
  if (mainWindow && !mainWindow.isDestroyed()) {
    if (typeof mainWindow.setSkipTaskbar === 'function') mainWindow.setSkipTaskbar(false);
    if (typeof mainWindow.setVisibleOnAllWorkspaces === 'function') {
      mainWindow.setVisibleOnAllWorkspaces(false);
    }
    const restore = restoredBounds() || DEFAULT_WINDOW;
    mainWindow.setBounds({
      width: restore.width,
      height: restore.height,
      ...(typeof restore.x === 'number' ? { x: restore.x, y: restore.y } : {})
    });
    applyWindowSettings();
    mainWindow.show();
    mainWindow.focus();
  }
}

function startMode() {
  // Tear down collectors synchronously so they can't double-run while the
  // async reconciliation below is queued.
  stopLocalCollector();
  stopStatsStream();
  stopSyncCollector();
  // Serialize the hub-side work so rapid UI events (mode change immediately
  // followed by a port edit or secret regenerate) reconcile in order rather
  // than racing — otherwise an in-flight start could finish with the old
  // port/secret after the UI already advertises the new ones.
  modeQueue = modeQueue.then(async () => {
    if (settings.hubMode === 'host') {
      await stopEmbeddedHub();
      const handle = await startEmbeddedHub();
      if (settings.hubMode !== 'host') {
        await stopEmbeddedHub();
        return;
      }
      if (!handle) {
        // Bind failed (e.g. EADDRINUSE). The error is already surfaced via
        // hub:push; fall back to the local collector so the widget still
        // shows data while the user fixes the port.
        startLocalCollector();
        return;
      }
      startStatsStream();
      startSyncCollector();
      return;
    }
    await stopEmbeddedHub();
    if (effectiveHubConfig().url) {
      startStatsStream();
      startSyncCollector();
    } else {
      startLocalCollector();
    }
  }).catch((err) => {
    console.log(`[mode] reconciliation failed: ${err?.message || err}`);
  });
}

function stopAll() {
  stopPersistBoundsTimer();
  stopLocalCollector();
  stopStatsStream();
  stopSyncCollector();
  void stopEmbeddedHub();
  stopDiscordRpc();
  if (tray && !tray.isDestroyed()) tray.destroy();
  tray = null;
}

let quitRequested = false;
function requestAppQuit() {
  if (quitRequested) return;
  quitRequested = true;
  stopAll();
  if (app.isReady()) app.quit();
  else app.exit(0);
}

async function fetchStats(options = {}) {
  const force = Boolean(options?.force);
  const tickOptions = force ? { forceLimits: true } : {};
  if (mode === 'local') {
    if (force && localCollectorHandle) await localCollectorHandle.tick('manual', tickOptions);
    if (localStats) return localStats;
    return aggregateDevices(localDevice ? [localDevice] : [], 0);
  }
  if (force && syncCollectorHandle && !isExternalAgentActive()) {
    await syncCollectorHandle.tick('manual', tickOptions);
  }
  const { url: hubUrl, secret } = effectiveHubConfig();
  if (!hubUrl) return aggregateDevices([], 0);
  const url = `${hubUrl.replace(/\/$/, '')}/api/stats`;
  const response = await fetch(url, { headers: secret ? { authorization: `Bearer ${secret}` } : {} });
  if (!response.ok) throw new Error(`Hub ${response.status}: ${(await response.text()).slice(0, 200)}`);
  return response.json();
}

function stripTokscaleMetadata(result) {
  if (!result || typeof result !== 'object') return result;
  const { metadata: _metadata, ...publicResult } = result;
  return publicResult;
}

function sendTokscalePush(payload) {
  if (!mainWindow || mainWindow.isDestroyed()) return;
  try { mainWindow.webContents.send('tokscale:push', payload); } catch (_) {}
}

async function checkTokscaleNpm({ silent = false } = {}) {
  try {
    const result = await checkNpmForNewer(app.getVersion());
    if (result.metadata) tokScaleNpmMetadata = result.metadata;
    const publicResult = stripTokscaleMetadata(result);
    sendTokscalePush({ type: 'check', ...publicResult });
    return publicResult;
  } catch (error) {
    if (silent) {
      console.log(`[tokscale] npm check failed: ${error.message}`);
      return { supported: true, error: null, silent: true };
    }
    return { supported: true, error: error.message };
  }
}

async function downloadTokscaleFromNpm() {
  if (tokScaleUpdaterBusy) return { supported: true, busy: true };
  tokScaleUpdaterBusy = true;
  try {
    if (!tokScaleNpmMetadata) {
      const checked = await checkNpmForNewer(app.getVersion());
      if (!checked.supported) return { supported: false };
      tokScaleNpmMetadata = checked.metadata;
    }
    const result = await downloadFromNpm(tokScaleNpmMetadata);
    const publicResult = stripTokscaleMetadata(result);
    sendTokscalePush({ type: 'download', ...publicResult });
    return publicResult;
  } catch (error) {
    return { supported: true, error: error.message };
  } finally {
    tokScaleUpdaterBusy = false;
  }
}

const APP_UPDATE_COOLDOWN_MS = 24 * 60 * 60 * 1000;
let appUpdateCheckInFlight = false;
let appUpdateLastError = null;

function deriveAppUpdateState() {
  const block = settings?.appUpdate || {};
  const currentVersion = app.getVersion();
  const latest = block.lastKnownLatest || null;
  const dismissedVersion = block.dismissedVersion || null;
  let hasUpdate = false;
  if (latest && semver.valid(latest.version) && semver.valid(currentVersion)) {
    hasUpdate = semver.gt(latest.version, currentVersion) && latest.version !== dismissedVersion;
  }
  return {
    currentVersion,
    latest,
    hasUpdate,
    dismissedVersion,
    lastCheckedAt: block.lastCheckedAt || null,
    checking: appUpdateCheckInFlight,
    lastError: appUpdateLastError
  };
}

function sendAppUpdatePush() {
  if (!mainWindow || mainWindow.isDestroyed()) return;
  mainWindow.webContents.send('appUpdate:push', deriveAppUpdateState());
}

async function runAppUpdateCheck({ force = false } = {}) {
  if (appUpdateCheckInFlight) return deriveAppUpdateState();
  const block = settings?.appUpdate || {};
  if (!force && block.lastCheckedAt) {
    const last = Date.parse(block.lastCheckedAt);
    if (Number.isFinite(last) && Date.now() - last < APP_UPDATE_COOLDOWN_MS) {
      return deriveAppUpdateState();
    }
  }
  appUpdateCheckInFlight = true;
  appUpdateLastError = null;
  if (force) sendAppUpdatePush();
  try {
    const result = await checkLatestRelease(app.getVersion());
    if (result.ok) {
      settings.appUpdate = {
        ...(settings.appUpdate || {}),
        lastCheckedAt: result.checkedAt,
        lastKnownLatest: result.latest
      };
      saveSettings();
      appUpdateLastError = null;
    } else {
      appUpdateLastError = force ? (result.error || 'Update check failed') : null;
      if (!force) console.warn('App update check failed:', result.error);
    }
  } catch (error) {
    appUpdateLastError = force ? (error.message || String(error)) : null;
    if (!force) console.warn('App update check threw:', error);
  } finally {
    appUpdateCheckInFlight = false;
    sendAppUpdatePush();
  }
  return deriveAppUpdateState();
}

function maybeRunBackgroundUpdateCheck() {
  runAppUpdateCheck({ force: false }).catch(() => {});
}

function dismissAppUpdateVersion(version) {
  if (typeof version !== 'string' || !version) return deriveAppUpdateState();
  settings.appUpdate = {
    ...(settings.appUpdate || {}),
    dismissedVersion: version
  };
  saveSettings();
  sendAppUpdatePush();
  return deriveAppUpdateState();
}

function isAllowedExternalUrl(value) {
  let parsed;
  try { parsed = new URL(String(value || '')); }
  catch (_) { return false; }
  if (parsed.protocol !== 'https:') return false;
  if (parsed.hostname === 'github.com' && parsed.pathname.startsWith('/junhoyeo/tokscale')) return true;
  if (parsed.hostname === 'www.npmjs.com' && parsed.pathname.startsWith('/package/@tokscale/')) return true;
  if (parsed.hostname === 'github.com' && parsed.pathname.startsWith('/Javis603/token-monitor')) return true;
  if ((parsed.hostname === 'cursor.com' || parsed.hostname === 'www.cursor.com') && parsed.pathname.startsWith('/settings')) return true;
  return false;
}

function revealWindow(target = mainWindow) {
  if (!target || target.isDestroyed() || target.isVisible()) return;
  target.show();
}

function loadWindowFile(target) {
  let revealed = false;
  const reveal = () => {
    if (revealed) return;
    revealed = true;
    if (settings?.trayMode) return; // stay hidden until tray click
    revealWindow(target);
  };
  const fallbackTimer = setTimeout(reveal, 2500);
  const cleanup = () => clearTimeout(fallbackTimer);
  target.once('show', cleanup);
  target.once('closed', cleanup);
  target.once('ready-to-show', reveal);
  target.webContents.once('did-finish-load', () => {
    applyZoomFactor(target);
    reveal();
  });
  target.webContents.once('did-fail-load', (_event, code, description) => {
    console.log(`[window] renderer load failed: ${code} ${description}`);
    reveal();
  });
  target.loadFile(path.join(__dirname, 'renderer', 'index.html')).catch((error) => {
    console.log(`[window] renderer load failed: ${error.message}`);
    reveal();
  });
}

function createWindow(boundsOverride) {
  if (!settings) settings = readSettings();
  const glass = nativeBlurEnabled();
  const bounds = boundsOverride || restoredBounds() || DEFAULT_WINDOW;
  const win = new BrowserWindow({
    width: bounds.width,
    height: bounds.height,
    ...(typeof bounds.x === 'number' ? { x: bounds.x, y: bounds.y } : {}),
    ...WINDOW_LIMITS,
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
  mainWindow = win;
  win.webContents.setWindowOpenHandler(({ url }) => {
    if (isAllowedExternalUrl(url)) shell.openExternal(url);
    return { action: 'deny' };
  });
  win.webContents.on('will-navigate', (event, url) => {
    event.preventDefault();
    if (isAllowedExternalUrl(url)) shell.openExternal(url);
  });
  if (settings.trayMode && typeof win.setSkipTaskbar === 'function') win.setSkipTaskbar(true);
  applyWindowSettings();
  applyNativeMaterial();
  keepNativeBlurActive();
  win.on('focus', keepNativeBlurActive);
  win.on('blur', () => {
    keepNativeBlurActive();
    if (settings?.trayMode && !suppressNextBlurHide && !quitRequested) hidePopover();
  });
  win.on('resized', persistBoundsSoon);
  win.on('moved', persistBoundsSoon);
  win.on('close', (event) => {
    if (settings?.trayMode && !quitRequested) {
      event.preventDefault();
      hidePopover();
    }
  });
  win.webContents.on('before-input-event', handleZoomShortcut);
  loadWindowFile(win);
}

function handleZoomShortcut(event, input) {
  if (input.type !== 'keyDown') return;
  if (!(input.control || input.meta)) return;
  const key = input.key;
  if (key === '=' || key === '+') { event.preventDefault(); adjustZoom(ZOOM_LIMITS.step); }
  else if (key === '-' || key === '_') { event.preventDefault(); adjustZoom(-ZOOM_LIMITS.step); }
  else if (key === '0') { event.preventDefault(); setZoomFactor(1); }
}

let cursorStatusCache = { value: null, at: 0 };
const CURSOR_STATUS_TTL_MS = 30 * 1000;

function normalizeManualCookie(input) {
  let s = String(input || '').trim();
  if (!s) return '';
  if (s.toLowerCase().startsWith('cookie:')) s = s.slice(7).trim();
  // If they pasted the full cookie header, extract the WorkosCursorSessionToken= value.
  const match = s.match(/WorkosCursorSessionToken=([^;\s]+)/);
  if (match) return match[1];
  // Otherwise assume the whole string is the raw token value.
  if (/\s/.test(s)) return '';
  return s;
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
  mainWindow.once('show', () => {
    if (!old.isDestroyed()) old.destroy();
    if (wasFocused && !mainWindow.isDestroyed()) mainWindow.focus();
  });
}

app.whenReady().then(() => {
  if (process.platform === 'darwin' && app.dock) app.dock.setIcon(APP_ICON_PATH);
  if (!settings) settings = readSettings();
  session.defaultSession.webRequest.onHeadersReceived((details, callback) => {
    callback({
      responseHeaders: {
        ...details.responseHeaders,
        'Content-Security-Policy': [CSP_HEADER]
      }
    });
  });
  applyMacActivationPolicy();
  createWindow();
  syncLoginItemSettingFromOs();
  cleanupStaleStaging().catch((error) => console.log(`[tokscale] staging cleanup failed: ${error.message}`));
  if (settings.trayMode) enterTrayMode();
  startMode();
  if (settings.discordRpcEnabled) startDiscordRpc();
  setTimeout(() => { checkTokscaleNpm({ silent: true }); }, 2000);
  ipcMain.handle('settings:get', () => settings);
  ipcMain.handle('settings:update', (_event, patch) => {
    const previousSystemGlass = settings.systemGlass;
    const previousHubMode = settings.hubMode;
    const previousHubHostPort = settings.hubHostPort;
    const previousHubHostSecret = settings.hubHostSecret;
    const previousHubUrl = settings.hubUrl;
    const previousSecret = settings.secret;
    const previousDeviceId = settings.deviceId;
    const previousClients = settings.clients;
    const previousLimitsEnabled = settings.limitsEnabled;
    const previousLimitProviders = settings.limitProviders;
    const previousLimitsRefreshMs = settings.limitsRefreshMs;
    const previousDiscordRpcEnabled = settings.discordRpcEnabled;
    const previousTrayMode = settings.trayMode;
    const previousTrayContent = settings.trayContent;
    const previousCurrency = settings.currency;
    const previousStartAtLogin = settings.startAtLogin;
    const normalizedCurrency = patch.currency !== undefined ? normalizeCurrency(patch.currency, settings.currency) : normalizeCurrency(settings.currency);
    const normalizedPatch = { ...patch, currency: normalizedCurrency };
    settings = normalizeWindowBehaviorSettings({
      ...settings,
      ...normalizedPatch,
      hubMode: patch.hubMode !== undefined ? normalizeHubMode(patch.hubMode, settings.hubMode) : settings.hubMode,
      hubHostPort: patch.hubHostPort !== undefined ? normalizeHubPort(patch.hubHostPort, settings.hubHostPort) : settings.hubHostPort,
      hubHostSecret: patch.hubHostSecret !== undefined ? String(patch.hubHostSecret) : settings.hubHostSecret,
      deviceId: (patch.deviceId !== undefined ? String(patch.deviceId).trim() : settings.deviceId) || defaultDeviceId(),
      refreshMs: Math.max(5000, Number(patch.refreshMs ?? settings.refreshMs ?? 15000)),
      glassOpacity: Math.max(0, Math.min(100, Number(patch.glassOpacity ?? settings.glassOpacity ?? 68))),
      glassBlur: Math.max(0, Math.min(100, Number(patch.glassBlur ?? settings.glassBlur ?? 32))),
      systemGlass: patch.systemGlass ?? settings.systemGlass ?? true,
      showLiveDot: patch.showLiveDot ?? settings.showLiveDot ?? true,
      showToolIcons: patch.showToolIcons ?? settings.showToolIcons ?? true,
      titleIconOnly: parseBoolean(patch.titleIconOnly ?? settings.titleIconOnly, false),
      discordRpcEnabled: patch.discordRpcEnabled ?? settings.discordRpcEnabled ?? false,
      limitsEnabled: parseBoolean(patch.limitsEnabled ?? settings.limitsEnabled, true),
      limitProviders: patch.limitProviders !== undefined ? parseLimitProviders(patch.limitProviders).join(',') : settings.limitProviders,
      limitProviderOrder: patch.limitProviderOrder !== undefined ? migrateLimitProviderOrder(patch.limitProviderOrder) : settings.limitProviderOrder,
      limitsRefreshMs: normalizeLimitsRefreshMs(patch.limitsRefreshMs ?? settings.limitsRefreshMs),
      showLimitSource: parseBoolean(patch.showLimitSource ?? settings.showLimitSource, false),
      zoomFactor: clampZoom(patch.zoomFactor ?? settings.zoomFactor),
      trayMode: parseBoolean(patch.trayMode ?? settings.trayMode, false),
      trayContent: normalizeTrayContent(patch.trayContent ?? settings.trayContent),
      currency: normalizedCurrency,
      language: patch.language !== undefined ? normalizeLanguageSetting(patch.language, settings.language) : normalizeLanguageSetting(settings.language),
      startAtLogin: loginItemEnabledHere() ? parseBoolean(patch.startAtLogin ?? settings.startAtLogin, false) : false
    }, normalizedPatch);
    saveSettings();
    if (settings.startAtLogin !== previousStartAtLogin) {
      settings.startAtLogin = applyLoginItem(settings.startAtLogin);
      saveSettings();
    }
    if (patch.zoomFactor !== undefined) applyZoomFactor();
    if (settings.discordRpcEnabled && !previousDiscordRpcEnabled) {
      startDiscordRpc();
      if (latestStats) updateDiscordRpc(latestStats, settings.currency);
    }
    else if (!settings.discordRpcEnabled && previousDiscordRpcEnabled) stopDiscordRpc();
    else if (settings.discordRpcEnabled && settings.currency !== previousCurrency && latestStats) updateDiscordRpc(latestStats, settings.currency);
    applyWindowSettings();
    if (process.platform === 'win32' && previousSystemGlass !== settings.systemGlass) {
      rebuildWindow();
    } else {
      applyNativeMaterial();
    }
    if (
      settings.hubMode !== previousHubMode ||
      settings.hubHostPort !== previousHubHostPort ||
      settings.hubHostSecret !== previousHubHostSecret ||
      settings.hubUrl !== previousHubUrl ||
      settings.secret !== previousSecret ||
      settings.deviceId !== previousDeviceId ||
      settings.clients !== previousClients ||
      settings.limitsEnabled !== previousLimitsEnabled ||
      settings.limitProviders !== previousLimitProviders ||
      settings.limitsRefreshMs !== previousLimitsRefreshMs
    ) {
      startMode();
    }
    if (settings.trayMode !== previousTrayMode) {
      if (settings.trayMode) enterTrayMode();
      else exitTrayMode();
    } else if (settings.trayContent !== previousTrayContent || settings.currency !== previousCurrency) {
      updateTrayDisplay();
    }
    return settings;
  });
  ipcMain.handle('appearance:preview', (_event, patch) => {
    applyNativeMaterial({ ...settings, ...patch });
    if (patch && patch.zoomFactor !== undefined && mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.setZoomFactor(clampZoom(patch.zoomFactor));
    }
    return true;
  });
  ipcMain.handle('tray:setIcons', (_event, icons) => {
    if (!icons || typeof icons !== 'object') return false;
    for (const [id, dataUrl] of Object.entries(icons)) {
      if (typeof dataUrl !== 'string' || !dataUrl.startsWith('data:image/png')) continue;
      const img = nativeImage.createFromDataURL(dataUrl);
      if (img.isEmpty()) continue;
      // Resize by height only; aspect ratio is preserved, so wide bar-style
      // icons keep their width while square provider icons stay 20x20.
      const sized = img.resize({ height: 20, quality: 'best' });
      if (process.platform === 'darwin') sized.setTemplateImage(true);
      providerTrayIcons[id] = sized;
    }
    updateTrayDisplay();
    return true;
  });
  ipcMain.handle('stats:get', (_event, options) => fetchStats(options));
  ipcMain.handle('stream:status', () => ({ connected: streamConnected, mode }));
  ipcMain.handle('hub:getInfo', () => getHubInfo());
  ipcMain.handle('hub:regenerateSecret', () => {
    settings.hubHostSecret = generateHubSecret();
    saveSettings();
    if (settings.hubMode === 'host') startMode();
    return getHubInfo();
  });
  ipcMain.handle('app:getInfo', () => ({
    version: app.getVersion(),
    platform: process.platform,
    arch: process.arch,
    isPackaged: app.isPackaged,
    userData: app.getPath('userData'),
    sharedDataDir: sharedDataDir(),
    loginItemSupported: loginItemEnabledHere(),
    loginItemOpenAtLogin: currentLoginItemState()
  }));
  ipcMain.handle('app:openExternal', (_event, url) => {
    if (!isAllowedExternalUrl(url)) return { ok: false, error: 'url not in allowlist' };
    return shell.openExternal(url)
      .then(() => ({ ok: true }))
      .catch((error) => ({ ok: false, error: error.message }));
  });
  ipcMain.handle('app:openUserData', () => shell.openPath(app.getPath('userData')));
  ipcMain.handle('tokscale:getStatus', () => getTokscaleStatus());
  ipcMain.handle('tokscale:checkNpm', () => checkTokscaleNpm());
  ipcMain.handle('tokscale:downloadFromNpm', () => downloadTokscaleFromNpm());
  ipcMain.handle('tokscale:resetToBundled', async () => {
    tokScaleNpmMetadata = null;
    const status = await resetToBundled();
    sendTokscalePush({ type: 'reset', status });
    return status;
  });
  ipcMain.handle('appUpdate:getState', () => deriveAppUpdateState());
  ipcMain.handle('appUpdate:checkNow', () => runAppUpdateCheck({ force: true }));
  ipcMain.handle('appUpdate:dismiss', (_event, version) => dismissAppUpdateVersion(version));
  ipcMain.handle('cursor:loginManual', async (_event, raw) => {
    const token = normalizeManualCookie(raw);
    if (!token) return { ok: false, error: 'Empty or malformed token' };
    try {
      const probeResult = await cursorProbe.probe(token);
      if (!probeResult.ok) return { ok: false, error: probeResult.error?.message || 'Cursor rejected the token' };
      await cursorAuth.runCursorLogin(token);
      cursorStatusCache = { value: null, at: 0 };
      return { ok: true, email: probeResult.user.email };
    } catch (err) {
      return { ok: false, error: err.message };
    }
  });
  ipcMain.handle('cursor:logout', async () => {
    try {
      await cursorAuth.runCursorLogout();
      cursorStatusCache = { value: null, at: 0 };
      return { ok: true };
    } catch (err) {
      return { ok: false, error: err.message };
    }
  });
  ipcMain.handle('cursor:status', async () => {
    const now = Date.now();
    if (cursorStatusCache.value && now - cursorStatusCache.at < CURSOR_STATUS_TTL_MS) {
      return cursorStatusCache.value;
    }
    const account = cursorAuth.readActiveAccount();
    if (!account) {
      const value = { loggedIn: false };
      cursorStatusCache = { value, at: now };
      return value;
    }
    const probeResult = await cursorProbe.probe(account.sessionToken);
    const value = probeResult.ok
      ? {
          loggedIn: true,
          email: probeResult.user.email,
          membershipType: probeResult.usage.membershipType,
          billingCycleEnd: probeResult.usage.billingCycleEnd,
          expired: false
        }
      : { loggedIn: true, expired: probeResult.error?.kind === 'unauthorized', error: probeResult.error?.message };
    cursorStatusCache = { value, at: now };
    return value;
  });
  ipcMain.on('window:minimize', () => {
    if (settings?.trayMode) hidePopover();
    else mainWindow?.minimize();
  });
  ipcMain.on('window:close', () => {
    if (settings?.trayMode) hidePopover();
    else mainWindow?.close();
  });
  app.on('activate', () => { if (BrowserWindow.getAllWindows().length === 0) createWindow(); });
  maybeRunBackgroundUpdateCheck();
});

app.on('second-instance', focusExistingWindow);
app.on('window-all-closed', () => { if (process.platform !== 'darwin') app.quit(); });
app.on('before-quit', () => { quitRequested = true; stopAll(); });
for (const signal of ['SIGINT', 'SIGTERM', 'SIGHUP']) {
  process.once(signal, requestAppQuit);
}
