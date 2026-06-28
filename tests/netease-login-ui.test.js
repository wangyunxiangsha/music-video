const assert = require('assert');
const fs = require('fs');
const path = require('path');

const server = fs.readFileSync(path.join(__dirname, '..', 'server', 'index.js'), 'utf8');
const html = fs.readFileSync(path.join(__dirname, '..', 'public', 'index.html'), 'utf8');
const js = fs.readFileSync(path.join(__dirname, '..', 'public', 'app.js'), 'utf8');
const css = fs.readFileSync(path.join(__dirname, '..', 'public', 'style.css'), 'utf8');
const music = fs.readFileSync(path.join(__dirname, '..', 'server', 'music.js'), 'utf8');

assert.match(server, /const neteaseLoginManager\s*=\s*require\('\.\/netease-login-manager'\)/);
assert.match(server, /app\.get\('\/api\/netease-login\/status'/);
assert.match(server, /app\.post\('\/api\/netease-login\/start'/);
assert.match(server, /app\.post\('\/api\/netease-login\/cancel'/);

assert.match(html, /id="netease-login-start"/);
assert.match(html, /id="netease-login-qr"/);
assert.match(html, /id="netease-login-status"/);

assert.match(js, /\/api\/netease-login\/start/);
assert.match(js, /\/api\/netease-login\/status/);
assert.match(js, /renderNeteaseLoginStatus/);

assert.match(css, /\.netease-login-panel/);
assert.match(css, /\.netease-login-qr/);

assert.match(music, /function getNeteaseCookie/);
assert.match(music, /env\.NETEASE_COOKIE/);

console.log('netease login UI tests passed');
