'use strict';

const DEFAULT_CATALOG_URL = 'https://models.dev/api.json';
const DEFAULT_CACHE_MS = 6 * 60 * 60 * 1000;
const DEFAULT_TIMEOUT_MS = 10_000;

function pricingNotFound(modelId) {
  const error = new Error(`No upstream pricing was found for ${modelId}`);
  error.code = 'pricing_not_found';
  return error;
}

function number(value) {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : undefined;
}

function modelIds(modelId) {
  const normalized = String(modelId || '').trim().toLowerCase();
  if (!normalized) return [];
  const ids = [normalized];
  for (const separator of ['/', ':']) {
    const index = normalized.lastIndexOf(separator);
    if (index >= 0 && index < normalized.length - 1) ids.push(normalized.slice(index + 1));
  }
  return [...new Set(ids)];
}

function findModel(catalog, modelId) {
  const ids = modelIds(modelId);
  for (const id of ids) {
    const [providerId, ...modelParts] = id.split('/');
    const providerModelId = modelParts.join('/');
    if (providerModelId && catalog?.[providerId]?.models?.[providerModelId]) {
      return catalog[providerId].models[providerModelId];
    }
  }
  for (const provider of Object.values(catalog || {})) {
    const models = provider?.models;
    if (!models || typeof models !== 'object') continue;
    for (const id of ids) {
      if (models[id]) return models[id];
    }
    for (const model of Object.values(models)) {
      if (ids.includes(String(model?.id || '').trim().toLowerCase())) return model;
    }
  }
  return null;
}

function catalogPricing(modelId, catalog) {
  const model = findModel(catalog, modelId);
  const cost = model?.cost;
  const input = number(cost?.input);
  const output = number(cost?.output);
  if (input === undefined && output === undefined) throw pricingNotFound(modelId);
  return {
    pricing: {
      inputCostPerToken: (input ?? 0) / 1_000_000,
      outputCostPerToken: (output ?? 0) / 1_000_000,
      cacheReadInputTokenCost: (number(cost?.cache_read) ?? 0) / 1_000_000,
      cacheCreationInputTokenCost: (number(cost?.cache_write) ?? 0) / 1_000_000
    }
  };
}

function createCatalogPricingLookup({
  fetchFn = globalThis.fetch,
  url = process.env.TOKSCALE_PRICING_CATALOG_URL || DEFAULT_CATALOG_URL,
  cacheMs = DEFAULT_CACHE_MS,
  timeoutMs = DEFAULT_TIMEOUT_MS,
  now = () => Date.now()
} = {}) {
  let cachedCatalog = null;
  let cachedAt = 0;
  let inFlight = null;

  async function catalog() {
    if (cachedCatalog && now() - cachedAt < cacheMs) return cachedCatalog;
    if (!inFlight) {
      inFlight = (async () => {
        const response = await fetchFn(url, { signal: AbortSignal.timeout(timeoutMs) });
        if (!response?.ok) throw new Error(`Pricing catalog request failed with HTTP ${response?.status || 'unknown'}`);
        const body = await response.json();
        if (!body || typeof body !== 'object') throw new Error('Pricing catalog response was not an object');
        cachedCatalog = body;
        cachedAt = now();
        return body;
      })().finally(() => { inFlight = null; });
    }
    return inFlight;
  }

  return async (modelId) => catalogPricing(modelId, await catalog());
}

module.exports = { catalogPricing, createCatalogPricingLookup, pricingNotFound };
