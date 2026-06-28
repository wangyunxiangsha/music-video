const assert = require('assert');
const playability = require('../server/playability');

function track(id, source = '') {
  return { id, source, name: id, artists: [{ name: 'A' }] };
}

async function run() {
  const calls = [];
  const result = await playability.pickPlayableTrack({
    playlist: [track('bad', 'qq'), track('good', 'qq'), track('later')],
    resolveUrl: async (item) => {
      calls.push(item.id);
      return item.id === 'good' ? 'https://ok.example/audio.mp3' : null;
    },
    maxAttempts: 3
  });

  assert.strictEqual(result.track.id, 'good');
  assert.deepStrictEqual(result.remaining.map(item => item.id), ['later']);
  assert.deepStrictEqual(result.skipped.map(item => item.id), ['bad']);
  assert.strictEqual(result.skipped[0].playbackFailureReason, '音源暂时不可用');
  assert.deepStrictEqual(calls, ['bad', 'good']);

  const exhausted = await playability.pickPlayableTrack({
    playlist: [track('bad1'), track('bad2'), track('keep')],
    resolveUrl: async () => null,
    maxAttempts: 2
  });

  assert.strictEqual(exhausted.track, null);
  assert.deepStrictEqual(exhausted.remaining.map(item => item.id), ['keep']);
  assert.deepStrictEqual(exhausted.skipped.map(item => item.id), ['bad1', 'bad2']);

  const blockedCalls = [];
  const skippedBlocked = await playability.pickPlayableTrack({
    playlist: [track('blocked'), track('ok')],
    resolveUrl: async (item) => {
      blockedCalls.push(item.id);
      return 'https://ok.example/audio.mp3';
    },
    isBlocked: (item) => item.id === 'blocked'
  });
  assert.strictEqual(skippedBlocked.track.id, 'ok');
  assert.deepStrictEqual(skippedBlocked.skipped.map(item => item.id), ['blocked']);
  assert.strictEqual(skippedBlocked.skipped[0].playbackFailureReason, '已被本地播放记忆临时跳过');
  assert.deepStrictEqual(blockedCalls, ['ok']);

  const fallbackCalls = [];
  const fallback = await playability.pickPlayableTrack({
    playlist: [track('bad')],
    fallbackPlaylist: [track('known-good')],
    resolveUrl: async (item) => {
      fallbackCalls.push(item.id);
      return item.id === 'known-good' ? 'https://ok.example/audio.mp3' : null;
    },
    maxAttempts: 3
  });
  assert.strictEqual(fallback.track.id, 'known-good');
  assert.deepStrictEqual(fallback.skipped.map(item => item.id), ['bad']);
  assert.deepStrictEqual(fallbackCalls, ['bad', 'known-good']);

  const primaryWins = await playability.pickPlayableTrack({
    playlist: [track('primary'), track('later')],
    fallbackPlaylist: [track('cached')],
    resolveUrl: async () => 'https://ok.example/audio.mp3',
    maxAttempts: 3
  });
  assert.strictEqual(primaryWins.track.id, 'primary');
  assert.deepStrictEqual(primaryWins.remaining.map(item => item.id), ['later']);

  console.log('playability tests passed');
}

run().catch((error) => {
  console.error(error);
  process.exit(1);
});
