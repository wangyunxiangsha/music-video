require('dotenv').config();
const fs   = require('fs');
const path = require('path');
const axios = require('axios');

const DATA_FILE = path.join(__dirname, '../data/playlists.json');

function ensureDataDir() {
  const dir = path.dirname(DATA_FILE);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}

function resolveDataFile(options = {}) {
  return options.dataFile || DATA_FILE;
}

function loadLocal(options = {}) {
  const dataFile = resolveDataFile(options);
  try {
    if (fs.existsSync(dataFile)) return JSON.parse(fs.readFileSync(dataFile, 'utf8'));
  } catch {}
  return null;
}

function saveLocal(data, options = {}) {
  const dataFile = resolveDataFile(options);
  const dir = path.dirname(dataFile);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(dataFile, JSON.stringify(data, null, 2), 'utf8');
}

function ensureLocalShape(data = {}) {
  data.netease = data.netease || { playlists: [] };
  data.qq = data.qq || { playlists: [] };
  data.claudio = data.claudio || { playlists: [] };
  data.netease.playlists = Array.isArray(data.netease.playlists) ? data.netease.playlists : [];
  data.qq.playlists = Array.isArray(data.qq.playlists) ? data.qq.playlists : [];
  data.claudio.playlists = Array.isArray(data.claudio.playlists) ? data.claudio.playlists : [];
  data.claudio.removedTracks = Array.isArray(data.claudio.removedTracks) ? data.claudio.removedTracks : [];
  return data;
}

function trackKey(track = {}) {
  const source = track.source || (track.mid || String(track.id || '').startsWith('qq:') ? 'qq' : 'netease');
  if (source === 'qq') {
    const mid = track.mid || track._qqmid || String(track.id || '').replace(/^qq:/, '');
    return mid ? `qq:${mid}` : '';
  }
  const id = track.id || track._neteaseId || '';
  return id ? `netease:${id}` : '';
}

function songIdentityKey(track = {}) {
  const name = String(track.name || '').trim().toLowerCase().replace(/\s+/g, '');
  const artists = (track.artists || track.ar || [])
    .map(item => String(item.name || item || '').trim().toLowerCase().replace(/\s+/g, ''))
    .filter(Boolean)
    .sort()
    .join('/');
  return name && artists ? `${name}::${artists}` : '';
}

function removedTrackKeys(data = {}) {
  return new Set((data.claudio?.removedTracks || []).map(item => item.key).filter(Boolean));
}

function listRemovedTracks(options = {}) {
  const data = ensureLocalShape(loadLocal(options) || {});
  return [...data.claudio.removedTracks].sort((a, b) => String(b.removedAt || '').localeCompare(String(a.removedAt || '')));
}

function restoreRemovedTrack(key, options = {}) {
  if (!key) return { ok: false, reason: '缺少屏蔽歌曲 key' };
  const data = ensureLocalShape(loadLocal(options) || {});
  const before = data.claudio.removedTracks.length;
  const restored = data.claudio.removedTracks.find(item => item.key === key);
  data.claudio.removedTracks = data.claudio.removedTracks.filter(item => item.key !== key);
  if (data.claudio.removedTracks.length === before) {
    return { ok: false, reason: '这首歌不在屏蔽列表' };
  }
  data.lastUpdated = new Date().toISOString();
  saveLocal(data, options);
  return { ok: true, restored };
}

function cloneJson(value) {
  return JSON.parse(JSON.stringify(value || {}));
}

function normalizePlaylist(playlist = {}) {
  const songs = Array.isArray(playlist.songs) ? playlist.songs : [];
  return {
    ...playlist,
    id: String(playlist.id || ''),
    name: playlist.name || String(playlist.id || ''),
    songs,
    songCount: songs.length
  };
}

function playlistsById(playlists = []) {
  return new Map((playlists || []).map(playlist => [String(playlist.id || ''), normalizePlaylist(playlist)]));
}

function comparableSong(song = {}) {
  return JSON.stringify({
    id: song.id || '',
    mid: song.mid || '',
    mediaMid: song.mediaMid || '',
    name: song.name || '',
    artists: song.artists || [],
    album: song.album || ''
  });
}

