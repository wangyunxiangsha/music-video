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
  assert.deepStrictEqual(calls, ['bad', 'good']);

  const exhausted = await playability.pickPlayableTrack({
    playlist: [track('bad1'), track('bad2'), track('keep')],
    resolveUrl: async () => null,
    maxAttempts: 2
  });

  assert.strictEqual(exhausted.track, null);
  assert.deepStrictEqual(exhausted.remaining.map(item => item.id), ['keep']);
  assert.deepStrictEqual(exhausted.skipped.map(item => item.id), ['bad1', 'bad2']);

  console.log('playability tests passed');
}

run().catch((error) => {
  console.error(error);
  process.exit(1);
});
