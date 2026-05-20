const assert = require('assert');
const fs = require('fs');
const path = require('path');

const index = fs.readFileSync(path.join(__dirname, '..', 'server', 'index.js'), 'utf8');
const mixer = fs.readFileSync(path.join(__dirname, '..', 'server', 'recommendation-mixer.js'), 'utf8');
const stats = fs.readFileSync(path.join(__dirname, '..', 'server', 'stats.js'), 'utf8');

assert.match(index, /isWhyThisSongCommand\(message\)/);
assert.match(index, /recommendationExplainer\.explainTrack\(currentTrack/);

assert.match(mixer, /recommendationReason/);
assert.match(mixer, /sourceReason/);

assert.match(stats, /temporaryReducedTrackKeys/);
assert.match(stats, /not_vibe/);
assert.match(stats, /expires_at/);

console.log('why this song chat tests passed');
