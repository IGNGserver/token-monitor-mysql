'use strict';

const { spawnSync } = require('node:child_process');

const result = spawnSync(process.execPath, ['--test', 'tests/hub/mysql.test.js'], {
  stdio: 'inherit',
  env: { ...process.env, MYSQL_TEST_ENABLED: '1' }
});
process.exitCode = result.status === null ? 1 : result.status;
