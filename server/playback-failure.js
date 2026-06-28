'use strict';

function normalizedDetail(event = {}) {
  return String(event.detail || event.message || '').trim().toLowerCase();
}

function isClosedResponseAbort(event = {}) {
  if (event.stage !== 'stream' || event.reason !== 'upstream_stream_error') return false;
  const detail = normalizedDetail(event);
  return detail === 'aborted' || detail.includes('premature close');
}

function shouldIgnorePlaybackFailure(event = {}) {
  return isClosedResponseAbort(event);
}

function trackName(track = {}) {
  return track.name || '这首歌';
}

function friendlyPlaybackNotice({ track = {}, reason = '', qqIssue = {} } = {}) {
  const name = trackName(track);
  const source = track.source || (String(track.id || '').startsWith('qq:') ? 'qq' : 'netease');

  if (source === 'qq') {
    if (qqIssue?.category === 'missing_login') {
      return 'QQ 音乐还没登录，我先换个音源试试；需要会员歌时可以到 SET 里扫码。';
    }
    if (qqIssue?.category === 'missing_playback_auth' || qqIssue?.category === 'cookie_expired') {
      return 'QQ 缺少播放授权或 Cookie 过期，我先换源播放；可以到 SET 里扫码刷新。';
    }
    if (qqIssue?.category === 'membership_insufficient') {
      return `QQ 当前会员权限可能不够播放《${name}》，我先换网易云或下一首试试。`;
    }
    if (qqIssue?.category === 'copyright_unavailable') {
      return `QQ 暂时不能播放《${name}》，可能是版权限制，我换个来源。`;
    }
    if (qqIssue?.category === 'cdn_rejected') {
      return `QQ 返回的播放地址被 CDN 拒绝，我先跳过《${name}》。`;
    }
    return `QQ 音源暂时打不开《${name}》，我先换下一首。`;
  }

  if (reason === 'trial_clip') {
    return `网易云只有试听版《${name}》，马上换下一首。`;
  }
  if (reason === 'stalled') {
    return `《${name}》播放卡住，已自动换歌。`;
  }
  if (reason === 'client_error') {
    return `《${name}》当前音源暂时打不开，已自动换歌。`;
  }
  return `《${name}》暂时播放失败，我先换下一首。`;
}

module.exports = {
  shouldIgnorePlaybackFailure,
  friendlyPlaybackNotice
};
