'use strict';

const fs = require('node:fs');
const path = require('node:path');
const { defaultDeviceId, loadProjectConfig, parseArgs, pidFilePath } = require('../shared/config');
const { collectUsageOnce, startCollector } = require('../shared/collector');

const args = parseArgs(process.argv.slice(2));
const projectConfig = loadProjectConfig();
const agentConfig = projectConfig.agent || {};
const hubUrl = String(args.hub || args.hubUrl || process.env.TOKEN_MONITOR_HUB_URL || agentConfig.hubUrl || 'http://127.0.0.1:17321').replace(/\/$/, '');
const secret = String(args.secret || process.env.TOKEN_MONITOR_SECRET || agentConfig.secret || '').trim();
const deviceId = String(args.device || args.deviceId || process.env.TOKEN_MONITOR_DEVICE_ID || agentConfig.deviceId || defaultDeviceId());
const intervalMs = Number(args.interval || args.intervalMs || process.env.TOKEN_MONITOR_INTERVAL_MS || agentConfig.intervalMs || 5 * 60 * 1000);
const watchEnabled = String(args.watch ?? process.env.TOKEN_MONITOR_WATCH ?? agentConfig.watch ?? '1') !== '0';
const watchDebounceMs = Number(args.watchDebounceMs || process.env.TOKEN_MONITOR_WATCH_DEBOUNCE_MS || agentConfig.watchDebounceMs || 1500);
const clients = String(args.clients || process.env.TOKEN_MONITOR_CLIENTS || agentConfig.clients || 'claude,codex,hermes');
const allTimeSince = String(args.since || args.allTimeSince || process.env.TOKEN_MONITOR_ALL_TIME_SINCE || agentConfig.allTimeSince || '2024-01-01');
const commandTimeoutMs = Number(args.timeoutMs || process.env.TOKEN_MONITOR_TOKSCALE_TIMEOUT_MS || agentConfig.tokscaleTimeoutMs || 120 * 1000);
const once = Boolean(args.once);
const dryRun = Boolean(args['dry-run'] || args.dryRun);

const collectorOptions = { clients, allTimeSince, commandTimeoutMs, deviceId, agentVersion: '0.1.0' };

async function postUsage(summary) {
  const response = await fetch(`${hubUrl}/api/ingest`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', ...(secret ? { authorization: `Bearer ${secret}` } : {}) },
    body: JSON.stringify(summary)
  });
  if (!response.ok) throw new Error(`Hub responded ${response.status}: ${(await response.text()).slice(0, 300)}`);
  return response.json();
}

async function deliver(summary) {
  if (dryRun) { console.log(JSON.stringify(summary, null, 2)); return; }
  await postUsage(summary);
  console.log(`[${new Date().toISOString()}] posted ${summary.deviceId}: today=${summary.today.totalTokens} month=${summary.month.totalTokens} allTime=${summary.allTime.totalTokens}`);
}

function registerPidFile() {
  const pidPath = pidFilePath();
  fs.mkdirSync(path.dirname(pidPath), { recursive: true });
  fs.writeFileSync(pidPath, String(process.pid), 'utf8');
  const cleanup = () => { try { fs.unlinkSync(pidPath); } catch (_) {} };
  process.on('exit', cleanup);
  for (const sig of ['SIGINT', 'SIGTERM', 'SIGHUP']) {
    process.on(sig, () => { cleanup(); process.exit(0); });
  }
}

async function main() {
  console.log(`Token Monitor agent device=${deviceId} hub=${hubUrl} intervalMs=${intervalMs} watch=${watchEnabled}`);
  if (!secret) console.warn('Warning: TOKEN_MONITOR_SECRET is not set. Posting without authorization header.');
  if (once) {
    const summary = await collectUsageOnce(collectorOptions);
    await deliver(summary);
    return;
  }
  if (!dryRun) registerPidFile();
  startCollector({
    ...collectorOptions,
    intervalMs,
    watchEnabled,
    watchDebounceMs,
    onUpdate: (summary, reason) => {
      deliver(summary).catch((error) => console.error(`[${new Date().toISOString()}] (${reason}) ${error.message}`));
    },
    onError: (error, reason) => console.error(`[${new Date().toISOString()}] (${reason}) ${error.message}`),
    logger: (msg) => console.log(msg)
  });
}

main().catch((error) => { console.error(error); process.exitCode = 1; });
