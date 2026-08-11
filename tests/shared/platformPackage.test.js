'use strict';

const assert = require('node:assert/strict');
const test = require('node:test');

const {
  linuxLibcVariant,
  tokscalePackageNameForPlatform,
  tokscalePackageNamesForPlatform,
  tokscalePlatformKey
} = require('../../src/shared/tokscalePlatform');

test('tokscalePackageNameForPlatform returns npm package names including Windows msvc suffix', () => {
  assert.equal(tokscalePackageNameForPlatform('darwin', 'arm64'), '@tokscale/cli-darwin-arm64');
  assert.equal(tokscalePackageNameForPlatform('darwin', 'x64'), '@tokscale/cli-darwin-x64');
  assert.equal(tokscalePackageNameForPlatform('win32', 'x64'), '@tokscale/cli-win32-x64-msvc');
  assert.equal(tokscalePackageNameForPlatform('win32', 'arm64'), '@tokscale/cli-win32-arm64-msvc');
});

test('tokscalePackageNameForPlatform supports Linux glibc and musl packages', () => {
  const glibcRuntime = { report: { getReport: () => ({ header: { osName: 'Linux', glibcVersionRuntime: '2.39' } }) } };
  const muslRuntime = { report: { getReport: () => ({ header: { osName: 'Linux' } }) } };
  assert.equal(linuxLibcVariant(glibcRuntime), 'gnu');
  assert.equal(linuxLibcVariant(muslRuntime), 'musl');
  assert.equal(tokscalePackageNameForPlatform('linux', 'x64', glibcRuntime), '@tokscale/cli-linux-x64-gnu');
  assert.equal(tokscalePackageNameForPlatform('linux', 'arm64', muslRuntime), '@tokscale/cli-linux-arm64-musl');
  assert.deepEqual(tokscalePackageNamesForPlatform('linux', 'x64', glibcRuntime), [
    '@tokscale/cli-linux-x64-gnu',
    '@tokscale/cli-linux-x64-musl'
  ]);
});

test('tokscalePackageNameForPlatform returns null for unsupported updater platforms', () => {
  assert.equal(tokscalePackageNameForPlatform('darwin', 'ia32'), null);
});

test('tokscalePlatformKey uses process-style platform and arch', () => {
  assert.equal(tokscalePlatformKey('darwin', 'arm64'), 'darwin-arm64');
  const glibcRuntime = { report: { getReport: () => ({ header: { osName: 'Linux', glibcVersionRuntime: '2.39' } }) } };
  const muslRuntime = { report: { getReport: () => ({ header: { osName: 'Linux' } }) } };
  assert.equal(tokscalePlatformKey('linux', 'x64', glibcRuntime), 'linux-x64-gnu');
  assert.equal(tokscalePlatformKey('linux', 'x64', muslRuntime), 'linux-x64-musl');
});
