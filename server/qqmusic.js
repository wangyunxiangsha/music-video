require('dotenv').config();
const axios = require('axios');

const QQ_COOKIE = process.env.QQ_MUSIC_COOKIE || '';
const QQ_CIRCUIT_THRESHOLD = Number(process.env.QQ_CIRCUIT_THRESHOLD || 3);
const QQ_CIRCUIT_COOLDOWN_MS = Number(process.env.QQ_CIRCUIT_COOLDOWN_MS || 10 * 60 * 1000);

const HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
  'Referer': 'https://y.qq.com',
  'Origin': 'https://y.qq.com'
};

const circuit = {
  failures: 0,
  openUntil: 0,
  lastReason: ''
};

function circuitRemainingMs() {
  return Math.max(0, circuit.openUntil - Date.now());
}

function isCircuitOpen() {
  return circuitRemainingMs() > 0;
}

function resetCircuit() {
  circuit.failures = 0;
  circuit.openUntil = 0;
  circuit.lastReason = '';
}

function recordCircuitFailure(reason) {
  circuit.failures += 1;
  circuit.lastReason = reason || 'unknown';
  if (circuit.failures >= QQ_CIRCUIT_THRESHOLD) {
    circuit.openUntil = Date.now() + QQ_CIRCUIT_COOLDOWN_MS;
    console.warn(`QQ Music circuit breaker opened for ${Math.round(QQ_CIRCUIT_COOLDOWN_MS / 1000)}s: ${circuit.lastReason}`);
  }
}

function getCircuitState() {
  return {
    open: isCircuitOpen(),
    failures: circuit.failures,
    openUntil: circuit.openUntil,
    remainingMs: circuitRemainingMs(),
    lastReason: circuit.lastReason,
    threshold: QQ_CIRCUIT_THRESHOLD,
    cooldownMs: QQ_CIRCUIT_COOLDOWN_MS
  };
}

function qqGtk(cookie) {
  const token = cookie.match(/\b(?:qqmusic_key|qm_keyst)=([^;]+)/)?.[1] || '';
  let hash = 5381;
  for (let i = 0; i < token.length; i++) {
    hash += (hash << 5) + token.charCodeAt(i);
  }
  return hash & 0x7fffffff;
}

function extractUin(cookie) {
  const m = cookie.match(/\buin=o?(\d+)/i) || cookie.match(/\bQQ=(\d+)/i);
  return m ? m[1] : '0';
}

function guid() {
  return Array.from({ length: 32 }, () =>
    Math.floor(Math.random() * 16).toString(16)
  ).join('');
}

// ─── Search ────────────────────────────────────────────────────────────────────
async function searchSongs(keywords, limit = 10) {
  try {
    // Use the newer search API
    const body = {
      comm: { ct: 19, cv: 1859, uin: extractUin(QQ_COOKIE) },
      req: {
        method: 'DoSearchForQQMusicDesktop',
        module: 'ns.UserActionInterface',
        param: {
          num_per_page: limit,
          page_num: 1,
          query: keywords,
          search_type: 0
        }
      }
    };

    const res = await axios.post(
      'https://u.y.qq.com/cgi-bin/musicu.fcg',
      body,
      { headers: { ...HEADERS, Cookie: QQ_COOKIE }, timeout: 8000 }
    );

    const list = res.data?.req?.data?.body?.song?.list || [];
    if (list.length) return list.map(formatSong);
    // Fall through to fallback if new API returns empty
  } catch {
    // Ignored — fall through to fallback
  }
  return searchFallback(keywords, limit);
}

async function searchFallback(keywords, limit) {
  try {
    const res = await axios.get(
      'https://c.y.qq.com/soso/fcgi-bin/client_search_cp',
      {
        params: { w: keywords, format: 'json', t: 0, n: limit, aggr: 1, cr: 1, p: 1 },
        headers: HEADERS,
        timeout: 8000
      }
    );
    const list = res.data?.data?.song?.list || [];
    return list.map((s) => ({
      id:      `qq:${s.songmid}`,
      name:    s.songname,
      artists: (s.singer || []).map((a) => ({ name: a.name })),
      album:   {
        name:   s.albumname,
        picUrl: s.albummid
          ? `https://y.gtimg.cn/music/photo_new/T002R300x300M000${s.albummid}.jpg`
          : ''
      },
      _qqmid: s.songmid,
      source: 'qq',
      privilege: { pl: 1 }
    }));
  } catch (e) {
    console.warn('QQ Music search fallback error:', e.message);
    return [];
  }
}

