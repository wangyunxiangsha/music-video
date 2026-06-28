const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');

const neteaseLogin = require('../server/netease-login-manager');

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'claudio-netease-login-'));
const envFile = path.join(tmp, '.env');
fs.writeFileSync(envFile, [
  'DEEPSEEK_API_KEY=abc',
  'NETEASE_COOKIE=old=value',
  'LOG_LEVEL=info'
].join('\n'), 'utf8');

const cookie = 'MUSIC_U=music-user-token; __csrf=csrf-token; NMTID=nmtid-token';
const parsed = neteaseLogin.parseCookieStatus(cookie);
assert.strictEqual(parsed.musicU.present, true);
assert.strictEqual(parsed.csrf.present, true);
assert.strictEqual(parsed.fieldCount, 3);

const updated = neteaseLogin.updateEnvCookie(envFile, cookie);
assert.strictEqual(updated.ok, true);
const text = fs.readFileSync(envFile, 'utf8');
assert.match(text, /^NETEASE_COOKIE=MUSIC_U=music-user-token;/m);
assert.match(text, /^LOG_LEVEL=info$/m);
assert.doesNotMatch(text, /DEEPSEEK_API_KEY=.*MUSIC_U/);

const addedEnv = path.join(tmp, '.env.new');
fs.writeFileSync(addedEnv, 'LOG_LEVEL=debug\n', 'utf8');
neteaseLogin.updateEnvCookie(addedEnv, cookie);
assert.match(fs.readFileSync(addedEnv, 'utf8'), /^NETEASE_COOKIE=MUSIC_U=music-user-token;/m);

let step = 0;
const calls = [];
async function request(endpoint, params) {
  calls.push({ endpoint, params });
  if (endpoint === '/login/qr/key') {
    return { data: { unikey: 'qr-key-1' } };
  }
  if (endpoint === '/login/qr/create') {
    assert.strictEqual(params.key, 'qr-key-1');
    assert.strictEqual(params.qrimg, true);
    return { data: { qrimg: 'data:image/png;base64,abc' } };
  }
  if (endpoint === '/login/qr/check') {
    step += 1;
    return step === 1
      ? { code: 801, message: 'waiting' }
      : { code: 803, message: 'ok', cookie };
  }
  throw new Error(`unexpected endpoint ${endpoint}`);
}

neteaseLogin.cancelLogin();
neteaseLogin.startLogin({
  request,
  envFile,
  pollIntervalMs: 20,
  onCookieUpdated: (nextCookie) => {
    assert.strictEqual(nextCookie, cookie);
    process.env.NETEASE_LOGIN_TEST_REFRESHED = String(Number(process.env.NETEASE_LOGIN_TEST_REFRESHED || 0) + 1);
  }
}).then((initial) => {
  assert.strictEqual(initial.status, 'waiting_scan');
  assert.strictEqual(initial.qrDataUrl, 'data:image/png;base64,abc');
});

setTimeout(() => {
  const done = neteaseLogin.getStatus({ env: { NETEASE_COOKIE: cookie } });
  assert.strictEqual(done.status, 'done');
  assert.strictEqual(done.message, '网易云音乐登录已刷新');
  assert.strictEqual(done.cookie.musicU.present, true);
  assert.strictEqual(process.env.NETEASE_LOGIN_TEST_REFRESHED, '1');
  assert.match(fs.readFileSync(envFile, 'utf8'), /^NETEASE_COOKIE=MUSIC_U=music-user-token;/m);
  assert.deepStrictEqual(calls.map(call => call.endpoint), [
    '/login/qr/key',
    '/login/qr/create',
    '/login/qr/check',
    '/login/qr/check'
  ]);
  neteaseLogin.cancelLogin();
  console.log('netease login manager tests passed');
}, 120);
