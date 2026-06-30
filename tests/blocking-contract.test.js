const assert = require('assert');
const fs = require('fs');
const path = require('path');

const server = fs.readFileSync(path.join(__dirname, '..', 'server', 'index.js'), 'utf8');
const stats = fs.readFileSync(path.join(__dirname, '..', 'server', 'stats.js'), 'utf8');

const nextTrack = server.match(/async function nextTrack\(\{[\s\S]*?\n\}/)?.[0] || '';
assert.match(nextTrack, /isTrackPlaybackBlocked/, 'nextTrack should combine playback failures and feedback blocks');
assert.match(nextTrack, /fallbackPlaylist:\s*playbackMemory\.recentPlayable\(12\)\.filter\(track => !isTrackPlaybackBlocked\(track\)\)/);

assert.match(server, /function isTrackPlaybackBlocked\(track\)/);
assert.match(server, /playbackMemory\.isBlocked\(track\) \|\| stats\.isTrackBlocked\(track,\s*\{ limit: 500 \}\)/);

assert.match(stats, /function isTrackBlocked\(track,\s*\{ limit = 500 \} = \{\}\)/);
assert.match(stats, /getFeedbackSignals\(limit\)/);

console.log('blocking contract tests passed');
