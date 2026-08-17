'use strict';

const assert = require('node:assert/strict');
const test = require('node:test');
const packageJson = require('../../package.json');

test('Windows installer stays one-click, current-user only', () => {
  assert.deepEqual(
    {
      oneClick: packageJson.build.nsis.oneClick,
      perMachine: packageJson.build.nsis.perMachine
    },
    {
      oneClick: true,
      perMachine: false
    }
  );
});
