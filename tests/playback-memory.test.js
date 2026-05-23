const assert = require('assert');
const { createPlaybackMemory } = require('../server/playback-memory');

function track(id, name = id, source = '') {
  return {
    id,
    name,
    source,
    artists: [{ name: 'Artist' }],
    album: { name: 'Album' }
  };
}

function run() {
  const memory = createPlaybackMemory({
    failureTtlMs: 1000,
    playableTtlMs: 5000,
    maxFailures: 3,
    maxPlayable: 2,
    now: () => 10000
  });

  memory.recordFailure({
    track: track('bad', 'Broken'),
    reason: 'upstream_404',
    stage: 'stream'
  });
  assert.strictEqual(memory.isBlocked(track('bad')), true);
  assert.strictEqual(memory.isBlocked(track('other')), false);
  assert.deepStrictEqual(memory.filterBlocked([track('bad'), track('ok')]).map(item => item.id), ['ok']);

  const expired = createPlaybackMemory({
    failureTtlMs: 1000,
    now: () => 12001
  });
  expired.recordFailure({ track: track('old'), reason: 'stalled', at: 10000 });
  assert.strictEqual(expired.isBlocked(track('old')), false);

  memory.recordSuccess(track('one', 'One'));
  memory.recordSuccess(track('two', 'Two'));
  memory.recordSuccess(track('three', 'Three'));
  assert.deepStrictEqual(memory.recentPlayable().map(item => item.id), ['three', 'two']);

  const preferred = memory.preferPlayable([track('new')]);
  assert.deepStrictEqual(preferred.map(item => item.id), ['new', 'three', 'two']);

  memory.recordFailure({ track: track('three'), reason: 'client_error' });
  assert.deepStrictEqual(memory.preferPlayable([track('three'), track('new')]).map(item => item.id), ['new', 'two']);

  const snapshot = memory.snapshot();
  assert.strictEqual(snapshot.blockedCount, 2);
  assert.strictEqual(snapshot.recentPlayableCount, 1);
  assert.strictEqual(snapshot.recentFailures[0].track.id, 'three');
  assert.strictEqual(snapshot.recentPlayable[0].id, 'two');

  memory.reset();
  assert.strictEqual(memory.snapshot().blockedCount, 0);
  assert.strictEqual(memory.snapshot().recentPlayableCount, 0);

  console.log('playback memory tests passed');
}

run();