function summarizePlatformMerge(existingPlaylists = [], incomingPlaylists = []) {
  const existingById = playlistsById(existingPlaylists);
  const incomingById = playlistsById(incomingPlaylists);
  const summary = {
    playlistsAdded: 0,
    playlistsRemoved: 0,
    addedSongs: 0,
    updatedSongs: 0,
    removedSongs: 0
  };

  for (const [playlistId, incoming] of incomingById.entries()) {
    const previous = existingById.get(playlistId);
    if (!previous) {
      summary.playlistsAdded += 1;
      summary.addedSongs += incoming.songs.length;
      continue;
    }

    const previousSongs = new Map((previous.songs || []).map(song => [trackKey(song), song]).filter(([key]) => key));
    const incomingKeys = new Set();
    for (const song of incoming.songs || []) {
      const key = trackKey(song);
      if (!key) continue;
      incomingKeys.add(key);
      const previousSong = previousSongs.get(key);
      if (!previousSong) {
        summary.addedSongs += 1;
      } else if (comparableSong(previousSong) !== comparableSong(song)) {
        summary.updatedSongs += 1;
      }
    }

    for (const [key] of previousSongs.entries()) {
      if (!incomingKeys.has(key)) summary.removedSongs += 1;
    }
  }

  for (const [playlistId, previous] of existingById.entries()) {
    if (!incomingById.has(playlistId)) {
      summary.playlistsRemoved += 1;
      summary.removedSongs += (previous.songs || []).length;
    }
  }

  return summary;
}

function mergeImportedPlaylists(existing = {}, imported = {}) {
  const current = ensureLocalShape(cloneJson(existing));
  const data = {
    ...current,
    lastUpdated: new Date().toISOString(),
    netease: { playlists: current.netease.playlists },
    qq: { playlists: current.qq.playlists },
    claudio: current.claudio
  };

  const summary = {
    netease: summarizePlatformMerge(current.netease.playlists, current.netease.playlists),
    qq: summarizePlatformMerge(current.qq.playlists, current.qq.playlists),
    preservedClaudioSongs: current.claudio.playlists.reduce((sum, playlist) => sum + (playlist.songs || []).length, 0),
    preservedRemovedTracks: current.claudio.removedTracks.length
  };

  if (imported.netease?.playlists) {
    const playlists = imported.netease.playlists.map(normalizePlaylist);
    summary.netease = summarizePlatformMerge(current.netease.playlists, playlists);
    data.netease = { playlists };
  }

  if (imported.qq?.playlists) {
    const playlists = imported.qq.playlists.map(normalizePlaylist);
    summary.qq = summarizePlatformMerge(current.qq.playlists, playlists);
    data.qq = { playlists };
  }

  return { data: ensureLocalShape(data), summary };
}

// ─── Netease ───────────────────────────────────────────────────────────────────
async function importNetease(music) {
  const log = [];
  try {
    const uid = await music.getUserAccount();
    if (!uid) { log.push('网易云：未检测到登录账号'); return { ok: false, log, playlists: [] }; }
    log.push(`网易云账号 UID: ${uid}`);

    const allPlaylists = await music.getUserPlaylists(uid);
    log.push(`获取到 ${allPlaylists.length} 个歌单`);

    const result = [];
    for (const pl of allPlaylists) {
      if (!pl.id) continue;
      try {
        const songs = await music.getPlaylistTracks(pl.id);
        const formatted = songs.map(t => ({
          id:      String(t.id),
          name:    t.name || '',
          artists: (t.ar || t.artists || []).map(a => a.name).filter(Boolean),
          album:   t.al?.name || t.album?.name || ''
        }));
        result.push({ id: String(pl.id), name: pl.name, songCount: formatted.length, songs: formatted });
        log.push(`  ✓ ${pl.name} (${formatted.length} 首)`);
      } catch (e) {
        log.push(`  ✗ ${pl.name}: ${e.message}`);
      }
    }
    return { ok: true, log, playlists: result };
  } catch (e) {
    log.push(`网易云导入失败: ${e.message}`);
    return { ok: false, log, playlists: [] };
  }
}

