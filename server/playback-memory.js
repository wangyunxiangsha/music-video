'use strict';

const DEFAULT_FAILURE_TTL_MS = Number(process.env.PLAYBACK_FAILURE_BLOCK_TTL_MS || 2 * 60 * 60 * 1000);
const DEFAULT_PLAYABLE_TTL_MS = Number(process.env.PLAYBACK_PLAYABLE_CACHE_TTL_MS || 6 * 60 * 60 * 1000);
const DEFAULT_MAX_FAILURES = Number(process.env.PLAYBACK_FAILURE_BLOCK_LIMIT || 80);
const DEFAULT_MAX_PLAYABLE = Number(process.env.PLAYBACK_PLAYABLE_CACHE_LIMIT || 40);

function artistOf(track) {
  return track?.artists?.[0]?.name || track?.ar?.[0]?.name || '';
}

function sourceOf(track) {
  return track?.source || (String(track?.id || '').startsWith('qq:') ? 'qq' : 'netease');
}

function trackKey(track) {
  if (!track) return '';
  if (track.id) return `${sourceOf(track)}:${String(track.id)}`;
  return `${String(track.name || '').trim().toLowerCase()}::${artistOf(track).trim().toLowerCase()}`;
}

function summarizeTrack(track) {
  if (!track) return null;
  return {
    id: track.id || null,
    source: sourceOf(track),
    name: track.name || '',
    artist: artistOf(track),
    album: track.album?.name || track.al?.name || ''
  };
}

function createPlaybackMemory(options = {}) {
  const failureTtlMs = Math.max(0, Number(options.failureTtlMs ?? DEFAULT_FAILURE_TTL_MS));
  const playableTtlMs = Math.max(0, Number(options.playableTtlMs ?? DEFAULT_PLAYABLE_TTL_MS));
  const maxFailures = Math.max(1, Number(options.maxFailures ?? DEFAULT_MAX_FAILURES));
  const maxPlayable = Math.max(1, Number(options.maxPlayable ?? DEFAULT_MAX_PLAYABLE));
  const now = typeof options.now === 'function' ? options.now : () => Date.now();
  const failures = new Map();
  const playable = new Map();
  let sequence = 0;

  function timeOf(event = {}) {
    if (typeof event.at === 'number') return event.at;
    const parsed = event.at ? Date.parse(event.at) : NaN;
    return Number.isFinite(parsed) ? parsed : now();
  }

  function prune() {
    const current = now();
    for (const [key, entry] of failures) {
      if (current - entry.at > failureTtlMs) failures.delete(key);
    }
    for (const [key, entry] of playable) {
      if (current - entry.at > playableTtlMs || failures.has(key)) playable.delete(key);
    }
    while (failures.size > maxFailures) failures.delete(failures.keys().next().value);
    while (playable.size > maxPlayable) playable.delete(playable.keys().next().value);
  }

  function recordFailure(event = {}) {
    const key = trackKey(event.track);
    if (!key) return null;
    const entry = {
      at: timeOf(event),
      order: sequence += 1,
      reason: event.reason || 'unknown',
      stage: event.stage || 'unknown',
      status: event.status || null,
      track: summarizeTrack(event.track)
    };
    failures.delete(key);
    failures.set(key, entry);
    playable.delete(key);
    prune();
    return entry;
  }

  function recordSuccess(track) {
    const key = trackKey(track);
    if (!key) return null;
    if (failures.has(key)) return null;
    const entry = {
      at: now(),
      order: sequence += 1,
      track: summarizeTrack(track),
      raw: track
    };
    playable.delete(key);
    playable.set(key, entry);
    prune();
    return entry.track;
  }

  function isBlocked(track) {
    prune();
    return failures.has(trackKey(track));
  }

  function filterBlocked(tracks = []) {
    prune();
    return (Array.isArray(tracks) ? tracks : []).filter(track => !failures.has(trackKey(track)));
  }

  function recentPlayable(limit = maxPlayable) {
    prune();
    return [...playable.values()]
      .sort((a, b) => (b.at - a.at) || (b.order - a.order))
      .slice(0, Math.max(0, Number(limit) || maxPlayable))
      .map(entry => ({ ...entry.raw }));
  }

  function preferPlayable(tracks = [], limit = maxPlayable) {
    const seen = new Set();
    const result = [];
    for (const track of [...(Array.isArray(tracks) ? tracks : []), ...recentPlayable(limit)]) {
      const key = trackKey(track);
      if (!key || seen.has(key) || isBlocked(track)) continue;
      seen.add(key);
      result.push(track);
    }
    return result;
  }

  function snapshot() {
    prune();
    const recentFailures = [...failures.values()]
      .sort((a, b) => (b.at - a.at) || (b.order - a.order))
      .slice(0, 10)
      .map(entry => ({
        at: new Date(entry.at).toISOString(),
        reason: entry.reason,
        stage: entry.stage,
        status: entry.status,
        track: entry.track
      }));
    const playableSnapshot = [...playable.values()]
      .sort((a, b) => (b.at - a.at) || (b.order - a.order))
      .slice(0, 10)
      .map(entry => entry.track);
    return {
      blockedCount: failures.size,
      recentPlayableCount: playable.size,
      failureTtlMs,
      playableTtlMs,
      recentFailures,
      recentPlayable: playableSnapshot
    };
  }

  function reset() {
    failures.clear();
    playable.clear();
  }

  return {
    recordFailure,
    recordSuccess,
    isBlocked,
    filterBlocked,
    recentPlayable,
    preferPlayable,
    snapshot,
    reset
  };
}

const defaultMemory = createPlaybackMemory();

module.exports = {
  createPlaybackMemory,
  ...defaultMemory
};
