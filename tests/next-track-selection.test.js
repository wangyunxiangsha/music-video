const assert = require('assert');
const selection = require('../server/next-track-selection');

function track(id, name = id) {
  return { id, name, artists: [{ name: 'A' }] };
}

{
  const picked = {
    track: track('fourth', '相似'),
    remaining: [track('fifth', '红颜旧')],
    skipped: [track('first', '我一直都在'), track('second', 'Jar Of Love'), track('third', 'This Is Gospel')]
  };

  const result = selection.applyPlayablePick(picked);

  assert.strictEqual(result.track.id, 'fourth');
  assert.deepStrictEqual(result.playlist.map(item => item.id), ['fifth']);
  assert.strictEqual(result.skippedCount, 3);
  assert.match(result.playbackNotice, /已跳过 3 首暂时打不开的候选/);
  assert.match(result.playbackNotice, /相似/);
  assert.match(result.track.playbackSwitchReason, /已跳过 3 首暂时打不开的候选/);
  assert.deepStrictEqual(result.track.playbackSkippedCandidates.map(item => item.name), [
    '我一直都在',
    'Jar Of Love',
    'This Is Gospel'
  ]);
}

{
  const picked = {
    track: null,
    remaining: [track('keep')],
    skipped: [track('bad1'), track('bad2')]
  };

  const result = selection.applyPlayablePick(picked);

  assert.strictEqual(result.track, null);
  assert.deepStrictEqual(result.playlist.map(item => item.id), ['keep']);
  assert.strictEqual(result.skippedCount, 2);
  assert.match(result.playbackNotice, /前 2 首暂时打不开/);
}

console.log('next track selection tests passed');
