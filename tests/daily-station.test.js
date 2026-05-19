const assert = require('assert');
const dailyStation = require('../server/daily-station');

async function run() {
  assert.strictEqual(dailyStation.getTimeSlot(new Date('2026-05-19T08:00:00+08:00')).id, 'morning');
  assert.strictEqual(dailyStation.getTimeSlot(new Date('2026-05-19T10:00:00+08:00')).id, 'work');
  assert.strictEqual(dailyStation.getTimeSlot(new Date('2026-05-19T12:30:00+08:00')).id, 'noon');
  assert.strictEqual(dailyStation.getTimeSlot(new Date('2026-05-19T15:00:00+08:00')).id, 'afternoon');
  assert.strictEqual(dailyStation.getTimeSlot(new Date('2026-05-19T21:00:00+08:00')).id, 'evening');
  assert.strictEqual(dailyStation.getTimeSlot(new Date('2026-05-19T23:30:00+08:00')).id, 'sleep');

  const morningKey = dailyStation.getBriefingKey(new Date('2026-05-19T08:00:00+08:00'));
  const morningKeyAgain = dailyStation.getBriefingKey(new Date('2026-05-19T08:30:00+08:00'));
  const workKey = dailyStation.getBriefingKey(new Date('2026-05-19T10:00:00+08:00'));
  assert.strictEqual(morningKey, morningKeyAgain);
  assert.notStrictEqual(morningKey, workKey);

  const fallback = dailyStation.fallbackBriefing({
    slot: dailyStation.getTimeSlot(new Date('2026-05-19T08:00:00+08:00')),
    weather: '北京，阴，22°C',
    recentPlays: [{ song_name: '晴天', artist: '周杰伦' }],
    tasteSignals: { topArtists: [{ name: '林俊杰', count: 3 }] }
  });
  assert.match(fallback, /早晨/);
  assert.match(fallback, /北京/);
  assert.match(fallback, /林俊杰|晴天/);

  let aiCalls = 0;
  const fakeStats = {
    saved: null,
    getDailyBriefing(key) {
      return this.saved?.key === key ? this.saved : null;
    },
    saveDailyBriefing(entry) {
      this.saved = entry;
      return entry;
    }
  };
  const fakeAi = {
    async generateDailyBriefing() {
      aiCalls += 1;
      return '早晨好，今天先用轻快一点的节奏，把状态慢慢打开。';
    }
  };

  const first = await dailyStation.getOrCreateBriefing({
    now: new Date('2026-05-19T08:00:00+08:00'),
    weather: '北京，阴，22°C',
    routinesText: '07:00 起床',
    tasteSignals: { topArtists: [] },
    recentPlays: [],
    stats: fakeStats,
    ai: fakeAi
  });
  const second = await dailyStation.getOrCreateBriefing({
    now: new Date('2026-05-19T08:20:00+08:00'),
    weather: '北京，阴，22°C',
    routinesText: '07:00 起床',
    tasteSignals: { topArtists: [] },
    recentPlays: [],
    stats: fakeStats,
    ai: fakeAi
  });

  assert.strictEqual(first.text, second.text);
  assert.strictEqual(aiCalls, 1);
  assert.strictEqual(first.cached, false);
  assert.strictEqual(second.cached, true);

  console.log('daily station tests passed');
}

run().catch((error) => {
  console.error(error);
  process.exit(1);
});
