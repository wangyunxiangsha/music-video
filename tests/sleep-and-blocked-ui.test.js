const assert = require('assert');
const fs = require('fs');
const path = require('path');

const html = fs.readFileSync(path.join(__dirname, '..', 'public', 'index.html'), 'utf8');
const js = fs.readFileSync(path.join(__dirname, '..', 'public', 'app.js'), 'utf8');
const css = fs.readFileSync(path.join(__dirname, '..', 'public', 'style.css'), 'utf8');
const server = fs.readFileSync(path.join(__dirname, '..', 'server', 'index.js'), 'utf8');

assert.match(html, /class="sleep-panel"/);
assert.match(html, /data-sleep-minutes="15"/);
assert.match(html, /data-sleep-minutes="30"/);
assert.match(html, /id="sleep-status"/);
assert.match(html, /class="blocked-panel"/);
assert.match(html, /id="blocked-list"/);
assert.match(html, /id="blocked-refresh"/);

assert.match(js, /function startSleepTimer/);
assert.match(js, /function cancelSleepTimer/);
assert.match(js, /function beginSleepFade/);
assert.match(js, /audio\.pause\(\)/);
assert.match(js, /document\.querySelectorAll\('\[data-sleep-minutes\]'\)/);
assert.match(js, /fetch\('\/api\/local-pool\/removed'\)/);
assert.match(js, /fetch\('\/api\/local-pool\/restore'/);
assert.match(js, /renderBlockedTracks/);

assert.match(css, /\.sleep-panel/);
assert.match(css, /\.blocked-panel/);
assert.match(css, /\.blocked-item/);

assert.match(server, /app\.get\('\/api\/local-pool\/removed'/);
assert.match(server, /app\.post\('\/api\/local-pool\/restore'/);
assert.match(server, /restoreRemovedTrack/);

console.log('sleep and blocked UI tests passed');
