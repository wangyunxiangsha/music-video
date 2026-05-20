const assert = require('assert');
const fs = require('fs');
const path = require('path');
const qqmusic = require('../server/qqmusic');

assert.deepStrictEqual(
  qqmusic.QQ_QUALITY_FALLBACKS.map(item => item.quality),
  ['M800', 'M500', 'C400', 'M128', 'C128']
);

assert.strictEqual(
  qqmusic.summarizeQualityAttempts([
    { quality: 'M800', reason: 'empty purl' },
    { quality: 'M500', reason: 'CDN HTTP 404' },
    { quality: 'C128', reason: 'empty purl' }
  ]),
  'M800: empty purl; M500: CDN HTTP 404; C128: empty purl'
);

const source = fs.readFileSync(path.join(__dirname, '..', 'server', 'qqmusic.js'), 'utf8');
assert.match(source, /qualityAttempts\.push/);
assert.match(source, /recentUrlAttempts/);
assert.match(source, /attempts: qualityAttempts/);

console.log('qqmusic quality fallback tests passed');
