const assert = require('assert');
const fs = require('fs');
const path = require('path');

const server = fs.readFileSync(path.join(__dirname, '..', 'server', 'index.js'), 'utf8');
const app = fs.readFileSync(path.join(__dirname, '..', 'public', 'app.js'), 'utf8');

assert.match(server, /const playbackDiagnostics = require\('\.\/playback-diagnostics'\)/);
assert.match(server, /const playbackMemory = require\('\.\/playback-memory'\)/);
assert.match(server, /const playbackFailure = require\('\.\/playback-failure'\)/);
assert.match(server, /async function handlePlaybackFailure/);
assert.match(server, /playbackFailure\.shouldIgnorePlaybackFailure\(event\)/);
assert.match(server, /function knownTrackForPlaybackId/);
assert.match(server, /stale client playback failure/i);
assert.match(server, /app\.get\('\/api\/debug\/playback'/);
assert.match(server, /app\.post\('\/api\/playback\/failure'/);
assert.match(server, /playbackFailure\.friendlyPlaybackNotice/);
assert.match(server, /playbackNotice/);
assert.match(server, /playbackDiagnostics\.recordSuccess\(successfulTrack\)/);
assert.match(server, /playbackMemory\.recordFailure\(event\)/);
assert.match(server, /playbackMemory\.recordSuccess\(successfulTrack\)/);
assert.match(server, /playbackMemory\.filterBlocked/);
assert.match(server, /fallbackPlaylist: playbackMemory\.recentPlayable/);
assert.match(server, /playbackMemory: playbackMemory\.snapshot\(\)/);
assert.match(server, /await rebuildUpcomingQueue\(\)/);
assert.match(server, /stage: 'stream'/);
assert.match(server, /hasRange: Boolean\(req\.headers\.range\)/);
assert.match(server, /responseClosed: res\.destroyed \|\| res\.writableEnded/);

assert.match(app, /async function reportPlaybackFailure/);
assert.match(app, /fetch\('\/api\/playback\/failure'/);
assert.match(app, /reportPlaybackFailure\('client_error'/);
assert.match(app, /reportPlaybackFailure\('stalled'/);

console.log('playback diagnostics integration tests passed');
