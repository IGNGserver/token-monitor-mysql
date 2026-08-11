#!/usr/bin/env node
'use strict';

const path = require('node:path');
const { spawnSync } = require('node:child_process');

const ROOT = path.resolve(__dirname, '..');
const GENERATE_SCRIPT = path.join(__dirname, 'generate-transparent-icons.js');

let electronBin;
try {
  electronBin = require('electron');
  if (typeof electronBin !== 'string') {
    electronBin = process.execPath;
  }
} catch (_) {
  electronBin = process.execPath;
}

// Icon generation is a build-only Electron process. Linux CI runners do not
// preserve Electron's SUID sandbox mode after npm extracts the binary, and
// Windows hosted runners can fail Viz initialization with hardware capture.
// Keep the packaged application sandboxed; these flags apply only to this
// short-lived asset generator.
const electronArgs = [];
if (process.platform === 'linux') electronArgs.push('--no-sandbox');
if (process.env.CI) electronArgs.push('--disable-gpu');

const result = spawnSync(electronBin, [...electronArgs, GENERATE_SCRIPT], {
  stdio: 'inherit',
  cwd: ROOT,
  env: { ...process.env, ELECTRON_RUN_AS_NODE: undefined }
});

if (result.status !== 0) {
  process.exit(result.status || 1);
}
