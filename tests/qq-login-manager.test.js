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

console.log('qq login manager tests passed');
