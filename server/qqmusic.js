require('dotenv').config();
const axios = require('axios');
const logger = require('./logger');

const QQ_CIRCUIT_THRESHOLD = Number(process.env.QQ_CIRCUIT_THRESHOLD || 3);
const QQ_CIRCUIT_COOLDOWN_MS = Number(process.env.QQ_CIRCUIT_COOLDOWN_MS || 10 * 60 * 1000);
const QQ_URL_CACHE_MS = Number(process.env.QQ_URL_CACHE_MS || 5 * 60 * 1000);
const QQ_UNAVAILABLE_CACHE_MS = Number(process.env.QQ_UNAVAILABLE_CACHE_MS || 15 * 60 * 1000);
const QQ_DEBUG_URL = process.env.QQ_DEBUG_URL === '1';
const QQ_COOKIE_HEALTH_THRESHOLD = Number(process.env.QQ_COOKIE_HEALTH_THRESHOLD || 3);

const HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
  'Referer': 'https://y.qq.com',
  'Origin': 'https://y.qq.com'
};

function getQQCookie() {
  return process.env.QQ_MUSIC_COOKIE || '';
}

const circuit = {
  failures: 0,
  openUntil: 0,
  lastReason: ''
};
const urlCache = new Map();
const unavailableCache = new Map();
const recentUrlAttempts = [];
const cookieHealth = {
  consecutiveSignals: 0,
  suspectedExpired: false,
  lastReason: '',
  lastAt: null
};

const QQ_QUALITY_FALLBACKS = [
  { quality: 'M800', ext: 'mp3' },
  { quality: 'M500', ext: 'mp3' },
  { quality: 'C400', ext: 'm4a' },
  { quality: 'M128', ext: 'mp3' },
  { quality: 'C128', ext: 'm4a' }
];

function summarizeQualityAttempts(attempts = []) {
  return attempts
    .filter(item => item?.quality)
    .map(item => `${item.quality}: ${item.reason || 'unknown'}`)
    .join('; ');
}

function rememberUrlAttempt(songmid, attempts, result = 'failed') {
  recentUrlAttempts.unshift({
    at: new Date().toISOString(),
    songmid,
    result,
    summary: summarizeQualityAttempts(attempts),
    attempts: attempts.map(item => ({ ...item }))
  });
  if (recentUrlAttempts.length > 20) recentUrlAttempts.length = 20;
}

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

function resetCookieHealth() {
  cookieHealth.consecutiveSignals = 0;
  cookieHealth.suspectedExpired = false;
  cookieHealth.lastReason = '';
  cookieHealth.lastAt = null;
}

function resetRuntimeState() {
  urlCache.clear();
  unavailableCache.clear();
  recentUrlAttempts.length = 0;
  resetCircuit();
  resetCookieHealth();
}

function getCookieHealth() {
  return {
    configured: Boolean(getQQCookie()),
    suspectedExpired: Boolean(getQQCookie()) && cookieHealth.suspectedExpired,
    consecutiveSignals: cookieHealth.consecutiveSignals,
    threshold: QQ_COOKIE_HEALTH_THRESHOLD,
    lastReason: cookieHealth.lastReason,
    lastAt: cookieHealth.lastAt,
    message: cookieHealth.suspectedExpired ? 'QQ 音乐 Cookie 疑似过期，请扫码刷新' : ''
  };
}

function isAuthFailureReason(reason = '') {
  return /(HTTP\s*(401|403)|auth|login|cookie|鉴权|登录|未登录|过期|失效)/i.test(String(reason));
}

function recordCookieHealthSignal(reason) {
  cookieHealth.consecutiveSignals += 1;
  cookieHealth.lastReason = reason || 'unknown';
  cookieHealth.lastAt = new Date().toISOString();
  if (cookieHealth.consecutiveSignals >= QQ_COOKIE_HEALTH_THRESHOLD) {
    cookieHealth.suspectedExpired = true;
  }
}

function recordCookieHealthFromAttempts(attempts = []) {
  const validAttempts = attempts.filter(item => item?.quality);
  if (!validAttempts.length) return getCookieHealth();
  const allEmptyPurl = validAttempts.every(item => item.reason === 'empty purl');
  const authFailure = validAttempts.find(item => isAuthFailureReason(item.reason));
  if (allEmptyPurl || authFailure) {
    recordCookieHealthSignal(allEmptyPurl ? 'all qualities returned empty purl' : authFailure.reason);
  }
  return getCookieHealth();
}

