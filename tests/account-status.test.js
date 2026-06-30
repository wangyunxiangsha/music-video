const assert = require('assert');
const accountStatus = require('../server/account-status');

{
  const summary = accountStatus.buildAccountStatus({
    qqLoginStatus: {
      cookie: {
        uin: { present: true },
        qqmusicKey: { present: true },
        qmKeyst: { present: true }
      }
    },
    qqCookieHealth: { suspectedExpired: false },
    qqPlaybackAuth: { playbackKeyReady: true },
    qqSearchHealth: { state: 'ok', message: 'QQ 搜索最近正常' },
    neteaseLoginStatus: {
      cookie: { musicU: { present: true } }
    }
  });

  assert.strictEqual(summary.qq.login.state, 'ok');
  assert.strictEqual(summary.qq.playback.state, 'ok');
  assert.strictEqual(summary.qq.cookie.state, 'ok');
  assert.strictEqual(summary.qq.search.state, 'ok');
  assert.strictEqual(summary.qq.search.message, 'QQ 搜索最近正常');
  assert.strictEqual(summary.netease.login.state, 'ok');
  assert.match(summary.netease.playback.message, /登录 Cookie 已配置/);
}

{
  const summary = accountStatus.buildAccountStatus({
    qqLoginStatus: { cookie: {} },
    qqCookieHealth: { suspectedExpired: true, message: 'QQ 音乐 Cookie 疑似过期，请扫码刷新' },
    qqPlaybackAuth: { playbackKeyReady: false },
    qqSearchHealth: { state: 'warn', message: 'QQ 搜索接口最近失败，会先使用本地 QQ 歌单兜底' },
    neteaseLoginStatus: { cookie: {} }
  });

  assert.strictEqual(summary.qq.login.state, 'missing');
  assert.strictEqual(summary.qq.playback.state, 'warn');
  assert.strictEqual(summary.qq.cookie.state, 'warn');
  assert.strictEqual(summary.qq.search.state, 'warn');
  assert.match(summary.qq.search.message, /QQ 搜索接口最近失败/);
  assert.strictEqual(summary.qq.cookie.message, 'QQ 音乐 Cookie 疑似过期，请扫码刷新');
  assert.strictEqual(summary.netease.login.state, 'missing');
  assert.strictEqual(summary.netease.playback.state, 'unknown');
}

console.log('account status tests passed');
