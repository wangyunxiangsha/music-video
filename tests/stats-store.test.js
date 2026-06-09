const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const store = require('../server/stats-store');

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'claudio-stats-store-'));
const file = path.join(tmp, 'stats.json');

assert.deepStrictEqual(store.normalizeStats({}), {
  plays: [],
  prefs: {},
  feedback: [],
  dailyBriefings: []
});

const normalized = store.normalizeStats({
  plays: [{ song_name: '夜笙歌' }],
  prefs: { stationMood: 'quiet' },
  feedback: 'bad',
  dailyBriefings: [{ key: '2026-05-25:night' }]
});
assert.strictEqual(normalized.plays.length, 1);
assert.deepStrictEqual(normalized.feedback, []);
assert.strictEqual(normalized.prefs.stationMood, 'quiet');

store.saveStats(file, normalized);
const loaded = store.loadStats(file);
assert.deepStrictEqual(loaded, normalized);

const report = store.storageReport(file, loaded);
assert.strictEqual(report.path, file);
assert.strictEqual(report.exists, true);
assert.strictEqual(report.counts.plays, 1);
assert.strictEqual(report.counts.feedback, 0);
assert.ok(report.bytes > 0);
assert.strictEqual(report.recommendation, 'healthy');

const large = store.storageReport(file, {
  plays: new Array(1500).fill({}),
  prefs: {},
  feedback: new Array(700).fill({}),
  dailyBriefings: []
});
assert.strictEqual(large.recommendation, 'consider_split');

console.log('stats store tests passed');
