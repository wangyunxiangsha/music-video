'use strict';

const REQUIRED_WARNINGS = [
  {
    key: 'DEEPSEEK_API_KEY',
    present: (env) => Boolean(env.DEEPSEEK_API_KEY),
    message: 'DeepSeek API Key 未配置，DJ 播报和聊天会降级。'
  },
  {
    key: 'QQ_MUSIC_COOKIE',
    present: (env, options) => Boolean(env.QQ_MUSIC_COOKIE) || options.qqEnabled,
    message: 'QQ 音乐 Cookie 未配置，QQ 歌单和 QQ 播放能力会不可用。'
  },
  {
    key: 'WEATHER_KEY',
    present: (env) => Boolean(env.AMAP_WEATHER_KEY || env.OPENWEATHER_API_KEY),
    message: '天气 Key 未配置，每日电台和 DJ 上下文会跳过天气。'
  }
];

function configured(value) {
  return value ? 'configured' : 'missing';
}

function weatherProvider(env = {}) {
  if (env.AMAP_WEATHER_KEY) return 'amap';
  if (env.OPENWEATHER_API_KEY) return 'openweather';
  return 'missing';
}

function runStartupSelfCheck({ env = process.env, qqEnabled = false } = {}) {
  const warnings = REQUIRED_WARNINGS
    .filter(check => !check.present(env, { qqEnabled }))
    .map(check => ({ key: check.key, message: check.message }));
  const summary = warnings.length
    ? `启动自检：${warnings.map(item => item.message).join(' ')}`
    : '启动自检：关键配置已就绪。';
  return {
    ok: true,
    warnings,
    summary
  };
}

function buildHealthSnapshot({
  port = null,
  startedAt = null,
  env = process.env,
  qqCircuit = {},
  playbackDiagnostics = {},
  playbackMemory = {},
  weather = ''
} = {}) {
  const selfCheck = runStartupSelfCheck({
    env,
    qqEnabled: Boolean(env.QQ_MUSIC_COOKIE)
  });
  return {
    ok: true,
    generatedAt: new Date().toISOString(),
    service: {
      name: 'Claudio FM',
      port,
      startedAt,
      uptimeSeconds: Math.round(process.uptime())
    },
    config: {
      deepseek: configured(env.DEEPSEEK_API_KEY),
      qqMusicCookie: configured(env.QQ_MUSIC_COOKIE),
      weather: weatherProvider(env),
      port: env.PORT || ''
    },
    selfCheck,
    musicSources: {
      netease: { enabled: true },
      qq: {
        enabled: Boolean(env.QQ_MUSIC_COOKIE),
        circuit: qqCircuit
      }
    },
    playback: {
      consecutiveFailures: playbackDiagnostics.consecutiveFailures || 0,
      rebuildThreshold: playbackDiagnostics.rebuildThreshold || 0,
      lastSuccess: playbackDiagnostics.lastSuccess || null,
      lastRebuildAt: playbackDiagnostics.lastRebuildAt || null,
      recentFailures: playbackDiagnostics.recentFailures || [],
      memory: playbackMemory
    },
    weather: {
      current: weather || ''
    }
  };
}

module.exports = {
  buildHealthSnapshot,
  runStartupSelfCheck
};
