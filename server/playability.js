'use strict';

async function pickPlayableTrack({ playlist = [], resolveUrl, maxAttempts = 8 } = {}) {
  const queue = Array.isArray(playlist) ? [...playlist] : [];
  const skipped = [];
  const attempts = Math.max(1, Number(maxAttempts) || 8);

  for (let i = 0; i < attempts && queue.length; i += 1) {
    const candidate = queue.shift();
    try {
      const url = await resolveUrl(candidate);
      if (url) {
        return { track: candidate, remaining: queue, skipped };
      }
    } catch {}
    skipped.push(candidate);
  }

  return { track: null, remaining: queue, skipped };
}

module.exports = { pickPlayableTrack };
