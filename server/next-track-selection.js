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

function skippedSummary(skipped = []) {
  return skipped
    .slice(0, 3)
    .map(item => item?.name || item?.id || '未知候选')
    .join('、');
}

function explainSwitch(skipped = [], track = null) {
  if (!skipped.length || !track) return '';
  const names = skippedSummary(skipped);
  const source = track.source === 'qq' ? 'QQ 音乐' : (track.source === 'netease' ? '网易云' : '当前音源');
  return `已跳过 ${skipped.length} 首暂时打不开的候选${names ? `（${names}）` : ''}，改用${source}播放。`;
}

function applyPlayablePick(picked = {}) {
  const skipped = Array.isArray(picked.skipped) ? picked.skipped : [];
  const playlist = Array.isArray(picked.remaining) ? picked.remaining : [];
  const track = picked.track || null;
  const skippedCount = skipped.length;

  const playbackSwitchReason = explainSwitch(skipped, track);
  const explainedTrack = track && playbackSwitchReason
    ? {
        ...track,
        playbackSwitchReason,
        playbackSkippedCandidates: skipped.map(item => ({
          id: item.id,
          name: item.name,
          source: item.source || '',
          reason: item.playbackFailureReason || '音源暂时不可用'
        }))
      }
    : track;

  return {
    track: explainedTrack,
    playlist,
    skipped,
    skippedCount,
    playbackNotice: skippedNotice(skippedCount, explainedTrack)
  };
}

module.exports = {
  applyPlayablePick
};
