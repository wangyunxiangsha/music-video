require('dotenv').config();
const { spawn } = require('child_process');
const axios = require('axios');
const path = require('path');
const logger = require('./logger');

const NCM_PORT      = process.env.NCM_PORT || 3001;
const NCM_BASE      = `http://127.0.0.1:${NCM_PORT}`;
const NCM_COOKIE    = process.env.NETEASE_COOKIE || '';  // optional login cookie

let neteaseProcess = null;

async function startServer() {
  if (neteaseProcess) return;

  const pkgJsonPath = require.resolve('NeteaseCloudMusicApi/package.json');
  const pkgDir = path.dirname(pkgJsonPath);
  const appPath = path.join(pkgDir, 'app.js');

  neteaseProcess = spawn(process.execPath, [appPath], {
    env: { ...process.env, PORT: String(NCM_PORT), HOST: '127.0.0.1' },
    stdio: 'pipe',
    windowsHide: true
  });

  await new Promise((resolve) => {
    let resolved = false;
    const done = () => { if (!resolved) { resolved = true; resolve(); } };

    neteaseProcess.stdout.on('data', (d) => {
      const s = d.toString();
      if (s.includes(NCM_PORT) || s.includes('running') || s.includes('server')) done();
    });
    neteaseProcess.on('error', done);
    setTimeout(done, 5000);
  });

  process.on('exit', () => { if (neteaseProcess) neteaseProcess.kill(); });
  logger.info(`✓ NeteaseCloudMusicApi on port ${NCM_PORT}`);
}

async function ncmGet(endpoint, params = {}) {
  try {
    const p = NCM_COOKIE ? { ...params, cookie: NCM_COOKIE } : params;
    const res = await axios.get(`${NCM_BASE}${endpoint}`, {
      params: p,
      timeout: 8000,
      headers: { 'User-Agent': 'Mozilla/5.0' }
    });
    return res.data;
  } catch (e) {
    logger.warn(`NCM [${endpoint}] error:`, e.message);
    return null;
  }
}

async function searchSongs(keywords, limit = 20) {
  const data = await ncmGet('/search', { keywords, limit, type: 1 });
  return data?.result?.songs || [];
}

async function getSongUrl(id) {
  const data = await ncmGet('/song/url/v1', { id, level: 'standard' });
  if (data?.data?.[0]?.url) return data.data[0].url;
  const fallback = await ncmGet('/song/url', { id, br: 128000 });
  return fallback?.data?.[0]?.url || null;
}

async function getLyric(id) {
  const data = await ncmGet('/lyric', { id });
  return data?.lrc?.lyric || '';
}

async function getTopSongs(type = 0) {
  const data = await ncmGet('/top/song', { type });
  return data?.data || [];
}

async function getPersonalized(limit = 30) {
  const data = await ncmGet('/personalized', { limit });
  return data?.result || [];
}

async function getAlbumCover(id) {
  const data = await ncmGet('/song/detail', { ids: id });
  return data?.songs?.[0]?.al?.picUrl || null;
}

async function getUserAccount() {
  const data = await ncmGet('/user/account');
  return data?.account?.id || null;
}

async function getUserPlaylists(uid) {
  const data = await ncmGet('/user/playlist', { uid, limit: 1000 });
  return data?.playlist || [];
}

async function getPlaylistTracks(id) {
  const data = await ncmGet('/playlist/track/all', { id, limit: 1000 });
  return data?.songs || [];
}

module.exports = {
  startServer,
  searchSongs,
  getSongUrl,
  getLyric,
  getTopSongs,
  getPersonalized,
  getAlbumCover,
  getUserAccount,
  getUserPlaylists,
  getPlaylistTracks
};
