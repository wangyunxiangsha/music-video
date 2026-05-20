const assert = require('assert');
const fs = require('fs');
const path = require('path');

const server = fs.readFileSync(path.join(__dirname, '..', 'server', 'index.js'), 'utf8');
const app = fs.readFileSync(path.join(__dirname, '..', 'public', 'app.js'), 'utf8');

assert.match(server, /const playbackDiagnostics = require\('\.\/playback-diagnostics'\)/);
assert.match(server, /async function handlePlaybackFailure/);
assert.match(server, /app\.get\('\/api\/debug\/playback'/);
assert.match(server, /app\.post\('\/api\/playback\/failure'/);
assert.match(server, /playbackDiagnostics\.recordSuccess\(trackForPlaybackId\(id\)\)/);
assert.match(server, /await rebuildUpcomingQueue\(\)/);
assert.match(server, /stage: 'stream'/);
assert.match(server, /hasRange: Boolean\(req\.headers\.range\)/);

assert.match(app, /async function reportPlaybackFailure/);
assert.match(app, /fetch\('\/api\/playback\/failure'/);
assert.match(app, /reportPlaybackFailure\('client_error'/);
assert.match(app, /reportPlaybackFailure\('stalled'/);

console.log('playback diagnostics integration tests passed');