// ─── QQ Music ──────────────────────────────────────────────────────────────────
async function importQQ(qqmusic) {
  const log = [];
  if (!qqmusic.isEnabled()) { log.push('QQ音乐：未配置 QQ_MUSIC_COOKIE'); return { ok: false, log, playlists: [] }; }

  const uin = qqmusic.extractUin(process.env.QQ_MUSIC_COOKIE || '');
  log.push(`QQ音乐 UIN: ${uin}`);

  try {
    const disslist = await qqmusic.getUserPlaylists(uin);
    log.push(`获取到 ${disslist.length} 个歌单`);

    const result = [];
    for (const pl of disslist) {
      const dissid = pl.dissid || pl.tid;
      if (!dissid) continue;
      try {
        const songs = await qqmusic.getPlaylistSongs(dissid);
        const formatted = songs.map(s => ({
          mid:     s.mid || s.songmid || s.strMediaMid || '',
          mediaMid: qqmusic.mediaMidFromSong ? qqmusic.mediaMidFromSong(s) : (s.file?.media_mid || s.strMediaMid || ''),
          name:    s.name || s.title || s.songname || s.songorig || '',
          artists: (s.singer || []).map(a => a.name).filter(Boolean),
          album:   s.album?.name || s.albumname || ''
        })).filter(s => s.mid && s.name);
        result.push({ id: String(dissid), name: pl.diss_name || pl.name || dissid, songCount: formatted.length, songs: formatted });
        log.push(`  ✓ ${pl.diss_name || pl.name} (${formatted.length} 首)`);
      } catch (e) {
        log.push(`  ✗ ${pl.diss_name || dissid}: ${e.message}`);
      }
    }
    return { ok: true, log, playlists: result };
  } catch (e) {
    log.push(`QQ音乐导入失败: ${e.message}`);
    return { ok: false, log, playlists: [] };
  }
}

// ─── Main import ───────────────────────────────────────────────────────────────
async function importAll(music, qqmusic) {
  const existing = loadLocal() || {};
  const [netease, qq] = await Promise.all([
    importNetease(music),
    importQQ(qqmusic)
  ]);

  const { data, summary } = mergeImportedPlaylists(existing, {
    netease: netease.ok ? { playlists: netease.playlists } : null,
    qq: qq.ok ? { playlists: qq.playlists } : null
  });
  saveLocal(data);

  const totalSongs = [
    ...data.netease.playlists.flatMap(p => p.songs),
    ...data.qq.playlists.flatMap(p => p.songs),
    ...data.claudio.playlists.flatMap(p => p.songs || [])
  ];
  const summaryLog = [
    '',
    `增量同步：网易云 +${summary.netease.addedSongs} / 更新 ${summary.netease.updatedSongs} / 移除 ${summary.netease.removedSongs}`,
    `增量同步：QQ音乐 +${summary.qq.addedSongs} / 更新 ${summary.qq.updatedSongs} / 移除 ${summary.qq.removedSongs}`,
    `保留 Claudio 收藏 ${summary.preservedClaudioSongs} 首，屏蔽 ${summary.preservedRemovedTracks} 首`
  ];

  return {
    ok: netease.ok || qq.ok,
    log: [...netease.log, '', ...qq.log, ...summaryLog],
    neteaseCount: netease.playlists.length,
    qqCount:      qq.playlists.length,
    totalSongs:   totalSongs.length,
    syncSummary: summary
  };
}

// ─── Build analysis data for taste.md generation ──────────────────────────────
function buildTasteData() {
  const local = loadLocal();
  if (!local) return null;

  const allSongs = [
    ...(local.netease?.playlists || []).flatMap(p => p.songs || []),
    ...(local.qq?.playlists || []).flatMap(p => p.songs || []),
    ...(local.claudio?.playlists || []).flatMap(p => p.songs || [])
  ];
  const playlistNames = [
    ...(local.netease?.playlists || []).map(p => p.name),
    ...(local.qq?.playlists || []).map(p => p.name),
    ...(local.claudio?.playlists || []).map(p => p.name)
  ].filter(Boolean);

  const artistCount = {};
  allSongs.forEach(s => {
    (s.artists || []).forEach(a => {
      artistCount[a] = (artistCount[a] || 0) + 1;
    });
  });
  const artists = Object.entries(artistCount).sort((a, b) => b[1] - a[1]).map(([n]) => n);

  const seen = new Set();
  const sampleSongs = allSongs.map(s => s.name).filter(n => {
    if (!n || seen.has(n)) return false;
    seen.add(n); return true;
  });

  return { playlistNames, artists, sampleSongs, totalSongs: allSongs.length };
}

