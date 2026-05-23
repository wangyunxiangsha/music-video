require('dotenv').config();
const { OpenAI } = require('openai');
const logger = require('./logger');

let client = null;

function getClient() {
  if (!client && process.env.DEEPSEEK_API_KEY) {
    client = new OpenAI({
      apiKey: process.env.DEEPSEEK_API_KEY,
      baseURL: 'https://api.deepseek.com'
    });
  }
  return client;
}

const FALLBACK_TEMPLATES = [
  (t) => `接下来是 ${artistName(t)} 的《${t.name}》，把手头的事放轻一点，慢慢听。`,
  (t) => `${artistName(t)} 的《${t.name}》，给此刻留一点安静，让旋律自己展开。`,
  (t) => `下一首《${t.name}》。如果刚才有点累，就让 ${artistName(t)} 陪你缓一口气。`,
  (t) => `现在切到《${t.name}》。这首歌有自己的温度，适合慢慢听完。`,
];

function artistName(track) {
  return track.artists?.[0]?.name || track.ar?.[0]?.name || '未知艺术家';
}

function fallbackAnnouncement(track) {
  const fn = FALLBACK_TEMPLATES[Math.floor(Math.random() * FALLBACK_TEMPLATES.length)];
  return fn(track);
}

const MODEL = process.env.DEEPSEEK_MODEL || 'deepseek-chat';

function limitAnnouncement(text, policy) {
  const value = String(text || '').trim();
  const maxChars = Number(policy?.maxChars || 0);
  if (!maxChars || value.length <= maxChars) return value;
  return value.slice(0, maxChars).replace(/[，。,.、；;：:！？!?]?$/, '。');
}

async function generateAnnouncement(track, systemPrompt, policy) {
  if (policy?.mode === 'silent' || policy?.maxChars === 0) return '';

  const ai = getClient();
  if (!ai) return limitAnnouncement(fallbackAnnouncement(track), policy);

  const name = track.name || '未知歌曲';
  const artist = artistName(track);

  try {
    const response = await ai.chat.completions.create({
      model: MODEL,
      messages: [
        { role: 'system', content: systemPrompt },
        {
          role: 'user',
          content: `请以复古电台 DJ 的风格，用中文生成一段播报词，介绍接下来要播放的歌曲。歌曲：《${name}》，艺术家：${artist}。

要求：
- 优先遵守系统提示中的“当前 DJ 播报策略”。
- 长度控制在 20-40 个中文字符，朗读时间约 5 秒；如果策略要求更短或更安静，以策略为准。
- 1-2 个短句即可，不要写成长段落。
- 可以结合时间、情绪或一个简短画面引出歌曲。
- 风格温暖、沉稳、轻松亲切，像深夜电台里的老朋友。
- 不要说“大家好”“欢迎收听”“今天给大家分享”。`
        }
      ],
      max_tokens: 100,
      temperature: 0.9
    });
    return limitAnnouncement(response.choices[0].message.content, policy);
  } catch (e) {
    logger.warn('AI announcement error:', e.message);
    return limitAnnouncement(fallbackAnnouncement(track), policy);
  }
}

async function chat(message, history, systemPrompt) {
  const ai = getClient();
  if (!ai) {
    return '抱歉，AI DJ 暂时离线。请在 .env 文件中配置 DEEPSEEK_API_KEY。';
  }

  if (message.length > 500) message = message.slice(0, 500);

  try {
    const messages = [
      { role: 'system', content: systemPrompt },
      ...history.slice(-10),
      { role: 'user', content: message }
    ];

    const response = await ai.chat.completions.create({
      model: MODEL,
      messages,
      max_tokens: 300,
      temperature: 0.85
    });
    return response.choices[0].message.content.trim();
  } catch (e) {
    logger.warn('AI chat error:', e.message);
    return '信号有点弱，稍后再试~';
  }
}

async function generateTasteMd({ playlistNames, artists, sampleSongs }) {
  const ai = getClient();
  const artistList = artists.slice(0, 60).join('、');
  const songList   = sampleSongs.slice(0, 40).join('、');
  const plList     = playlistNames.join('、');

  const prompt = `以下是用户在网易云音乐创建的歌单名称、歌单中出现频率最高的艺术家、以及部分歌曲名。
请根据这些数据，用中文生成一份 taste.md 用户音乐品味档案，格式参考示例，内容要真实反映用户品味。

歌单名称：${plList}
高频艺术家：${artistList}
部分歌曲：${songList}

请输出完整的 Markdown 文件内容（包含 # 标题和各章节），不要输出任何额外说明。
格式参考：
# 我的音乐品味
## 喜欢的类型
## 喜欢的情绪
## 不喜欢
## 常听场景
## 近期关注`;

  if (!ai) return null;
  try {
    const response = await ai.chat.completions.create({
      model: MODEL,
      messages: [{ role: 'user', content: prompt }],
      max_tokens: 600,
      temperature: 0.7
    });
    return response.choices[0].message.content.trim();
  } catch (e) {
    logger.warn('generateTasteMd error:', e.message);
    return null;
  }
}

function fallbackDailyBriefing(input = {}) {
  const slotLabel = input.slot?.label || '现在';
  const weather = input.weather ? `外面是${input.weather}，` : '';
  const artist = input.tasteSignals?.topArtists?.[0]?.name || '';
  const taste = artist ? `顺着你最近常听的 ${artist}，` : '';
  return `${slotLabel}好，${weather}${taste}我先把电台调到适合这一刻的状态。`;
}

async function generateDailyBriefing(input = {}) {
  const ai = getClient();
  if (!ai) return fallbackDailyBriefing(input);

  const topArtists = (input.tasteSignals?.topArtists || []).slice(0, 4).map(item => item.name).join('、') || '暂无';
  const topCategories = (input.tasteSignals?.topCategories || []).slice(0, 4).map(item => item.name).join('、') || '暂无';
  const recentSongs = (input.recentPlays || []).slice(0, 4).map(item => item.song_name || item.name).filter(Boolean).join('、') || '暂无';

  try {
    const response = await ai.chat.completions.create({
      model: MODEL,
      messages: [
        {
          role: 'user',
          content: `请为私人 AI 音乐电台生成一句当前时段开场白。

时段：${input.slot?.label || '当前时段'}（${input.slot?.tone || '贴合当前状态'}）
天气：${input.weather || '未知'}
近期常听歌手：${topArtists}
近期常听类型：${topCategories}
最近播放：${recentSongs}
用户作息：
${input.routinesText || '暂无'}

要求：
- 中文，35-70 个字。
- 像私人电台 DJ 对一个人说话，不要像公告。
- 可以提到时间、天气、状态或听歌偏好，但不要堆信息。
- 不要说“大家好”。`
        }
      ],
      max_tokens: 140,
      temperature: 0.8
    });
    const text = response.choices[0].message.content.trim();
    return text || fallbackDailyBriefing(input);
  } catch (e) {
    logger.warn('generateDailyBriefing error:', e.message);
    return fallbackDailyBriefing(input);
  }
}

module.exports = { generateAnnouncement, chat, generateTasteMd, generateDailyBriefing };
