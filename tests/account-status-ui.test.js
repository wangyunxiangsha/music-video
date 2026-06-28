const assert = require('assert');
const fs = require('fs');
const path = require('path');

const server = fs.readFileSync(path.join(__dirname, '..', 'server', 'index.js'), 'utf8');
const html = fs.readFileSync(path.join(__dirname, '..', 'public', 'index.html'), 'utf8');
const js = fs.readFileSync(path.join(__dirname, '..', 'public', 'app.js'), 'utf8');
const css = fs.readFileSync(path.join(__dirname, '..', 'public', 'style.css'), 'utf8');

assert.match(server, /const accountStatus\s*=\s*require\('\.\/account-status'\)/);
assert.match(server, /app\.get\('\/api\/account-status'/);
assert.match(server, /accountStatus\.buildAccountStatus/);

assert.match(html, /id="account-status-panel"/);
assert.match(html, /id="account-status-list"/);

assert.match(js, /fetch\('\/api\/account-status'\)/);
assert.match(js, /function renderAccountStatus/);
assert.match(js, /refreshAccountStatus/);

assert.match(css, /\.account-status-panel/);
assert.match(css, /\.account-status-item\.ok/);
assert.match(css, /\.account-status-item\.warn/);
assert.match(css, /\.account-status-item\.missing/);

console.log('account status UI tests passed');
