const assert = require('assert');
const stats = require('../server/stats');

const track = {
  id: 'song-1',
  name: 'Long Song',
  artists: [{ name: 'Singer' }],
  categoryName: 'Pop'
};

const completed = stats.buildPlaybackProgressEntry({
  event: 'completed',
  track,
  position: 188,
  duration: 190
}, { now: 1779696000 });

assert.strictEqual(completed.type, 'completed');
assert.strictEqual(completed.track_key, 'long song::singer');
assert.strictEqual(completed.position, 188);
assert.strictEqual(completed.duration, 190);

const quickSkip = stats.buildPlaybackProgressEntry({
  event: 'quick_skip',
  track,
  position: 8,
  duration: 190
}, { now: 1779696010 });

const signals = stats.buildPlaybackProgressSignals([completed, quickSkip], { now: 1779696020 });
assert.ok(signals.completedTrackKeys.has('long song::singer'));
assert.ok(signals.quickSkippedTrackKeys.has('long song::singer'));

assert.throws(() => stats.buildPlaybackProgressEntry({ event: 'started', track }), /unsupported/);

console.log('playback progress tests passed');
