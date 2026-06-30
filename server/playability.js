'use strict';

const BLOCKED_REASON = 'playback_memory_blocked';
const UNAVAILABLE_REASON = 'audio_source_unavailable';

function trackKey(candidate) {
  return `${candidate?.source || ''}:${candidate?.id || candidate?.name || ''}`;
}

function normalizeResolvedTrack(candidate, resolved) {
  if (!resolved) return null;
  if (typeof resolved === 'string') return candidate;
  if (resolved.url) return resolved.track || candidate;
  return null;
}

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
    const key = trackKey(candidate);
    if (key && seen.has(key)) {
      i -= 1;
      continue;
    }
    if (key) seen.add(key);
    if (isBlocked(candidate)) {
      skipped.push({
        ...candidate,
        playbackFailureReason: BLOCKED_REASON
      });
      i -= 1;
      continue;
    }
    try {
      const resolved = await resolveUrl(candidate);
      const playableTrack = normalizeResolvedTrack(candidate, resolved);
      if (playableTrack) {
        return { track: playableTrack, remaining: queue.filter(entry => !entry.fallback).map(entry => entry.track), skipped };
      }
    } catch {}
    skipped.push({
      ...candidate,
      playbackFailureReason: UNAVAILABLE_REASON
    });
  }

  return { track: null, remaining: queue.filter(entry => !entry.fallback).map(entry => entry.track), skipped };
}

async function precheckPlayableQueue({
  playlist = [],
  resolveUrl,
  targetCount = 5,
  maxAttempts = 10,
  isBlocked = () => false
} = {}) {
  const source = Array.isArray(playlist) ? playlist : [];
  const target = Math.max(1, Number(targetCount) || 5);
  const attempts = Math.max(target, Number(maxAttempts) || 10);
  const checked = [];
  const skipped = [];
  const seen = new Set();
  let cursor = 0;
  let probes = 0;

  while (cursor < source.length && checked.length < target && probes < attempts) {
    const candidate = source[cursor];
    cursor += 1;
    const key = trackKey(candidate);
    if (key && seen.has(key)) continue;
    if (key) seen.add(key);
    if (isBlocked(candidate)) {
      skipped.push({
        ...candidate,
        playbackFailureReason: BLOCKED_REASON
      });
      continue;
    }
    probes += 1;
    try {
      const resolved = await resolveUrl(candidate);
      const playableTrack = normalizeResolvedTrack(candidate, resolved);
      if (playableTrack) {
        checked.push(playableTrack);
        continue;
      }
    } catch {}
    skipped.push({
      ...candidate,
      playbackFailureReason: UNAVAILABLE_REASON
    });
  }

  const remaining = source.slice(cursor).filter(track => {
    const key = trackKey(track);
    return !key || !seen.has(key);
  });

  return {
    playlist: [...checked, ...remaining],
    skipped,
    checkedCount: checked.length
  };
}

module.exports = {
  BLOCKED_REASON,
  UNAVAILABLE_REASON,
  pickPlayableTrack,
  precheckPlayableQueue
};
