const fs   = require('fs');
const path = require('path');

const DATA_DIR = path.join(__dirname, '../data');
const DB_PATH  = path.join(DATA_DIR, 'stats.json');

fs.mkdirSync(DATA_DIR, { recursive: true });

function load() {
  try {
    const db = JSON.parse(fs.readFileSync(DB_PATH, 'utf8'));
    return {
      plays: Array.isArray(db.plays) ? db.plays : [],
      prefs: db.prefs || {},
      feedback: Array.isArray(db.feedback) ? db.feedback : [],
      dailyBriefings: Array.isArray(db.dailyBriefings) ? db.dailyBriefings : []
    };
  } catch {
    return { plays: [], prefs: {}, feedback: [], dailyBriefings: [] };
  }
}

function save(db) {
  fs.writeFileSync(DB_PATH, JSON.stringify(db, null, 2), 'utf8');
}

function savePlay(track) {
  const db   = load();
  const entry = {
    id:        Date.now(),
    song_id:   String(track.id),
    song_name: track.name || '',
    artist:    track.artists?.[0]?.name || track.ar?.[0]?.name || '',
    album:     track.album?.name || track.al?.name || '',
    category:  track.categoryName || '',
    category_ids: track.categoryIds || [],
    cover_url: track.album?.picUrl || track.al?.picUrl || '',
    recommendation_source: track.recommendationSource || '',
    recommendation_reason: track.recommendationReason || '',
    played_at: Math.floor(Date.now() / 1000)
  };
  db.plays.unshift(entry);
  if (db.plays.length > 200) db.plays = db.plays.slice(0, 200);
  save(db);
}

function getRecentPlays(limit = 20) {
  return load().plays.slice(0, limit);
}

function topBy(items, key, limit = 5) {
  const counts = {};
  for (const item of items) {
    const value = item[key];
    if (!value) continue;
    counts[value] = (counts[value] || 0) + 1;
  }
  return Object.entries(counts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, limit)
    .map(([name, count]) => ({ name, count }));
}

function getTasteSignals(limit = 80) {
  const plays = getRecentPlays(limit);
  return {
    topArtists: topBy(plays, 'artist', 6),
    topCategories: topBy(plays, 'category', 6),
    recentSongs: plays.slice(0, 8).map(p => p.song_name).filter(Boolean)
  };
}

function getHistorySummary(limit = 80) {
  const plays = getRecentPlays(limit);
  const uniqueSongs = new Set(plays.map(p => `${p.song_name}::${p.artist}`).filter(Boolean));
  const lastPlayedAt = plays[0]?.played_at || null;
  return {
    totalStored: load().plays.length,
    windowCount: plays.length,
    uniqueSongCount: uniqueSongs.size,
    lastPlayedAt,
    topArtists: topBy(plays, 'artist', 8),
    topCategories: topBy(plays, 'category', 8),
    todayReport: getTodayReport(),
    recent: plays.slice(0, 30)
  };
}

function startOfLocalDay(date = new Date()) {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return Math.floor(d.getTime() / 1000);
}

function localDateKey(date = new Date()) {
  const d = new Date(date);
  return [
    d.getFullYear(),
    String(d.getMonth() + 1).padStart(2, '0'),
    String(d.getDate()).padStart(2, '0')
  ].join('-');
}

function roundRatio(value) {
  return Math.round(value * 100) / 100;
}

function buildTodayReport({ now = new Date(), plays = [], feedback = [] } = {}) {
  const start = startOfLocalDay(now);
  const end = start + 24 * 60 * 60;
  const todayPlays = plays.filter((play) => play.played_at >= start && play.played_at < end);
  const todayFeedback = feedback.filter((item) => item.created_at >= start && item.created_at < end);
  const uniqueSongs = new Set(todayPlays.map(p => `${p.song_name}::${p.artist}`).filter(Boolean));
  const externalCount = todayPlays.filter((play) => play.recommendation_source === 'external').length;
  return {
    date: localDateKey(now),
    playCount: todayPlays.length,
    uniqueSongCount: uniqueSongs.size,
    externalCount,
    externalRatio: todayPlays.length ? roundRatio(externalCount / todayPlays.length) : 0,
    topArtists: topBy(todayPlays, 'artist', 5),
    topCategories: topBy(todayPlays, 'category', 5),
    skippedCategories: topBy(todayFeedback.filter((item) => item.type === 'skip'), 'category', 5),
    feedback: {
      skipCount: todayFeedback.filter((item) => item.type === 'skip').length,
      notVibeCount: todayFeedback.filter((item) => item.type === 'not_vibe').length,
      likeCount: todayFeedback.filter((item) => item.type === 'like').length,
      dislikeCount: todayFeedback.filter((item) => item.type === 'dislike').length
    },
    recent: todayPlays.slice(0, 12)
  };
}

