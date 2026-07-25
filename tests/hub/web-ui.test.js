'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const {
  normalizeRequestPath,
  resolveWebFile,
  resolveStaticAsset,
  tryServeStatic,
  DEFAULT_WEB_ROOT
} = require('../../src/hub/static');
const { createHub } = require('../../src/hub/server');
const { MemoryRepository } = require('./memory-repository');

test('normalizeRequestPath blocks traversal and keeps root', () => {
  assert.equal(normalizeRequestPath('/'), '/');
  assert.equal(normalizeRequestPath('/css/app.css'), '/css/app.css');
  assert.equal(normalizeRequestPath('/../secret'), null);
  assert.equal(normalizeRequestPath('/foo/../../etc/passwd'), null);
});

test('resolveWebFile stays inside the web root', () => {
  const file = resolveWebFile(DEFAULT_WEB_ROOT, '/index.html');
  assert.equal(file, path.join(DEFAULT_WEB_ROOT, 'index.html'));
  assert.equal(resolveWebFile(DEFAULT_WEB_ROOT, '/../server.js'), null);
});

test('resolveStaticAsset serves the SPA shell and real assets', async () => {
  const index = await resolveStaticAsset(DEFAULT_WEB_ROOT, '/');
  assert.ok(index);
  assert.equal(path.basename(index.filePath), 'index.html');

  const css = await resolveStaticAsset(DEFAULT_WEB_ROOT, '/css/app.css');
  assert.ok(css);
  assert.equal(path.basename(css.filePath), 'app.css');

  const spa = await resolveStaticAsset(DEFAULT_WEB_ROOT, '/devices');
  assert.ok(spa);
  assert.equal(path.basename(spa.filePath), 'index.html');
});

test('hub serves the web UI on the same port without a secret', async () => {
  const hub = createHub({
    port: 0,
    host: '127.0.0.1',
    secret: '',
    repository: new MemoryRepository(),
    logger: { error() {}, warn() {} }
  });
  await hub.start();
  try {
    const { port } = hub.server.address();
    const base = `http://127.0.0.1:${port}`;

    const home = await fetch(`${base}/`);
    assert.equal(home.status, 200);
    assert.match(home.headers.get('content-type') || '', /text\/html/);
    const html = await home.text();
    assert.match(html, /Token Monitor/);
    assert.match(html, /manifest\.webmanifest/);

    const manifest = await fetch(`${base}/manifest.webmanifest`);
    assert.equal(manifest.status, 200);
    assert.match(manifest.headers.get('content-type') || '', /manifest|json/);
    const body = await manifest.json();
    assert.equal(body.name, 'Token Monitor');
    assert.equal(body.display, 'standalone');

    const sw = await fetch(`${base}/sw.js`);
    assert.equal(sw.status, 200);
    assert.match(sw.headers.get('content-type') || '', /javascript/);
    assert.ok((await sw.text()).length > 0);

    const icon = await fetch(`${base}/icons/icon-192.png`);
    assert.equal(icon.status, 200);
    assert.match(icon.headers.get('content-type') || '', /image\/png/);
    assert.ok((await icon.arrayBuffer()).byteLength > 0);

    const css = await fetch(`${base}/css/app.css`);
    assert.equal(css.status, 200);
    assert.ok((await css.text()).length > 0);

    const appJs = await fetch(`${base}/js/app.js`);
    assert.equal(appJs.status, 200);
    assert.match(await appJs.text(), /openStatsStream|serviceWorker/);

    // API routes remain JSON and still work beside the UI.
    const health = await (await fetch(`${base}/api/health`)).json();
    assert.equal(health.ok, true);
    assert.equal(health.secretRequired, false);
  } finally {
    await hub.stop();
  }
});

test('hub web UI stays reachable when a secret protects the API', async () => {
  const hub = createHub({
    port: 0,
    host: '127.0.0.1',
    secret: 'web-ui-secret',
    repository: new MemoryRepository(),
    logger: { error() {}, warn() {} }
  });
  await hub.start();
  try {
    const { port } = hub.server.address();
    const base = `http://127.0.0.1:${port}`;

    const home = await fetch(`${base}/`);
    assert.equal(home.status, 200);
    assert.match(await home.text(), /authGate|Connect to hub|Token Monitor/);

    const denied = await fetch(`${base}/api/stats`);
    assert.equal(denied.status, 401);
    await denied.text();

    const allowed = await fetch(`${base}/api/stats`, {
      headers: { authorization: 'Bearer web-ui-secret' }
    });
    assert.equal(allowed.status, 200);
    await allowed.text();
  } finally {
    await hub.stop();
  }
});

test('tryServeStatic refuses non-GET methods and API paths', async () => {
  const fakeRes = {
    writeHead() {},
    end() {}
  };
  assert.equal(await tryServeStatic({ method: 'POST', url: '/' }, fakeRes), false);
  assert.equal(await tryServeStatic({ method: 'GET', url: '/api/stats' }, fakeRes), false);
  assert.equal(fs.existsSync(path.join(DEFAULT_WEB_ROOT, 'index.html')), true);
});