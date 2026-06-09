/**
 * 歌单同步脚本
 * 用法：npm run sync
 * 功能：从网易云 + QQ 音乐拉取所有歌单，保存到 data/playlists.json
 *       如已配置 DeepSeek API，自动生成 user/taste.md
 */

require('dotenv').config();
const { spawn } = require('child_process');
const path      = require('path');
const fs        = require('fs');
const axios     = require('axios');
const importer  = require('./import');

const NCM_PORT = process.env.NCM_PORT || 3001;
const NCM_BASE = `http://127.0.0.1:${NCM_PORT}`;
const NCM_COOKIE = process.env.NETEASE_COOKIE || '';
const QQ_COOKIE  = process.env.QQ_MUSIC_COOKIE || '';

const DATA_DIR   = path.join(__dirname, '../data');
const DATA_FILE  = path.join(DATA_DIR, 'playlists.json');
const TASTE_FILE = path.join(__dirname, '../user/taste.md');

// ─── Logging ──────────────────────────────────────────────────────────────────
function log(msg)  { console.log(`  ${msg}`); }
function info(msg) { console.log(`\n[INFO] ${msg}`); }
function ok(msg)   { console.log(`  ✓ ${msg}`); }
function warn(msg) { console.log(`  ✗ ${msg}`); }

// ─── NCM Server ───────────────────────────────────────────────────────────────
let ncmProcess = null;

async function startNCM() {
  info('启动 NeteaseCloudMusicApi...');
  const pkgJsonPath = require.resolve('NeteaseCloudMusicApi/package.json');
  const appPath     = path.join(path.dirname(pkgJsonPath), 'app.js');

  ncmProcess = spawn(process.execPath, [appPath], {
    env: { ...process.env, PORT: String(NCM_PORT), HOST: '127.0.0.1' },
    stdio: 'pipe',
    windowsHide: true
  });

  await new Promise((resolve) => {
    let resolved = false;
    const done = () => { if (!resolved) { resolved = true; resolve(); } };
    ncmProcess.stdout.on('data', (d) => {
      const s = d.toString();
      if (s.includes(NCM_PORT) || s.includes('running')) done();
    });
    ncmProcess.on('error', done);
    setTimeout(done, 5000);
  });
  ok(`NeteaseCloudMusicApi 已启动 (port ${NCM_PORT})`);
}

function stopNCM() {
  if (ncmProcess) { ncmProcess.kill(); ncmProcess = null; }
}

// ─── NCM API ──────────────────────────────────────────────────────────────────
async function ncm(endpoint, params = {}) {
  const p = NCM_COOKIE ? { ...params, cookie: NCM_COOKIE } : params;
  const res = await axios.get(`${NCM_BASE}${endpoint}`, { params: p, timeout: 10000 });
  return res.data;
}

// ─── Netease Import ───────────────────────────────────────────────────────────
async function importNetease() {
  info('导入网易云音乐歌单...');

  const accountData = await ncm('/user/account').catch(e => { warn(`账号接口失败: ${e.message}`); return null; });
  const uid = accountData?.account?.id;
  if (!uid) { warn('未检测到网易云登录，请检查 NETEASE_COOKIE'); return []; }
  ok(`账号 UID: ${uid}`);

  const plData = await ncm('/user/playlist', { uid, limit: 1000 }).catch(e => { warn(`歌单列表失败: ${e.message}`); return null; });
  const allPlaylists = plData?.playlist || [];
  ok(`找到 ${allPlaylists.length} 个歌单`);

  const result = [];
  for (const pl of allPlaylists) {
    if (!pl.id) continue;
    try {
      // 使用 /playlist/detail 获取更完整信息
      const detail = await ncm('/playlist/detail', { id: pl.id }).catch(() => null);
      const trackIds = detail?.playlist?.trackIds || [];

      let songs = [];
      if (trackIds.length > 0) {
        // 分批获取，每批 100 首
        for (let i = 0; i < trackIds.length; i += 100) {
          const batch = trackIds.slice(i, i + 100).map(t => t.id).join(',');
          const songData = await ncm('/song/detail', { ids: batch }).catch(() => null);
          if (songData?.songs) songs.push(...songData.songs);
        }
      } else {
        // fallback: /playlist/track/all
        const trackData = await ncm('/playlist/track/all', { id: pl.id, limit: 1000 }).catch(() => null);
        songs = trackData?.songs || [];
      }

      const formatted = songs.map(s => ({
        id:      String(s.id),
        name:    s.name || '',
        artists: (s.ar || s.artists || []).map(a => a.name).filter(Boolean),
        album:   s.al?.name || s.album?.name || ''
      })).filter(s => s.id && s.name);

      result.push({ id: String(pl.id), name: pl.name, songCount: formatted.length, songs: formatted });
      ok(`${pl.name} (${formatted.length} 首)`);
    } catch (e) {
      warn(`${pl.name}: ${e.message}`);
    }
  }

  const total = result.reduce((n, p) => n + p.songCount, 0);
  ok(`网易云导入完成：${result.length} 个歌单，${total} 首歌`);
  return result;
}

