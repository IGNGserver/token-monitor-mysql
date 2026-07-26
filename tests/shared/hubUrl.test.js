'use strict';

const assert = require('node:assert/strict');
const test = require('node:test');
const { normalizeHubUrl } = require('../../src/shared/config');

test('normalizeHubUrl defaults bare host/IP to http', () => {
  assert.equal(normalizeHubUrl('192.168.1.1:17321'), 'http://192.168.1.1:17321');
  assert.equal(normalizeHubUrl('hub.example.com'), 'http://hub.example.com');
  assert.equal(normalizeHubUrl(' hub.example.com/path '), 'http://hub.example.com/path');
});

test('normalizeHubUrl preserves existing schemes and empty', () => {
  assert.equal(normalizeHubUrl('https://secure.example.com:8443'), 'https://secure.example.com:8443');
  assert.equal(normalizeHubUrl('http://already'), 'http://already');
  assert.equal(normalizeHubUrl(''), '');
  assert.equal(normalizeHubUrl('   '), '');
});
