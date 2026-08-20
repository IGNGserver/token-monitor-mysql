'use strict';

const { clientsCsvForSetting } = require('../shared/clientTracking');
const { normalizeHistoryIntervalMs } = require('../shared/collector');
const {
  normalizeLimitsRefreshMode,
  normalizeLimitsRefreshMs,
  parseLimitProviderAutoDetectDisabled,
  parseLimitProviders
} = require('../shared/limitCollector');
const { normalizeSyncUploadIntervalMs } = require('../shared/syncUploadInterval');

const DEFAULT_ALL_TIME_SINCE = '2024-01-01';

const MODE_STRUCTURAL_KEYS = Object.freeze([
  'hubMode',
  'hubUrl',
  'secret',
  'hubHostPort',
  'hubHostSecret',
  'deviceId'
]);
const USAGE_STRUCTURAL_KEYS = Object.freeze([
  'clients',
  'allTimeSince',
  'collectionIntervalMs',
  'collectionMode',
  'historyEnabled',
  'historyIntervalMs',
  'sessionUsageArchiveEnabled',
  'projectsEnabled',
  'wslScanEnabled'
]);
const LIMITS_RECONFIGURE_KEYS = Object.freeze([
  'limitsEnabled',
  'limitProviders',
  'limitProviderAutoDetectDisabled',
  'limitsRefreshMode',
  'limitsRefreshMs',
  'opencodeLocalLimitsEnabled'
]);
const SINK_STRUCTURAL_KEYS = Object.freeze(['syncUploadIntervalMs']);
const LIMIT_PROVIDER_SETTING_KEYS = Object.freeze({
  claude: ['claudeWebCookie'],
  opencode: ['opencodeCookie', 'opencodeProfiles', 'opencodeLocalLimitsEnabled'],
  cursor: [],
  antigravity: [],
  openrouter: ['openrouterProfiles'],
  deepseek: ['deepseekApiKey'],
  minimax: ['minimaxApiKey'],
  copilot: ['copilotApiToken', 'copilotEnterpriseHost'],
  zai: ['zaiApiKey', 'zaiApiRegion'],
  zaiteam: ['zaiTeamApiKey', 'zaiTeamOrganizationId', 'zaiTeamProjectId'],
  volcengine: ['volcengineAccessKeyId', 'volcengineSecretAccessKey', 'volcengineRegion'],
  qoder: ['qoderCookie', 'qoderSite'],
  commandcode: ['commandcodeCookie'],
  kimi: ['kimiApiKey', 'kimiWebAccessToken'],
  ollama: ['ollamaCookie'],
  codex: ['codexManagedAccounts'],
  mimo: ['mimoManagedAccounts'],
  thirdparty: ['thirdPartyProfiles'],
  grok: [],
  kiro: []
});

function equalSetting(left, right) {
  if (left === right) return true;
  if ((left === undefined || left === null) && (right === undefined || right === null)) return true;
  try { return JSON.stringify(left) === JSON.stringify(right); }
  catch (_) { return false; }
}

function changedAny(previous, next, keys) {
  return keys.some((key) => !equalSetting(previous?.[key], next?.[key]));
}

function normalizeAllTimeSince(value, fallback = DEFAULT_ALL_TIME_SINCE) {
  const raw = String(value ?? '').trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(raw)) return fallback;
  const date = new Date(`${raw}T00:00:00.000Z`);
  return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === raw ? raw : fallback;
}

function usageConfigFromSettings(settings = {}, context = {}) {
  return {
    clients: clientsCsvForSetting(settings.clients),
    allTimeSince: normalizeAllTimeSince(settings.allTimeSince),
    commandTimeoutMs: Number(context.commandTimeoutMs || 120 * 1000),
    deviceId: settings.deviceId || context.defaultDeviceId,
    agentVersion: context.agentVersion,
    agentRuntime: context.agentRuntime || 'electron-widget',
    intervalMs: context.intervalMs ?? settings.collectionIntervalMs,
    historyEnabled: settings.historyEnabled !== false,
    dailyHistoryArchiveEnabled: settings.sessionUsageArchiveEnabled !== false,
    dailyHistoryArchiveWriteEnabled: context.dailyHistoryArchiveWriteEnabled,
    projectsEnabled: settings.projectsEnabled !== false,
    reasonixNativeSessionsEnabled: context.reasonixNativeSessionsEnabled === true,
    historyIntervalMs: context.historyIntervalMs ?? settings.historyIntervalMs,
    watchEnabled: context.watchEnabled,
    watchUsePolling: context.watchUsePolling,
    watchTriggersCollection: context.watchTriggersCollection !== false,
    intervalRequiresActivity: Boolean(context.intervalRequiresActivity),
    watchDebounceMs: Number(context.watchDebounceMs || 1500),
    wslScanEnabled: settings.wslScanEnabled !== false,
    onError: context.onError,
    logger: context.logger
  };
}

