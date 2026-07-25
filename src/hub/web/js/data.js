export const CLIENT_LABELS = {
  claude: 'Claude Code',
  codex: 'Codex',
  hermes: 'Hermes',
  gemini: 'Gemini',
  cursor: 'Cursor',
  opencode: 'OpenCode',
  openclaw: 'OpenClaw',
  antigravity: 'Antigravity',
  cline: 'Cline',
  kimi: 'Kimi',
  qwen: 'Qwen',
  grok: 'Grok',
  copilot: 'GitHub Copilot',
  pi: 'Pi',
  zed: 'Zed',
  kilocode: 'Kilo Code',
  micode: 'MiMo Code',
  zcode: 'ZCode',
  kiro: 'Kiro',
  codebuddy: 'CodeBuddy',
  workbuddy: 'WorkBuddy',
  proma: 'Proma',
  deepseek: 'DeepSeek',
  minimax: 'Minimax',
  mimo: 'MiMo',
  zai: 'GLM',
  zaiteam: 'GLM Team',
  volcengine: 'Volcengine',
  qoder: 'Qoder',
  ollama: 'Ollama',
  doubao: 'Doubao',
  moonshot: 'Moonshot',
  xai: 'xAI',
  meta: 'Meta',
  mistral: 'Mistral',
  cohere: 'Cohere',
  xiaomi: 'Xiaomi'
};

export const CLIENT_COLORS = {
  claude: '#cc7c5e',
  codex: '#49a3b0',
  hermes: '#d4af37',
  gemini: '#4285f4',
  antigravity: '#4285f4',
  cline: '#323B43',
  kimi: '#16191e',
  grok: '#000000',
  copilot: '#000000',
  deepseek: '#4d6bfe',
  cursor: '#000000',
  opencode: '#000000',
  openclaw: '#ff4d4d',
  xai: '#000000',
  meta: '#1d65c1',
  mistral: '#fa520f',
  qwen: '#615ced',
  pi: '#000',
  zed: '#4173e7',
  kilocode: '#F8F676',
  micode: '#000000',
  zcode: '#000000',
  kiro: '#9046FF',
  codebuddy: '#6C4DFF',
  workbuddy: '#0DC8A5',
  proma: '#000000',
  moonshot: '#16191e',
  zai: '#000000',
  zaiteam: '#000000',
  cohere: '#39594d',
  xiaomi: '#ff6700',
  minimax: '#f23f5d',
  doubao: '#1E37FC',
  volcengine: '#006EFF',
  qoder: '#2ADB5C',
  ollama: '#888888',
  default: '#6ab4f0'
};

export const PROVIDER_LABELS = {
  claude: 'Claude Code',
  codex: 'Codex',
  cursor: 'Cursor',
  antigravity: 'Antigravity',
  opencode: 'OpenCode',
  deepseek: 'DeepSeek',
  minimax: 'Minimax',
  mimo: 'MiMo',
  grok: 'Grok',
  copilot: 'GitHub Copilot',
  kiro: 'Kiro',
  zai: 'GLM',
  zaiteam: 'GLM Team',
  volcengine: 'Volcengine',
  qoder: 'Qoder',
  kimi: 'Kimi',
  ollama: 'Ollama'
};

const FALLBACK_MODEL_COLORS = ['#6ab4f0', '#cc7c5e', '#a57df0', '#49a3b0', '#f0d66a', '#f06a7b'];

const ICON_ALIASES = {
  hermes: 'hermes-agent',
  mimo: 'xiaomi',
  micode: 'xiaomi',
  grok: 'grok',
  zai: 'zai',
  zaiteam: 'zai'
};

export function clientLabel(id) {
  return CLIENT_LABELS[id] || id || 'Unknown';
}

export function clientColor(id) {
  return CLIENT_COLORS[id] || CLIENT_COLORS.default;
}

export function clientIconPath(id) {
  const key = ICON_ALIASES[id] || id;
  return `/icons/clients/${key}.svg`;
}

export function modelVendorFor(model) {
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
  if (/doubao|\bseed(?:-|$)/.test(name)) return 'doubao';
  if (/^big-pickle$/.test(name)) return 'opencode';
  return null;
}

export function modelColor(model) {
  const vendor = modelVendorFor(model);
  if (vendor && CLIENT_COLORS[vendor]) return CLIENT_COLORS[vendor];
  const name = String(model || '').toLowerCase();
  let hash = 0;
  for (let i = 0; i < name.length; i += 1) hash = (hash * 31 + name.charCodeAt(i)) | 0;
  return FALLBACK_MODEL_COLORS[Math.abs(hash) % FALLBACK_MODEL_COLORS.length];
}

export function platformLabel(platform) {
  const value = String(platform || '').toLowerCase();
  if (value.includes('darwin') || value.includes('mac')) return 'macOS';
  if (value.includes('win')) return 'Windows';
  if (value.includes('linux')) return 'Linux';
  return platform || '—';
}

