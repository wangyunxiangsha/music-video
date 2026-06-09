'use strict';

function trackName(track) {
  return track?.name || '下一首';
}

function skippedNotice(skippedCount, track) {
  if (!skippedCount) return '';
  if (track) {
    return `已跳过 ${skippedCount} 首暂时打不开的候选，正在播放《${trackName(track)}》。`;
  }
  return `前 ${skippedCount} 首暂时打不开，已从队列移除，请再点下一首。`;
}

function applyPlayablePick(picked = {}) {
  const skipped = Array.isArray(picked.skipped) ? picked.skipped : [];
  const playlist = Array.isArray(picked.remaining) ? picked.remaining : [];
  const track = picked.track || null;
  const skippedCount = skipped.length;

  return {
    track,
    playlist,
    skipped,
    skippedCount,
    playbackNotice: skippedNotice(skippedCount, track)
  };
}

module.exports = {
  applyPlayablePick
};
