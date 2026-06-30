const assert = require('assert');
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const app = fs.readFileSync(path.join(root, 'public', 'app.js'), 'utf8');
const server = fs.readFileSync(path.join(root, 'server', 'index.js'), 'utf8');
const stats = fs.readFileSync(path.join(root, 'server', 'stats.js'), 'utf8');

assert.match(server, /app\.post\('\/api\/playback\/progress'/);
assert.match(server, /stats\.savePlaybackProgress/);
assert.match(stats, /function savePlaybackProgress/);
assert.match(stats, /buildPlaybackProgressSignals/);

assert.match(app, /function reportPlaybackProgress/);
assert.match(app, /reportPlaybackProgress\('half_played'/);
assert.match(app, /reportPlaybackProgress\('completed'/);
assert.match(app, /reportPlaybackProgress\('quick_skip'/);
assert.match(app, /playbackProgressReported/);

console.log('playback progress integration tests passed');
