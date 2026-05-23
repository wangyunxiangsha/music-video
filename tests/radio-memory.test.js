const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');

const radioMemory = require('../server/radio-memory');

function writeJson(file, data) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, JSON.stringify(data, null, 2), 'utf8');
}

function readJson(file) {
  return JSON.parse(fs.readFileSync(file, 'utf8'));
}

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'claudio-memory-'));
const statsFile = path.join(tmp, 'data', 'stats.json');
const tasteFile = path.join(tmp, 'user', 'taste.md');
const backupDir = path.join(tmp, 'backups');

writeJson(statsFile, {
  prefs: { externalRecommendRatio: 0.25, secretLikeName: 'not-a-secret' },
  plays: [{ id: 1, song_name: 'A', artist: 'AA', played_at: 100 }],
  feedback: [{ id: 2, type: 'like', track_key: 'a::aa', created_at: 101 }],
  dailyBriefings: [{ key: '2026-05-23-morning', text: 'hi' }]
});
fs.mkdirSync(path.dirname(tasteFile), { recursive: true });
fs.writeFileSync(tasteFile, '# Taste\n\nLong term memory.', 'utf8');

const exported = radioMemory.createMemoryExport({ statsFile, tasteFile, now: new Date('2026-05-23T00:00:00Z') });
assert.strictEqual(exported.app, 'Claudio FM');
assert.strictEqual(exported.kind, 'radio-memory');
assert.strictEqual(exported.version, 1);
assert.strictEqual(exported.exportedAt, '2026-05-23T00:00:00.000Z');
assert.deepStrictEqual(exported.stats.prefs.externalRecommendRatio, 0.25);
assert.strictEqual(exported.profile.tasteMd, '# Taste\n\nLong term memory.');
assert.ok(!JSON.stringify(exported).includes('QQ_MUSIC_COOKIE'));
assert.ok(!JSON.stringify(exported).includes('DEEPSEEK_API_KEY'));

assert.throws(
  () => radioMemory.importMemory({ app: 'Other App' }, { statsFile, tasteFile, backupDir }),
  /Invalid Claudio memory backup/
);

const incoming = {
  app: 'Claudio FM',
  kind: 'radio-memory',
  version: 1,
  exportedAt: '2026-05-23T00:01:00.000Z',
  profile: { tasteMd: '# Imported Taste\n\nReliable memory.' },
  stats: {
    prefs: { externalRecommendRatio: 0.4, defaultSceneId: 'rain' },
    plays: [
      { id: 1, song_name: 'A', artist: 'AA', played_at: 100 },
      { id: 3, song_name: 'B', artist: 'BB', played_at: 110 }
    ],
    feedback: [
      { id: 2, type: 'like', track_key: 'a::aa', created_at: 101 },
      { id: 4, type: 'not_vibe', track_key: 'b::bb', created_at: 111 }
    ],
    dailyBriefings: [
      { key: '2026-05-23-morning', text: 'hi' },
      { key: '2026-05-23-evening', text: 'bye' }
    ]
  }
};

const result = radioMemory.importMemory(incoming, {
  statsFile,
  tasteFile,
  backupDir,
  now: new Date('2026-05-23T00:02:00Z')
});

assert.strictEqual(result.ok, true);
assert.strictEqual(result.imported.plays, 1);
assert.strictEqual(result.skipped.plays, 1);
assert.strictEqual(result.imported.feedback, 1);
assert.strictEqual(result.skipped.feedback, 1);
assert.strictEqual(result.imported.dailyBriefings, 1);
assert.strictEqual(result.skipped.dailyBriefings, 1);
assert.ok(result.backups.stats.endsWith('.bak'));
assert.ok(result.backups.taste.endsWith('.bak'));
assert.ok(fs.existsSync(result.backups.stats));
assert.ok(fs.existsSync(result.backups.taste));

const merged = readJson(statsFile);
assert.strictEqual(merged.prefs.externalRecommendRatio, 0.4);
assert.strictEqual(merged.prefs.defaultSceneId, 'rain');
assert.strictEqual(merged.plays.length, 2);
assert.strictEqual(merged.feedback.length, 2);
assert.strictEqual(merged.dailyBriefings.length, 2);
assert.strictEqual(fs.readFileSync(tasteFile, 'utf8'), '# Imported Taste\n\nReliable memory.');

console.log('radio memory tests passed');
