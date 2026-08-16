'use strict';

const PROJECT_VERSION_PATTERN = /^(?<major>0|[1-9]\d*)\.(?<minor>0|[1-9]\d*)\.(?<patch>0|[1-9]\d*)-rev\.(?<revision>[1-9]\d*)$/;

function parseProjectVersion(value) {
  if (typeof value !== 'string') return null;
  const version = value.trim();
  const match = PROJECT_VERSION_PATTERN.exec(version);
  if (!match) return null;

  const numericParts = Object.fromEntries(
    ['major', 'minor', 'patch', 'revision'].map((name) => [name, Number(match.groups[name])])
  );
  if (Object.values(numericParts).some((part) => !Number.isSafeInteger(part))) return null;

  return {
    version,
    upstreamVersion: `${match.groups.major}.${match.groups.minor}.${match.groups.patch}`,
    channel: 'rev',
    ...numericParts
  };
}

function parseProjectTag(tag) {
  if (typeof tag !== 'string') return null;
  return parseProjectVersion(tag.trim().replace(/^v/i, ''));
}

function isProjectVersion(value) {
  return Boolean(parseProjectVersion(value));
}

function compareProjectVersions(leftValue, rightValue) {
  const left = typeof leftValue === 'string' ? parseProjectVersion(leftValue) : leftValue;
  const right = typeof rightValue === 'string' ? parseProjectVersion(rightValue) : rightValue;
  if (!left || !right) return null;

  for (const name of ['major', 'minor', 'patch', 'revision']) {
    if (left[name] !== right[name]) return left[name] > right[name] ? 1 : -1;
  }
  return 0;
}

module.exports = {
  PROJECT_VERSION_PATTERN,
  parseProjectVersion,
  parseProjectTag,
  isProjectVersion,
  compareProjectVersions
};