// ─── QQ Music Import ──────────────────────────────────────────────────────────
const QQ_HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
  'Referer':    'https://y.qq.com',
  'Origin':     'https://y.qq.com'
};

function extractUin(cookie) {
  const m = cookie.match(/\buin=o?(\d+)/i) || cookie.match(/\bQQ=(\d+)/i);
  return m ? m[1] : '0';
}

function extractCookieValue(cookie, key) {
  const escaped = key.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const m = cookie.match(new RegExp(`(?:^|;\\s*)${escaped}=([^;]+)`));
  return m ? m[1] : '';
}

function qqGtk(cookie) {
  const token = extractCookieValue(cookie, 'qqmusic_key')
    || extractCookieValue(cookie, 'qm_keyst')
    || extractCookieValue(cookie, 'p_skey')
    || extractCookieValue(cookie, 'skey');
  let hash = 5381;
  for (let i = 0; i < token.length; i++) {
    hash += (hash << 5) + token.charCodeAt(i);
  }
  return hash & 0x7fffffff;
}

async function qqPost(body) {
  const res = await axios.post('https://u.y.qq.com/cgi-bin/musicu.fcg', body,
    { headers: { ...QQ_HEADERS, Cookie: QQ_COOKIE }, timeout: 10000 });
  return res.data;
}

async function importQQ() {
  if (!QQ_COOKIE) { warn('未配置 QQ_MUSIC_COOKIE，跳过 QQ 音乐'); return []; }
  info('导入 QQ 音乐歌单...');

  const uin = extractUin(QQ_COOKIE);
  ok(`QQ UIN: ${uin}`);

  // 获取用户歌单列表
  let disslist = [];
  try {
    const data = await qqPost({
      req_0: {
        module: 'music.playlist.PlaylistCenterServer',
        method: 'GetUserPlaylist',
        param:  { uin, lastid: 0, num: 100, special_handel: 1 }
      },
      comm: { uin, format: 'json', ct: 24, cv: 0 }
    });
    disslist = data?.req_0?.data?.disslist || [];
    log(`  PlaylistCenterServer 返回 ${disslist.length} 个歌单`);
  } catch (e) {
    warn(`PlaylistCenterServer 失败: ${e.message}`);
  }

  // 备用接口
  if (!disslist.length) {
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
        headers: { ...QQ_HEADERS, Cookie: QQ_COOKIE },
        timeout: 10000
      });
      disslist = res.data?.data?.disslist || [];
      log(`  fcg_user_created_diss 返回 ${disslist.length} 个歌单`);
    } catch (e) {
      warn(`fcg_user_created_diss 失败: ${e.message}`);
    }
  }

  if (!disslist.length) { warn('QQ 音乐歌单列表获取失败'); return []; }
  ok(`找到 ${disslist.length} 个歌单`);

  const result = [];
  for (const pl of disslist) {
    const dissid = pl.dissid || pl.tid || pl.id;
    const plName = pl.diss_name || pl.name || String(dissid);
    if (!dissid) continue;
    try {
      const songs = await getQQPlaylistSongs(dissid);
      const formatted = songs.map(formatQQSong).filter(s => s.mid && s.name);

      result.push({ id: String(dissid), name: plName, songCount: formatted.length, songs: formatted });
      ok(`${plName} (${formatted.length} 首)`);
    } catch (e) {
      warn(`${plName}: ${e.message}`);
    }
  }

  const total = result.reduce((n, p) => n + p.songCount, 0);
  ok(`QQ 音乐导入完成：${result.length} 个歌单，${total} 首歌`);
  return result;
}

async function getQQPlaylistSongs(dissid) {
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
    headers: { 'User-Agent': QQ_HEADERS['User-Agent'], Referer: 'https://y.qq.com/', Cookie: QQ_COOKIE },
    timeout: 10000
  });
  return res.data?.cdlist?.[0]?.songlist || [];
}

