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
    reasons.push(`最近常听歌手 ${artist}`);
  }
  if (setHas(topCategories, category)) {
    weight += 0.45;
    reasons.push(`最近常听类型 ${category}`);
  }
  if (setHas(feedbackSignals.likedTrackKeys, key)) {
    weight += 1.8;
    reasons.push('你喜欢过这首');
  }
  if (setHas(feedbackSignals.boostArtists, artist)) {
    weight += 1.2;
    reasons.push(`已加强歌手 ${artist}`);
  }
  if (setHas(feedbackSignals.sceneBoostedTrackKeys, key)) {
    weight += 1;
    reasons.push('适合当前场景');
  }
  if (setHas(feedbackSignals.completedTrackKeys, key)) {
    weight += 0.7;
    reasons.push('曾完整听过');
  } else if (setHas(feedbackSignals.halfPlayedTrackKeys, key)) {
    weight += 0.3;
    reasons.push('曾听过半程');
  }
  if (setHas(feedbackSignals.skippedTrackKeys, key)) {
    weight -= 1.2;
    reasons.push('最近跳过');
  }
  if (setHas(feedbackSignals.quickSkippedTrackKeys, key)) {
    weight -= 1;
    reasons.push('曾很快跳过');
  }
  if (setHas(feedbackSignals.temporaryReducedTrackKeys, key)) {
    weight -= 0.8;
    reasons.push('临时减少播放');
  }
  if (setHas(feedbackSignals.reduceArtists, artist)) {
    weight -= 0.7;
    reasons.push(`减少播放歌手 ${artist}`);
  }
  if (setHas(feedbackSignals.sceneReducedTrackKeys, key)) {
    weight -= 1.4;
    reasons.push('当前场景减少播放');
  }
  if ((tasteSignals.recentSongs || []).includes(track.name)) {
    weight -= 0.8;
    reasons.push('刚播放过');
  }
  if (artistRepeatMode === 'less' && setHas(recentArtists, artist)) {
    weight -= 1;
    reasons.push('歌手最近重复');
  }

  const safeWeight = Math.max(0.1, Math.round(weight * 100) / 100);
  return {
    weight: safeWeight,
    reason: reasons.length ? reasons.slice(0, 2).join('，') : '符合当前电台氛围'
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