// ─── Build shuffled playlist pool from local data ─────────────────────────────
function buildPlaylistPool(options = {}) {
  const local = ensureLocalShape(loadLocal(options) || {});
  if (!local) return [];
  const blocked = removedTrackKeys(local);

  let neteaseSongs = (local.netease?.playlists || []).flatMap(p =>
    p.songs.map(s => ({ id: s.id, name: s.name, artists: s.artists.map(n => ({ name: n })), album: { name: s.album }, privilege: { pl: 1 } }))
  );
  const qqSongs = (local.qq?.playlists || []).flatMap(p =>
    p.songs.map(s => ({
      id: `qq:${s.mid}`,
      source: 'qq',
      _qqmid: s.mid,
      _qqMediaMid: s.mediaMid || '',
      name: s.name,
      artists: s.artists.map(n => ({ name: n })),
      album: { name: s.album },
      privilege: { pl: 1 }
    }))
  );
  const qqSongIdentities = new Set(qqSongs.map(songIdentityKey).filter(Boolean));
  neteaseSongs = neteaseSongs.filter(song => !qqSongIdentities.has(songIdentityKey(song)));
  const claudioSongs = (local.claudio?.playlists || []).flatMap(p =>
    (p.songs || []).map(s => {
      const source = s.source || (s.mid ? 'qq' : 'netease');
      const id = source === 'qq'
        ? `qq:${s.mid || String(s.id || '').replace(/^qq:/, '')}`
        : String(s.id || '');
      return {
        id,
        source,
        _qqmid: s.mid || '',
        _qqMediaMid: s.mediaMid || '',
        name: s.name,
        artists: (s.artists || []).map(n => ({ name: n })),
        album: { name: s.album },
        privilege: { pl: 1 },
        recommendationSource: 'local',
        recommendationReason: '来自 Claudio 收藏'
      };
    })
  );

  // Deduplicate. Prefer QQ copies for the same song because the Netease copy
  // often degrades to a preview clip even when the user's QQ account can play it.
  const seen = new Set();
  const unique = [...qqSongs, ...neteaseSongs, ...claudioSongs].filter(s => {
    const key = trackKey(s);
    if (!s.id || !key || blocked.has(key) || seen.has(key)) return false;
    seen.add(key);
    return true;
  });

  // Shuffle
  for (let i = unique.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [unique[i], unique[j]] = [unique[j], unique[i]];
  }
  return unique;
}

function normalizeSearchText(value = '') {
  return String(value).trim().toLowerCase().replace(/\s+/g, '');
}

function artistNamesOf(song = {}) {
  return (song.artists || []).map(name => String(name || '')).filter(Boolean);
}

function localQqSongToTrack(song = {}) {
  if (!song.mid) return null;
  return {
    id: `qq:${song.mid}`,
    source: 'qq',
    _qqmid: song.mid,
    _qqMediaMid: song.mediaMid || '',
    name: song.name || '',
    artists: artistNamesOf(song).map(name => ({ name })),
    album: { name: song.album || '' },
    privilege: { pl: 1 },
    recommendationSource: 'local',
    recommendationReason: '来自本地 QQ 歌单兜底'
  };
}

function findLocalQqTrack(title, artistHint = '', options = {}) {
  const local = ensureLocalShape(loadLocal(options) || {});
  const wantedTitle = normalizeSearchText(title);
  const wantedArtist = normalizeSearchText(artistHint);
  if (!wantedTitle) return null;

  const songs = (local.qq?.playlists || []).flatMap(p => p.songs || []);
  const candidates = songs.filter(song => normalizeSearchText(song.name) === wantedTitle);
  const artistMatched = wantedArtist
    ? candidates.filter(song => artistNamesOf(song).some(name => {
      const normalized = normalizeSearchText(name);
      return normalized.includes(wantedArtist) || wantedArtist.includes(normalized);
    }))
    : candidates;
  const picked = artistMatched[0] || (!wantedArtist ? candidates[0] : null);
  return picked ? localQqSongToTrack(picked) : null;
}

