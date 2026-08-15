'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const test = require('node:test');

const rootPackage = require('../../package.json');
const { mergeMacUpdaterMetadata } = require('../../scripts/merge-mac-updater-metadata');
const {
  referencedArtifactNames,
  verifyUpdaterArtifactNames
} = require('../../scripts/verify-updater-artifact-names');

test('release artifact templates use GitHub-safe names', () => {
  const patterns = [
    rootPackage.build.mac.artifactName,
    rootPackage.build.linux.artifactName,
    rootPackage.build.nsis.artifactName,
    rootPackage.build.portable.artifactName
  ];
  assert.deepEqual(patterns, [
    'Token-Monitor-${version}-${arch}.${ext}',
    'Token-Monitor-${version}.${ext}',
    'Token-Monitor-Setup-${version}.${ext}',
    'Token-Monitor-${version}.${ext}'
  ]);
  for (const pattern of patterns) assert.doesNotMatch(pattern, /\s/);
});

test('macOS releases build unsigned DMG and ZIP artifacts for both architectures', () => {
  assert.deepEqual(rootPackage.build.mac.target, ['dmg', 'zip']);
  assert.equal(rootPackage.build.mac.forceCodeSigning, false);
  assert.equal(rootPackage.build.mac.minimumSystemVersion, '14.0');
  assert.equal(rootPackage.build.mac.icon, 'assets/icon.png');
  assert.match(rootPackage.scripts['dist:mac'], /--arm64/);
  assert.match(rootPackage.scripts['dist:mac:x64'], /--x64/);
  assert.equal(rootPackage.scripts['predist:mac:x64'], 'npm run icons');
  assert.equal(rootPackage.devDependencies['electron-icon-builder'], undefined);

  const workflow = fs.readFileSync(path.join(__dirname, '../../.github/workflows/release.yml'), 'utf8');
  assert.match(workflow, /runs-on: macos-15\n/);
  assert.match(workflow, /runs-on: macos-15-intel\n/);
  assert.match(workflow, /name: token-monitor-macos-arm64/);
  assert.match(workflow, /name: token-monitor-macos-x64/);
  assert.match(workflow, /scripts\/merge-mac-updater-metadata\.js/);
});

test('Linux releases include both AppImage and Debian targets', () => {
  const targets = rootPackage.build.linux.target.map((entry) => entry.target);
  assert.deepEqual(targets, ['AppImage', 'deb']);
  assert.match(rootPackage.build.linux.maintainer, /<[^@<>\s]+@[^<>\s]+>/);

  const workflow = fs.readFileSync(path.join(__dirname, '../../.github/workflows/release.yml'), 'utf8');
  assert.match(workflow, /dist\/\*\.deb/);
  assert.match(workflow, /artifacts\/\*\.deb/);
});

test('extracts updater artifact names from url and path fields', () => {
  const names = referencedArtifactNames([
    'files:',
    '  - url: Token-Monitor-0.25.0-arm64.zip',
    'path: "Token-Monitor-0.25.0-arm64.zip"',
    "  - url: 'https://example.com/Token-Monitor-0.25.0-arm64.dmg'"
  ].join('\n'));
  assert.deepEqual(names, [
    'Token-Monitor-0.25.0-arm64.zip',
    'Token-Monitor-0.25.0-arm64.dmg'
  ]);
});

test('fails when updater metadata references an asset that will not be uploaded', (t) => {
  const distDir = fs.mkdtempSync(path.join(os.tmpdir(), 'token-monitor-release-'));
  t.after(() => fs.rmSync(distDir, { recursive: true, force: true }));
  fs.writeFileSync(path.join(distDir, 'latest-mac.yml'), [
    'version: 0.25.0',
    'files:',
    '  - url: Token-Monitor-0.25.0-arm64.zip',
    'path: Token-Monitor-0.25.0-arm64.zip'
  ].join('\n'));

  assert.throws(
    () => verifyUpdaterArtifactNames(distDir),
    /latest-mac\.yml -> Token-Monitor-0\.25\.0-arm64\.zip/
  );

  fs.writeFileSync(path.join(distDir, 'Token-Monitor-0.25.0-arm64.zip'), 'artifact');
  assert.deepEqual(verifyUpdaterArtifactNames(distDir), {
    metadataFiles: ['latest-mac.yml']
  });
});

test('merges ARM64 and Intel macOS updater metadata into one feed', () => {
  const metadata = (arch) => [
    'version: 0.37.21',
    'files:',
    `  - url: Token-Monitor-0.37.21-${arch}.zip`,
    `    sha512: ${arch}-zip-hash`,
    `    size: 123`,
    `  - url: Token-Monitor-0.37.21-${arch}.dmg`,
    `    sha512: ${arch}-dmg-hash`,
    `    size: 456`,
    `path: Token-Monitor-0.37.21-${arch}.zip`,
    'sha512: feed-hash'
  ].join('\n');

  const merged = mergeMacUpdaterMetadata(metadata('arm64'), metadata('x64'));
  assert.match(merged, /Token-Monitor-0\.37\.21-arm64\.zip/);
  assert.match(merged, /Token-Monitor-0\.37\.21-arm64\.dmg/);
  assert.match(merged, /Token-Monitor-0\.37\.21-x64\.zip/);
  assert.match(merged, /Token-Monitor-0\.37\.21-x64\.dmg/);
  assert.match(merged, /path: Token-Monitor-0\.37\.21-arm64\.zip/);
});
