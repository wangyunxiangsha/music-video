const assert = require('assert');
const fs = require('fs');
const path = require('path');
const mixer = require('../server/recommendation-mixer');

const index = fs.readFileSync(path.join(__dirname, '..', 'server', 'index.js'), 'utf8');

const quiet = mixer.parseQualityTuningCommand('安静一点');
assert.strictEqual(quiet.mood, 'quiet');
assert.strictEqual(quiet.explorationMode, 'conservative');
assert.strictEqual(quiet.djPolicyMode, 'minimal');
assert.match(quiet.reply, /安静/);

const lively = mixer.parseQualityTuningCommand('热闹一点');
assert.strictEqual(lively.mood, 'lively');
assert.strictEqual(lively.explorationMode, 'discovery');
assert.strictEqual(lively.djPolicyMode, 'short');
assert.match(lively.reply, /热闹/);

const repeat = mixer.parseQualityTuningCommand('少放重复歌手');
assert.strictEqual(repeat.artistRepeatMode, 'less');
assert.match(repeat.reply, /重复歌手/);

const reset = mixer.parseQualityTuningCommand('恢复默认调音');
assert.strictEqual(reset.mood, 'balanced');
assert.strictEqual(reset.artistRepeatMode, 'normal');
assert.strictEqual(reset.explorationMode, 'balanced');

const topArtists = new Set(['SING女团']);
const recentArtists = new Set(['SING女团']);
assert.ok(mixer.tasteWeightForTrack({
  track: { name: '夜笙歌', artists: [{ name: 'SING女团' }], categoryName: '国风' },
  topArtists,
  recentArtists,
  artistRepeatMode: 'less'
}) < mixer.tasteWeightForTrack({
  track: { name: '夜笙歌', artists: [{ name: 'SING女团' }], categoryName: '国风' },
  topArtists,
  recentArtists,
  artistRepeatMode: 'normal'
}));

assert.match(index, /parseQualityTuningCommand\(message\)/);
assert.match(index, /activeStationMood/);
assert.match(index, /activeArtistRepeatMode/);
assert.match(index, /savePreference\('stationMood'/);
assert.match(index, /savePreference\('artistRepeatMode'/);

console.log('recommendation tuning tests passed');
