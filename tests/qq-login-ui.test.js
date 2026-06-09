const assert = require('assert');
const fs = require('fs');
const path = require('path');

const server = fs.readFileSync(path.join(__dirname, '..', 'server', 'index.js'), 'utf8');
const qqmusic = fs.readFileSync(path.join(__dirname, '..', 'server', 'qqmusic.js'), 'utf8');
const html = fs.readFileSync(path.join(__dirname, '..', 'public', 'index.html'), 'utf8');
const js = fs.readFileSync(path.join(__dirname, '..', 'public', 'app.js'), 'utf8');
const css = fs.readFileSync(path.join(__dirname, '..', 'public', 'style.css'), 'utf8');
const docs = fs.readFileSync(path.join(__dirname, '..', 'doc', 'deployment.md'), 'utf8');
const helper = fs.readFileSync(path.join(__dirname, '..', 'scripts', 'qq-login-helper.py'), 'utf8');

assert.match(server, /const qqLoginManager\s*=\s*require\('\.\/qq-login-manager'\)/);
assert.match(server, /app\.get\('\/api\/qq-login\/status'/);
assert.match(server, /qqCookieHealth:\s*qqmusic\.getCookieHealth\(\)/);
assert.match(server, /app\.post\('\/api\/qq-login\/start'/);
assert.match(server, /app\.post\('\/api\/qq-login\/cancel'/);

assert.match(qqmusic, /function getQQCookie/);
assert.doesNotMatch(qqmusic, /const QQ_COOKIE = process\.env\.QQ_MUSIC_COOKIE/);

assert.match(html, /id="qq-login-start"/);
assert.match(html, /id="qq-login-qr"/);
assert.match(html, /id="qq-login-status"/);

assert.match(js, /refreshQqLoginStatus/);
assert.match(js, /startQqLogin/);
assert.match(js, /\/api\/qq-login\/start/);
assert.match(js, /\/api\/qq-login\/status/);
assert.match(js, /qqCookieHealth\?\.suspectedExpired/);
assert.match(js, /疑似过期，请扫码刷新/);

assert.match(css, /\.qq-login-panel/);
assert.match(css, /\.qq-login-qr/);

assert.match(docs, /QQ 音乐扫码刷新/);
assert.match(docs, /qqmusic-api-python/);

assert.match(helper, /ensure_ascii=True/);
assert.doesNotMatch(helper, /ensure_ascii=False/);
assert.match(helper, /client = Client\(\)/);
assert.match(helper, /safe_close/);
assert.doesNotMatch(helper, /async with Client/);

console.log('qq login ui tests passed');
