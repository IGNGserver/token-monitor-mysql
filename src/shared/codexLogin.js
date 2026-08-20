'use strict';

function isAllowedCodexLoginUrl(value) {
  let parsed;
  try {
    parsed = new URL(String(value || ''));
  } catch (_) {
    return false;
  }
  if (parsed.protocol !== 'https:' || parsed.hostname !== 'auth.openai.com') return false;
  return parsed.pathname === '/oauth/authorize'
    || parsed.pathname.startsWith('/oauth/authorize/')
    || parsed.pathname === '/device'
    || parsed.pathname.startsWith('/device/')
    || parsed.pathname === '/codex/device'
    || parsed.pathname.startsWith('/codex/device/');
}

function stripAnsi(value) {
  return String(value || '')
    .replace(/\x1b\][^\x07]*(?:\x07|\x1b\\)/g, '')
    .replace(/\x1b\[[0-?]*[ -/]*[@-~]/g, '')
    .replace(/\x1b[@-_]/g, '');
}

function codexLoginUrlFromOutput(output) {
  const candidates = String(output || '').match(/https:\/\/[^\x00-\x20\x7f<>"']+/gi) || [];
  for (const candidate of candidates) {
    const trimmed = candidate.replace(/[),.;\]]+$/g, '');
    if (!isAllowedCodexLoginUrl(trimmed)) continue;
    try {
      return new URL(trimmed).toString();
    } catch (_) {}
  }
  return '';
}

function codexLoginDeviceCodeFromOutput(output) {
  const text = stripAnsi(output).replace(/\r\n?/g, '\n');
  const match = text.match(
    /(?:one[- ]time code|verification code|device code)[^\n:]*:?\s*([A-Za-z0-9][A-Za-z0-9-]{3,63})/i
  );
  return match?.[1] || '';
}

module.exports = {
  codexLoginDeviceCodeFromOutput,
  codexLoginUrlFromOutput,
  isAllowedCodexLoginUrl
};
