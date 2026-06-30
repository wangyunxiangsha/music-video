'use strict';

function artistOf(track = {}) {
  return track.artists?.[0]?.name || track.ar?.[0]?.name || '';
}

function compactTrack(track) {
  if (!track) return null;
  return {
    id: String(track.id || ''),
    name: track.name || '',
    artist: artistOf(track),
    album: track.album?.name || track.al?.name || '',
    categoryName: track.categoryName || '',
    source: track.source || '',
    recommendationSource: track.recommendationSource || '',
    sourceReason: track.sourceReason || '',
    recommendationReason: track.recommendationReason || '',
    recommendationScore: track.recommendationScore
  };
}

function summarizeQueue({ currentTrack = null, playlist = [], limit = 5, scene = null, djPolicy = null, recommendation = null } = {}) {
  const safePlaylist = Array.isArray(playlist) ? playlist : [];
  const max = Math.max(1, Math.min(20, Number(limit) || 5));
  return {
    current: compactTrack(currentTrack),
    next: safePlaylist.slice(0, max).map(compactTrack).filter(Boolean),
    count: safePlaylist.length,
    scene,
    djPolicy,
    recommendation
  };
}

function removeNext(playlist = []) {
  const copy = Array.isArray(playlist) ? [...playlist] : [];
  const removed = copy.shift() || null;
  return { removed, playlist: copy };
}

function rebuildQueue(pool = []) {
  return Array.isArray(pool) ? [...pool] : [];
}

function insertNext(playlist = [], track = null) {
  const copy = Array.isArray(playlist) ? [...playlist] : [];
  return track ? [track, ...copy] : copy;
}

module.exports = {
  summarizeQueue,
  removeNext,
  rebuildQueue,
  insertNext
};
