'use strict';

const SLOTS = [
  { id: 'morning', label: '早晨', start: 7, end: 9, tone: '轻快一点，把状态打开' },
  { id: 'work', label: '工作时段', start: 9, end: 12, tone: '少打断，保持专注' },
  { id: 'noon', label: '午休', start: 12, end: 14, tone: '放松一点，给脑子留空' },
  { id: 'afternoon', label: '下午', start: 14, end: 18, tone: '稍微提神，稳住节奏' },
  { id: 'evening_commute', label: '傍晚通勤', start: 18, end: 20, tone: '提一点精神，陪你从工作里出来' },
  { id: 'evening', label: '晚间', start: 20, end: 22, tone: '慢慢收束，适合放松' },
  { id: 'night_low', label: '夜间低音量', start: 22, end: 23, tone: '降低刺激，把音量和情绪都放轻' },
  { id: 'sleep', label: '睡前', start: 23, end: 24, tone: '低刺激，声音放轻' },
  { id: 'late', label: '深夜', start: 0, end: 7, tone: '安静陪伴，不吵醒夜色' }
];

const STRATEGIES = {
  morning: {
    scene: { id: 'commute_energy', name: '通勤提神' },
    djPolicyMode: 'short',
    recommendedVolume: 0.72,
    reason: '早晨轻启动，稍微提神但不一下子拉满'
  },
  work: {
    scene: { id: 'focus_work', name: '工作专注' },
    djPolicyMode: 'minimal',
    recommendedVolume: 0.58,
    reason: '工作时段少打断，优先保持专注'
  },
  noon: {
    scene: { id: 'sleep_low', name: '睡前低刺激' },
    djPolicyMode: 'minimal',
    recommendedVolume: 0.5,
    reason: '午休低刺激，让脑子短暂留白'
  },
  afternoon: {
    scene: { id: 'focus_work', name: '工作专注' },
    djPolicyMode: 'short',
    recommendedVolume: 0.64,
    reason: '下午稳住节奏，轻微提神'
  },
  evening_commute: {
    scene: { id: 'commute_energy', name: '通勤提神' },
    djPolicyMode: 'short',
    recommendedVolume: 0.74,
    reason: '傍晚通勤需要从工作状态里切出来'
  },
  evening: {
    scene: { id: 'rainy_quiet', name: '下雨安静' },
    djPolicyMode: 'warm',
    recommendedVolume: 0.58,
    reason: '晚间逐渐收束，适合放松'
  },
  night_low: {
    scene: { id: 'late_night', name: '深夜模式' },
    djPolicyMode: 'warm',
    recommendedVolume: 0.42,
    reason: '夜间低音量，降低人声和节奏刺激'
  },
  sleep: {
    scene: { id: 'sleep_low', name: '睡前低刺激' },
    djPolicyMode: 'minimal',
    recommendedVolume: 0.36,
    reason: '睡前减少刺激，慢慢降下来'
  },
  late: {
    scene: { id: 'late_night', name: '深夜模式' },
    djPolicyMode: 'warm',
    recommendedVolume: 0.38,
    reason: '深夜安静陪伴，不抢注意力'
  }
};

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

function getTimeSlotStrategy(now = new Date()) {
  const slot = getTimeSlot(now);
  return {
    slot,
    ...(STRATEGIES[slot.id] || STRATEGIES.morning)
  };
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
  getTimeSlotStrategy,
  getBriefingKey,
  fallbackBriefing,
  getOrCreateBriefing
};
