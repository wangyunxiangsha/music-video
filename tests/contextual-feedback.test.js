const assert = require('assert');
const feedback = require('../server/feedback');
const stats = require('../server/stats');

const track = {
  id: 'song-1',
  name: '夜笙歌',
  artists: [{ name: 'SING女团' }],
  album: { name: '如梦令' },
  categoryName: '国风'
};

const workScene = { id: 'work', name: '工作专注' };
const sleepScene = { id: 'sleep', name: '睡前低刺激' };
const trackKey = '夜笙歌::sing女团';

const sceneReduce = feedback.parseFeedback('这个场景别放这首', track, { scene: workScene });
assert.strictEqual(sceneReduce.type, 'scene_reduce');
assert.strictEqual(sceneReduce.target, 'track');
assert.deepStrictEqual(sceneReduce.scene, workScene);
assert.match(sceneReduce.reply, /工作专注/);

const sceneBoost = feedback.parseFeedback('这个场景适合这首', track, { scene: workScene });
assert.strictEqual(sceneBoost.type, 'scene_boost');
assert.strictEqual(sceneBoost.target, 'track');
assert.deepStrictEqual(sceneBoost.scene, workScene);

const entry = stats.buildFeedbackEntry(sceneReduce, { now: 1779696000 });
assert.strictEqual(entry.scene_id, 'work');
assert.strictEqual(entry.scene_name, '工作专注');
assert.strictEqual(entry.track_key, trackKey);

const matchingSignals = stats.buildFeedbackSignals([entry], { scene: workScene });
assert.strictEqual(matchingSignals.sceneReducedTrackKeys.has(trackKey), true);

const otherSignals = stats.buildFeedbackSignals([entry], { scene: sleepScene });
assert.strictEqual(otherSignals.sceneReducedTrackKeys.has(trackKey), false);

const boostEntry = stats.buildFeedbackEntry(sceneBoost, { now: 1779696001 });
const boostSignals = stats.buildFeedbackSignals([boostEntry], { scene: workScene });
assert.strictEqual(boostSignals.sceneBoostedTrackKeys.has(trackKey), true);

const globalDislike = feedback.parseFeedback('少放这首', track, { scene: workScene });
const globalEntry = stats.buildFeedbackEntry(globalDislike, { now: 1779696002 });
const globalSignals = stats.buildFeedbackSignals([globalEntry], { scene: sleepScene });
assert.strictEqual(globalSignals.dislikedTrackKeys.has(trackKey), true);

console.log('contextual feedback tests passed');
