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
  assert.strictEqual(result.skipped[0].playbackFailureReason, playability.UNAVAILABLE_REASON);
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
  assert.strictEqual(skippedBlocked.skipped[0].playbackFailureReason, playability.BLOCKED_REASON);
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

  const replaced = await playability.pickPlayableTrack({
    playlist: [track('netease-preview', 'netease'), track('later')],
    resolveUrl: async () => ({
      url: 'https://qq.example/full.m4a',
      track: track('qq-full', 'qq')
    }),
    maxAttempts: 2
  });
  assert.strictEqual(replaced.track.id, 'qq-full');
  assert.strictEqual(replaced.track.source, 'qq');
  assert.deepStrictEqual(replaced.remaining.map(item => item.id), ['later']);

  const precheckCalls = [];
  const prechecked = await playability.precheckPlayableQueue({
    playlist: [
      track('bad-a'),
      track('good-a'),
      track('blocked'),
      track('bad-b'),
      track('good-b'),
      track('good-c'),
      track('later')
    ],
    targetCount: 3,
    maxAttempts: 6,
    isBlocked: item => item.id === 'blocked',
    resolveUrl: async (item) => {
      precheckCalls.push(item.id);
      if (item.id === 'good-b') {
        return { url: 'https://ok.example/audio.mp3', track: track('good-b-qq', 'qq') };
      }
      return item.id.startsWith('good') ? 'https://ok.example/audio.mp3' : null;
    }
  });
  assert.deepStrictEqual(prechecked.playlist.map(item => item.id), ['good-a', 'good-b-qq', 'good-c', 'later']);
  assert.deepStrictEqual(prechecked.skipped.map(item => item.id), ['bad-a', 'blocked', 'bad-b']);
  assert.deepStrictEqual(precheckCalls, ['bad-a', 'good-a', 'bad-b', 'good-b', 'good-c']);

  console.log('playability tests passed');
}

run().catch((error) => {
  console.error(error);
  process.exit(1);
});
