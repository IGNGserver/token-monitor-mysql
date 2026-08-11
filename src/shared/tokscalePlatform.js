'use strict';

function linuxLibcVariant(runtime = process) {
  try {
    const header = runtime?.report?.getReport?.().header;
    if (header && Object.hasOwn(header, 'glibcVersionRuntime')) {
      return header.glibcVersionRuntime ? 'gnu' : 'musl';
    }
    // Node's diagnostic report omits glibcVersionRuntime on musl. Only infer
    // musl when the report itself identifies Linux; test doubles and other
    // runtimes otherwise keep the broadly compatible glibc package default.
    if (/linux/i.test(String(header?.osName || ''))) return 'musl';
  } catch (_) {}
  return 'gnu';
}

function tokscalePackageNamesForPlatform(platform = process.platform, arch = process.arch, runtime = process) {
  if (platform === 'darwin') {
    if (arch === 'arm64') return ['@tokscale/cli-darwin-arm64'];
    if (arch === 'x64') return ['@tokscale/cli-darwin-x64'];
  }
  if (platform === 'win32') {
    if (arch === 'arm64') return ['@tokscale/cli-win32-arm64-msvc'];
    if (arch === 'x64') return ['@tokscale/cli-win32-x64-msvc'];
  }
  if (platform === 'linux' && (arch === 'arm64' || arch === 'x64')) {
    const variant = linuxLibcVariant(runtime);
    const fallback = variant === 'gnu' ? 'musl' : 'gnu';
    return [
      `@tokscale/cli-linux-${arch}-${variant}`,
      `@tokscale/cli-linux-${arch}-${fallback}`
    ];
  }
  return [];
}

function tokscalePackageNameForPlatform(platform = process.platform, arch = process.arch, runtime = process) {
  return tokscalePackageNamesForPlatform(platform, arch, runtime)[0] || null;
}

function tokscalePlatformKey(platform = process.platform, arch = process.arch, runtime = process) {
  const libc = platform === 'linux' && (arch === 'arm64' || arch === 'x64')
    ? `-${linuxLibcVariant(runtime)}`
    : '';
  return `${platform}-${arch}${libc}`;
}

module.exports = {
  linuxLibcVariant,
  tokscalePackageNameForPlatform,
  tokscalePackageNamesForPlatform,
  tokscalePlatformKey
};
