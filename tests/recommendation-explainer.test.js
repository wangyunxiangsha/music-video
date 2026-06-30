const assert = require('assert');
const explainer = require('../server/recommendation-explainer');
const feedback = require('../server/feedback');
const queue = require('../server/queue');

const localTrack = {
  id: 'local-1',
  name: '本地歌',
  artists: [{ name: '本地歌手' }],
  album: { name: '本地专辑' },
  recommendationSource: 'local',
  recommendationReason: '来自你的歌单'
};

const externalTrack = {
  id: 'external-1',
  name: '外部歌',
  artists: [{ name: '外部歌手' }],
  album: { name: '外部专辑' },
  recommendationSource: 'external',
  sourceReason: '国风',
  recommendationReason: '因为你最近常听国风',
  recommendationScore: 2.45
};

const context = {
  scene: { id: 'rainy_quiet', name: '下雨安静' },
  djPolicy: { mode: 'minimal', name: '少说一点' },
  recommendation: { externalRatio: 0.25 }
};

assert.match(explainer.explainTrack(localTrack, context), /来自你的歌单/);
assert.match(explainer.explainTrack(localTrack, context), /下雨安静/);
assert.match(explainer.explainTrack(localTrack, context), /少说一点/);
assert.match(explainer.explainTrack(externalTrack, context), /国风/);
assert.match(explainer.explainTrack(externalTrack, context), /25%/);
assert.match(explainer.explainTrack(externalTrack, context), /推荐分/);
assert.match(explainer.explainTrack(externalTrack, context), /2\.45/);

const summary = queue.summarizeQueue({
  currentTrack: localTrack,
  playlist: [externalTrack],
  scene: context.scene,
  djPolicy: context.djPolicy,
  recommendation: context.recommendation
});
assert.strictEqual(summary.current.recommendationReason, '来自你的歌单');
assert.strictEqual(summary.next[0].sourceReason, '国风');
assert.strictEqual(summary.next[0].recommendationScore, 2.45);
assert.strictEqual(summary.recommendation.externalRatio, 0.25);

const notVibe = feedback.parseFeedback('这首不对味', localTrack);
assert.strictEqual(notVibe.type, 'not_vibe');
assert.strictEqual(notVibe.temporary, true);
assert.match(notVibe.reply, /今天/);

console.log('recommendation explainer tests passed');