function recordCircuitFailure(reason) {
  circuit.failures += 1;
  circuit.lastReason = reason || 'unknown';
  if (circuit.failures >= QQ_CIRCUIT_THRESHOLD) {
    circuit.openUntil = Date.now() + QQ_CIRCUIT_COOLDOWN_MS;
    logger.warn(`QQ Music circuit breaker opened for ${Math.round(QQ_CIRCUIT_COOLDOWN_MS / 1000)}s: ${circuit.lastReason}`);
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
    cooldownMs: QQ_CIRCUIT_COOLDOWN_MS,
    recentUrlAttempts: recentUrlAttempts.slice(0, 10),
    unavailable: Array.from(unavailableCache.entries()).map(([songmid, entry]) => ({
      songmid,
      reason: entry.reason,
      attempts: entry.attempts || [],
      expiresAt: entry.expiresAt
    }))
  };
}

function getCachedEntry(cache, key) {
  const entry = cache.get(key);
  if (!entry) return null;
  if (entry.expiresAt <= Date.now()) {
    cache.delete(key);
    return null;
  }
  return entry;
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

function mediaMidFromSong(song = {}) {
  return song.file?.media_mid
    || song.file?.strMediaMid
    || song.file?.mediaMid
    || song.strMediaMid
    || song.media_mid
    || song.mediaMid
    || '';
}

function buildQQFilename(songmid, mediaMid, quality, ext) {
  return `${quality}${songmid}${mediaMid || ''}.${ext}`;
}

// ─── Search ────────────────────────────────────────────────────────────────────
async function searchSongs(keywords, limit = 10) {
  const cookie = getQQCookie();
  try {
    // Use the newer search API
    const body = {
      comm: { ct: 19, cv: 1859, uin: extractUin(cookie) },
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
      { headers: { ...HEADERS, Cookie: cookie }, timeout: 8000 }
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
      _qqMediaMid: mediaMidFromSong(s),
      source: 'qq',
      privilege: { pl: 1 }
    }));
  } catch (e) {
    logger.warn('QQ Music search fallback error:', e.message);
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
    _qqMediaMid: mediaMidFromSong(s),
    source:  'qq',
    privilege: { pl: 1 }
  };
}

// ─── Song URL ──────────────────────────────────────────────────────────────────
async function getSongUrl(songmid, mediaMid = '') {
  const cookie = getQQCookie();
  if (!cookie) {
    logger.warn('QQ_MUSIC_COOKIE 未配置，无法获取 QQ 音乐链接');
    return null;
  }
  const cachedUrl = getCachedEntry(urlCache, songmid);
  if (cachedUrl) return cachedUrl.url;
  const unavailable = getCachedEntry(unavailableCache, songmid);
  if (unavailable) return null;
  if (isCircuitOpen()) {
    logger.warn(`QQ Music circuit breaker active, skip URL probe (${Math.ceil(circuitRemainingMs() / 1000)}s left)`);
    return null;
  }

  const uin = extractUin(cookie);
  const g   = guid();
  let lastError = '';
  const qualityAttempts = [];

  // Try formats in order; probe CDN before returning to avoid silent 404s
  // M800/M500 = 超级会员; C400 = 绿钻可能可用; M128/C128 = 普通会员可用
  for (const { quality, ext } of QQ_QUALITY_FALLBACKS) {
    const filename = buildQQFilename(songmid, mediaMid, quality, ext);
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
        { headers: { ...HEADERS, Cookie: cookie }, timeout: 8000 }
      );

      const info  = res.data?.req_0?.data;
      const purl  = info?.midurlinfo?.[0]?.purl;
      if (!purl) {
        lastError = `${quality}: empty purl`;
        qualityAttempts.push({ quality, reason: 'empty purl' });
        continue;
      }

      const rawDomain = info.sip?.[0] || 'https://dl.stream.qqmusic.qq.com/';
      // Force HTTPS — some CDN nodes only accept HTTPS requests
      const domain = rawDomain.replace(/^http:\/\//, 'https://');
      const url = `${domain.replace(/\/$/, '')}/${purl}`;

      // Probe CDN — signed vkeys can be returned even when account lacks access
      const probe = await axios.get(url, {
        headers: { ...HEADERS, Cookie: cookie, Range: 'bytes=0-0' },
        responseType: 'arraybuffer',
        timeout: 5000,
        validateStatus: () => true
      });
      if (probe.status === 200 || probe.status === 206) {
        logger.debug(`QQ Music URL 成功 (${quality}): ${url.substring(0, 80)}...`);
        resetCircuit();
        resetCookieHealth();
        urlCache.set(songmid, { url, expiresAt: Date.now() + QQ_URL_CACHE_MS });
        qualityAttempts.push({ quality, reason: `CDN HTTP ${probe.status}`, status: probe.status });
        rememberUrlAttempt(songmid, qualityAttempts, 'success');
        return url;
      }
      lastError = `${quality}: CDN HTTP ${probe.status}`;
      qualityAttempts.push({ quality, reason: `CDN HTTP ${probe.status}`, status: probe.status });
      if (QQ_DEBUG_URL) logger.debug(`QQ Music CDN probe 拒绝 (${quality}): HTTP ${probe.status}`);
    } catch (e) {
      lastError = `${quality}: ${e.message}`;
      qualityAttempts.push({ quality, reason: e.message });
      if (QQ_DEBUG_URL) logger.debug(`QQ Music URL (${quality}) error:`, e.message);
    }
  }
  const failureSummary = summarizeQualityAttempts(qualityAttempts) || lastError || `all formats failed: ${songmid}`;
  unavailableCache.set(songmid, {
    reason: failureSummary,
    attempts: qualityAttempts,
    expiresAt: Date.now() + QQ_UNAVAILABLE_CACHE_MS
  });
  recordCookieHealthFromAttempts(qualityAttempts);
  rememberUrlAttempt(songmid, qualityAttempts, 'failed');
  logger.warn(`QQ Music 候选暂不可播，已跳过 (songmid: ${songmid}, reason: ${failureSummary})`);
  recordCircuitFailure(failureSummary);
  return null;
}

