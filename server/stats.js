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
      feedback: Array.isArray(db.feedback) ? db.feedback : []
    };
  } catch {
    return { plays: [], prefs: {}, feedback: [] };
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
    recent: plays.slice(0, 30)
  };
}

function normalizeTrackKey(track = {}) {
  const artist = track.artist || track.artists?.[0]?.name || track.ar?.[0]?.name || '';
  const name = track.song_name || track.name || '';
  return `${String(name).trim().toLowerCase()}::${String(artist).trim().toLowerCase()}`;
}

function saveFeedback(action) {
  const db = load();
  const entry = {
    id: Date.now(),
    type: action.type,
    target: action.target || 'track',
    value: action.value || '',
    track_id: action.track?.id ? String(action.track.id) : '',
    track_key: action.track ? normalizeTrackKey(action.track) : '',
    song_name: action.track?.name || '',
    artist: action.track?.artists?.[0]?.name || action.track?.ar?.[0]?.name || '',
    category: action.track?.categoryName || '',
    created_at: Math.floor(Date.now() / 1000)
  };
  db.feedback.unshift(entry);
  if (db.feedback.length > 500) db.feedback = db.feedback.slice(0, 500);
  save(db);
  return entry;
}

function getFeedbackSignals(limit = 200) {
  const events = load().feedback.slice(0, limit);
  return {
    likedTrackKeys: new Set(events.filter(e => e.type === 'like' && e.track_key).map(e => e.track_key)),
    dislikedTrackKeys: new Set(events.filter(e => e.type === 'dislike' && e.track_key).map(e => e.track_key)),
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
  savePreference,
  getPreference,
  saveFeedback,
  getFeedbackSignals,
  isTrackBlocked
};
