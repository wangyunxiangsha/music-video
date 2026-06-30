const assert = require('assert');
const score = require('../server/recommendation-score');

function track(name, artist, categoryName = 'Pop') {
  return {
    id: `${artist}-${name}`,
    name,
    artists: [{ name: artist }],
    album: { name: 'Album' },
    categoryName
  };
}

const favorite = track('Night Song', 'Favorite Artist', 'City Pop');
const skipped = track('Skipped Song', 'Skipped Artist', 'Rock');
const neutral = track('Neutral Song', 'Neutral Artist', 'Folk');

const tasteSignals = {
  topArtists: [{ name: 'Favorite Artist', count: 4 }],
  topCategories: [{ name: 'City Pop', count: 3 }],
  recentSongs: ['Old Song']
};

const feedbackSignals = {
  likedTrackKeys: new Set(['night song::favorite artist']),
  skippedTrackKeys: new Set(['skipped song::skipped artist']),
  temporaryReducedTrackKeys: new Set(),
  boostArtists: new Set(['Favorite Artist']),
  reduceArtists: new Set(['Skipped Artist']),
  sceneReducedTrackKeys: new Set(),
  sceneBoostedTrackKeys: new Set(),
  completedTrackKeys: new Set(['night song::favorite artist']),
  quickSkippedTrackKeys: new Set(['skipped song::skipped artist'])
};

const favoriteScore = score.scoreTrack(favorite, { tasteSignals, feedbackSignals });
const skippedScore = score.scoreTrack(skipped, { tasteSignals, feedbackSignals });
const neutralScore = score.scoreTrack(neutral, { tasteSignals, feedbackSignals });

assert.ok(favoriteScore.weight > neutralScore.weight);
assert.ok(skippedScore.weight < neutralScore.weight);
assert.match(favoriteScore.reason, /最近常听歌手 Favorite Artist|最近常听类型 City Pop|你喜欢过这首/);
assert.match(skippedScore.reason, /最近跳过|减少播放/);
assert.strictEqual(neutralScore.reason, '符合当前电台氛围');

const completedOnly = score.scoreTrack(neutral, {
  feedbackSignals: {
    completedTrackKeys: new Set(['neutral song::neutral artist'])
  }
});
const quickOnly = score.scoreTrack(neutral, {
  feedbackSignals: {
    quickSkippedTrackKeys: new Set(['neutral song::neutral artist'])
  }
});
assert.ok(completedOnly.weight > neutralScore.weight);
assert.ok(quickOnly.weight < neutralScore.weight);
assert.match(completedOnly.reason, /曾完整听过/);
assert.match(quickOnly.reason, /曾很快跳过/);

const annotated = score.annotateRecommendationReason(favorite, favoriteScore);
assert.strictEqual(annotated.recommendationReason, favoriteScore.reason);
assert.strictEqual(annotated.recommendationScore, favoriteScore.weight);

console.log('recommendation score tests passed');
