const assert = require('assert');
const fs = require('fs');
const path = require('path');

process.env.QQ_MUSIC_COOKIE = 'uin=o123; qqmusic_key=test-key; qm_keyst=test-key';
const qqmusic = require('../server/qqmusic');

assert.deepStrictEqual(
  qqmusic.QQ_QUALITY_FALLBACKS.map(item => item.quality),
  ['M800', 'M500', 'C400', 'M128', 'C128']
);

qqmusic.resetQualityStrategy();
assert.deepStrictEqual(
  qqmusic.getQualityFallbacksForCurrentStrategy().map(item => item.quality),
  ['M800', 'M500', 'C400', 'M128', 'C128']
);

for (let i = 0; i < 2; i++) {
  qqmusic.recordQualityStrategyFromAttempts([
    { quality: 'M800', reason: 'empty purl' },
    { quality: 'M500', reason: 'empty purl' },
    { quality: 'C400', reason: 'empty purl' },
    { quality: 'M128', reason: 'CDN HTTP 206', status: 206 }
  ]);
}
assert.strictEqual(qqmusic.getQualityStrategyState().preferStable, true);
assert.deepStrictEqual(
  qqmusic.getQualityFallbacksForCurrentStrategy().map(item => item.quality),
  ['M128', 'C128', 'C400', 'M500', 'M800']
);

qqmusic.recordQualityStrategyFromAttempts([
  { quality: 'M800', reason: 'CDN HTTP 206', status: 206 }
]);
assert.strictEqual(qqmusic.getQualityStrategyState().preferStable, false);

assert.strictEqual(
  qqmusic.summarizeQualityAttempts([
    { quality: 'M800', reason: 'empty purl' },
    { quality: 'M500', reason: 'CDN HTTP 404' },
    { quality: 'C128', reason: 'empty purl' }
  ]),
  'M800: empty purl; M500: CDN HTTP 404; C128: empty purl'
);

assert.strictEqual(
  qqmusic.classifyPlaybackIssue({
    cookieConfigured: false,
    playbackKeyReady: false,
    attempts: []
  }).category,
  'missing_login'
);

assert.strictEqual(
  qqmusic.classifyPlaybackIssue({
    cookieConfigured: true,
    playbackKeyReady: false,
    attempts: [{ quality: 'M800', reason: 'empty purl' }]
  }).category,
  'missing_playback_auth'
);

assert.strictEqual(
  qqmusic.classifyPlaybackIssue({
    cookieConfigured: true,
    playbackKeyReady: true,
    attempts: [
      { quality: 'M800', reason: 'empty purl' },
      { quality: 'M500', reason: 'empty purl' }
    ]
  }).category,
  'membership_insufficient'
);

assert.strictEqual(
  qqmusic.classifyPlaybackIssue({
    cookieConfigured: true,
    playbackKeyReady: true,
    attempts: [{ quality: 'M800', reason: 'CDN HTTP 404' }]
  }).category,
  'cdn_rejected'
);

assert.strictEqual(
  qqmusic.classifyPlaybackIssue({
    cookieConfigured: true,
    playbackKeyReady: true,
    result: 'success',
    attempts: [{ quality: 'M800', reason: 'CDN HTTP 206', status: 206 }]
  }).category,
  'playable'
);

assert.strictEqual(
  qqmusic.classifyPlaybackIssue({
    cookieConfigured: true,
    playbackKeyReady: true,
    attempts: [{ quality: 'M800', reason: 'free trial only' }]
  }).category,
  'trial_only'
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

qqmusic.resetCookieHealth();
assert.strictEqual(qqmusic.getCookieHealth().suspectedExpired, false);
for (let i = 0; i < 3; i++) {
  qqmusic.recordCookieHealthFromAttempts([
    { quality: 'M800', reason: 'empty purl' },
    { quality: 'M500', reason: 'empty purl' },
    { quality: 'C400', reason: 'empty purl' },
    { quality: 'M128', reason: 'empty purl' },
    { quality: 'C128', reason: 'empty purl' }
  ]);
}
assert.strictEqual(qqmusic.getCookieHealth().suspectedExpired, true);
assert.match(qqmusic.getCookieHealth().message, /疑似过期，请扫码刷新/);

qqmusic.resetCookieHealth();
qqmusic.recordCookieHealthFromAttempts([
  { quality: 'M800', reason: 'CDN HTTP 404' },
  { quality: 'M500', reason: 'empty purl' }
]);
assert.strictEqual(qqmusic.getCookieHealth().suspectedExpired, false);

for (let i = 0; i < 3; i++) {
  qqmusic.recordCookieHealthFromAttempts([
    { quality: 'M800', reason: 'empty purl' },
    { quality: 'M500', reason: 'empty purl' },
    { quality: 'C400', reason: 'empty purl' },
    { quality: 'M128', reason: 'empty purl' },
    { quality: 'C128', reason: 'empty purl' }
  ]);
}
assert.strictEqual(qqmusic.getCookieHealth().suspectedExpired, true);
qqmusic.resetRuntimeState();
assert.strictEqual(qqmusic.getCookieHealth().suspectedExpired, false);

const source = fs.readFileSync(path.join(__dirname, '..', 'server', 'qqmusic.js'), 'utf8');
assert.match(source, /qualityAttempts\.push/);
assert.match(source, /recentUrlAttempts/);
assert.match(source, /attempts: qualityAttempts/);
assert.match(source, /_qqMediaMid/);

console.log('qqmusic quality fallback tests passed');
