'use strict';

const SLOTS = [
  { id: 'morning', label: '早晨', start: 7, end: 9, tone: '轻快一点，把状态打开' },
  { id: 'work', label: '工作时段', start: 9, end: 12, tone: '少打断，保持专注' },
  { id: 'noon', label: '午休', start: 12, end: 14, tone: '放松一点，给脑子留空' },
  { id: 'afternoon', label: '下午', start: 14, end: 18, tone: '稍微提神，稳住节奏' },
  { id: 'evening', label: '晚间', start: 18, end: 23, tone: '慢慢收束，适合放松' },
  { id: 'sleep', label: '睡前', start: 23, end: 24, tone: '低刺激，声音放轻' },
  { id: 'late', label: '深夜', start: 0, end: 7, tone: '安静陪伴，不吵醒夜色' }
];

function pad(value) {
  return String(value).padStart(2, '0');
}

function getLocalDateKey(now = new Date()) {
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
}

function getTimeSlot(now = new Date()) {
  const hour = now.getHours();
  return SLOTS.find(slot => hour >= slot.start && hour < slot.end) || SLOTS[0];
}

function getBriefingKey(now = new Date()) {
  return `${getLocalDateKey(now)}:${getTimeSlot(now).id}`;
}

function firstNamed(items = []) {
  const item = Array.isArray(items) ? items.find(entry => entry?.name || entry?.song_name) : null;
  return item?.name || item?.song_name || '';
}

function fallbackBriefing({ slot = getTimeSlot(), weather = '', recentPlays = [], tasteSignals = {} } = {}) {
  const artist = firstNamed(tasteSignals.topArtists);
  const recent = firstNamed(recentPlays);
  const hint = artist || recent;
  const weatherPart = weather ? `外面是${weather}，` : '';
  const tastePart = hint ? `延续一点 ${hint} 的气味，` : '';
  return `${slot.label}好，${weatherPart}${tastePart}${slot.tone}。我先替你把电台调到合适的位置。`;
}

async function getOrCreateBriefing({
  now = new Date(),
  weather = '',
  routinesText = '',
  tasteSignals = {},
  recentPlays = [],
  stats,
  ai
} = {}) {
  const slot = getTimeSlot(now);
  const key = getBriefingKey(now);
  const cached = stats?.getDailyBriefing?.(key);
  if (cached?.text) return { ...cached, cached: true };

  const input = { key, slot, weather, routinesText, tasteSignals, recentPlays };
  const generated = await ai?.generateDailyBriefing?.(input).catch(() => '');
  const text = generated || fallbackBriefing({ slot, weather, tasteSignals, recentPlays });
  const entry = {
    key,
    date: getLocalDateKey(now),
    slot: slot.id,
    slotLabel: slot.label,
    text,
    weather,
    created_at: Math.floor(now.getTime() / 1000)
  };
  const saved = stats?.saveDailyBriefing?.(entry) || entry;
  return { ...saved, cached: false };
}

module.exports = {
  getTimeSlot,
  getBriefingKey,
  fallbackBriefing,
  getOrCreateBriefing
};
