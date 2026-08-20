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

const CODEX_DEVICE_CODE_PATTERN = /\b[A-Za-z0-9]{9}\b|\b[A-Za-z0-9]{1,8}-[A-Za-z0-9]{1,8}\b/g;

function findCodexDeviceCode(value) {
  const candidates = String(value || '').match(CODEX_DEVICE_CODE_PATTERN) || [];
  for (const candidate of candidates) {
    if (candidate.replace('-', '').length === 9) return candidate;
  }
  return '';
}

function codexLoginDeviceCodeFromOutput(output) {
  const text = stripAnsi(output).replace(/\r\n?/g, '\n');
  const labelPattern = /(?:one[- ]time code|verification code|device code)\b/gi;
  let labelMatch;

  while ((labelMatch = labelPattern.exec(text))) {
    // The CLI may print the code on the same line or on one of the next few
    // lines. Keep the search local to the prompt so URLs and other output
    // cannot be mistaken for a device code.
    const prompt = text.slice(labelMatch.index + labelMatch[0].length)
      .split('\n')
      .slice(0, 4)
      .join('\n');
    const code = findCodexDeviceCode(prompt);
    if (code) return code;
  }

  return '';
}

module.exports = {
  codexLoginDeviceCodeFromOutput,
  codexLoginUrlFromOutput,
  isAllowedCodexLoginUrl
};
