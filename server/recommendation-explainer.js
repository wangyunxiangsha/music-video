'use strict';

function pct(value) {
  return `${Math.round(Math.max(0, Math.min(1, Number(value) || 0)) * 100)}%`;
}

function explainTrack(track = {}, context = {}) {
  if (!track) return '现在还没有正在播放的歌曲。';
  const name = track.name || '这首歌';
  const artist = track.artists?.[0]?.name || track.ar?.[0]?.name || '';
  const sceneName = context.scene?.name || '默认电台';
  const policyName = context.djPolicy?.name || '正常播报';
  const ratio = pct(context.recommendation?.externalRatio);
  const baseReason = track.recommendationReason
    || (track.recommendationSource === 'external'
      ? `因为「${track.sourceReason || '你的近期口味'}」推荐`
      : '来自你的歌单');
  const sourceText = track.recommendationSource === 'external'
    ? `这是外部推荐池里的候选，当前外部推荐比例约 ${ratio}。`
    : '这是从你的本地歌单池里选出来的。';
  const scoreText = Number.isFinite(Number(track.recommendationScore))
    ? `推荐分 ${Number(track.recommendationScore).toFixed(2)}。`
    : '';

  return [
    `《${name}》${artist ? ` - ${artist}` : ''}：${baseReason}。`,
    `当前场景是「${sceneName}」，DJ 策略是「${policyName}」。`,
    sourceText,
    scoreText
  ].join('');
}

module.exports = { explainTrack };
