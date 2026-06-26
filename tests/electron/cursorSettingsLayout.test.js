'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const rendererDir = path.join(__dirname, '..', '..', 'src', 'electron', 'renderer');

function readRendererFile(name) {
  return fs.readFileSync(path.join(rendererDir, name), 'utf8');
}

function cssRule(source, selector) {
  const escaped = selector.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const match = source.match(new RegExp(`${escaped}\\s*\\{([^}]*)\\}`));
  assert.ok(match, `${selector} rule should exist`);
  return match[1];
}

function declaration(rule, property) {
  const escaped = property.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const match = rule.match(new RegExp(`${escaped}\\s*:\\s*([^;]+);`));
  return match?.[1].trim() || '';
}

function functionBody(source, name, nextName) {
  const start = source.indexOf(`function ${name}(`);
  assert.notEqual(start, -1, `${name} function should exist`);
  const end = source.indexOf(`function ${nextName}(`, start);
  assert.notEqual(end, -1, `${nextName} function should follow ${name}`);
  return source.slice(start, end);
}

function functionBodyBeforeMarker(source, name, marker) {
  const start = source.indexOf(`function ${name}(`);
  assert.notEqual(start, -1, `${name} function should exist`);
  const end = source.indexOf(marker, start);
  assert.notEqual(end, -1, `${marker} marker should follow ${name}`);
  return source.slice(start, end);
}

test('Cursor account status stays inline with an email-only summary', () => {
  const html = readRendererFile('index.html');
  const toggle = html.match(/<button id="cursorSettingsToggle"[\s\S]*?<\/button>/)?.[0] || '';
  assert.match(
    toggle,
    /<span data-i18n="settings\.cursor\.title"[\s\S]*?<\/span>\s*<span class="cursor-settings-summary">[\s\S]*?<span id="cursorAccountStatus"[\s\S]*?<\/span>\s*<span class="cursor-disclosure-icon"/,
    'status pill and disclosure icon should stay on the title row'
  );
  assert.match(
    toggle,
    /<span class="cursor-disclosure-icon" aria-hidden="true"><\/span>/,
    'CSS chevron should not render on top of a text arrow'
  );

  const css = readRendererFile('styles.css');
  const toggleRule = cssRule(css, '.cursor-settings-toggle');
  assert.equal(declaration(toggleRule, 'flex-wrap'), '');

  const summaryRule = cssRule(css, '.settings-group-header .cursor-settings-summary');
  assert.equal(declaration(summaryRule, 'max-width'), '58%');

  const pillRule = cssRule(css, '.cursor-status-pill');
  assert.equal(declaration(pillRule, 'white-space'), 'nowrap');
  assert.equal(declaration(pillRule, 'overflow-wrap'), '');

  const iconRule = cssRule(css, '.cursor-disclosure-icon');
  assert.equal(declaration(iconRule, 'display'), 'inline-grid');
  assert.equal(declaration(iconRule, 'place-items'), 'center');
  assert.equal(declaration(iconRule, 'height'), '12px');
  assert.equal(declaration(iconRule, 'transform-origin'), 'center');
  assert.equal(declaration(iconRule, 'transform'), '');

  const expandedRule = cssRule(css, '.cursor-account-group.expanded .cursor-disclosure-icon');
  assert.equal(declaration(expandedRule, 'transform'), 'rotate(180deg)');
});

test('Cursor account header omits plan and reset details', () => {
  const body = functionBody(readRendererFile('app.js'), 'renderCursorStatus', 'refreshCursorStatus');
  assert.match(body, /const summary = status\.email \|\| t\('settings\.cursor\.loggedIn'\);/);
  assert.match(body, /setCursorStatusText\(statusEl, summary\);/);
  assert.doesNotMatch(body, /membershipType|billingCycleEnd|billingResets/);
});