// ─── Lyric ─────────────────────────────────────────────────────────────────────
async function getLyric(songmid) {
  const cookie = getQQCookie();
  try {
    const res = await axios.get('https://c.y.qq.com/lyric/fcgi-bin/fcg_query_lyric_new.fcg', {
      params: { songmid, format: 'json', nobase64: 1 },
      headers: { ...HEADERS, Cookie: cookie },
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
  const cookie = getQQCookie();
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
      { headers: { ...HEADERS, Cookie: cookie }, timeout: 8000 });
    const disslist = res.data?.req_0?.data?.disslist || [];
    if (disslist.length) return disslist;
  } catch (e) {
    logger.warn('QQ getUserPlaylists error:', e.message);
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
        g_tk_new_20200303: qqGtk(cookie),
        g_tk: qqGtk(cookie),
        hostuin: uin,
        sin: 0,
        size: 100
      },
      headers: { ...HEADERS, Cookie: cookie },
      timeout: 10000
    });
    return res.data?.data?.disslist || [];
  } catch (e) {
    logger.warn('QQ getUserCreatedDiss error:', e.message);
    return [];
  }
}

async function getPlaylistSongs(dissid) {
  const cookie = getQQCookie();
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
        comm: { uin: extractUin(cookie), format: 'json', ct: 24, cv: 0 }
      };
      const res = await axios.post('https://u.y.qq.com/cgi-bin/musicu.fcg', body,
        { headers: { ...HEADERS, Cookie: cookie }, timeout: 8000 });
      const songlist = res.data?.req_0?.data?.songlist || [];
      if (!songlist.length) break;
      all.push(...songlist);
      if (songlist.length < pageSize) break;
      begin += pageSize;
    } catch (e) {
      logger.warn(`QQ getPlaylistSongs(${dissid}) error:`, e.message);
      break;
    }
  }
  if (all.length) return all;

  try {
    const uin = extractUin(cookie);
    const res = await axios.get('https://c.y.qq.com/qzone/fcg-bin/fcg_ucc_getcdinfo_byids_cp.fcg', {
      params: {
        type: 1,
        json: 1,
        utf8: 1,
        onlysong: 0,
        disstid: dissid,
        format: 'json',
        g_tk: qqGtk(cookie),
        loginUin: uin,
        hostUin: uin
      },
      // This legacy qzone endpoint returns subcode=1 with an Origin header.
      headers: { 'User-Agent': HEADERS['User-Agent'], Referer: 'https://y.qq.com/', Cookie: cookie },
      timeout: 10000
    });
    return res.data?.cdlist?.[0]?.songlist || [];
  } catch (e) {
    logger.warn(`QQ getPlaylistSongsFallback(${dissid}) error:`, e.message);
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
  resetRuntimeState,
  getCookieHealth,
  resetCookieHealth,
  recordCookieHealthFromAttempts,
  isEnabled: () => !!getQQCookie(),
  getQQCookie,
  extractUin,
  mediaMidFromSong,
  buildQQFilename,
  QQ_QUALITY_FALLBACKS,
  summarizeQualityAttempts
};
