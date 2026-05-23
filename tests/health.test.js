const assert = require('assert');
const health = require('../server/health');

{
  const snapshot = health.buildHealthSnapshot({
    port: 8081,
    startedAt: '2026-05-23T12:00:00.000Z',
    env: {
      DEEPSEEK_API_KEY: 'sk-test',
      QQ_MUSIC_COOKIE: 'uin=o123;',
      AMAP_WEATHER_KEY: 'amap',
      PORT: '8080'
    },
    qqCircuit: { open: true, failureCount: 3, recentUrlAttempts: [{ songmid: 'abc' }] },
    playbackDiagnostics: { consecutiveFailures: 2, recentFailures: [{ reason: 'stalled' }] },
    playbackMemory: { blockedCount: 4, recentPlayableCount: 9 }
  });

  assert.strictEqual(snapshot.ok, true);
  assert.strictEqual(snapshot.service.port, 8081);
  assert.strictEqual(snapshot.config.deepseek, 'configured');
  assert.strictEqual(snapshot.config.qqMusicCookie, 'configured');
  assert.strictEqual(snapshot.config.weather, 'amap');
  assert.strictEqual(snapshot.musicSources.qq.enabled, true);
  assert.strictEqual(snapshot.musicSources.qq.circuit.open, true);
  assert.strictEqual(snapshot.playback.consecutiveFailures, 2);
  assert.strictEqual(snapshot.playback.memory.blockedCount, 4);
}

{
  const checks = health.runStartupSelfCheck({
    env: {},
    qqEnabled: false
  });

  assert.strictEqual(checks.ok, true);
  assert.deepStrictEqual(checks.warnings.map(item => item.key), [
    'DEEPSEEK_API_KEY',
    'QQ_MUSIC_COOKIE',
    'WEATHER_KEY'
  ]);
  assert.match(checks.summary, /DeepSeek/);
  assert.match(checks.summary, /QQ/);
}

console.log('health tests passed');
