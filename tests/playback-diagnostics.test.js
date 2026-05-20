const assert = require('assert');
const diagnostics = require('../server/playback-diagnostics');

function track(id, name = 'Song', source = 'netease') {
  return {
    id,
    name,
    source,
    artists: [{ name: 'Artist' }],
    album: { name: 'Album' }
  };
}

function run() {
  diagnostics.reset();

  let first = diagnostics.recordFailure({
    stage: 'stream',
    reason: 'upstream_404',
    status: 404,
    track: track('qq:001', 'Bad QQ', 'qq'),
    hasRange: true
  });
  assert.strictEqual(first.shouldRebuild, false);
  assert.strictEqual(first.consecutiveFailures, 1);

  diagnostics.recordFailure({
    stage: 'stream',
    reason: 'upstream_timeout',
    status: 502,
    track: track('2', 'Bad Netease')
  });
  const third = diagnostics.recordFailure({
    stage: 'client',
    reason: 'stalled',
    track: track('3', 'Stalled')
  });
  assert.strictEqual(third.shouldRebuild, true);
  assert.strictEqual(third.consecutiveFailures, 3);

  const snapshot = diagnostics.snapshot();
  assert.strictEqual(snapshot.consecutiveFailures, 3);
  assert.strictEqual(snapshot.recentFailures.length, 3);
  assert.strictEqual(snapshot.recentFailures[0].track.name, 'Stalled');
  assert.strictEqual(snapshot.recentFailures[2].track.name, 'Bad QQ');
  assert.strictEqual(snapshot.recentFailures[2].hasRange, true);

  diagnostics.recordSuccess(track('4', 'Good'));
  assert.strictEqual(diagnostics.snapshot().consecutiveFailures, 0);
  assert.strictEqual(diagnostics.snapshot().lastSuccess.track.name, 'Good');

  console.log('playback diagnostics tests passed');
}

run();
