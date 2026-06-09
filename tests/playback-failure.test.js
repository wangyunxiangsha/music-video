const assert = require('assert');
const failure = require('../server/playback-failure');

function run() {
  assert.strictEqual(failure.shouldIgnorePlaybackFailure({
    stage: 'stream',
    reason: 'upstream_stream_error',
    detail: 'aborted',
    responseClosed: true
  }), true);

  assert.strictEqual(failure.shouldIgnorePlaybackFailure({
    stage: 'stream',
    reason: 'upstream_stream_error',
    detail: 'aborted',
    responseClosed: false
  }), true);

  assert.strictEqual(failure.shouldIgnorePlaybackFailure({
    stage: 'stream',
    reason: 'upstream_stream_error',
    detail: 'Premature close',
    responseClosed: true
  }), true);

  assert.strictEqual(failure.shouldIgnorePlaybackFailure({
    stage: 'stream',
    reason: 'upstream_stream_error',
    detail: 'ECONNRESET',
    responseClosed: false
  }), false);

  assert.strictEqual(failure.shouldIgnorePlaybackFailure({
    stage: 'stream',
    reason: 'url_unavailable',
    status: 404,
    responseClosed: true
  }), false);

  console.log('playback failure tests passed');
}

run();