test('OpenCode account panel provides multi-profile management', () => {
  const html = readRendererFile('index.html');
  const details = html.match(/<div id="opencodeSettingsDetails"[\s\S]*?<div id="opencodeErrorMessage" class="settings-note error hidden"><\/div>/)?.[0] || '';
  assert.match(details, /<div id="opencodeProfileList" class="opencode-profile-list"><\/div>/);
  assert.match(details, /<div id="opencodeAddForm" class="opencode-add-form">/);
  assert.match(details, /<button id="opencodeAddToggle" class="opencode-add-summary" type="button" aria-expanded="false" aria-controls="opencodeAddDetails">/);
  assert.match(details, /<div id="opencodeAddDetails" class="opencode-add-details accordion-animated-container hidden">/);
  assert.match(details, /<span data-i18n="settings\.opencode\.addProfile"/);
  assert.match(details, /<input id="opencodeProfileName" type="text"[\s\S]*data-i18n-placeholder="settings\.opencode\.profileNamePlaceholder"/);
  assert.match(details, /<textarea id="opencodeCookieInput"[\s\S]*placeholder="auth=\.\.\."><\/textarea>/);
  assert.match(details, /<div class="settings-actions">\s*<button id="opencodeCookieSubmit" data-i18n="settings\.opencode\.saveProfile">/);
  assert.match(details, /<div id="opencodeErrorMessage" class="settings-note error hidden"><\/div>/);

  const app = readRendererFile('app.js');
  assert.match(app, /function renderOpenCodeProfiles\(\)/);
  assert.match(app, /function updateOpenCodeProfilesStatus\(\)/);
  assert.match(app, /function renderOpenCodeAccountGroup\(/);
  assert.match(app, /function setOpencodeCookieExpanded\(/);

  const setupBody = functionBodyBeforeMarker(app, 'setupCursorAccountUI', '\nsetupCursorAccountUI();');
  assert.match(setupBody, /document\.getElementById\('opencodeAddToggle'\)/);
  assert.match(setupBody, /addDetails\?\.classList\.toggle\('hidden'/);
  assert.match(setupBody, /window\.tokenMonitor\.opencode\.saveProfile\(/);
  assert.match(setupBody, /renderOpenCodeProfiles\(\)/);
  assert.match(setupBody, /updateOpenCodeProfilesStatus\(\)/);
});

test('DeepSeek account panel provides a first-class API key entry', () => {
  const html = readRendererFile('index.html');
  const details = html.match(/<div id="deepseekSettingsDetails"[\s\S]*?<div id="deepseekErrorMessage" class="settings-note error hidden"><\/div>/)?.[0] || '';
  assert.match(details, /<button id="deepseekOpenBrowser"[\s\S]*data-i18n="settings\.deepseek\.openBrowser">/);
  assert.match(details, /<button id="deepseekLogoutButton" class="hidden" data-i18n="settings\.deepseek\.clearApiKey">/);
  assert.match(details, /<input id="deepseekApiKeyInput" type="password"[\s\S]*data-i18n-placeholder="settings\.deepseek\.apiKeyPlaceholder"/);
  assert.match(details, /<button id="deepseekApiKeySubmit"[\s\S]*data-i18n="settings\.deepseek\.saveApiKey">/);

  const app = readRendererFile('app.js');
  const setupBody = functionBodyBeforeMarker(app, 'setupCursorAccountUI', '\nsetupCursorAccountUI();');
  assert.match(setupBody, /window\.tokenMonitor\.openExternal\('https:\/\/platform\.deepseek\.com\/api_keys'\)/);
  assert.match(setupBody, /saveSettings\(\{ deepseekApiKey: input\.value \}\)/);
  assert.match(setupBody, /saveSettings\(\{ deepseekApiKey: '' \}\)/);
  assert.match(setupBody, /refreshStats\(\{ force: true \}\)/);
  const renderBody = functionBody(app, 'renderDeepseekStatus', 'renderOpenCodeProfiles');
  assert.match(renderBody, /const openBtn = document\.getElementById\('deepseekOpenBrowser'\);/);
  assert.match(renderBody, /const linked = deepseekAccountLinked\(\);/);
  assert.match(renderBody, /manualPanel\.classList\.toggle\('hidden', linked\)/);
  assert.match(renderBody, /openBtn\.classList\.toggle\('hidden', linked\)/);
  assert.match(renderBody, /logoutBtn\.classList\.toggle\('hidden', !linked \|\| source !== 'settings'\)/);
  assert.match(renderBody, /refreshBtn\.classList\.toggle\('hidden', !configured\)/);
});

test('MiniMax key entry shares DeepSeek styling and Copilot uses the folded token entry', () => {
  const app = readRendererFile('app.js');
  const css = readRendererFile('styles.css');

  const animationBody = functionBodyBeforeMarker(app, 'initSettingsAnimationWrappers', '\ninitSettingsAnimationWrappers();');
  assert.match(animationBody, /'#deepseekManualPanel',\n\s*'#minimaxManualPanel'/);
  assert.doesNotMatch(animationBody, /'#copilotManualPanel'/);

  assert.match(css, /#deepseekManualPanel\.hidden,\n#minimaxManualPanel\.hidden,/);
  assert.match(css, /#minimaxManualPanel\.hidden,\n#copilotManualPanel\.hidden,/);
  assert.match(css, /#copilotManualPanel\.hidden,\n#copilotManualDetails\.hidden,/);
  assert.match(css, /#deepseekErrorMessage\.hidden,\n#minimaxErrorMessage\.hidden,\n#copilotErrorMessage\.hidden,/);
  assert.match(css, /#deepseekManualPanel,\n#minimaxManualPanel,\n#copilotManualPanel\s*\{\n\s*min-width: 0;/);
  assert.match(css, /#deepseekManualPanel > \.accordion-animation-inner,\n#minimaxManualPanel > \.accordion-animation-inner\s*\{\n\s*display: grid;/);
  assert.doesNotMatch(css, /#copilotManualPanel > \.accordion-animation-inner/);
  assert.match(css, /#deepseekManualPanel input,\n#minimaxManualPanel input,\n#copilotManualDetails input\s*\{[\s\S]*?font-family: monospace;[\s\S]*?font-size: 12px;/);
});

test('Copilot account panel provides GitHub sign-in plus manual token fallback', () => {
  const html = readRendererFile('index.html');
  const details = html.match(/<div id="copilotSettingsDetails"[\s\S]*?<div id="copilotErrorMessage" class="settings-note error hidden"><\/div>/)?.[0] || '';
  assert.match(details, /<button id="copilotSignInButton"[\s\S]*data-i18n="settings\.copilot\.signIn">/);
  assert.match(details, /<button id="copilotCancelSignInButton" class="hidden" data-i18n="settings\.common\.cancel">/);
  assert.match(details, /<button id="copilotLogoutButton" class="hidden" data-i18n="settings\.copilot\.logout">/);
  assert.match(details, /<pre id="copilotLoginStatus" class="codex-login-output hidden"><\/pre>/);
  assert.match(details, /<button id="copilotManualToggle"[\s\S]*aria-controls="copilotManualDetails"/);
  assert.match(details, /<div id="copilotManualDetails" class="opencode-add-details accordion-animated-container hidden">/);
  assert.match(details, /<input id="copilotApiTokenInput" type="password"[\s\S]*data-i18n-placeholder="settings\.copilot\.apiTokenPlaceholder"/);
  assert.match(details, /<button id="copilotApiTokenSubmit"[\s\S]*data-i18n="settings\.copilot\.saveToken">/);

  const app = readRendererFile('app.js');
  const setupBody = functionBodyBeforeMarker(app, 'setupCursorAccountUI', '\nsetupCursorAccountUI();');
  assert.match(setupBody, /const flowId = nextCopilotSignInFlowId\(\);/);
  assert.match(setupBody, /state\.copilotSignInFlowId = flowId;/);
  assert.match(setupBody, /window\.tokenMonitor\.copilot\.signIn\(\{ flowId \}\)/);
  assert.match(setupBody, /isCurrentCopilotSignInFlow\(status\.flowId\)/);
  assert.match(setupBody, /isCurrentCopilotSignInFlow\(result\?\.flowId \|\| flowId\)/);
  assert.match(setupBody, /window\.tokenMonitor\.copilot\.cancelSignIn\(\{ flowId \}\)/);
  assert.match(setupBody, /state\.copilotSignInFlowId = '';/);
  assert.match(setupBody, /state\.copilotSignInCancelable = true;/);
  assert.match(setupBody, /status\.phase === 'success'[\s\S]*?state\.copilotSignInCancelable = false;/);
  assert.match(setupBody, /state\.copilotAuthorizeMessage = t\('settings\.copilot\.authorize'/);
  assert.match(setupBody, /\[state\.copilotAuthorizeMessage, t\('settings\.copilot\.polling'\)\]\.filter\(Boolean\)\.join\('\\n\\n'\)/);
  assert.match(setupBody, /setCopilotManualExpanded\(false\)/);
  assert.match(setupBody, /saveSettings\(\{ copilotApiToken: input\.value \}\)/);
  assert.match(setupBody, /saveSettings\(\{ copilotApiToken: '' \}\)/);

  const renderBody = functionBody(app, 'renderCopilotStatus', 'renderDeepseekStatus');
  assert.match(renderBody, /cancelBtn\.classList\.toggle\('hidden', !state\.copilotSignInBusy \|\| !state\.copilotSignInCancelable \|\| linked\)/);
  assert.match(renderBody, /refreshBtn\.classList\.toggle\('hidden', !configured \|\| \(state\.copilotSignInBusy && !linked\)\)/);
  assert.match(renderBody, /errorEl\.textContent = state\.copilotErrorMessage \|\| '';/);
  assert.doesNotMatch(renderBody, /errorEl\.textContent = '';/);

  const statusBody = functionBody(app, 'copilotAccountStatusText', 'apiKeyAccountStatusText');
  assert.match(statusBody, /provider\?\.accountName/);
  assert.match(statusBody, /settings\.copilot\.statusSet/);

  const flowBody = functionBody(app, 'isCurrentCopilotSignInFlow', 'copilotAccountStatusText');
  assert.match(flowBody, /const current = String\(state\.copilotSignInFlowId \|\| ''\);/);
  assert.match(flowBody, /const incoming = String\(flowId \|\| ''\);/);
  assert.match(flowBody, /return current && incoming === current;/);
});

test('DeepSeek account linked state requires a validated API key', () => {
  const app = readRendererFile('app.js');
  const summaryBody = functionBody(app, 'settingsSectionSummary', 'renderSettingsSummaries');
  assert.match(summaryBody, /const deepseekLinked = deepseekAccountLinked\(\);/);
  assert.doesNotMatch(
    summaryBody,
    /const deepseekLinked = Boolean\(state\.settings\?\.deepseekApiKeyConfigured\);/,
    'the account summary should not count an unverified stored API key as linked'
  );

  const linkedBody = functionBody(app, 'deepseekAccountLinked', 'deepseekProviderStatus');
  assert.match(linkedBody, /Boolean\(state\.settings\?\.deepseekApiKeyConfigured\)/);
  assert.match(linkedBody, /deepseekProviderForAccount\(\)/);
  assert.match(linkedBody, /provider\?\.status === 'ok'/);

  const renderBody = functionBody(app, 'renderDeepseekStatus', 'renderOpenCodeProfiles');
  assert.match(renderBody, /const configured = Boolean\(state\.settings\?\.deepseekApiKeyConfigured\);/);
  assert.match(renderBody, /apiKeyAccountStatusText\('deepseek', provider, configured, source\)/);
});

test('DeepSeek key changes invalidate stale provider status before re-checking', () => {
  const app = readRendererFile('app.js');
  const setupBody = functionBodyBeforeMarker(app, 'setupCursorAccountUI', '\nsetupCursorAccountUI();');
  assert.match(setupBody, /markDeepseekKeyCheckPending\(\);[\s\S]*await saveSettings\(\{ deepseekApiKey: input\.value \}\);[\s\S]*renderDeepseekStatus\(\);[\s\S]*await refreshStats\(\{ force: true \}\);/);
  assert.match(setupBody, /await saveSettings\(\{ deepseekApiKey: '' \}\);[\s\S]*clearDeepseekPendingCheck\(\);[\s\S]*clearDeepseekProviderStatus\(\);[\s\S]*renderDeepseekStatus\(\);/);

  const pendingBody = functionBody(app, 'markDeepseekKeyCheckPending', 'clearDeepseekPendingCheck');
  assert.match(pendingBody, /state\.deepseekPendingCheckSince = Date\.now\(\);/);
  assert.match(pendingBody, /clearDeepseekProviderStatus\(\);/);

  const providerBody = functionBody(app, 'deepseekProviderForAccount', 'markDeepseekKeyCheckPending');
  assert.match(providerBody, /const pendingSince = Number\(state\.deepseekPendingCheckSince \|\| 0\);/);
  assert.match(providerBody, /Date\.parse\(provider\.updatedAt \|\| ''\)/);
  assert.match(providerBody, /updatedAt < pendingSince/);
  assert.match(providerBody, /state\.deepseekPendingCheckSince = 0;/);

  const clearBody = functionBody(app, 'clearDeepseekProviderStatus', 'renderDeepseekStatus');
  assert.match(clearBody, /state\.stats\.limits\.providers = state\.stats\.limits\.providers\.filter/);
  assert.match(clearBody, /provider\.provider !== 'deepseek'/);
});

test('MiniMax key changes invalidate stale provider status before re-checking', () => {
  const app = readRendererFile('app.js');
  const setupBody = functionBodyBeforeMarker(app, 'setupCursorAccountUI', '\nsetupCursorAccountUI();');
  assert.match(setupBody, /markMinimaxKeyCheckPending\(\);[\s\S]*await saveSettings\(\{ minimaxApiKey: input\.value \}\);[\s\S]*renderMinimaxStatus\(\);[\s\S]*await refreshStats\(\{ force: true \}\);/);
  assert.match(setupBody, /await saveSettings\(\{ minimaxApiKey: '' \}\);[\s\S]*clearMinimaxPendingCheck\(\);[\s\S]*clearMinimaxProviderStatus\(\);[\s\S]*renderMinimaxStatus\(\);/);

  const linkedBody = functionBody(app, 'minimaxAccountLinked', 'apiKeyAccountStatusText');
  assert.match(linkedBody, /minimaxProviderForAccount\(\)/);

  const renderBody = functionBody(app, 'renderMinimaxStatus', 'renderDeepseekStatus');
  assert.match(renderBody, /const provider = minimaxProviderForAccount\(\);/);

  const pendingBody = functionBody(app, 'markMinimaxKeyCheckPending', 'clearMinimaxPendingCheck');
  assert.match(pendingBody, /state\.minimaxPendingCheckSince = Date\.now\(\);/);
  assert.match(pendingBody, /clearMinimaxProviderStatus\(\);/);

  const providerBody = functionBody(app, 'minimaxProviderForAccount', 'markMinimaxKeyCheckPending');
  assert.match(providerBody, /const pendingSince = Number\(state\.minimaxPendingCheckSince \|\| 0\);/);
  assert.match(providerBody, /Date\.parse\(provider\.updatedAt \|\| ''\)/);
  assert.match(providerBody, /updatedAt < pendingSince/);
  assert.match(providerBody, /state\.minimaxPendingCheckSince = 0;/);

  const clearBody = functionBody(app, 'clearMinimaxProviderStatus', 'apiKeyAccountStatusText');
  assert.match(clearBody, /state\.stats\.limits\.providers = state\.stats\.limits\.providers\.filter/);
  assert.match(clearBody, /provider\.provider !== 'minimax'/);
});

test('DeepSeek account copy says browser and external URL is allowlisted', () => {
  const html = readRendererFile('index.html');
  const details = html.match(/<div id="deepseekSettingsDetails"[\s\S]*?<div id="deepseekErrorMessage" class="settings-note error hidden"><\/div>/)?.[0] || '';
  assert.match(details, /<button id="deepseekOpenBrowser"[\s\S]*data-i18n="settings\.deepseek\.openBrowser">/);

  const i18n = readRendererFile('i18n.js');
  assert.match(i18n, /'settings\.deepseek\.openBrowser': 'Open DeepSeek API keys in browser'/);
  assert.match(i18n, /'settings\.deepseek\.openBrowser': '在瀏覽器開啟 DeepSeek API 金鑰'/);
  assert.match(i18n, /'settings\.deepseek\.openBrowser': '在浏览器打开 DeepSeek API 密钥'/);

  const main = fs.readFileSync(path.join(__dirname, '..', '..', 'src', 'electron', 'main.js'), 'utf8');
  const allowlist = functionBody(main, 'isAllowedExternalUrl', 'revealWindow');
  assert.match(allowlist, /parsed\.hostname === 'platform\.deepseek\.com'/);

  const app = readRendererFile('app.js');
  const setupBody = functionBodyBeforeMarker(app, 'setupCursorAccountUI', '\nsetupCursorAccountUI();');
  assert.match(setupBody, /window\.tokenMonitor\.openExternal\('https:\/\/platform\.deepseek\.com\/api_keys'\)/);
});

test('opencode status env account avoids saved profile names', () => {
  const main = fs.readFileSync(path.join(__dirname, '..', '..', 'src', 'electron', 'main.js'), 'utf8');
  const handler = main.slice(
    main.indexOf("ipcMain.handle('opencode:status'"),
    main.indexOf("ipcMain.handle('opencode:getProfiles'")
  );
  assert.ok(handler, 'opencode:status handler should exist');
  assert.match(handler, /hasOwnProperty\.call\(profiles, envKey\)/);
  assert.doesNotMatch(handler, /hasOwnProperty\.call\(result, envKey\)/);
});

test('settingsForRenderer strips OpenCode cookies before they reach the renderer', () => {
  const main = fs.readFileSync(path.join(__dirname, '..', '..', 'src', 'electron', 'main.js'), 'utf8');
  const body = main.slice(
    main.indexOf('function settingsForRenderer'),
    main.indexOf('function pushSettingsToRenderer')
  );
  assert.ok(body, 'settingsForRenderer should exist');
  // The raw OpenCode cookie must be reduced to a presence flag, never forwarded verbatim.
  assert.match(body, /opencodeCookie:[^,}]*\?\s*'set'\s*:\s*''/);
  // Multi-account profile cookies are redacted the same way.
  assert.match(body, /opencodeProfiles: redactOpencodeProfilesForRenderer\(/);
});
