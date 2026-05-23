const assert = require('assert');
const fs = require('fs');
const path = require('path');

const index = fs.readFileSync(path.join(__dirname, '..', 'server', 'index.js'), 'utf8');
const stats = fs.readFileSync(path.join(__dirname, '..', 'server', 'stats.js'), 'utf8');
const app = fs.readFileSync(path.join(__dirname, '..', 'public', 'app.js'), 'utf8');

assert.match(app, /requestNextTrack\('',\s*'manual_skip'\)/);
assert.match(app, /skipReason/);
assert.match(index, /skipReason/);
assert.match(index, /stats\.saveFeedback\(\{\s*type:\s*'skip'/);
assert.match(stats, /skippedTrackKeys/);
assert.match(stats, /skippedArtists/);
assert.match(stats, /skippedVersionKeywords/);
assert.match(index, /feedbackSignals\.skippedTrackKeys/);
assert.match(index, /feedbackSignals\.skippedArtists/);
assert.match(index, /feedbackSignals\.skippedVersionKeywords/);

console.log('skip learning tests passed');
