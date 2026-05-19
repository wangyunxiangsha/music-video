require('dotenv').config();
const fs   = require('fs');
const path = require('path');
const axios = require('axios');

const DATA_FILE = path.join(__dirname, '../data/playlists.json');

function ensureDataDir() {
  const dir = path.dirname(DATA_FILE);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}

function loadLocal() {
  try {
    if (fs.existsSync(DATA_FILE)) return JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));
  } catch {}
  return null;
}

function saveLocal(data) {
  ensureDataDir();
  fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2), 'utf8');
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
  const [netease, qq] = await Promise.all([
    importNetease(music),
    importQQ(qqmusic)
  ]);

  const data = {
    lastUpdated: new Date().toISOString(),
    netease: { playlists: netease.playlists },
    qq:      { playlists: qq.playlists }
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
    ...local.netease.playlists.flatMap(p => p.songs),
    ...local.qq.playlists.flatMap(p => p.songs)
  ];
  const playlistNames = [
    ...local.netease.playlists.map(p => p.name),
    ...local.qq.playlists.map(p => p.name)
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
function buildPlaylistPool() {
  const local = loadLocal();
  if (!local) return [];

  const neteaseSongs = local.netease.playlists.flatMap(p =>
    p.songs.map(s => ({ id: s.id, name: s.name, artists: s.artists.map(n => ({ name: n })), album: { name: s.album }, privilege: { pl: 1 } }))
  );
  const qqSongs = local.qq.playlists.flatMap(p =>
    p.songs.map(s => ({
      id: `qq:${s.mid}`,
      source: 'qq',
      name: s.name,
      artists: s.artists.map(n => ({ name: n })),
      album: { name: s.album },
      privilege: { pl: 1 }
    }))
  );

  // Deduplicate
  const seen = new Set();
  const unique = [...neteaseSongs, ...qqSongs].filter(s => { if (!s.id || seen.has(s.id)) return false; seen.add(s.id); return true; });

  // Shuffle
  for (let i = unique.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [unique[i], unique[j]] = [unique[j], unique[i]];
  }
  return unique;
}

module.exports = { importAll, buildTasteData, buildPlaylistPool, loadLocal };