export function mapRows(mapTokens = {}, mapCosts = {}, { labelFor, colorFor } = {}) {
  return Object.entries(mapTokens)
    .map(([key, value]) => ({
      key,
      name: labelFor ? labelFor(key) : key,
      value: Number(value || 0),
      cost: Number(mapCosts?.[key] || 0),
      color: colorFor ? colorFor(key) : clientColor(key)
    }))
    .filter((row) => row.value > 0)
    .sort((a, b) => b.value - a.value || a.name.localeCompare(b.name));
}

export function toolRows(period) {
  return mapRows(period?.clients, period?.clientCosts, {
    labelFor: clientLabel,
    colorFor: clientColor
  });
}

export function modelRows(period) {
  return mapRows(period?.models, period?.modelCosts, {
    labelFor: (id) => id,
    colorFor: modelColor
  });
}

export function projectRows(period) {
  return Object.entries(period?.projects || {})
    .map(([key, project]) => ({
      key,
      name: project?.label || key,
      value: Number(project?.tokens || 0),
      cost: Number(project?.costUsd || 0),
      color: CLIENT_COLORS.default,
      sub: Object.keys(project?.clients || {}).map(clientLabel).join(' · ')
    }))
    .filter((row) => row.value > 0)
    .sort((a, b) => b.value - a.value || a.name.localeCompare(b.name));
}

export function sessionRows(period) {
  return Object.entries(period?.sessions || {})
    .map(([key, session]) => {
      const value = Number(session?.totalTokens || 0);
      if (value <= 0) return null;
      const client = session?.client || '';
      const models = Object.keys(session?.models || {});
      return {
        key,
        name: `${clientLabel(client)}${models[0] ? ` · ${models[0]}` : ''}`,
        value,
        cost: Number(session?.costUsd || 0),
        color: clientColor(client),
        client,
        sub: session?.projectLabel || session?.sessionId || key,
        lastUsedAt: session?.lastUsedAt || session?.startedAt || ''
      };
    })
    .filter(Boolean)
    .sort((a, b) => Date.parse(b.lastUsedAt || 0) - Date.parse(a.lastUsedAt || 0) || b.value - a.value);
}

export function deviceRows(stats, periodKey) {
  return (stats?.devices || [])
    .map((device) => {
      const period = device?.periods?.[periodKey] || {};
      return {
        key: device.deviceId,
        name: device.deviceId || device.hostname || 'device',
        value: Number(period.totalTokens || 0),
        cost: Number(period.costUsd || 0),
        color: device.stale ? '#8c97a7' : '#73bdf5',
        stale: Boolean(device.stale),
        platform: device.platform || '',
        updatedAt: device.updatedAt || device.receivedAt || '',
        hostname: device.hostname || ''
      };
    })
    .sort((a, b) => b.value - a.value || a.name.localeCompare(b.name));
}

export function limitCards(stats) {
  const providers = stats?.limits?.providers || [];
  return providers.map((provider, index) => {
    const id = String(provider?.provider || '').toLowerCase();
    const windows = (provider?.windows || []).map((window) => {
      const remaining = Number.isFinite(Number(window.remainingPercent))
        ? Number(window.remainingPercent)
        : (Number.isFinite(Number(window.usedPercent)) ? 100 - Number(window.usedPercent) : null);
      return {
        kind: window.kind || 'window',
        label: window.label || window.kind || 'Window',
        remaining,
        used: remaining == null ? null : 100 - remaining,
        resetsAt: window.resetsAt || '',
        value: window.value || ''
      };
    });
    if (provider?.balance && Number.isFinite(Number(provider.balance.amount))) {
      const amount = Math.max(0, Number(provider.balance.amount || 0));
      const spend = Math.max(0, Number(provider.balance.monthSpend || 0));
      const total = amount + spend;
      windows.push({
        kind: 'balance',
        label: 'Balance',
        remaining: total > 0 ? (amount / total) * 100 : 100,
        used: total > 0 ? (spend / total) * 100 : 0,
        resetsAt: '',
        value: `${amount} ${provider.balance.currency || ''}`.trim()
      });
    }
    const lowest = windows
      .map((window) => window.remaining)
      .filter((value) => value != null)
      .sort((a, b) => a - b)[0];
    return {
      key: `${id}:${provider.accountKey || index}`,
      provider: id,
      name: provider.accountEmail || provider.accountName || PROVIDER_LABELS[id] || id,
      plan: provider.plan || provider.planType || '',
      status: provider.status || 'unknown',
      stale: Boolean(provider.stale),
      color: clientColor(id),
      windows,
      lowestRemaining: lowest ?? 100
    };
  }).sort((a, b) => a.lowestRemaining - b.lowestRemaining || a.name.localeCompare(b.name));
}

export function historyDaily(history, range = 30) {
  const daily = Array.isArray(history?.daily) ? history.daily : [];
  const num = Number(range);
  return Number.isFinite(num) && num > 0 ? daily.slice(-num) : daily.slice();
}
