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

assert.strictEqual(
  qqmusic.mediaMidFromSong({
    mid: '0018C4LJ40te4R',
    file: { media_mid: '003MEDIAID' }
  }),
  '003MEDIAID'
);

assert.strictEqual(
  qqmusic.mediaMidFromSong({
    mid: '0018C4LJ40te4R',
    file: { strMediaMid: '004STRMEDIA' }
  }),
  '004STRMEDIA'
);

assert.strictEqual(
  qqmusic.buildQQFilename('0018C4LJ40te4R', '003MEDIAID', 'M800', 'mp3'),
  'M8000018C4LJ40te4R003MEDIAID.mp3'
);

assert.strictEqual(
  qqmusic.buildQQFilename('0018C4LJ40te4R', '', 'M800', 'mp3'),
  'M8000018C4LJ40te4R.mp3'
);

const source = fs.readFileSync(path.join(__dirname, '..', 'server', 'qqmusic.js'), 'utf8');
assert.match(source, /qualityAttempts\.push/);
assert.match(source, /recentUrlAttempts/);
assert.match(source, /attempts: qualityAttempts/);
assert.match(source, /_qqMediaMid/);

console.log('qqmusic quality fallback tests passed');