function addTrackToLocalPool(track, options = {}) {
  if (!track?.id || !track?.name) return { ok: false, reason: '缺少歌曲信息' };
  const data = ensureLocalShape(loadLocal(options) || {
    lastUpdated: new Date().toISOString(),
    netease: { playlists: [] },
    qq: { playlists: [] },
    claudio: { playlists: [] }
  });

  let playlist = data.claudio.playlists.find(item => item.id === 'claudio-saved');
  if (!playlist) {
    playlist = { id: 'claudio-saved', name: 'Claudio 收藏', songCount: 0, songs: [] };
    data.claudio.playlists.unshift(playlist);
  }

  const source = track.source || (String(track.id).startsWith('qq:') ? 'qq' : 'netease');
  const rawId = String(track.id);
  const artists = (track.artists || track.ar || []).map(item => item.name).filter(Boolean);
  const song = source === 'qq'
    ? {
        mid: rawId.replace(/^qq:/, ''),
        mediaMid: track._qqMediaMid || track.mediaMid || '',
        name: track.name,
        artists,
        album: track.album?.name || track.al?.name || '',
        source
      }
    : {
        id: rawId,
        name: track.name,
        artists,
        album: track.album?.name || track.al?.name || '',
        source
      };

  const key = trackKey(song);
  data.claudio.removedTracks = data.claudio.removedTracks.filter(item => item.key !== key);
  const exists = playlist.songs.some(item => {
    return trackKey(item) === key;
  });
  if (exists) {
    data.lastUpdated = new Date().toISOString();
    saveLocal(data, options);
    return { ok: true, added: false, playlistName: playlist.name, song };
  }

  playlist.songs.unshift(song);
  playlist.songCount = playlist.songs.length;
  data.lastUpdated = new Date().toISOString();
  saveLocal(data, options);
  return { ok: true, added: true, playlistName: playlist.name, song };
}

function removeSongFromPlaylist(playlist, key) {
  const songs = Array.isArray(playlist.songs) ? playlist.songs : [];
  const before = songs.length;
  playlist.songs = songs.filter(song => trackKey(song) !== key);
  playlist.songCount = playlist.songs.length;
  return before - playlist.songs.length;
}

function removeTrackFromLocalPool(track, options = {}) {
  const key = trackKey(track);
  if (!key) return { ok: false, reason: '缺少歌曲信息' };
  const data = ensureLocalShape(loadLocal(options) || {
    lastUpdated: new Date().toISOString(),
    netease: { playlists: [] },
    qq: { playlists: [] },
    claudio: { playlists: [] }
  });

  let removedCount = 0;
  for (const playlist of data.netease.playlists) removedCount += removeSongFromPlaylist(playlist, key);
  for (const playlist of data.qq.playlists) removedCount += removeSongFromPlaylist(playlist, key);
  for (const playlist of data.claudio.playlists) removedCount += removeSongFromPlaylist(playlist, key);

  if (!data.claudio.removedTracks.some(item => item.key === key)) {
    data.claudio.removedTracks.unshift({
      key,
      name: track.name || '',
      artist: (track.artists || track.ar || []).map(item => item.name || item).filter(Boolean).join('/'),
      removedAt: new Date().toISOString()
    });
  }

  data.lastUpdated = new Date().toISOString();
  saveLocal(data, options);
  return { ok: true, removed: removedCount > 0, removedCount, key };
}

module.exports = {
  importAll,
  mergeImportedPlaylists,
  buildTasteData,
  buildPlaylistPool,
  findLocalQqTrack,
  loadLocal,
  listRemovedTracks,
  addTrackToLocalPool,
  removeTrackFromLocalPool,
  restoreRemovedTrack,
  trackKey,
  songIdentityKey
};
