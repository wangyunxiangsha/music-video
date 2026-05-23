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

  const data = {
    lastUpdated: new Date().toISOString(),
    netease: { playlists: netease.playlists },
    qq:      { playlists: qq.playlists },
    claudio: existing.claudio || { playlists: [] }
  };
  saveLocal(data);

  const totalSongs = [
    ...netease.playlists.flatMap(p => p.songs),
    ...qq.playlists.flatMap(p => p.songs)
  ];

  return {
    ok: netease.ok || qq.ok,
    log: [...netease.log, '', ...qq.log],
    neteaseCount: netease.playlists.length,
    qqCount:      qq.playlists.length,
    totalSongs:   totalSongs.length
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
  const local = loadLocal(options);
  if (!local) return [];

  const neteaseSongs = (local.netease?.playlists || []).flatMap(p =>
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

  // Deduplicate
  const seen = new Set();
  const unique = [...neteaseSongs, ...qqSongs, ...claudioSongs].filter(s => { if (!s.id || seen.has(s.id)) return false; seen.add(s.id); return true; });

  // Shuffle
  for (let i = unique.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [unique[i], unique[j]] = [unique[j], unique[i]];
  }
  return unique;
}

function addTrackToLocalPool(track, options = {}) {
  if (!track?.id || !track?.name) return { ok: false, reason: '缺少歌曲信息' };
  const data = loadLocal(options) || {
    lastUpdated: new Date().toISOString(),
    netease: { playlists: [] },
    qq: { playlists: [] },
    claudio: { playlists: [] }
  };
  data.netease = data.netease || { playlists: [] };
  data.qq = data.qq || { playlists: [] };
  data.claudio = data.claudio || { playlists: [] };
  data.claudio.playlists = Array.isArray(data.claudio.playlists) ? data.claudio.playlists : [];

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

  const key = source === 'qq' ? `qq:${song.mid}` : String(song.id);
  const exists = playlist.songs.some(item => {
    const itemSource = item.source || (item.mid ? 'qq' : 'netease');
    const itemKey = itemSource === 'qq' ? `qq:${item.mid}` : String(item.id);
    return itemKey === key;
  });
  if (exists) return { ok: true, added: false, playlistName: playlist.name, song };

  playlist.songs.unshift(song);
  playlist.songCount = playlist.songs.length;
  data.lastUpdated = new Date().toISOString();
  saveLocal(data, options);
  return { ok: true, added: true, playlistName: playlist.name, song };
}

module.exports = { importAll, buildTasteData, buildPlaylistPool, loadLocal, addTrackToLocalPool };
