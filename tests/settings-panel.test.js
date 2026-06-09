const assert = require('assert');
const fs = require('fs');
const path = require('path');

const html = fs.readFileSync(path.join(__dirname, '..', 'public', 'index.html'), 'utf8');
const js = fs.readFileSync(path.join(__dirname, '..', 'public', 'app.js'), 'utf8');
const css = fs.readFileSync(path.join(__dirname, '..', 'public', 'style.css'), 'utf8');
const server = fs.readFileSync(path.join(__dirname, '..', 'server', 'index.js'), 'utf8');

assert.match(html, /id="status-strip"/);
assert.match(html, /id="status-scene"/);
assert.match(html, /id="status-ratio"/);
assert.match(html, /id="status-dj"/);
assert.match(html, /id="btn-settings"[^>]*>SET<\/button>/);
assert.match(html, /id="settings-panel"/);
assert.match(html, /id="setting-external-enabled"/);
assert.match(html, /id="setting-external-ratio"/);
assert.match(html, /id="setting-dj-policy"/);
assert.match(html, /id="setting-scene"/);

assert.match(js, /fetch\('\/api\/settings'\)/);
assert.match(js, /fetch\('\/api\/settings', \{\s*method: 'PATCH'/);
assert.match(js, /renderStationStatus/);
assert.match(js, /renderSettingsPanel/);
assert.match(js, /btnSettings\.onclick/);

assert.match(css, /\.status-strip/);
assert.match(css, /\.settings-panel/);
assert.match(css, /grid-template-columns: repeat\(5, 1fr\)/);

assert.match(server, /app\.get\('\/api\/settings'/);
assert.match(server, /app\.patch\('\/api\/settings'/);
assert.match(server, /savePreference\('externalRecommendRatio'/);
assert.match(server, /savePreference\('externalRecommendEnabled'/);
assert.match(server, /savePreference\('defaultSceneId'/);

console.log('settings panel tests passed');
