const assert = require('assert');
const stats = require('../server/stats');

const base = new Date('2026-05-23T20:30:00+08:00');
const ts = (iso) => Math.floor(new Date(iso).getTime() / 1000);

{
  const report = stats.buildTodayReport({
    now: base,
    plays: [
      { song_name: '寄明月', artist: 'SING女团', category: '国风', recommendation_source: 'external', played_at: ts('2026-05-23T19:00:00+08:00') },
      { song_name: '夜笙歌', artist: 'SING女团', category: '国风', recommendation_source: 'local', played_at: ts('2026-05-23T18:00:00+08:00') },
      { song_name: '寄明月', artist: 'SING女团', category: '国风', recommendation_source: 'external', played_at: ts('2026-05-23T17:00:00+08:00') },
      { song_name: '昨天的歌', artist: '旧歌手', category: '怀旧', recommendation_source: 'local', played_at: ts('2026-05-22T23:59:00+08:00') }
    ],
    feedback: [
      { type: 'skip', category: '国风', created_at: ts('2026-05-23T19:30:00+08:00') },
      { type: 'not_vibe', created_at: ts('2026-05-23T19:35:00+08:00') },
      { type: 'skip', created_at: ts('2026-05-22T19:30:00+08:00') }
    ]
  });

  assert.strictEqual(report.playCount, 3);
  assert.strictEqual(report.date, '2026-05-23');
  assert.strictEqual(report.uniqueSongCount, 2);
  assert.strictEqual(report.externalCount, 2);
  assert.strictEqual(report.externalRatio, 0.67);
  assert.strictEqual(report.feedback.skipCount, 1);
  assert.strictEqual(report.feedback.notVibeCount, 1);
  assert.deepStrictEqual(report.topArtists[0], { name: 'SING女团', count: 3 });
  assert.deepStrictEqual(report.topCategories[0], { name: '国风', count: 3 });
  assert.deepStrictEqual(report.skippedCategories[0], { name: '国风', count: 1 });
}

{
  const empty = stats.buildTodayReport({ now: base, plays: [], feedback: [] });
  assert.strictEqual(empty.playCount, 0);
  assert.strictEqual(empty.uniqueSongCount, 0);
  assert.strictEqual(empty.externalRatio, 0);
  assert.deepStrictEqual(empty.topArtists, []);
  assert.deepStrictEqual(empty.feedback, { skipCount: 0, notVibeCount: 0, likeCount: 0, dislikeCount: 0 });
}

console.log('today report tests passed');
