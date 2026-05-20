'use strict';

const MAX_FAILURES = Number(process.env.PLAYBACK_FAILURE_HISTORY_LIMIT || 40);
const REBUILD_THRESHOLD = Number(process.env.PLAYBACK_FAILURE_REBUILD_THRESHOLD || 3);

let consecutiveFailures = 0;
let lastSuccess = null;
let lastRebuildAt = null;
let recentFailures = [];

function artistOf(track) {
  return track?.artists?.[0]?.name || track?.ar?.[0]?.name || '';
}

function summarizeTrack(track) {
  if (!track) return null;
  return {
    id: track.id || null,
    source: track.source || (String(track.id || '').startsWith('qq:') ? 'qq' : 'netease'),
    name: track.name || '',
    artist: artistOf(track),
    album: track.album?.name || track.al?.name || ''
  };
}

function recordFailure(event = {}) {
  consecutiveFailures += 1;
  const entry = {
    at: new Date().toISOString(),
    stage: event.stage || 'unknown',
    reason: event.reason || 'unknown',
    status: event.status || null,
    hasRange: Boolean(event.hasRange),
    track: summarizeTrack(event.track),
    detail: event.detail || ''
  };
  recentFailures.unshift(entry);
  recentFailures = recentFailures.slice(0, MAX_FAILURES);

  return {
    entry,
    consecutiveFailures,
    shouldRebuild: consecutiveFailures >= REBUILD_THRESHOLD
  };
}

function recordSuccess(track) {
  consecutiveFailures = 0;
  lastSuccess = {
    at: new Date().toISOString(),
    track: summarizeTrack(track)
  };
  return lastSuccess;
}

function recordRebuild(reason = 'consecutive_failures') {
  lastRebuildAt = new Date().toISOString();
  consecutiveFailures = 0;
  return { at: lastRebuildAt, reason };
}

function snapshot() {
  return {
    consecutiveFailures,
    rebuildThreshold: REBUILD_THRESHOLD,
    lastSuccess,
    lastRebuildAt,
    recentFailures: [...recentFailures]
  };
}

function reset() {
  consecutiveFailures = 0;
  lastSuccess = null;
  lastRebuildAt = null;
  recentFailures = [];
}

module.exports = {
  recordFailure,
  recordSuccess,
  recordRebuild,
  snapshot,
  reset,
  summarizeTrack
};
