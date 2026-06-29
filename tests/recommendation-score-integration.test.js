const assert = require('assert');
const fs = require('fs');
const path = require('path');

const index = fs.readFileSync(path.join(__dirname, '..', 'server', 'index.js'), 'utf8');

assert.match(index, /const recommendationScore\s*=\s*require\('\.\/recommendation-score'\)/);
assert.match(index, /recommendationScore\.scoreTrack/);
assert.match(index, /recommendationScore\.annotateRecommendationReason/);

console.log('recommendation score integration tests passed');
