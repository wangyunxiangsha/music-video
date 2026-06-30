'use strict';

function ready(value) {
  return Boolean(value?.present);
}

function item(state, label, message) {
  return { state, label, message };
}

function buildAccountStatus({
  qqLoginStatus = {},
  qqCookieHealth = {},
  qqPlaybackAuth = {},
  qqSearchHealth = {},
  neteaseLoginStatus = {}
} = {}) {
  const qqCookie = qqLoginStatus.cookie || {};
  const qqLoggedIn = ready(qqCookie.uin) || ready(qqCookie.qqmusicKey) || ready(qqCookie.qmKeyst);
  const qqTokenReady = ready(qqCookie.qqmusicKey) || ready(qqCookie.qmKeyst);
  const qqPlaybackReady = Boolean(qqPlaybackAuth.playbackKeyReady);
  const neteaseCookie = neteaseLoginStatus.cookie || {};
  const neteaseLoggedIn = ready(neteaseCookie.musicU);

  return {
    qq: {
      label: 'QQ 音乐',
      login: item(
        qqLoggedIn ? 'ok' : 'missing',
        '登录',
        qqLoggedIn ? '账号 Cookie 已配置' : '未检测到 QQ 登录'
      ),
      playback: item(
        qqPlaybackReady ? 'ok' : (qqTokenReady ? 'warn' : 'warn'),
        '播放授权',
        qqPlaybackReady
          ? '播放票据可用'
          : (qqTokenReady ? '缺少播放授权，建议扫码刷新' : '缺少 QQ 音乐播放票据')
      ),
      cookie: item(
        qqCookieHealth.suspectedExpired ? 'warn' : (qqLoggedIn ? 'ok' : 'missing'),
        'Cookie 健康',
        qqCookieHealth.suspectedExpired
          ? (qqCookieHealth.message || 'QQ 音乐 Cookie 疑似过期')
          : (qqLoggedIn ? '未发现明显过期信号' : '等待配置 Cookie')
      ),
      search: item(
        qqSearchHealth.state || 'unknown',
        '搜索状态',
        qqSearchHealth.message || '尚未检测 QQ 搜索'
      )
    },
    netease: {
      label: '网易云',
      login: item(
        neteaseLoggedIn ? 'ok' : 'missing',
        '登录',
        neteaseLoggedIn ? '账号 Cookie 已配置' : '未检测到网易云登录'
      ),
      playback: item(
        neteaseLoggedIn ? 'ok' : 'unknown',
        '可播放状态',
        neteaseLoggedIn ? '登录 Cookie 已配置，播放能力以账号权益为准' : '未登录时可能只能播放公开可用歌曲'
      )
    }
  };
}

module.exports = {
  buildAccountStatus
};