function getTodayReport(now = new Date()) {
  const db = load();
  return buildTodayReport({ now, plays: db.plays, feedback: db.feedback });
}

function normalizeTrackKey(track = {}) {
  const artist = track.artist || track.artists?.[0]?.name || track.ar?.[0]?.name || '';
  const name = track.song_name || track.name || '';
  return `${String(name).trim().toLowerCase()}::${String(artist).trim().toLowerCase()}`;
}

function versionKeywords(name = '') {
  const text = String(name).toLowerCase();
  const hits = [];
  if (/live|concert|现场|演唱会/.test(text)) hits.push('live');
  if (/remix|mix|dj|混音/.test(text)) hits.push('remix');
  if (/demo|cover|翻唱|片段|剪辑|铃声/.test(text)) hits.push('variant');
  if (/伴奏|instrumental|karaoke/.test(text)) hits.push('instrumental');
  return hits;
}

function saveFeedback(action) {
  const db = load();
  const now = Math.floor(Date.now() / 1000);
  const entry = {
    id: Date.now(),
    type: action.type,
    target: action.target || 'track',
    value: action.value || '',
    temporary: Boolean(action.temporary),
    track_id: action.track?.id ? String(action.track.id) : '',
    track_key: action.track ? normalizeTrackKey(action.track) : '',
    song_name: action.track?.name || '',
    artist: action.track?.artists?.[0]?.name || action.track?.ar?.[0]?.name || '',
    category: action.track?.categoryName || '',
    created_at: now,
    expires_at: action.temporary ? now + 24 * 60 * 60 : null
  };
  db.feedback.unshift(entry);
  if (db.feedback.length > 500) db.feedback = db.feedback.slice(0, 500);
  save(db);
  return entry;
}

function getFeedbackSignals(limit = 200) {
  const now = Math.floor(Date.now() / 1000);
  const events = load().feedback
    .filter(e => !e.expires_at || e.expires_at > now)
    .slice(0, limit);
  return {
    likedTrackKeys: new Set(events.filter(e => e.type === 'like' && e.track_key).map(e => e.track_key)),
    dislikedTrackKeys: new Set(events.filter(e => e.type === 'dislike' && e.track_key).map(e => e.track_key)),
    skippedTrackKeys: new Set(events.filter(e => e.type === 'skip' && e.track_key).map(e => e.track_key)),
    skippedArtists: new Set(events.filter(e => e.type === 'skip' && e.artist).map(e => e.artist)),
    skippedVersionKeywords: new Set(events
      .filter(e => e.type === 'skip' && e.song_name)
      .flatMap(e => versionKeywords(e.song_name))),
    temporaryReducedTrackKeys: new Set(events.filter(e => e.type === 'not_vibe' && e.track_key).map(e => e.track_key)),
    blockedArtists: new Set(events.filter(e => e.type === 'block' && e.target === 'artist').map(e => e.value)),
    blockedCategories: new Set(events.filter(e => e.type === 'block' && e.target === 'category').map(e => e.value)),
    boostArtists: new Set(events.filter(e => e.type === 'boost' && e.target === 'artist').map(e => e.value)),
    reduceArtists: new Set(events.filter(e => e.type === 'reduce' && e.target === 'artist').map(e => e.value)),
    events
  };
}

function isTrackBlocked(track) {
  const signals = getFeedbackSignals();
  const artist = track?.artists?.[0]?.name || track?.ar?.[0]?.name || '';
  const category = track?.categoryName || '';
  const trackKey = normalizeTrackKey(track);
  return signals.dislikedTrackKeys.has(trackKey)
    || signals.blockedArtists.has(artist)
    || signals.blockedCategories.has(category);
}

function saveDailyBriefing(entry) {
  const db = load();
  const next = {
    key: entry.key,
    date: entry.date || '',
    slot: entry.slot || '',
    slotLabel: entry.slotLabel || '',
    text: entry.text || '',
    weather: entry.weather || '',
    created_at: entry.created_at || Math.floor(Date.now() / 1000)
  };
  db.dailyBriefings = db.dailyBriefings.filter(item => item.key !== next.key);
  db.dailyBriefings.unshift(next);
  if (db.dailyBriefings.length > 40) db.dailyBriefings = db.dailyBriefings.slice(0, 40);
  save(db);
  return next;
}

function getDailyBriefing(key) {
  if (!key) return null;
  return load().dailyBriefings.find(item => item.key === key) || null;
}

function savePreference(key, value) {
  const db = load();
  db.prefs[key] = value;
  save(db);
}

function getPreference(key, fallback = null) {
  return load().prefs[key] ?? fallback;
}

module.exports = {
  savePlay,
  getRecentPlays,
  getTasteSignals,
  getHistorySummary,
  getTodayReport,
  buildTodayReport,
  savePreference,
  getPreference,
  saveFeedback,
  getFeedbackSignals,
  isTrackBlocked,
  saveDailyBriefing,
  getDailyBriefing
};
