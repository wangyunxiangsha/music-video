'use strict';

async function pickPlayableTrack({ playlist = [], fallbackPlaylist = [], resolveUrl, maxAttempts = 8, isBlocked = () => false } = {}) {
  const queue = [
    ...(Array.isArray(playlist) ? playlist : []).map(track => ({ track, fallback: false })),
    ...(Array.isArray(fallbackPlaylist) ? fallbackPlaylist : []).map(track => ({ track, fallback: true }))
  ];
  const skipped = [];
  const attempts = Math.max(1, Number(maxAttempts) || 8);
  const seen = new Set();

  for (let i = 0; i < attempts && queue.length; i += 1) {
    const item = queue.shift();
    const candidate = item.track;
    const key = `${candidate?.source || ''}:${candidate?.id || candidate?.name || ''}`;
    if (key && seen.has(key)) {
      i -= 1;
      continue;
    }
    if (key) seen.add(key);
    if (isBlocked(candidate)) {
      skipped.push({
        ...candidate,
        playbackFailureReason: '已被本地播放记忆临时跳过'
      });
      i -= 1;
      continue;
    }
    try {
      const url = await resolveUrl(candidate);
      if (url) {
        return { track: candidate, remaining: queue.filter(entry => !entry.fallback).map(entry => entry.track), skipped };
      }
    } catch {}
    skipped.push({
      ...candidate,
      playbackFailureReason: '音源暂时不可用'
    });
  }

  return { track: null, remaining: queue.filter(entry => !entry.fallback).map(entry => entry.track), skipped };
}

module.exports = { pickPlayableTrack };
