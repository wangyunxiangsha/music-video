'use strict';

function artistOf(track = {}) {
  return track.artists?.[0]?.name || track.ar?.[0]?.name || track.artist || '';
}

function trackKey(track = {}) {
  return `${String(track.name || track.song_name || '').trim().toLowerCase()}::${String(artistOf(track)).trim().toLowerCase()}`;
}

function setHas(set, value) {
  return Boolean(value && set?.has?.(value));
}

function scoreTrack(track = {}, {
  tasteSignals = {},
  feedbackSignals = {},
  recentArtists = new Set(),
  artistRepeatMode = 'normal'
} = {}) {
  const artist = artistOf(track);
  const category = track.categoryName || track.category || '';
  const key = trackKey(track);
  const topArtists = new Set((tasteSignals.topArtists || []).map(item => item.name));
  const topCategories = new Set((tasteSignals.topCategories || []).map(item => item.name));
  const reasons = [];
  let weight = 1;

  if (setHas(topArtists, artist)) {
    weight += 0.8;
    reasons.push(`recent artist ${artist}`);
  }
  if (setHas(topCategories, category)) {
    weight += 0.45;
    reasons.push(`recent category ${category}`);
  }
  if (setHas(feedbackSignals.likedTrackKeys, key)) {
    weight += 1.8;
    reasons.push('liked track');
  }
  if (setHas(feedbackSignals.boostArtists, artist)) {
    weight += 1.2;
    reasons.push(`boosted artist ${artist}`);
  }
  if (setHas(feedbackSignals.sceneBoostedTrackKeys, key)) {
    weight += 1;
    reasons.push('fits current scene');
  }
  if (setHas(feedbackSignals.skippedTrackKeys, key)) {
    weight -= 1.2;
    reasons.push('skipped recently');
  }
  if (setHas(feedbackSignals.temporaryReducedTrackKeys, key)) {
    weight -= 0.8;
    reasons.push('temporarily reduced');
  }
  if (setHas(feedbackSignals.reduceArtists, artist)) {
    weight -= 0.7;
    reasons.push(`reduced artist ${artist}`);
  }
  if (setHas(feedbackSignals.sceneReducedTrackKeys, key)) {
    weight -= 1.4;
    reasons.push('reduced in current scene');
  }
  if ((tasteSignals.recentSongs || []).includes(track.name)) {
    weight -= 0.8;
    reasons.push('played very recently');
  }
  if (artistRepeatMode === 'less' && setHas(recentArtists, artist)) {
    weight -= 1;
    reasons.push('artist repeated recently');
  }

  const safeWeight = Math.max(0.1, Math.round(weight * 100) / 100);
  return {
    weight: safeWeight,
    reason: reasons.length ? `Because ${reasons.slice(0, 2).join(' and ')}` : 'Because it matches the current radio mix'
  };
}

function annotateRecommendationReason(track = {}, score = {}) {
  return {
    ...track,
    recommendationReason: score.reason || track.recommendationReason || '',
    recommendationScore: score.weight
  };
}

module.exports = {
  scoreTrack,
  annotateRecommendationReason,
  trackKey
};