function formatQQSong(s) {
  const mid = s.mid || s.songmid || '';
  return {
    mid,
    mediaMid: s.file?.media_mid || s.strMediaMid || s.media_mid || '',
    name: s.name || s.title || s.songname || '',
    artists: (s.singer || s.ar || []).map(a => a.name).filter(Boolean),
    album: s.album?.name || s.albumname || ''
  };
}

// ─── Save Data ────────────────────────────────────────────────────────────────
function saveData(netease, qq) {
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
  const existing = importer.loadLocal() || {};
  const { data, summary } = importer.mergeImportedPlaylists(existing, {
    netease: { playlists: netease },
    qq: { playlists: qq }
  });
  fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2), 'utf8');
  ok(`已保存到 ${DATA_FILE}`);
  ok(`增量同步：网易云 +${summary.netease.addedSongs} / 更新 ${summary.netease.updatedSongs} / 移除 ${summary.netease.removedSongs}`);
  ok(`增量同步：QQ音乐 +${summary.qq.addedSongs} / 更新 ${summary.qq.updatedSongs} / 移除 ${summary.qq.removedSongs}`);
  ok(`保留 Claudio 收藏 ${summary.preservedClaudioSongs} 首，屏蔽 ${summary.preservedRemovedTracks} 首`);
  return data;
}

// ─── Generate taste.md ────────────────────────────────────────────────────────
async function generateTaste(data) {
  const apiKey = process.env.DEEPSEEK_API_KEY;
  if (!apiKey) { warn('未配置 DEEPSEEK_API_KEY，跳过品味档案生成'); return; }

  info('用 AI 生成音乐品味档案...');

  const allSongs = [
    ...data.netease.playlists.flatMap(p => p.songs),
    ...data.qq.playlists.flatMap(p => p.songs),
    ...(data.claudio?.playlists || []).flatMap(p => p.songs || [])
  ];
  const playlistNames = [
    ...data.netease.playlists.map(p => p.name),
    ...data.qq.playlists.map(p => p.name),
    ...(data.claudio?.playlists || []).map(p => p.name)
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

  const prompt = `以下是用户在网易云音乐和QQ音乐创建的歌单名称、歌单中出现频率最高的艺术家、以及部分歌曲名。
请根据这些数据，用中文生成一份 taste.md 用户音乐品味档案，格式参考示例，内容要真实反映用户品味。

歌单名称：${playlistNames.join('、')}
高频艺术家（按出现次数排序）：${artists.slice(0, 60).join('、')}
部分歌曲：${sampleSongs.slice(0, 50).join('、')}

请输出完整的 Markdown 文件内容，不要输出任何额外说明。
格式：
# 我的音乐品味
## 喜欢的类型
## 喜欢的情绪
## 不喜欢
## 常听场景
## 近期关注`;

  const res = await axios.post('https://api.deepseek.com/chat/completions', {
    model: process.env.DEEPSEEK_MODEL || 'deepseek-chat',
    messages: [{ role: 'user', content: prompt }],
    max_tokens: 700,
    temperature: 0.7
  }, {
    headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
    timeout: 30000
  });

  const tasteMd = res.data?.choices?.[0]?.message?.content?.trim();
  if (!tasteMd) { warn('AI 未返回内容'); return; }

  fs.writeFileSync(TASTE_FILE, tasteMd, 'utf8');
  ok(`品味档案已写入 ${TASTE_FILE}`);
  console.log('\n--- taste.md 预览 ---');
  console.log(tasteMd.slice(0, 400) + (tasteMd.length > 400 ? '\n...' : ''));
}

// ─── Main ─────────────────────────────────────────────────────────────────────
async function main() {
  console.log('\n========================================');
  console.log('  Claudio FM — 歌单同步工具');
  console.log('========================================');

  try {
    await startNCM();

    const [netease, qq] = await Promise.all([
      importNetease(),
      importQQ()
    ]);

    const totalSongs = netease.reduce((n, p) => n + p.songCount, 0)
                     + qq.reduce((n, p) => n + p.songCount, 0);

    if (totalSongs === 0) {
      console.log('\n[WARN] 未导入任何歌曲，请检查 Cookie 配置');
    } else {
      const data = saveData(netease, qq);
      await generateTaste(data);

      info('同步完成');
      console.log(`  网易云: ${netease.length} 个歌单`);
      console.log(`  QQ音乐: ${qq.length} 个歌单`);
      console.log(`  总计:   ${totalSongs} 首歌`);
      console.log('\n下次启动 npm start 会自动使用这份歌单数据。');
    }
  } catch (e) {
    console.error('\n[ERROR]', e.message);
  } finally {
    stopNCM();
    process.exit(0);
  }
}

main();
