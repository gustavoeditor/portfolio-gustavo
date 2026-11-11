'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { requestRenditions } = require('../lib/rendition-trigger');

const withEnv = async (token, fetchImpl, run) => {
  const previousToken = process.env.GITHUB_RENDITIONS_TOKEN, previousFetch = global.fetch;
  if (token) process.env.GITHUB_RENDITIONS_TOKEN = token; else delete process.env.GITHUB_RENDITIONS_TOKEN;
  global.fetch = fetchImpl;
  try { return await run(); } finally {
    if (previousToken === undefined) delete process.env.GITHUB_RENDITIONS_TOKEN; else process.env.GITHUB_RENDITIONS_TOKEN = previousToken;
    global.fetch = previousFetch;
  }
};

test('publishing an upload starts the quality workflow right away', async () => {
  const calls = [];
  const result = await withEnv('test-token', async (url, init) => { calls.push({ url, init }); return { status: 204 }; },
    () => requestRenditions('new-upload'));
  assert.equal(result, 'started');
  assert.equal(calls.length, 1);
  assert.equal(calls[0].url, 'https://api.github.com/repos/gustavoeditor/portfolio-gustavo/dispatches');
  assert.equal(calls[0].init.method, 'POST');
  assert.equal(calls[0].init.headers.Authorization, 'Bearer test-token');
  assert.equal(JSON.parse(calls[0].init.body).event_type, 'new-upload');
});

test('without a token the upload waits for the scheduled run and nothing is called', async () => {
  let called = false;
  const result = await withEnv(null, async () => { called = true; return { status: 204 }; }, () => requestRenditions());
  assert.equal(result, 'scheduled');
  assert.equal(called, false);
});

test('a GitHub failure never breaks publishing', async () => {
  assert.equal(await withEnv('t', async () => { throw new Error('offline'); }, () => requestRenditions()), 'scheduled');
  assert.equal(await withEnv('t', async () => ({ status: 401 }), () => requestRenditions()), 'scheduled');
});
