const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');

const qqLogin = require('../server/qq-login-manager');

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'claudio-qq-login-'));
const envFile = path.join(tmp, '.env');
fs.writeFileSync(envFile, [
  'DEEPSEEK_API_KEY=abc',
  'QQ_MUSIC_COOKIE=old=value',
  'LOG_LEVEL=info'
].join('\n'), 'utf8');

const cookie = qqLogin.cookieFromCredential({ musicid: 123456789, musickey: 'music-key-value' });
assert.match(cookie, /uin=o123456789/);
assert.match(cookie, /qqmusic_key=music-key-value/);
assert.match(cookie, /qm_keyst=music-key-value/);
assert.ok(!cookie.includes('DEEPSEEK_API_KEY'));

const parsed = qqLogin.parseCookieStatus(cookie);
assert.strictEqual(parsed.uin.present, true);
assert.strictEqual(parsed.qqmusicKey.present, true);
assert.strictEqual(parsed.qmKeyst.present, true);
assert.strictEqual(parsed.fieldCount, 3);

const updated = qqLogin.updateEnvCookie(envFile, cookie);
assert.strictEqual(updated.ok, true);
const text = fs.readFileSync(envFile, 'utf8');
assert.match(text, /^QQ_MUSIC_COOKIE=uin=o123456789;/m);
assert.match(text, /^LOG_LEVEL=info$/m);

const addedEnv = path.join(tmp, '.env.new');
fs.writeFileSync(addedEnv, 'LOG_LEVEL=debug\n', 'utf8');
qqLogin.updateEnvCookie(addedEnv, cookie);
assert.match(fs.readFileSync(addedEnv, 'utf8'), /^QQ_MUSIC_COOKIE=uin=o123456789;/m);

const hangingHelper = path.join(tmp, 'hanging-helper.js');
fs.writeFileSync(hangingHelper, 'setTimeout(() => {}, 5000);\n', 'utf8');
qqLogin.cancelLogin();
qqLogin.startLogin({
  python: process.execPath,
  helperScript: hangingHelper,
  qrTimeoutMs: 50,
  envFile
});

setTimeout(() => {
  const status = qqLogin.getStatus();
  assert.strictEqual(status.status, 'error');
  assert.match(status.message, /QR generation timed out/);
  qqLogin.cancelLogin();

  const noisySuccessHelper = path.join(tmp, 'noisy-success-helper.js');
  fs.writeFileSync(noisySuccessHelper, [
    'console.log(JSON.stringify({ type: "credential", credential: { musicid: 987654321, musickey: "fresh-key" } }));',
    'console.error("raise RuntimeError(\'Event loop is closed\')");',
    'console.error("RuntimeError: Event loop is closed");'
  ].join('\n'), 'utf8');
  qqLogin.startLogin({
    python: process.execPath,
    helperScript: noisySuccessHelper,
    qrTimeoutMs: 500,
    envFile,
    onCookieUpdated: (cookie) => {
      assert.match(cookie, /qqmusic_key=fresh-key/);
      process.env.QQ_LOGIN_TEST_REFRESHED = String(Number(process.env.QQ_LOGIN_TEST_REFRESHED || 0) + 1);
    }
  });
  setTimeout(() => {
    const done = qqLogin.getStatus();
    assert.strictEqual(done.status, 'done');
    assert.strictEqual(done.message, 'QQ Music login refreshed');
    assert.doesNotMatch(done.message, /Event loop is closed/);
    assert.match(fs.readFileSync(envFile, 'utf8'), /^QQ_MUSIC_COOKIE=uin=o987654321; qqmusic_key=fresh-key; qm_keyst=fresh-key$/m);
    assert.strictEqual(process.env.QQ_LOGIN_TEST_REFRESHED, '1');
    console.log('qq login manager tests passed');
  }, 120);
}, 120);
