'use strict';

const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

function projectRoot() {
  return path.resolve(__dirname, '..', '..');
}

function parseArgs(argv) {
  const args = {};
  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];
    if (!token.startsWith('--')) continue;
    const stripped = token.slice(2);
    if (!stripped) continue;
    const eqIndex = stripped.indexOf('=');
    if (eqIndex !== -1) {
      args[stripped.slice(0, eqIndex)] = stripped.slice(eqIndex + 1);
      continue;
    }
    const next = argv[index + 1];
    if (!next || next.startsWith('--')) args[stripped] = true;
    else {
      args[stripped] = next;
      index += 1;
    }
  }
  return args;
}

function readJson(filePath, fallback = null) {
  let content;
  try {
    content = fs.readFileSync(filePath, 'utf8');
  } catch (error) {
    if (error.code !== 'ENOENT') console.warn(`Could not read ${filePath}: ${error.message}`);
    return fallback;
  }
  if (!content.trim()) return fallback;
  try {
    return JSON.parse(content);
  } catch (error) {
    console.warn(`Could not parse JSON in ${filePath}: ${error.message}`);
    return fallback;
  }
}

function writeJsonAtomic(filePath, value) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  const tempPath = `${filePath}.tmp`;
  fs.writeFileSync(tempPath, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
  fs.renameSync(tempPath, filePath);
}

function loadProjectConfig() {
  return readJson(path.join(projectRoot(), 'config.local.json'), {}) || {};
}

function defaultDeviceId() {
  return os.hostname().toLowerCase().replace(/[^a-z0-9_-]+/g, '-').replace(/^-+|-+$/g, '') || 'device';
}

function pidFilePath() {
  return path.join(projectRoot(), 'data', 'agent.pid');
}

module.exports = { defaultDeviceId, loadProjectConfig, parseArgs, pidFilePath, projectRoot, readJson, writeJsonAtomic };
