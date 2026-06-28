const assert = require('assert');
const failure = require('../server/playback-failure');

function run() {
  assert.strictEqual(failure.shouldIgnorePlaybackFailure({
    stage: 'stream',
    reason: 'upstream_stream_error',
    detail: 'aborted',
    responseClosed: true
  }), true);

  assert.strictEqual(failure.shouldIgnorePlaybackFailure({
    stage: 'stream',
    reason: 'upstream_stream_error',
    detail: 'aborted',
    responseClosed: false
  }), true);

  assert.strictEqual(failure.shouldIgnorePlaybackFailure({
    stage: 'stream',
    reason: 'upstream_stream_error',
    detail: 'Premature close',
    responseClosed: true
  }), true);

  assert.strictEqual(failure.shouldIgnorePlaybackFailure({
    stage: 'stream',
    reason: 'upstream_stream_error',
    detail: 'ECONNRESET',
    responseClosed: false
  }), false);

  assert.strictEqual(failure.shouldIgnorePlaybackFailure({
    stage: 'stream',
    reason: 'url_unavailable',
    status: 404,
    responseClosed: true
  }), false);

  assert.match(failure.friendlyPlaybackNotice({
    track: { name: '晴天', source: 'qq' },
    qqIssue: { category: 'missing_playback_auth' }
  }), /QQ 缺少播放授权/);

  assert.match(failure.friendlyPlaybackNotice({
    track: { name: '晴天', source: 'qq' },
    qqIssue: { category: 'membership_insufficient' }
  }), /QQ 当前会员权限可能不够/);

  assert.match(failure.friendlyPlaybackNotice({
    track: { name: '慢歌', source: 'netease' },
    reason: 'trial_clip'
  }), /网易云只有试听版/);

  assert.match(failure.friendlyPlaybackNotice({
    track: { name: '卡住的歌', source: 'netease' },
    reason: 'stalled'
  }), /播放卡住/);

  console.log('playback failure tests passed');
}

run();
