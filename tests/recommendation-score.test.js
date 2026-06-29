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
  sceneBoostedTrackKeys: new Set()
};

const favoriteScore = score.scoreTrack(favorite, { tasteSignals, feedbackSignals });
const skippedScore = score.scoreTrack(skipped, { tasteSignals, feedbackSignals });
const neutralScore = score.scoreTrack(neutral, { tasteSignals, feedbackSignals });

assert.ok(favoriteScore.weight > neutralScore.weight);
assert.ok(skippedScore.weight < neutralScore.weight);
assert.match(favoriteScore.reason, /Favorite Artist|City Pop|liked/);
assert.match(skippedScore.reason, /skipped|reduced/);

const annotated = score.annotateRecommendationReason(favorite, favoriteScore);
assert.strictEqual(annotated.recommendationReason, favoriteScore.reason);
assert.strictEqual(annotated.recommendationScore, favoriteScore.weight);

console.log('recommendation score tests passed');
