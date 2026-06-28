const assert = require('assert');
const fs = require('fs');
const path = require('path');

const app = fs.readFileSync(path.join(__dirname, '..', 'public', 'app.js'), 'utf8');
const server = fs.readFileSync(path.join(__dirname, '..', 'server', 'index.js'), 'utf8');

assert.match(app, /btnSettings\.onclick/);
assert.match(app, /refreshAccountStatus\(\)/);
assert.match(app, /refreshQqLoginStatus\(\)/);
assert.match(app, /refreshNeteaseLoginStatus\(\)/);

assert.match(app, /if \(qqLoginStart\) qqLoginStart\.onclick = startQqLogin/);
assert.match(app, /if \(neteaseLoginStart\) neteaseLoginStart\.onclick = startNeteaseLogin/);
assert.doesNotMatch(app, /[^.]startQqLogin\(\);/);
assert.doesNotMatch(app, /[^.]startNeteaseLogin\(\);/);
assert.doesNotMatch(app, /window\.onload[\s\S]*\/api\/qq-login\/start/);
assert.doesNotMatch(app, /window\.onload[\s\S]*\/api\/netease-login\/start/);

assert.match(server, /app\.post\('\/api\/qq-login\/start'/);
assert.match(server, /app\.post\('\/api\/netease-login\/start'/);

console.log('login nonblocking startup tests passed');