function diagnosticConfigurationFromSettings(settings = {}, context = {}) {
  const usage = usageConfigFromSettings(settings, context.usage || {});
  const limits = limitsConfigFromSettings(settings, context.limits || {});
  return {
    configurationSource: 'effective-normalized',
    allTimeSince: usage.allTimeSince,
    historyEnabled: usage.historyEnabled,
    historyIntervalMs: normalizeHistoryIntervalMs(usage.historyIntervalMs),
    projectsEnabled: usage.projectsEnabled,
    wslScanEnabled: usage.wslScanEnabled,
    syncUploadIntervalMs: normalizeSyncUploadIntervalMs(
      context.syncUploadIntervalMs ?? settings.syncUploadIntervalMs
    ),
    limitsRefreshMode: limits.limitsRefreshMode,
    limitsRefreshMs: limits.limitsRefreshMs
  };
}

function limitsConfigFromSettings(settings = {}, context = {}) {
  return {
    limitsEnabled: settings.limitsEnabled !== false,
    limitProviders: settings.limitProviders ?? context.defaultLimitProviders,
    limitProviderAutoDetectDisabled: parseLimitProviderAutoDetectDisabled(settings.limitProviderAutoDetectDisabled).join(','),
    limitsRefreshMode: normalizeLimitsRefreshMode(settings.limitsRefreshMode),
    limitsRefreshMs: normalizeLimitsRefreshMs(settings.limitsRefreshMs),
    // Keep GUI credentials separate from environment discovery. The provider
    // can still fall back to env when auto-detection is enabled, but a disabled
    // provider must be able to retain only the credential saved in the GUI.
    claudeWebCookie: settings.claudeWebCookie || '',
    claudePrepaidBalanceEnabled: settings.claudePrepaidBalanceEnabled !== false,
    opencodeLocalLimitsEnabled: settings.opencodeLocalLimitsEnabled === true,
    opencodeAmbientEnabled: settings.opencodeAmbientEnabled !== false,
    opencodeCookie: settings.opencodeCookie || '',
    opencodeProfiles: settings.opencodeProfiles || {},
    openrouterProfiles: settings.openrouterProfiles || {},
    deepseekApiKey: settings.deepseekApiKey || '',
    minimaxApiKey: settings.minimaxApiKey || '',
    copilotApiToken: settings.copilotApiToken || '',
    copilotEnterpriseHost: settings.copilotEnterpriseHost || '',
    zaiApiKey: settings.zaiApiKey || '',
    zaiApiRegion: settings.zaiApiRegion || 'global',
    zaiTeamApiKey: settings.zaiTeamApiKey || '',
    zaiTeamOrganizationId: settings.zaiTeamOrganizationId || '',
    zaiTeamProjectId: settings.zaiTeamProjectId || '',
    volcengineAccessKeyId: settings.volcengineAccessKeyId || '',
    volcengineSecretAccessKey: settings.volcengineSecretAccessKey || '',
    volcengineRegion: settings.volcengineRegion || '',
    qoderCookie: settings.qoderCookie || '',
    qoderSite: settings.qoderSite || 'global',
    commandcodeCookie: settings.commandcodeCookie || '',
    kimiApiKey: settings.kimiApiKey || '',
    kimiWebAccessToken: settings.kimiWebAccessToken || '',
    ollamaCookie: settings.ollamaCookie || '',
    cursorManualAccountConfigured: context.cursorManualAccountConfigured === true,
    codexManagedAccounts: context.codexManagedAccounts ?? settings.codexManagedAccounts ?? [],
    mimoManagedAccounts: context.mimoManagedAccounts ?? settings.mimoManagedAccounts ?? [],
    thirdPartyProfiles: settings.thirdPartyProfiles || {}
  };
}

function envelopeFromSettings(settings = {}, context = {}) {
  return {
    deviceId: settings.deviceId || context.defaultDeviceId,
    agentVersion: context.agentVersion,
    agentRuntime: context.agentRuntime || 'electron-widget'
  };
}

function classifySettingsChange(previous = {}, next = {}) {
  const limitScopes = [];
  const previousAutoDetectDisabled = new Set(parseLimitProviderAutoDetectDisabled(previous.limitProviderAutoDetectDisabled));
  const nextAutoDetectDisabled = new Set(parseLimitProviderAutoDetectDisabled(next.limitProviderAutoDetectDisabled));
  for (const [provider, keys] of Object.entries(LIMIT_PROVIDER_SETTING_KEYS)) {
    if (changedAny(previous, next, keys)
      || previousAutoDetectDisabled.has(provider) !== nextAutoDetectDisabled.has(provider)) {
      limitScopes.push({ provider });
    }
  }
  return {
    modeStructural: changedAny(previous, next, MODE_STRUCTURAL_KEYS),
    usageStructural: changedAny(previous, next, USAGE_STRUCTURAL_KEYS),
    limitsReconfigure: changedAny(previous, next, LIMITS_RECONFIGURE_KEYS),
    sinkStructural: changedAny(previous, next, SINK_STRUCTURAL_KEYS),
    limitScopes,
    enabledProviders: parseLimitProviders(next.limitProviders)
  };
}

module.exports = {
  LIMIT_PROVIDER_SETTING_KEYS,
  classifySettingsChange,
  diagnosticConfigurationFromSettings,
  envelopeFromSettings,
  limitsConfigFromSettings,
  normalizeAllTimeSince,
  usageConfigFromSettings
};
