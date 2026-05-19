const fs = require('fs');
const path = require('path');
const djPolicy = require('./dj-policy');

const ROOT = path.join(__dirname, '..');

function readFile(filePath, fallback = '') {
  try {
    return fs.readFileSync(filePath, 'utf8');
  } catch {
    return fallback;
  }
}

function getTimeContext() {
  const now = new Date();
  const hour = now.getHours();
  const timeStr = now.toLocaleString('zh-CN', {
    timeZone: 'Asia/Shanghai',
    hour12: false
  });
  let timeOfDay;
  if (hour >= 5 && hour < 9) timeOfDay = '早晨';
  else if (hour >= 9 && hour < 12) timeOfDay = '上午';
  else if (hour >= 12 && hour < 14) timeOfDay = '午间';
  else if (hour >= 14 && hour < 18) timeOfDay = '下午';
  else if (hour >= 18 && hour < 22) timeOfDay = '晚上';
  else timeOfDay = '深夜';
  return { timeStr, timeOfDay };
}

function buildSystemPrompt(extraContext = {}) {
  const djPersona = readFile(
    path.join(ROOT, 'prompts/dj-persona.md'),
    '你是一位轻松复古风格的电台 DJ，名叫 Claudio，用亲切自然的中文播报音乐。'
  );
  const taste = readFile(
    path.join(ROOT, 'user/taste.md'),
    '用户喜欢各类华语音乐。'
  );
  const routines = readFile(
    path.join(ROOT, 'user/routines.md'),
    ''
  );

  const { timeStr, timeOfDay } = getTimeContext();

  const parts = [
    djPersona,
    `\n## 用户音乐品味\n${taste}`,
    routines ? `\n## 用户日常习惯\n${routines}` : '',
    `\n## 当前环境\n- 时间：${timeStr}（${timeOfDay}）`,
    extraContext.weather ? `- 天气：${extraContext.weather}` : '',
    extraContext.recentPlays?.length
      ? `- 最近播放：${extraContext.recentPlays.map((p) => p.song_name).join('、')}`
      : '',
    extraContext.tasteSignals
      ? `\n## 自动学习到的近期偏好\n${formatTasteSignals(extraContext.tasteSignals)}`
      : '',
    extraContext.djPolicy
      ? `\n## 当前 DJ 播报策略\n${djPolicy.formatForPrompt(extraContext.djPolicy)}`
      : ''
  ];

  return parts.filter(Boolean).join('\n').trim();
}

function formatTasteSignals(signals) {
  const artists = signals.topArtists?.map(i => `${i.name}(${i.count})`).join('、') || '暂无';
  const categories = signals.topCategories?.map(i => `${i.name}(${i.count})`).join('、') || '暂无';
  const songs = signals.recentSongs?.join('、') || '暂无';
  return [
    `- 高频歌手：${artists}`,
    `- 高频类型：${categories}`,
    `- 最近常听：${songs}`,
    '- 推荐和播报时优先贴近这些近期偏好，但不要完全重复最近刚播过的歌。'
  ].join('\n');
}

module.exports = { buildSystemPrompt };
