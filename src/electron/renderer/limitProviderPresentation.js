'use strict';

(function exposeLimitProviderPresentation(root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) root.TokenMonitorLimitProviderPresentation = api;
})(typeof window !== 'undefined' ? window : null, function createLimitProviderPresentationApi() {
  const SOURCE_LABELS = {
    oauth: 'OAuth',
    cli: 'CLI',
    web: 'Web',
    rpc: 'CLI RPC',
    local: 'Local'
  };

  const PROVIDER_SOURCE_LABELS = {
    claude: { oauth: 'OAuth', cli: 'CLI' },
    codex: { rpc: 'CLI RPC' },
    cursor: { web: 'Web' },
    antigravity: { rpc: 'RPC' },
    opencode: { local: 'Local', web: 'Zen' }
  };

  const CAPABILITY_TAGS = {
    claude: ['Auto', 'OAuth/CLI'],
    codex: ['Auto', 'CLI RPC'],
    cursor: ['Manual login', 'Web'],
    antigravity: ['App must be open', 'RPC'],
    opencode: ['Local/Zen', 'Manual login']
  };

  function normalizeId(value) {
    return String(value || '').trim().toLowerCase();
  }

  function providerId(value) {
    return normalizeId(typeof value === 'object' && value ? value.provider : value);
  }

  function sourceId(value, fallback = '') {
    return normalizeId(typeof value === 'object' && value ? (value.source || fallback) : (value || fallback));
  }

  function deviceKey(value) {
    return String(value || '').trim().toLowerCase();
  }

  function deviceLabel(deviceOrId) {
    if (typeof deviceOrId === 'string') return deviceOrId.trim();
    const id = String(deviceOrId?.deviceId || '').trim();
    if (id) return id;
    return String(deviceOrId?.hostname || '').trim();
  }

  function statusId(provider, fallback = '') {
    return String(provider?.status || fallback).trim();
  }

  function limitProviderSourceLabel(providerOrId, sourceFallback = '') {
    const provider = providerId(providerOrId);
    const source = sourceId(providerOrId, sourceFallback);
    return PROVIDER_SOURCE_LABELS[provider]?.[source] || SOURCE_LABELS[source] || '';
  }

  function limitProviderCapabilityTags(providerOrId) {
    return (CAPABILITY_TAGS[providerId(providerOrId)] || []).slice();
  }

  function isLinkedStatus(provider) {
    const providerName = providerId(provider);
    const source = sourceId(provider);
    return providerName === 'cursor' || (providerName === 'opencode' && source === 'web');
  }

  function limitProviderStatusLabel(provider = {}) {
    const providerName = providerId(provider);
    const status = statusId(provider);

    if (provider?.stale) return { label: 'Stale', tone: 'stale' };
    if (status === 'ok') return { label: isLinkedStatus(provider) ? 'Linked' : 'Live', tone: 'ok' };
    if (status === 'disabled') return { label: 'Disabled', tone: 'muted' };
    if (status === 'noSyncedData') return { label: 'No synced data', tone: 'sync' };
    if (status === 'unauthorized') return { label: 'Sign in again', tone: 'setup' };
    if (status === 'rateLimited') return { label: 'Limited', tone: 'warn' };
    if (status === 'sourceRateLimited') return { label: 'Usage API limited', tone: 'warn' };
    if (status === 'unavailable') return { label: 'Unavailable', tone: 'warn' };
    if (status === 'notConfigured') {
      if (providerName === 'antigravity') return { label: 'Open app', tone: 'setup' };
      if (providerName === 'cursor') return { label: 'Sign in', tone: 'setup' };
      return { label: 'Not set up', tone: 'setup' };
    }
    return status ? { label: 'Error', tone: 'warn' } : null;
  }

  function usableProviderCandidate(provider) {
    const status = statusId(provider);
    return status !== 'disabled' && status !== 'notConfigured';
  }

  function deviceProviderCandidate(device, providerName) {
    const providers = Array.isArray(device?.limits?.providers) ? device.limits.providers : [];
    return providers.find((provider) => providerId(provider) === providerName && usableProviderCandidate(provider)) || null;
  }

  function limitProviderProvenance(providerOrId, options = {}) {
    const provider = typeof providerOrId === 'object' && providerOrId ? providerOrId : { provider: providerOrId };
    const providerName = providerId(provider);
    const localKey = deviceKey(options.localDeviceId);
    const selectedKey = deviceKey(provider?.sourceDeviceId);
    const devices = Array.isArray(options.devices) ? options.devices : [];
    const selectedDevice = devices.find((device) => deviceKey(device?.deviceId) === selectedKey) || null;
    const candidates = devices.filter((device) => deviceProviderCandidate(device, providerName));
    const localCandidate = candidates.find((device) => localKey && deviceKey(device?.deviceId) === localKey) || null;
    const remoteCandidates = candidates.filter((device) => !localKey || deviceKey(device?.deviceId) !== localKey);
    const selectedIsLocal = Boolean(selectedKey && localKey && selectedKey === localKey);
    const selectedIsRemote = Boolean(selectedKey && localKey && selectedKey !== localKey);

    return {
      syncActive: Boolean(options.syncActive),
      selectedDeviceId: selectedKey,
      selectedDeviceLabel: deviceLabel(selectedDevice) || String(provider?.sourceDeviceId || '').trim(),
      selectedIsLocal,
      selectedIsRemote,
      hasLocalCandidate: Boolean(localCandidate),
      remoteCount: remoteCandidates.length,
      candidateCount: candidates.length
    };
  }

  function limitProviderProvenanceTags(provenance) {
    if (!provenance?.syncActive) return [];
    if (provenance.selectedIsRemote && provenance.selectedDeviceLabel) {
      const tags = [{
        key: 'settings.limits.device.from',
        values: { device: provenance.selectedDeviceLabel },
        deviceLabel: provenance.selectedDeviceLabel,
        kind: 'device',
        tone: 'remote'
      }];
      if (provenance.hasLocalCandidate) {
        tags.push({ key: 'settings.limits.device.localAlso', kind: 'device', tone: 'multi' });
      }
      return tags;
    }
    if (provenance.selectedIsLocal) {
      if (provenance.remoteCount > 0) {
        return [{
          key: 'settings.limits.device.localAndSynced',
          values: { count: provenance.remoteCount },
          count: provenance.remoteCount,
          kind: 'device',
          tone: 'multi'
        }];
      }
      return [{ key: 'settings.limits.device.local', kind: 'device', tone: 'local' }];
    }
    return [];
  }

  function limitProviderMainDeviceLabel(provenance) {
    if (!provenance?.syncActive || !provenance.selectedIsRemote) return '';
    return provenance.selectedDeviceLabel || '';
  }

  function limitProviderSettingsTags(providerOrId, provenance = null) {
    const tags = [];
    const provider = typeof providerOrId === 'object' && providerOrId ? providerOrId : { provider: providerOrId };
    const status = limitProviderStatusLabel(provider);
    if (status) tags.push({ ...status, kind: 'status' });
    if (status && (provider.status === 'ok' || provider.stale)) {
      const sourceLabel = limitProviderSourceLabel(provider);
      if (sourceLabel) tags.push({ label: sourceLabel, kind: 'source' });
      tags.push(...limitProviderProvenanceTags(provenance));
      return tags;
    }
    for (const label of limitProviderCapabilityTags(provider)) {
      tags.push({ label, kind: 'capability' });
    }
    return tags;
  }

  return {
    limitProviderCapabilityTags,
    limitProviderMainDeviceLabel,
    limitProviderProvenance,
    limitProviderSettingsTags
  };
});
