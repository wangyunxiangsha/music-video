const assert = require('assert');
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const html = fs.readFileSync(path.join(root, 'public', 'index.html'), 'utf8');
const app = fs.readFileSync(path.join(root, 'public', 'app.js'), 'utf8');
const css = fs.readFileSync(path.join(root, 'public', 'style.css'), 'utf8');

assert.match(html, /id="song-reason"/);
assert.match(app, /const songReason\s*=\s*\$\('song-reason'\)/);
assert.match(app, /function recommendationLabel/);
assert.match(app, /function recommendationHint/);
assert.match(app, /songReason\.textContent\s*=\s*recommendationLabel\(track\)/);
assert.match(app, /recommendationHint\(item\)/);
assert.doesNotMatch(app, /queue-reason-tag/);
assert.doesNotMatch(app, />WHY</);
assert.match(app, /recommendationScore/);
assert.match(app, /queue-reason/);
assert.doesNotMatch(css, /\.queue-reason-tag/);
assert.match(css, /\.song-reason/);
assert.match(css, /\.queue-reason/);

console.log('recommendation reason UI tests passed');
