const assert = require('assert');
const fs = require('fs');
const path = require('path');

const app = fs.readFileSync(path.join(__dirname, '..', 'public', 'app.js'), 'utf8');
const index = fs.readFileSync(path.join(__dirname, '..', 'server', 'index.js'), 'utf8');

assert.match(app, /nextRequestTrackId/);
assert.match(app, /id:\s*trackId/);
assert.match(app, /skipReason,\s*id:\s*trackId/);
assert.match(app, /audio\.onended\s*=\s*\(\)\s*=>\s*requestNextTrack\('',\s*'',\s*'ended'\)/);
assert.match(app, /requestNextTrack\('',\s*'client_error',\s*'client_error'\)/);
assert.match(app, /requestNextTrack\('',\s*'stalled',\s*'stalled'\)/);
assert.match(app, /lastProgressAt = Date\.now\(\);\s*lastProgressTime = 0;\s*fill\.style\.width = '0%'/);
assert.match(app, /playbackNotice/);

assert.match(index, /const hasClientTrackId = id !== undefined && id !== null && id !== ''/);
assert.match(index, /if \(hasClientTrackId && !matchesCurrent\)/);
assert.match(index, /stale:\s*true/);
assert.match(index, /let nextRequestInFlight = null/);
assert.match(index, /let trialClipNextRequests = \[\]/);
assert.match(index, /function canAcceptTrialClipNext/);
assert.match(index, /nextRequestInFlight && nextRequestInFlight\.trackId === requestTrackId/);
assert.match(index, /duplicate:\s*true/);
assert.match(index, /trialLimited:\s*true/);
assert.match(index, /finally\s*{\s*if \(nextRequestInFlight === inFlight\) nextRequestInFlight = null;/);
assert.match(index, /await nextTrack\(\)/);
assert.match(index, /maxAttempts:\s*recoveryReasons\.has\(reason \|\| skipReason\) \? 8 : 1/);
assert.doesNotMatch(index, /picked\.track\s*\|\|\s*playlist\.shift\(\)/);

console.log('next track dedupe tests passed');