function formatSong(s) {
  const mid = s.mid || s.id;
  const pic = s.album?.mid
    ? `https://y.gtimg.cn/music/photo_new/T002R300x300M000${s.album.mid}.jpg`
    : '';
  return {
    id:      `qq:${mid}`,
    name:    s.name,
    artists: (s.singer || []).map((a) => ({ name: a.name })),
    album:   { name: s.album?.name || '', picUrl: pic },
    _qqmid:  mid,
    source:  'qq',
    privilege: { pl: 1 }
  };
}

// ─── Song URL ──────────────────────────────────────────────────────────────────
async function getSongUrl(songmid) {
  if (!QQ_COOKIE) {
    console.warn('QQ_MUSIC_COOKIE 未配置，无法获取 QQ 音乐链接');
    return null;
  }
  if (isCircuitOpen()) {
    console.warn(`QQ Music circuit breaker active, skip URL probe (${Math.ceil(circuitRemainingMs() / 1000)}s left)`);
    return null;
  }

  const uin = extractUin(QQ_COOKIE);
  const g   = guid();
  let lastError = '';

  // Try formats in order; probe CDN before returning to avoid silent 404s
  // M800/M500 = 超级会员; C400 = 绿钻可能可用; M128/C128 = 普通会员可用
  for (const [quality, ext] of [['M800', 'mp3'], ['M500', 'mp3'], ['C400', 'm4a'], ['M128', 'mp3'], ['C128', 'm4a']]) {
    const filename = `${quality}${songmid}.${ext}`;
    try {
      const body = {
        req_0: {
          module: 'vkey.GetVkeyServer',
          method: 'CgiGetVkey',
          param: {
            guid:      g,
            songmid:   [songmid],
            filename:  [filename],
            songtype:  [0],
            uin,
            loginflag: 1,
            platform:  '20'
          }
        },
        comm: { uin, format: 'json', ct: 24, cv: 0 }
      };

      const res = await axios.post(
        'https://u.y.qq.com/cgi-bin/musicu.fcg',
        body,
        { headers: { ...HEADERS, Cookie: QQ_COOKIE }, timeout: 8000 }
      );

      const info  = res.data?.req_0?.data;
      const purl  = info?.midurlinfo?.[0]?.purl;
      if (!purl) {
        lastError = `${quality}: empty purl`;
        continue;
      }

      const rawDomain = info.sip?.[0] || 'https://dl.stream.qqmusic.qq.com/';
      // Force HTTPS — some CDN nodes only accept HTTPS requests
      const domain = rawDomain.replace(/^http:\/\//, 'https://');
      const url = `${domain.replace(/\/$/, '')}/${purl}`;

      // Probe CDN — signed vkeys can be returned even when account lacks access
      const probe = await axios.get(url, {
        headers: { ...HEADERS, Cookie: QQ_COOKIE, Range: 'bytes=0-0' },
        responseType: 'arraybuffer',
        timeout: 5000,
        validateStatus: (s) => s === 200 || s === 206
      });
      if (probe.status === 200 || probe.status === 206) {
        console.log(`QQ Music URL 成功 (${quality}): ${url.substring(0, 80)}...`);
        resetCircuit();
        return url;
      }
      lastError = `${quality}: CDN HTTP ${probe.status}`;
      console.warn(`QQ Music CDN probe 拒绝 (${quality}): HTTP ${probe.status}`);
    } catch (e) {
      lastError = `${quality}: ${e.message}`;
      console.warn(`QQ Music URL (${quality}) error:`, e.message);
    }
  }
  console.warn(`QQ Music 所有格式均失败 (songmid: ${songmid})`);
  recordCircuitFailure(lastError || `all formats failed: ${songmid}`);
  return null;
}

// ─── Lyric ─────────────────────────────────────────────────────────────────────
async function getLyric(songmid) {
  try {
    const res = await axios.get('https://c.y.qq.com/lyric/fcgi-bin/fcg_query_lyric_new.fcg', {
      params: { songmid, format: 'json', nobase64: 1 },
      headers: { ...HEADERS, Cookie: QQ_COOKIE },
      timeout: 8000
    });
    const raw = res.data?.lyric || '';
    // QQ lyric may be base64 encoded
    try { return Buffer.from(raw, 'base64').toString('utf8'); } catch { return raw; }
  } catch {
    return '';
  }
}

// ─── User Playlists ────────────────────────────────────────────────────────────
async function getUserPlaylists(uin) {
  try {
    const body = {
      req_0: {
        module: 'music.playlist.PlaylistCenterServer',
        method: 'GetUserPlaylist',
        param: { uin, lastid: 0, num: 100, special_handel: 1 }
      },
      comm: { uin, format: 'json', ct: 24, cv: 0 }
    };
    const res = await axios.post('https://u.y.qq.com/cgi-bin/musicu.fcg', body,
      { headers: { ...HEADERS, Cookie: QQ_COOKIE }, timeout: 8000 });
    const disslist = res.data?.req_0?.data?.disslist || [];
    if (disslist.length) return disslist;
  } catch (e) {
    console.warn('QQ getUserPlaylists error:', e.message);
  }

  try {
    const now = Date.now();
    const res = await axios.get('https://c6.y.qq.com/rsc/fcgi-bin/fcg_user_created_diss', {
      params: {
        r: now,
        _: now + 1,
        cv: 4747474,
        ct: 24,
        format: 'json',
        inCharset: 'utf-8',
        outCharset: 'utf-8',
        notice: 0,
        platform: 'yqq.json',
        needNewCode: 1,
        uin,
        g_tk_new_20200303: qqGtk(QQ_COOKIE),
        g_tk: qqGtk(QQ_COOKIE),
        hostuin: uin,
        sin: 0,
        size: 100
      },
      headers: { ...HEADERS, Cookie: QQ_COOKIE },
      timeout: 10000
    });
    return res.data?.data?.disslist || [];
  } catch (e) {
    console.warn('QQ getUserCreatedDiss error:', e.message);
    return [];
  }
}

async function getPlaylistSongs(dissid) {
  const all = [];
  let begin = 0;
  const pageSize = 100;
  while (true) {
    try {
      const body = {
        req_0: {
          module: 'music.srfDissInfo.aiDissInfo',
          method: 'uniform_get_Dissinfo',
          param: { disstid: dissid, onlysong: 1, num: pageSize, begin, enc_host_uin: '' }
        },
        comm: { uin: extractUin(QQ_COOKIE), format: 'json', ct: 24, cv: 0 }
      };
      const res = await axios.post('https://u.y.qq.com/cgi-bin/musicu.fcg', body,
        { headers: { ...HEADERS, Cookie: QQ_COOKIE }, timeout: 8000 });
      const songlist = res.data?.req_0?.data?.songlist || [];
      if (!songlist.length) break;
      all.push(...songlist);
      if (songlist.length < pageSize) break;
      begin += pageSize;
    } catch (e) {
      console.warn(`QQ getPlaylistSongs(${dissid}) error:`, e.message);
      break;
    }
  }
  if (all.length) return all;

  try {
    const uin = extractUin(QQ_COOKIE);
    const res = await axios.get('https://c.y.qq.com/qzone/fcg-bin/fcg_ucc_getcdinfo_byids_cp.fcg', {
      params: {
        type: 1,
        json: 1,
        utf8: 1,
        onlysong: 0,
        disstid: dissid,
        format: 'json',
        g_tk: qqGtk(QQ_COOKIE),
        loginUin: uin,
        hostUin: uin
      },
      // This legacy qzone endpoint returns subcode=1 with an Origin header.
      headers: { 'User-Agent': HEADERS['User-Agent'], Referer: 'https://y.qq.com/', Cookie: QQ_COOKIE },
      timeout: 10000
    });
    return res.data?.cdlist?.[0]?.songlist || [];
  } catch (e) {
    console.warn(`QQ getPlaylistSongsFallback(${dissid}) error:`, e.message);
    return [];
  }
}

module.exports = {
  searchSongs,
  getSongUrl,
  getLyric,
  getUserPlaylists,
  getPlaylistSongs,
  getCircuitState,
  resetCircuit,
  isEnabled: () => !!QQ_COOKIE,
  extractUin
};
