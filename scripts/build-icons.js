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

const result = spawnSync(electronBin, [GENERATE_SCRIPT], {
  stdio: 'inherit',
  cwd: ROOT,
  env: { ...process.env, ELECTRON_RUN_AS_NODE: undefined }
});

if (result.status !== 0) {
  process.exit(result.status || 1);
}
