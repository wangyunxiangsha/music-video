require('dotenv').config();
const express = require('express');
const { WebSocketServer } = require('ws');
const http = require('http');
const path = require('path');
const fs = require('fs');
const cors = require('cors');
const axios = require('axios');

const music     = require('./music');
const qqmusic   = require('./qqmusic');
const ai        = require('./ai');
const context   = require('./context');
const stats     = require('./stats');
const tts       = require('./tts');
const importer  = require('./import');
const weather   = require('./weather');
const categories = require('./categories');
const feedback  = require('./feedback');
const scenes    = require('./scenes');
const djPolicy  = require('./dj-policy');
const queue     = require('./queue');
const dailyStation = require('./daily-station');
const recommendationMixer = require('./recommendation-mixer');
const recommendationExplainer = require('./recommendation-explainer');
const playability = require('./playability');
const playbackDiagnostics = require('./playback-diagnostics');
const playbackMemory = require('./playback-memory');
const playbackFailure = require('./playback-failure');
const nextTrackSelection = require('./next-track-selection');
const health = require('./health');
const tasteProfile = require('./taste-profile');
const radioMemory = require('./radio-memory');
const qqLoginManager = require('./qq-login-manager');
const neteaseLoginManager = require('./netease-login-manager');
const accountStatus = require('./account-status');
const logger = require('./logger');

const app = express();
const server = http.createServer(app);
const wss = new WebSocketServer({ server, path: '/stream' });

const PORT = Number(process.env.PORT || 8080);
const PORT_RETRY_LIMIT = Number(process.env.PORT_RETRY_LIMIT || 10);
const TRIAL_CLIP_NEXT_LIMIT = 3;
const TRIAL_CLIP_NEXT_WINDOW_MS = 45000;
const startedAt = new Date().toISOString();
const RUNTIME_FILE = path.join(__dirname, '../data/runtime.json');
const DEFAULT_EXTERNAL_RECOMMEND_RATIO = recommendationMixer.resolveExternalRecommendationRatio({
  env: process.env
});

app.use(cors());
app.use(express.json({ limit: '5mb' }));
// Prevent browsers from caching the app shell and JS/CSS so updates take effect immediately
app.use((req, res, next) => {
  if (
    req.path === '/'
    || req.path.endsWith('.html')
    || req.path.endsWith('.js')
    || req.path.endsWith('.css')
  ) {
    res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
  }
  next();
});
app.use(express.static(path.join(__dirname, '../public')));

// ─── State ───────────────────────────────────────────────────────────────────
let currentTrack = null;
let playlist = [];
let djMessage = '欢迎收听 Claudio FM，你的个人 AI 复古电台~';
let chatHistory = [];
let weatherText = '';
const defaultScene = scenes.findScene(stats.getPreference('defaultSceneId', ''));
let activeScene = defaultScene ? { id: defaultScene.id, name: defaultScene.name } : null;
let activePolicy = defaultScene ? djPolicy.policyFromScene(defaultScene) : djPolicy.defaultPolicy();
let policyPlayCount = 0;
let dailyBriefing = null;
let activeExplorationMode = stats.getPreference('explorationMode', 'balanced');
let activeExternalRecommendRatio = stats.getPreference('externalRecommendRatio', DEFAULT_EXTERNAL_RECOMMEND_RATIO);
let activeExternalRecommendEnabled = stats.getPreference('externalRecommendEnabled', true) !== false;
let activeStationMood = stats.getPreference('stationMood', 'balanced');
let activeArtistRepeatMode = stats.getPreference('artistRepeatMode', 'normal');
let activePort = null;
let nextRequestInFlight = null;
let trialClipNextRequests = [];
const clients = new Set();

// ─── WebSocket ────────────────────────────────────────────────────────────────
function broadcast(data) {
  const msg = JSON.stringify(data);
  for (const ws of clients) {
    if (ws.readyState === 1) ws.send(msg);
  }
}

function getQueueState(limit = 5) {
  return queue.summarizeQueue({
    currentTrack,
    playlist,
    limit,
    scene: getEffectiveScene(),
    djPolicy: getEffectivePolicy(),
    recommendation: {
      explorationMode: activeExplorationMode,
      externalRatio: currentExternalRecommendationRatio()
    }
  });
}

function currentExternalRecommendationRatio() {
  if (!activeExternalRecommendEnabled) return 0;
  return recommendationMixer.ratioForExplorationMode(
    activeExplorationMode,
    activeExternalRecommendRatio
  );
}

function currentTimeStrategy(now = new Date()) {
  return dailyStation.getTimeSlotStrategy(now);
}

function getEffectiveScene(now = new Date()) {
  return activeScene || currentTimeStrategy(now).scene || null;
}

function getEffectivePolicy(now = new Date()) {
  if (activeScene) return activePolicy;
  const mode = currentTimeStrategy(now).djPolicyMode;
  return mode ? djPolicy.clonePolicy(mode) : activePolicy;
}

function getStationSettings() {
  const timeStrategy = currentTimeStrategy();
  return {
    scene: activeScene,
    effectiveScene: getEffectiveScene(),
    djPolicy: activePolicy,
    effectiveDjPolicy: getEffectivePolicy(),
    timeStrategy,
    recommendation: {
      explorationMode: activeExplorationMode,
      externalEnabled: activeExternalRecommendEnabled,
      externalRatio: currentExternalRecommendationRatio(),
      configuredExternalRatio: activeExternalRecommendRatio
    },
    tuning: {
      mood: activeStationMood,
      artistRepeatMode: activeArtistRepeatMode
    },
    scenes: scenes.summarizeScenes()
  };
}

async function applyStationSettings(input = {}) {
  const body = input || {};

  if ('externalEnabled' in body) {
    activeExternalRecommendEnabled = body.externalEnabled !== false;
    stats.savePreference('externalRecommendEnabled', activeExternalRecommendEnabled);
  }

  if ('externalRatio' in body) {
    activeExternalRecommendRatio = recommendationMixer.resolveExternalRecommendationRatio({
      env: { EXTERNAL_RECOMMEND_RATIO: body.externalRatio },
      fallback: DEFAULT_EXTERNAL_RECOMMEND_RATIO
    });
    activeExplorationMode = 'custom';
    stats.savePreference('externalRecommendRatio', activeExternalRecommendRatio);
    stats.savePreference('explorationMode', activeExplorationMode);
  }

  if (body.djPolicyMode) {
    activePolicy = djPolicy.clonePolicy(body.djPolicyMode);
    policyPlayCount = 0;
  }

  if (body.stationMood) {
    activeStationMood = ['quiet', 'lively', 'balanced'].includes(body.stationMood)
      ? body.stationMood
      : 'balanced';
    stats.savePreference('stationMood', activeStationMood);
  }

  if (body.artistRepeatMode) {
    activeArtistRepeatMode = body.artistRepeatMode === 'less' ? 'less' : 'normal';
    stats.savePreference('artistRepeatMode', activeArtistRepeatMode);
  }

  if ('sceneId' in body) {
    const nextScene = body.sceneId ? scenes.findScene(String(body.sceneId)) : null;
    activeScene = nextScene ? { id: nextScene.id, name: nextScene.name } : null;
    if (!body.djPolicyMode) {
      activePolicy = nextScene ? djPolicy.policyFromScene(nextScene) : activePolicy;
      policyPlayCount = 0;
    }
    stats.savePreference('defaultSceneId', activeScene?.id || '');
  }

  const nextQueue = await rebuildUpcomingQueue();
  broadcast({
    type: 'settings',
    settings: getStationSettings(),
    queue: nextQueue
  });
  return { settings: getStationSettings(), queue: nextQueue };
}

function readUserFile(relativePath) {
  try {
    return fs.readFileSync(path.join(__dirname, '..', relativePath), 'utf8');
  } catch {
    return '';
  }
}

function writeRuntimeInfo({ port, startedAt: runtimeStartedAt = startedAt } = {}) {
  const runtimeInfo = {
    port,
    url: `http://localhost:${port}`,
    startedAt: runtimeStartedAt
  };
  try {
    fs.mkdirSync(path.dirname(RUNTIME_FILE), { recursive: true });
    fs.writeFileSync(RUNTIME_FILE, JSON.stringify(runtimeInfo, null, 2), 'utf8');
  } catch (error) {
    logger.warn(`运行时端口文件写入失败: ${error.message}`);
  }
  return runtimeInfo;
}

async function ensureDailyBriefing(now = new Date()) {
  if (!weatherText) {
    weatherText = await weather.getWeatherText().catch(() => '');
  }
  dailyBriefing = await dailyStation.getOrCreateBriefing({
    now,
    weather: weatherText,
    routinesText: readUserFile('user/routines.md'),
    tasteSignals: stats.getTasteSignals(80),
    recentPlays: stats.getRecentPlays(8),
    stats,
    ai
  });
  return dailyBriefing;
}

function broadcastQueue() {
  broadcast({ type: 'queue', queue: getQueueState() });
}

function trackForPlaybackId(id) {
  if (currentTrack && String(currentTrack.id) === String(id)) return currentTrack;
  const found = playlist.find((track) => String(track.id) === String(id));
  return found || { id, source: String(id).startsWith('qq:') ? 'qq' : 'netease' };
}

function knownTrackForPlaybackId(id) {
  if (!id) return currentTrack;
  if (currentTrack && String(currentTrack.id) === String(id)) return currentTrack;
  return playlist.find((track) => String(track.id) === String(id)) || null;
}

function qqSwitchReasonFromLatestAttempt() {
  const latest = qqmusic.getCircuitState().latestUrlAttempt;
  if (!latest) return 'QQ 音乐候选暂时不可播，已切到网易云。';
  if (latest.category === 'missing_playback_auth') return 'QQ 音乐缺少播放授权，已切到网易云。';
  if (latest.category === 'membership_insufficient') return 'QQ 当前会员权限可能不够，已切到网易云。';
  if (latest.category === 'copyright_unavailable') return 'QQ 音乐版权暂不可播，已切到网易云。';
  if (latest.category === 'cdn_rejected') return 'QQ 音乐播放地址被 CDN 拒绝，已切到网易云。';
  return 'QQ 音乐候选暂时不可播，已切到网易云。';
}

function canAcceptTrialClipNext(now = Date.now()) {
  trialClipNextRequests = trialClipNextRequests.filter((ts) => now - ts < TRIAL_CLIP_NEXT_WINDOW_MS);
  if (trialClipNextRequests.length >= TRIAL_CLIP_NEXT_LIMIT) return false;
  trialClipNextRequests.push(now);
  return true;
}

function resetTrialClipNextRequests() {
  trialClipNextRequests = [];
}

async function handlePlaybackFailure(event = {}) {
  if (playbackFailure.shouldIgnorePlaybackFailure(event)) {
    logger.info(
      `忽略客户端关闭的音频流: track=${event.track?.name || event.track?.id || 'unknown'}, detail=${event.detail || ''}`
    );
    return { ignored: true, shouldRebuild: false };
  }
  playbackMemory.recordFailure(event);
  const result = playbackDiagnostics.recordFailure(event);
  logger.warn(
    `播放失败记录: stage=${event.stage || 'unknown'}, reason=${event.reason || 'unknown'}, `
    + `count=${result.consecutiveFailures}/${playbackDiagnostics.snapshot().rebuildThreshold}`
  );
  if (result.shouldRebuild) {
    logger.warn('连续播放失败达到阈值，正在重建后续队列');
    await rebuildUpcomingQueue();
    playbackDiagnostics.recordRebuild(event.reason || 'consecutive_failures');
    broadcastQueue();
  }
  return result;
}

wss.on('connection', (ws) => {
  clients.add(ws);
  ws.send(JSON.stringify({
    type: 'state',
    track: currentTrack,
    djMessage,
    weather: weatherText,
    next: playlist[0] || null,
    queue: getQueueState(),
    dailyBriefing,
    djPolicy: activePolicy,
    effectiveDjPolicy: getEffectivePolicy(),
    scene: activeScene,
    effectiveScene: getEffectiveScene(),
    timeStrategy: currentTimeStrategy()
  }));
  ws.on('close', () => clients.delete(ws));
  ws.on('error', () => clients.delete(ws));
});

wss.on('error', (err) => {
  if (err.code !== 'EADDRINUSE') {
    logger.warn('WebSocket error:', err.message);
  }
});

// ─── Song-request intent detection ───────────────────────────────────────────
const REQUEST_PATTERNS = [
  /^切换(?:到|成)?[《<「【]?(.+?)[》>」】]?\s*$/,
  /^播放[《<「【]?(.+?)[》>」】]?\s*$/,
  /^来(?:一首)?[《<「【]?(.+?)[》>」】]?\s*$/,
  /^放[《<「【]?(.+?)[》>」】]?\s*$/,
  /^我(?:想|要)听[《<「【]?(.+?)[》>」】]?\s*$/,
  /^点歌[：:：]?\s*[《<「【]?(.+?)[》>」】]?\s*$/,
  /^换(?:一首|成)?[《<「【]?(.+?)[》>」】]?\s*$/,
  /^帮我放[《<「【]?(.+?)[》>」】]?\s*$/,
];
const INSERT_PATTERNS = [
  /^插队(?:播放|点歌)?[《<「【]?(.+?)[》>」】]?\s*$/,
  /^把[《<「【]?(.+?)[》>」】]?\s*插(?:到|为)?下一首\s*$/,
  /^下一首(?:播放|放|听)[《<「【]?(.+?)[》>」】]?\s*$/
];
const NEXT_PATTERNS = [/^(下一首|换一首|切歌|跳过)$/];
const CATEGORY_PATTERNS = [
  /^播放(.+?)(?:类型|分类|歌单)?$/,
  /^来点(.+?)(?:歌|音乐)?$/,
  /^切到(.+?)(?:类型|分类|歌单)?$/,
  /^换成(.+?)(?:类型|分类|歌单)?$/,
  /^我想听(.+?)(?:类型|分类|歌单)?$/
];
const SCENE_PATTERNS = [
  /^(.+?)(?:模式|电台|场景)$/,
  /^来点(.+?)(?:模式|电台|场景)?$/,
  /^切到(.+?)(?:模式|电台|场景)?$/,
  /^换成(.+?)(?:模式|电台|场景)?$/
];

function extractSongName(message) {
  for (const p of REQUEST_PATTERNS) {
    const m = message.trim().match(p);
    if (m && m[1] && m[1].trim().length >= 1) return m[1].trim();
  }
  return null;
}

function extractInsertSongName(message) {
  for (const p of INSERT_PATTERNS) {
    const m = message.trim().match(p);
    if (m && m[1] && m[1].trim().length >= 1) return m[1].trim();
  }
  return null;
}

function extractCategoryName(message) {
  const text = message.trim();
  for (const p of CATEGORY_PATTERNS) {
    const m = text.match(p);
    if (m?.[1]) {
      const maybe = categories.findCategory(m[1].trim());
      if (maybe) return maybe;
    }
  }
  return categories.findCategory(text);
}

function extractStyleCategory(message) {
  const text = message.trim();
  if (!/(想听|听点|放点|来点|安排|适合|上午|早上|中午|下午|晚上|夜里|阴天|雨天|下雨)/.test(text)) {
    return null;
  }
  return categories.findCategory(text);
}

function extractScene(message) {
  const text = message.trim();
  for (const p of SCENE_PATTERNS) {
    const m = text.match(p);
    if (m?.[1]) {
      const maybe = scenes.findScene(m[1].trim());
      if (maybe) return maybe;
    }
  }
  return scenes.findScene(text);
}

function wantsNextTrack(message) {
  return NEXT_PATTERNS.some(p => p.test(message.trim()));
}

function isWhyThisSongCommand(message) {
  return /(为什么放这首|为什么播这首|为什么推荐这首|为啥放这首|这首为什么)/.test(String(message || '').trim());
}

function dedupeSongs(songs) {
  const seen = new Set();
  return songs.filter(song => {
    const artist = (song.artists || song.ar || []).map(a => a.name || '').join('/');
    const key = `${String(song.name || '').toLowerCase()}::${artist.toLowerCase()}`;
    if (!song.name || seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

// Parse "周杰伦的稻香" → { artist: '周杰伦', song: '稻香' }
// Returns null if no clear "X的Y" artist pattern detected
function parseArtistSong(text) {
  const m = text.match(/^(.{1,10})的(.{1,20})$/);
  if (!m) return null;
  // Avoid false positives like "起风了的" or single-char "的"
  if (m[1].length < 1 || m[2].length < 1) return null;
  return { artist: m[1].trim(), song: m[2].trim() };
}

// Rank candidates: songs whose artist name matches the requested artist come first
function rankByArtist(candidates, artistHint) {
  if (!artistHint) return candidates;
  const hint = artistHint.toLowerCase();
  return [
    ...candidates.filter((s) => {
      const names = (s.artists || s.ar || []).map((a) => (a.name || '').toLowerCase());
      return names.some((n) => n.includes(hint) || hint.includes(n));
    }),
    ...candidates.filter((s) => {
      const names = (s.artists || s.ar || []).map((a) => (a.name || '').toLowerCase());
      return !names.some((n) => n.includes(hint) || hint.includes(n));
    })
  ];
}

async function resolveSongUrl(track) {
  if (track.source === 'qq') {
    return qqmusic.getSongUrl(track._qqmid, track._qqMediaMid);
  }
  return music.getSongUrl(track.id);
}

async function switchToSong(songName, systemPrompt) {
  const track = await findRequestedSong(songName);
  return track ? activateTrack(track, systemPrompt, true) : null;
}

async function findRequestedSong(songName) {
  // Parse "周杰伦的稻香" → search with full artist+song query for precision
  const parsed = parseArtistSong(songName);
  const query  = parsed ? `${parsed.artist} ${parsed.song}` : songName;
  const artist = parsed?.artist || recommendationMixer.originalArtistForSong(songName) || null;
  const requestedTitle = parsed?.song || songName;

  // ── 1. QQ Music first for explicit requests to avoid Netease preview clips ──
  let qqTried = false;
  if (qqmusic.isEnabled()) {
    logger.info(`优先尝试 QQ 音乐点歌: ${query}`);
    const qqResults  = dedupeSongs(await qqmusic.searchSongs(query, 8));
    const qqClean    = recommendationMixer.preferCleanVersions(qqResults);
    const qqTitleMatched = recommendationMixer.preferTitleMatches(qqClean, requestedTitle);
    const qqArtistMatched = recommendationMixer.preferArtistMatches(qqTitleMatched, artist);
    const qqOriginalPreferred = recommendationMixer.preferOriginalArtist(qqArtistMatched, requestedTitle);
    const qqRanked   = rankByArtist(qqOriginalPreferred, artist);
    const qqFiltered = artist ? qqRanked : qqRanked.slice(0, 1);
    for (const candidate of qqFiltered.slice(0, 3)) {
      qqTried = true;
      const url = await qqmusic.getSongUrl(candidate._qqmid, candidate._qqMediaMid);
      if (url) return candidate;
    }
  }

  // ── 2. Fall back to Netease ─────────────────────────────────────────────────
  const neteaseResults = dedupeSongs(await music.searchSongs(query, 10));
  const neteaseClean   = recommendationMixer.preferCleanVersions(neteaseResults);
  const neteaseTitleMatched = recommendationMixer.preferTitleMatches(neteaseClean, requestedTitle);
  const neteaseArtistMatched = recommendationMixer.preferArtistMatches(neteaseTitleMatched, artist);
  const neteaseOriginalPreferred = recommendationMixer.preferOriginalArtist(neteaseArtistMatched, requestedTitle);
  const neteaseRanked  = rankByArtist(neteaseOriginalPreferred, artist);
  const neteaseOrdered = [
    ...neteaseRanked.filter(isPlayable),
    ...neteaseRanked.filter((s) => !isPlayable(s))
  ];

  for (const candidate of neteaseOrdered) {
    const url = await music.getSongUrl(candidate.id);
    if (url) {
      if (!qqTried) return candidate;
      const playbackSwitchReason = qqSwitchReasonFromLatestAttempt();
      return {
        ...candidate,
        playbackSwitchReason,
        playbackSkippedCandidates: [{
          source: 'qq',
          reason: playbackSwitchReason,
          name: requestedTitle
        }]
      };
    }
  }

  return null;
}

async function activateTrack(track, systemPrompt, userRequested = false) {
  currentTrack = track;
  stats.savePlay(track);
  policyPlayCount += 1;
  djMessage = djPolicy.shouldAnnounce(activePolicy, policyPlayCount)
    ? await ai.generateAnnouncement(track, systemPrompt, activePolicy)
    : '';
  broadcast({
    type: 'track',
    track: currentTrack,
    djMessage,
    weather: weatherText,
    next: playlist[0] || null,
    queue: getQueueState(),
    dailyBriefing,
    userRequested,
    djPolicy: activePolicy,
    scene: activeScene
  });
  return track;
}

async function buildRuntimeContext() {
  const [latestWeather] = await Promise.all([
    weather.getWeatherText().catch(() => '')
  ]);
  weatherText = latestWeather || weatherText;
  const recentPlays = stats.getRecentPlays(8);
  const tasteSignals = stats.getTasteSignals(80);
  return context.buildSystemPrompt({
    recentPlays,
    tasteSignals,
    weather: latestWeather,
    djPolicy: activePolicy
  });
}

function setActivePolicy(policy, scene = activeScene) {
  activePolicy = policy || djPolicy.defaultPolicy();
  activeScene = scene;
  policyPlayCount = 0;
  broadcast({ type: 'policy', djPolicy: activePolicy, scene: activeScene, queue: getQueueState() });
  return activePolicy;
}

async function switchToCategory(category, systemPrompt) {
  const pool = categories.buildCategoryPool(category);
  if (!pool.length) return null;
  playlist = await buildSmartQueue(pool, { scene: { id: category.id, name: category.name }, limit: 80 });
  const track = playlist.shift();
  if (!track) return null;
  broadcastQueue();
  return activateTrack(track, systemPrompt, true);
}

async function switchToScene(scene, systemPrompt) {
  setActivePolicy(djPolicy.policyFromScene(scene), { id: scene.id, name: scene.name });
  const pool = await buildSmartQueue(scenes.buildScenePool(scene), { scene, limit: 80 });
  if (!pool.length) return null;
  playlist = pool;
  const track = playlist.shift();
  if (!track) return null;
  const scenePrompt = await buildRuntimeContext();
  broadcastQueue();
  return activateTrack(track, scenePrompt, true);
}

async function buildDefaultQueuePool() {
  try {
    const pool = importer.buildPlaylistPool();
    if (pool.length > 0) return buildSmartQueue(pool, { limit: 120 });
  } catch (e) {
    logger.warn('队列重建读取本地歌单失败:', e.message);
  }
  return [...MOCK_PLAYLIST];
}

async function rebuildUpcomingQueue() {
  let pool = [];
  if (activeScene?.id) {
    const scene = scenes.findScene(activeScene.id);
    if (scene) pool = await buildSmartQueue(scenes.buildScenePool(scene), { scene, limit: 80 });
  }
  if (!pool.length) pool = await buildDefaultQueuePool();
  playlist = queue.rebuildQueue(playbackMemory.preferPlayable(playbackMemory.filterBlocked(pool), 20));
  broadcastQueue();
  return getQueueState();
}

async function insertRequestedTrack(songName) {
  const track = await findRequestedSong(songName);
  if (!track) return null;
  playlist = queue.insertNext(playlist, track);
  broadcastQueue();
  return track;
}

// ─── Playlist management ──────────────────────────────────────────────────────
const MOCK_PLAYLIST = [
  { id: '347230', name: '海阔天空', artists: [{ name: 'Beyond' }], album: { name: '请将手放开' } },
  { id: '186016', name: '光辉岁月', artists: [{ name: 'Beyond' }], album: { name: '犹豫' } },
  { id: '28285122', name: '夜空中最亮的星', artists: [{ name: '逃跑计划' }], album: { name: '世界' } },
  { id: '65522', name: '晴天', artists: [{ name: '周杰伦' }], album: { name: '叶惠美' } },
  { id: '192937', name: '起风了', artists: [{ name: '买辣椒也用券' }], album: { name: '起风了' } },
];

function isPlayable(song) {
  const pl = song.privilege?.pl ?? song.privilege?.fl ?? -1;
  return pl > 0;
}

function boostPlaylistByTaste(pool, { scene = activeScene } = {}) {
  const signals = stats.getTasteSignals(120);
  const feedbackSignals = stats.getFeedbackSignals(200, { scene });
  const recentArtists = new Set(stats.getRecentPlays(12).map(play => play.artist).filter(Boolean));
  const topArtists = new Set((signals.topArtists || []).map(i => i.name));
  const topCategories = new Set((signals.topCategories || []).map(i => i.name));
  const hasFeedback = feedbackSignals.likedTrackKeys.size
    || feedbackSignals.dislikedTrackKeys.size
    || feedbackSignals.skippedTrackKeys.size
    || feedbackSignals.skippedArtists.size
    || feedbackSignals.skippedVersionKeywords.size
    || feedbackSignals.temporaryReducedTrackKeys.size
    || feedbackSignals.blockedArtists.size
    || feedbackSignals.blockedCategories.size
    || feedbackSignals.boostArtists.size
    || feedbackSignals.reduceArtists.size
    || feedbackSignals.sceneReducedTrackKeys.size
    || feedbackSignals.sceneBoostedTrackKeys.size;
  if (!topArtists.size && !topCategories.size && !hasFeedback) return pool;

  const filtered = [...pool].filter(track => {
    const artist = track.artists?.[0]?.name || track.ar?.[0]?.name || '';
    const category = track.categoryName || '';
    const trackKey = `${String(track.name || '').trim().toLowerCase()}::${String(artist).trim().toLowerCase()}`;
    return !feedbackSignals.dislikedTrackKeys.has(trackKey)
      && !feedbackSignals.blockedArtists.has(artist)
      && !feedbackSignals.blockedCategories.has(category);
  });
  return recommendationMixer.weightedShuffle(filtered, (track) => {
    return recommendationMixer.tasteWeightForTrack({
      track,
      tasteSignals: signals,
      feedbackSignals,
      topArtists,
      topCategories,
      recentArtists,
      artistRepeatMode: activeArtistRepeatMode
    });
  });
}

async function buildSmartQueue(localPool, { scene = activeScene, limit = 80 } = {}) {
  const effectiveScene = scene || getEffectiveScene();
  const externalRatio = currentExternalRecommendationRatio();
  const externalPool = externalRatio > 0
    ? await recommendationMixer.buildExternalRecommendationPool({
        music,
        qqmusic,
        tasteSignals: stats.getTasteSignals(120),
        scene: effectiveScene,
        slot: dailyBriefing || currentTimeStrategy(),
        limit: Math.max(8, Math.ceil(limit * Math.max(externalRatio, 0.15))),
        isBlocked: stats.isTrackBlocked
      })
    : [];
  const mixed = recommendationMixer.mixRecommendationQueue({
    localPool: boostPlaylistByTaste(localPool, { scene: effectiveScene }),
    externalPool,
    localRatio: 1 - externalRatio,
    limit,
    isBlocked: stats.isTrackBlocked
  });
  return playbackMemory.filterBlocked(mixed.length ? mixed : boostPlaylistByTaste(localPool, { scene: effectiveScene }));
}

async function loadUserPlaylistsIntoPool() {
  const uid = await music.getUserAccount();
  if (!uid) return [];

  const userPlaylists = await music.getUserPlaylists(uid);
  if (!userPlaylists.length) return [];

  logger.info(`✓ 获取到 ${userPlaylists.length} 个歌单，开始加载曲目…`);

  // Fetch tracks concurrently (3 at a time to avoid rate limiting)
  const allTracks = [];
  for (let i = 0; i < userPlaylists.length; i += 3) {
    const batch = userPlaylists.slice(i, i + 3).filter(p => p.trackCount > 0);
    const results = await Promise.all(batch.map(p => music.getPlaylistTracks(p.id).catch(() => [])));
    results.forEach(tracks => allTracks.push(...tracks));
  }

  // De-duplicate by song ID
  const seen = new Set();
  const unique = allTracks.filter(t => {
    if (!t?.id || seen.has(t.id)) return false;
    seen.add(t.id);
    return true;
  });

  // Shuffle
  for (let i = unique.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [unique[i], unique[j]] = [unique[j], unique[i]];
  }

  return unique.map(t => ({
    id:      String(t.id),
    name:    t.name,
    artists: t.ar || t.artists || [],
    album:   t.al || t.album || {},
    privilege: t.privilege || { pl: 1 }
  }));
}

async function loadPlaylist() {
  // 1. Use locally imported playlist data (fastest, offline-capable)
  try {
    const pool = importer.buildPlaylistPool();
    if (pool.length > 0) {
      playlist = await buildSmartQueue(pool, { limit: 120 });
      logger.info(`✓ 加载智能队列 ${playlist.length} 首（外部推荐 ${Math.round(currentExternalRecommendationRatio() * 100)}%）`);
      return;
    }
  } catch (e) {
    logger.warn('本地歌单加载失败:', e.message);
  }

  // 2. Live fetch from Netease user playlists
  try {
    const userTracks = await loadUserPlaylistsIntoPool();
    if (userTracks.length > 0) {
      playlist = await buildSmartQueue(userTracks, { limit: 120 });
      logger.info(`✓ 用户歌单加载完成，共 ${playlist.length} 首`);
      return;
    }
  } catch (e) {
    logger.warn('用户歌单加载失败，降级到热门榜:', e.message);
  }

  // 3. Fallback to Netease top songs
  try {
    const songs = await music.getTopSongs(0);
    if (songs.length > 0) {
      const playable = songs.filter(isPlayable);
      playlist = (playable.length > 5 ? playable : songs).slice(0, 50);
      logger.info(`✓ 加载了 ${playlist.length} 首热门歌曲`);
      return;
    }
  } catch (e) {
    logger.warn('热门榜加载失败，使用 mock 数据:', e.message);
  }
  playlist = [...MOCK_PLAYLIST];
}

async function nextTrack({ maxAttempts = 8 } = {}) {
  const previousTrack = currentTrack;
  if (playlist.length === 0) {
    await loadPlaylist();
  } else if (playlist.length < 5) {
    loadPlaylist().catch(logger.error);
  }
  if (playlist.length === 0) {
    playlist = [...MOCK_PLAYLIST];
  }

  const picked = await playability.pickPlayableTrack({
    playlist,
    resolveUrl: resolveSongUrl,
    maxAttempts,
    isBlocked: playbackMemory.isBlocked,
    fallbackPlaylist: playbackMemory.recentPlayable(12)
  });
  const selection = nextTrackSelection.applyPlayablePick(picked);
  playlist = selection.playlist;
  if (selection.skippedCount) {
    logger.warn(`跳过 ${selection.skippedCount} 首暂不可播放的候选，继续寻找下一首`);
  }
  currentTrack = selection.track;
  if (!currentTrack) {
    currentTrack = previousTrack;
    return selection;
  }

  stats.savePlay(currentTrack);

  const systemPrompt = await buildRuntimeContext();
  policyPlayCount += 1;
  djMessage = djPolicy.shouldAnnounce(activePolicy, policyPlayCount)
    ? await ai.generateAnnouncement(currentTrack, systemPrompt, activePolicy)
    : '';

  broadcast({
    type: 'track',
    track: currentTrack,
    djMessage,
    weather: weatherText,
    next: playlist[0] || null,
    queue: getQueueState(),
    dailyBriefing,
    djPolicy: activePolicy,
    scene: activeScene
  });
  return selection;
}

// ─── Debug ────────────────────────────────────────────────────────────────────
app.get('/api/debug/qqtest', async (req, res) => {
  if (!qqmusic.isEnabled()) return res.json({ ok: false, reason: 'QQ_MUSIC_COOKIE not set' });
  try {
    const results = await qqmusic.searchSongs('晴天 周杰伦', 3);
    if (!results.length) return res.json({ ok: false, reason: 'search returned 0 results' });
    const song = results[0];
    const url  = await qqmusic.getSongUrl(song._qqmid, song._qqMediaMid);
    res.json({ ok: !!url, song: song.name, artist: song.artists?.[0]?.name, mid: song._qqmid, mediaMid: song._qqMediaMid || '', url: url || null });
  } catch (e) {
    res.json({ ok: false, error: e.message });
  }
});

app.get('/api/debug/qq-circuit', (req, res) => {
  res.json(qqmusic.getCircuitState());
});

app.get('/api/debug/playback', (req, res) => {
  res.json({
    ...playbackDiagnostics.snapshot(),
    playbackMemory: playbackMemory.snapshot(),
    currentTrack: playbackDiagnostics.summarizeTrack(currentTrack),
    queue: getQueueState()
  });
});

app.get('/api/debug/stats-storage', (req, res) => {
  res.json(stats.getStorageReport());
});

app.post('/api/playback/failure', async (req, res) => {
  const { id, stage, reason, detail } = req.body || {};
  try {
    const track = id ? knownTrackForPlaybackId(id) : currentTrack;
    if (id && !track) {
      logger.warn(`Ignoring stale client playback failure: requestTrack=${id}, currentTrack=${currentTrack?.id || 'none'}`);
      return res.json({
        ok: true,
        ignored: true,
        stale: true,
        diagnostics: {
          ...playbackDiagnostics.snapshot(),
          playbackMemory: playbackMemory.snapshot()
        },
        queue: getQueueState()
      });
    }
    const result = await handlePlaybackFailure({
      stage: stage || 'client',
      reason: reason || 'client_report',
      detail,
      track
    });
    const qqLatest = qqmusic.getCircuitState().latestUrlAttempt || null;
    const playbackNotice = playbackFailure.friendlyPlaybackNotice({
      track,
      reason: reason || 'client_report',
      qqIssue: track?.source === 'qq' ? qqLatest : null
    });
    res.json({
      ok: true,
      rebuilt: result.shouldRebuild,
      playbackNotice,
      diagnostics: {
        ...playbackDiagnostics.snapshot(),
        playbackMemory: playbackMemory.snapshot()
      },
      queue: getQueueState()
    });
  } catch (e) {
    res.status(500).json({ ok: false, error: e.message });
  }
});

app.get('/api/feedback', (req, res) => {
  const signals = stats.getFeedbackSignals(200);
  res.json({
    events: signals.events.slice(0, 50),
    likedTrackCount: signals.likedTrackKeys.size,
    dislikedTrackCount: signals.dislikedTrackKeys.size,
    blockedArtists: [...signals.blockedArtists],
    blockedCategories: [...signals.blockedCategories],
    boostArtists: [...signals.boostArtists],
    reduceArtists: [...signals.reduceArtists]
  });
});

app.get('/api/debug/qqdiag', async (req, res) => {
  const axios = require('axios');
  require('dotenv').config();
  const QQ_COOKIE = process.env.QQ_MUSIC_COOKIE || '';
  const songmid = req.query.mid || '0039MnYb0qxYhV'; // 晴天
  const uin = QQ_COOKIE.match(/\buin=o?(\d+)/i)?.[1] || '0';
  const g = Math.random().toString(36).slice(2);
  const HEADERS = { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36', 'Referer': 'https://y.qq.com', 'Origin': 'https://y.qq.com' };
  const formats = [['M800','mp3'],['M500','mp3'],['C400','m4a'],['M128','mp3'],['C128','m4a']];
  const results = [];
  for (const [quality, ext] of formats) {
    const filename = `${quality}${songmid}.${ext}`;
    const entry = { quality, filename, purl: null, url: null, cdnStatus: null, error: null };
    try {
      const body = { req_0: { module: 'vkey.GetVkeyServer', method: 'CgiGetVkey', param: { guid: g, songmid: [songmid], filename: [filename], songtype: [0], uin, loginflag: 1, platform: '20' } }, comm: { uin, format: 'json', ct: 24, cv: 0 } };
      const r = await axios.post('https://u.y.qq.com/cgi-bin/musicu.fcg', body, { headers: { ...HEADERS, Cookie: QQ_COOKIE }, timeout: 8000 });
      const info = r.data?.req_0?.data;
      entry.purl = info?.midurlinfo?.[0]?.purl || '';
      if (entry.purl) {
        const domain = (info.sip?.[0] || 'https://dl.stream.qqmusic.qq.com/').replace(/^http:\/\//, 'https://');
        entry.url = `${domain.replace(/\/$/, '')}/${entry.purl}`;
        try {
          const probe = await axios.get(entry.url, { headers: { ...HEADERS, Cookie: QQ_COOKIE, Range: 'bytes=0-0' }, responseType: 'arraybuffer', timeout: 5000, validateStatus: () => true });
          entry.cdnStatus = probe.status;
          if (probe.status !== 200 && probe.status !== 206) {
            const body = probe.data ? Buffer.from(probe.data).toString('utf8', 0, 200) : '';
            entry.cdnError = body;
          }
        } catch (e2) { entry.cdnStatus = 'probe_error'; entry.error = e2.message; }
      }
    } catch (e) { entry.error = e.message; }
    results.push(entry);
  }
  res.json({ songmid, uin, results });
});

app.get('/api/debug/import-diag', async (req, res) => {
  const out = {};
  // Netease
  try {
    const uid = await music.getUserAccount();
    out.netease_uid = uid;
    if (uid) {
      const pls = await music.getUserPlaylists(uid);
      out.netease_playlists = pls.map(p => ({ id: p.id, name: p.name, trackCount: p.trackCount }));
      if (pls.length > 0) {
        const tracks = await music.getPlaylistTracks(pls[0].id);
        out.netease_first_playlist_songs = tracks.slice(0, 3).map(t => ({ id: t.id, name: t.name, ar: (t.ar||[]).map(a=>a.name) }));
        out.netease_first_playlist_total = tracks.length;
      }
    }
  } catch (e) { out.netease_error = e.message; }
  // QQ
  try {
    const uin = qqmusic.extractUin(process.env.QQ_MUSIC_COOKIE || '');
    out.qq_uin = uin;
    const pls = await qqmusic.getUserPlaylists(uin);
    out.qq_playlists_raw_count = pls.length;
    out.qq_playlists = pls.slice(0, 5).map(p => ({ dissid: p.dissid, tid: p.tid, name: p.diss_name || p.name, num: p.song_cnt || p.songNum }));
    if (pls.length > 0) {
      const first = pls[0];
      const dissid = first.dissid || first.tid;
      const songs = await qqmusic.getPlaylistSongs(dissid);
      out.qq_first_playlist_songs = songs.slice(0, 3).map(s => ({ mid: s.mid||s.songmid, name: s.name||s.title, singer: (s.singer||[]).map(a=>a.name) }));
      out.qq_first_playlist_total = songs.length;
    }
  } catch (e) { out.qq_error = e.message; }
  res.json(out);
});

// Import playlists from Netease + QQ into data/playlists.json
app.post('/api/import-playlists', async (req, res) => {
  try {
    const result = await importer.importAll(music, qqmusic);
    // Reload in-memory playlist from freshly imported data
    const pool = importer.buildPlaylistPool();
    if (pool.length > 0) playlist = pool;
    res.json(result);
  } catch (e) {
    res.json({ ok: false, log: [e.message], neteaseCount: 0, qqCount: 0, totalSongs: 0 });
  }
});

// Generate taste.md from locally imported playlist data
app.post('/api/generate-taste', async (req, res) => {
  try {
    const tasteData = importer.buildTasteData();
    if (!tasteData) return res.json({ ok: false, reason: '请先点击 ✨ 导入歌单数据' });
    if (tasteData.totalSongs === 0) return res.json({ ok: false, reason: '导入的歌单中没有歌曲数据' });

    const tasteMd = await ai.generateTasteMd(tasteData);
    if (!tasteMd) return res.json({ ok: false, reason: 'AI 生成失败，请检查 DEEPSEEK_API_KEY' });

    const tastePath = path.join(__dirname, '../user/taste.md');
    const savedTaste = tasteProfile.writeTasteMdSafely(tastePath, tasteMd);
    if (!savedTaste.ok) {
      return res.json({ ok: false, reason: `生成内容不完整，已保留旧的 taste.md：${savedTaste.reason}` });
    }

    const local = importer.loadLocal();
    const plCount = (local?.netease?.playlists?.length || 0) + (local?.qq?.playlists?.length || 0);
    res.json({ ok: true, tasteMd: savedTaste.tasteMd, playlistCount: plCount, songCount: tasteData.totalSongs });
  } catch (e) {
    res.json({ ok: false, reason: e.message });
  }
});

app.post('/api/local-pool/current', (req, res) => {
  try {
    if (!currentTrack) return res.status(400).json({ ok: false, reason: '当前没有正在播放的歌曲' });
    if (currentTrack.recommendationSource !== 'external') {
      return res.status(400).json({ ok: false, reason: '这首已经来自本地歌单池' });
    }
    const result = importer.addTrackToLocalPool(currentTrack);
    if (result.ok) {
      currentTrack = {
        ...currentTrack,
        recommendationSource: 'local',
        recommendationReason: `已加入${result.playlistName}`
      };
    }
    res.json({ ...result, track: currentTrack });
  } catch (e) {
    res.status(500).json({ ok: false, reason: e.message });
  }
});

// ─── API Routes ───────────────────────────────────────────────────────────────
app.post('/api/local-pool/remove-current', async (req, res) => {
  try {
    if (!currentTrack) return res.status(400).json({ ok: false, reason: '当前没有正在播放的歌曲' });
    if (currentTrack.recommendationSource === 'external') {
      return res.status(400).json({ ok: false, reason: '这首是外部推荐，不在本地歌单池' });
    }
    if (currentTrack.recommendationSource === 'removed') {
      return res.status(400).json({ ok: false, reason: '这首已经从本地歌单池删除' });
    }
    const result = importer.removeTrackFromLocalPool(currentTrack);
    if (!result.ok) return res.status(400).json(result);
    playlist = playlist.filter(track => importer.trackKey(track) !== result.key);
    currentTrack = {
      ...currentTrack,
      recommendationSource: 'removed',
      recommendationReason: '已从本地歌单池删除'
    };
    broadcastQueue();
    res.json({ ...result, track: currentTrack, queue: getQueueState() });
  } catch (e) {
    res.status(500).json({ ok: false, reason: e.message });
  }
});

app.get('/api/local-pool/removed', (req, res) => {
  try {
    res.json({ ok: true, removedTracks: importer.listRemovedTracks() });
  } catch (e) {
    res.status(500).json({ ok: false, reason: e.message });
  }
});

app.post('/api/local-pool/restore', (req, res) => {
  try {
    const key = String(req.body?.key || '');
    const result = importer.restoreRemovedTrack(key);
    if (!result.ok) return res.status(400).json(result);
    res.json(result);
  } catch (e) {
    res.status(500).json({ ok: false, reason: e.message });
  }
});

app.get('/api/now', async (req, res) => {
  if (!weatherText) {
    weatherText = await weather.getWeatherText().catch(() => '');
  }
  res.json({
    track: currentTrack,
    djMessage,
    weather: weatherText,
    next: playlist[0] || null,
    queue: getQueueState(),
    dailyBriefing,
    djPolicy: activePolicy,
    effectiveDjPolicy: getEffectivePolicy(),
    scene: activeScene,
    effectiveScene: getEffectiveScene(),
    timeStrategy: currentTimeStrategy()
  });
});

app.get('/api/daily-briefing', async (req, res) => {
  const briefing = await ensureDailyBriefing();
  res.json({ briefing });
});

app.post('/api/next', async (req, res) => {
  const { skipReason, id, reason } = req.body || {};
  const hasClientTrackId = id !== undefined && id !== null && id !== '';
  const matchesCurrent = !hasClientTrackId || (currentTrack && String(currentTrack.id) === String(id));
  const requestTrackId = hasClientTrackId
    ? String(id)
    : (currentTrack ? String(currentTrack.id) : '__none__');
  if (reason === 'trial_clip' && !canAcceptTrialClipNext()) {
    logger.warn(`限制连续试听片段自动切歌: requestTrack=${requestTrackId}`);
    return res.json({ track: currentTrack, djMessage, queue: getQueueState(), trialLimited: true });
  }
  if (nextRequestInFlight && nextRequestInFlight.trackId === requestTrackId) {
    logger.warn(
      `忽略重复切歌请求: requestTrack=${requestTrackId}, reason=${reason || skipReason || 'unknown'}`
    );
    const payload = await nextRequestInFlight.promise;
    return res.json({ ...payload, duplicate: true });
  }
  if (hasClientTrackId && !matchesCurrent) {
    logger.warn(
      `忽略过期切歌请求: requestTrack=${id}, currentTrack=${currentTrack?.id || 'none'}, reason=${reason || skipReason || 'unknown'}`
    );
    return res.json({ track: currentTrack, djMessage, queue: getQueueState(), stale: true });
  }
  const inFlight = {
    trackId: requestTrackId,
    promise: (async () => {
      if (skipReason && currentTrack && matchesCurrent) {
        stats.saveFeedback({
          type: 'skip',
          target: 'track',
          value: skipReason,
          temporary: true,
          track: currentTrack
        });
      }
      const recoveryReasons = new Set(['alarm_start', 'client_error', 'ended', 'stalled', 'trial_clip']);
      const result = await nextTrack({
        maxAttempts: recoveryReasons.has(reason || skipReason) ? 8 : 1
      });
      if (reason !== 'trial_clip') resetTrialClipNextRequests();
      return {
        track: currentTrack,
        djMessage,
        queue: getQueueState(),
        skippedCandidates: result?.skippedCount || 0,
        playbackNotice: result?.playbackNotice || ''
      };
    })()
  };
  nextRequestInFlight = inFlight;
  try {
    const payload = await inFlight.promise;
    res.json(payload);
  } finally {
    if (nextRequestInFlight === inFlight) nextRequestInFlight = null;
  }
});

app.get('/api/queue', (req, res) => {
  res.json(getQueueState(Math.max(1, Math.min(20, Number(req.query.limit) || 5))));
});

app.post('/api/queue/skip-next', (req, res) => {
  const result = queue.removeNext(playlist);
  playlist = result.playlist;
  broadcastQueue();
  res.json({ ok: true, removed: result.removed ? queue.summarizeQueue({ playlist: [result.removed] }).next[0] : null, queue: getQueueState() });
});

app.post('/api/queue/rebuild', async (req, res) => {
  try {
    const nextQueue = await rebuildUpcomingQueue();
    res.json({ ok: true, queue: nextQueue });
  } catch (error) {
    res.status(500).json({ ok: false, reason: error.message, queue: getQueueState() });
  }
});

app.post('/api/queue/insert', async (req, res) => {
  const { message } = req.body || {};
  const songName = typeof message === 'string' ? (extractSongName(message) || message.trim()) : '';
  if (!songName) return res.status(400).json({ ok: false, reason: '请输入要插队的歌曲' });
  const track = await insertRequestedTrack(songName);
  if (!track) return res.json({ ok: false, reason: `没找到《${songName}》，可能版权限制或拼写有误。`, queue: getQueueState() });
  res.json({ ok: true, inserted: queue.summarizeQueue({ playlist: [track] }).next[0], queue: getQueueState() });
});

app.get('/api/music/url/:id', async (req, res) => {
  const url = await music.getSongUrl(req.params.id);
  if (!url) return res.status(404).json({ error: '该歌曲暂不可播放' });
  res.redirect(url);
});

// Resolve audio URL from either Netease or QQ Music
async function resolveAudioUrl(id, track = null) {
  if (String(id).startsWith('qq:')) {
    const mid = String(id).slice(3);
    return qqmusic.getSongUrl(mid, track?._qqMediaMid);
  }
  return music.getSongUrl(id);
}

// Proxy audio stream to avoid CORS issues and handle both sources
app.get('/api/music/stream/:id(*)', async (req, res) => {
  const id  = req.params.id;
  const track = trackForPlaybackId(id);
  try {
    const url = await resolveAudioUrl(id, track);
    if (!url) {
      await handlePlaybackFailure({
        stage: 'stream',
        reason: 'url_unavailable',
        status: 404,
        hasRange: Boolean(req.headers.range),
        track
      });
      return res.status(404).json({ error: '该歌曲暂不可播放，可能受版权限制' });
    }

    const isQQ = String(id).startsWith('qq:');

    const streamHeaders = isQQ
      ? {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
          'Referer':    'https://y.qq.com/',
          'Origin':     'https://y.qq.com',
          'Cookie':     process.env.QQ_MUSIC_COOKIE || ''
        }
      : {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
          'Referer':    'https://music.163.com/',
          'Cookie':     process.env.NETEASE_COOKIE || ''
        };
    if (req.headers.range) {
      streamHeaders.Range = req.headers.range;
    }

    const response = await axios({
      url,
      method: 'GET',
      responseType: 'stream',
      timeout: 15000,
      maxRedirects: 5,
      validateStatus: (status) => status >= 200 && status < 300,
      headers: streamHeaders
    });
    const successfulTrack = trackForPlaybackId(id);
    playbackDiagnostics.recordSuccess(successfulTrack);
    playbackMemory.recordSuccess(successfulTrack);

    if (response.status === 206) {
      res.status(206);
    }
    res.setHeader('Content-Type', response.headers['content-type'] || 'audio/mpeg');
    if (response.headers['content-length']) {
      res.setHeader('Content-Length', response.headers['content-length']);
    }
    if (response.headers['content-range']) {
      res.setHeader('Content-Range', response.headers['content-range']);
    }
    res.setHeader('Accept-Ranges', 'bytes');

    const upstream = response.data;
    upstream.on('error', (streamError) => {
      logger.warn('Audio upstream stream error:', streamError.message);
      handlePlaybackFailure({
        stage: 'stream',
        reason: 'upstream_stream_error',
        detail: streamError.message,
        responseClosed: res.destroyed || res.writableEnded,
        hasRange: Boolean(req.headers.range),
        track
      }).catch((failureError) => logger.warn('Playback failure handler error:', failureError.message));
      if (!res.headersSent) {
        res.status(502).json({ error: '音频源连接中断' });
      } else {
        res.destroy(streamError);
      }
    });
    res.on('close', () => {
      if (!upstream.destroyed) upstream.destroy();
    });
    upstream.pipe(res);
  } catch (e) {
    logger.error('Audio stream error:', e.message, e.response?.status);
    await handlePlaybackFailure({
      stage: 'stream',
      reason: e.response?.status ? 'upstream_http_error' : 'stream_request_error',
      status: e.response?.status || null,
      detail: e.message,
      hasRange: Boolean(req.headers.range),
      track
    });
    if (!res.headersSent) {
      res.status(502).json({ error: '音频流获取失败' });
    } else {
      res.destroy(e);
    }
  }
});

app.get('/api/music/lyric/:id(*)', async (req, res) => {
  const id = req.params.id;
  if (String(id).startsWith('qq:')) {
    const lyric = await qqmusic.getLyric(String(id).slice(3));
    return res.json({ lyric });
  }
  const lyric = await music.getLyric(id);
  res.json({ lyric });
});

app.get('/api/music/search', async (req, res) => {
  const { q, limit } = req.query;
  if (!q) return res.json({ songs: [] });
  const songs = dedupeSongs(await music.searchSongs(q, parseInt(limit) || 20));
  res.json({ songs });
});

app.get('/api/categories', (req, res) => {
  res.json({ categories: categories.summarizeCategories() });
});

app.get('/api/scenes', (req, res) => {
  res.json({ scenes: scenes.summarizeScenes() });
});

app.get('/api/dj-policy', (req, res) => {
  res.json({ policy: activePolicy, scene: activeScene });
});

app.get('/api/settings', (req, res) => {
  res.json(getStationSettings());
});

app.patch('/api/settings', async (req, res) => {
  try {
    const result = await applyStationSettings(req.body || {});
    res.json({ ok: true, ...result });
  } catch (e) {
    res.status(500).json({ ok: false, error: e.message });
  }
});

app.get('/api/memory/export', (req, res) => {
  const now = new Date();
  const payload = radioMemory.createMemoryExport({ now });
  res.setHeader('Content-Type', 'application/vnd.claudio.memory+json; charset=utf-8');
  res.setHeader('Content-Disposition', `attachment; filename="${radioMemory.exportFilename(now)}"`);
  res.send(JSON.stringify(payload, null, 2));
});

app.post('/api/memory/import', (req, res) => {
  try {
    const result = radioMemory.importMemory(req.body || {});
    res.json(result);
  } catch (e) {
    res.status(400).json({ ok: false, error: e.message });
  }
});

app.get('/api/qq-login/status', (req, res) => {
  res.json({
    ...qqLoginManager.getStatus(),
    qqCookieHealth: qqmusic.getCookieHealth(),
    qqPlaybackAuth: qqmusic.getPlaybackAuthStatus()
  });
});

app.post('/api/qq-login/start', (req, res) => {
  res.json(qqLoginManager.startLogin({
    onCookieUpdated: () => qqmusic.resetRuntimeState()
  }));
});

app.post('/api/qq-login/cancel', (req, res) => {
  res.json(qqLoginManager.cancelLogin());
});

app.get('/api/netease-login/status', (req, res) => {
  res.json(neteaseLoginManager.getStatus());
});

app.post('/api/netease-login/start', async (req, res) => {
  await music.startServer();
  res.json(await neteaseLoginManager.startLogin());
});

app.post('/api/netease-login/cancel', (req, res) => {
  res.json(neteaseLoginManager.cancelLogin());
});

app.get('/api/account-status', (req, res) => {
  res.json(accountStatus.buildAccountStatus({
    qqLoginStatus: qqLoginManager.getStatus(),
    qqCookieHealth: qqmusic.getCookieHealth(),
    qqPlaybackAuth: qqmusic.getPlaybackAuthStatus(),
    neteaseLoginStatus: neteaseLoginManager.getStatus()
  }));
});

app.post('/api/chat', async (req, res) => {
  const { message } = req.body;
  if (!message || typeof message !== 'string') {
    return res.status(400).json({ error: '请输入消息' });
  }

  const systemPrompt = await buildRuntimeContext();

  const policyCommand = djPolicy.parsePolicyCommand(message);
  if (policyCommand) {
    setActivePolicy(policyCommand.policy, activeScene);
    const reply = policyCommand.reply;
    chatHistory.push({ role: 'user', content: message }, { role: 'assistant', content: reply });
    if (chatHistory.length > 20) chatHistory = chatHistory.slice(-20);
    return res.json({ reply, policy: activePolicy.mode, djPolicy: activePolicy });
  }

  const explorationCommand = recommendationMixer.parseExplorationCommand(message);
  if (explorationCommand) {
    activeExplorationMode = explorationCommand.mode;
    stats.savePreference('explorationMode', activeExplorationMode);
    const nextQueue = await rebuildUpcomingQueue();
    const externalRatio = currentExternalRecommendationRatio();
    const reply = `${explorationCommand.reply} 当前外部推荐比例约 ${Math.round(externalRatio * 100)}%。`;
    chatHistory.push({ role: 'user', content: message }, { role: 'assistant', content: reply });
    if (chatHistory.length > 20) chatHistory = chatHistory.slice(-20);
    return res.json({
      reply,
      recommendation: true,
      explorationMode: activeExplorationMode,
      externalRatio,
      queue: nextQueue
    });
  }

  const tuningCommand = recommendationMixer.parseQualityTuningCommand(message);
  if (tuningCommand) {
    if (tuningCommand.mood) {
      activeStationMood = tuningCommand.mood;
      stats.savePreference('stationMood', activeStationMood);
    }
    if (tuningCommand.artistRepeatMode) {
      activeArtistRepeatMode = tuningCommand.artistRepeatMode;
      stats.savePreference('artistRepeatMode', activeArtistRepeatMode);
    }
    if (tuningCommand.explorationMode) {
      activeExplorationMode = tuningCommand.explorationMode;
      stats.savePreference('explorationMode', activeExplorationMode);
    }
    if (tuningCommand.djPolicyMode) {
      activePolicy = djPolicy.clonePolicy(tuningCommand.djPolicyMode);
      policyPlayCount = 0;
    }
    const nextQueue = await rebuildUpcomingQueue();
    const reply = `${tuningCommand.reply} 当前外部推荐比例约 ${Math.round(currentExternalRecommendationRatio() * 100)}%。`;
    chatHistory.push({ role: 'user', content: message }, { role: 'assistant', content: reply });
    if (chatHistory.length > 20) chatHistory = chatHistory.slice(-20);
    return res.json({
      reply,
      tuning: getStationSettings().tuning,
      recommendation: getStationSettings().recommendation,
      djPolicy: activePolicy,
      queue: nextQueue
    });
  }

  const feedbackAction = feedback.parseFeedback(message, currentTrack, { scene: activeScene });
  if (feedbackAction) {
    stats.saveFeedback(feedbackAction);
    const reply = feedbackAction.reply;
    chatHistory.push({ role: 'user', content: message }, { role: 'assistant', content: reply });
    if (chatHistory.length > 20) chatHistory = chatHistory.slice(-20);
    return res.json({ reply, feedback: true, action: feedbackAction.type, target: feedbackAction.target });
  }

  if (isWhyThisSongCommand(message)) {
    const reply = recommendationExplainer.explainTrack(currentTrack, {
      scene: activeScene,
      djPolicy: activePolicy,
      recommendation: {
        explorationMode: activeExplorationMode,
        externalRatio: currentExternalRecommendationRatio()
      }
    });
    chatHistory.push({ role: 'user', content: message }, { role: 'assistant', content: reply });
    if (chatHistory.length > 20) chatHistory = chatHistory.slice(-20);
    return res.json({ reply, explain: true });
  }

  if (wantsNextTrack(message)) {
    await nextTrack();
    const reply = currentTrack ? `好，切到下一首《${currentTrack.name}》。` : '暂时没有下一首。';
    chatHistory.push({ role: 'user', content: message }, { role: 'assistant', content: reply });
    if (chatHistory.length > 20) chatHistory = chatHistory.slice(-20);
    return res.json({ reply, switched: !!currentTrack });
  }

  const insertSongName = extractInsertSongName(message);
  if (insertSongName) {
    const track = await insertRequestedTrack(insertSongName);
    const artistName = track
      ? (track.artists?.[0]?.name || track.ar?.[0]?.name || '')
      : '';
    const reply = track
      ? `好，《${track.name}》${artistName ? `— ${artistName}` : ''} 已插到下一首。`
      : `没找到《${insertSongName}》，可能版权限制或拼写有误。`;
    chatHistory.push({ role: 'user', content: message }, { role: 'assistant', content: reply });
    if (chatHistory.length > 20) chatHistory = chatHistory.slice(-20);
    return res.json({ reply, inserted: !!track, queue: getQueueState() });
  }

  const styleCategory = extractStyleCategory(message);
  if (styleCategory) {
    const track = await switchToCategory(styleCategory, systemPrompt);
    const reply = track
      ? `好，我给你安排「${styleCategory.name}」风格，先听《${track.name}》。`
      : `「${styleCategory.name}」里暂时没有可播放歌曲。`;
    chatHistory.push({ role: 'user', content: message }, { role: 'assistant', content: reply });
    if (chatHistory.length > 20) chatHistory = chatHistory.slice(-20);
    return res.json({ reply, switched: !!track, category: styleCategory.name, styleIntent: true });
  }

  const scene = extractScene(message);
  if (scene) {
    const track = await switchToScene(scene, systemPrompt);
    const reply = track
      ? `好，切到「${scene.name}」，${activePolicy.name}，先听《${track.name}》。`
      : `「${scene.name}」暂时没有可播放歌曲。`;
    chatHistory.push({ role: 'user', content: message }, { role: 'assistant', content: reply });
    if (chatHistory.length > 20) chatHistory = chatHistory.slice(-20);
    return res.json({ reply, switched: !!track, scene: scene.name });
  }

  const category = extractCategoryName(message);
  if (category) {
    const track = await switchToCategory(category, systemPrompt);
    const reply = track
      ? `好，切到「${category.name}」，先听《${track.name}》。`
      : `「${category.name}」里暂时没有可播放歌曲。`;
    chatHistory.push({ role: 'user', content: message }, { role: 'assistant', content: reply });
    if (chatHistory.length > 20) chatHistory = chatHistory.slice(-20);
    return res.json({ reply, switched: !!track, category: category.name });
  }

  // ── Song-request fast path ──────────────────────────────────────────────────
  const songName = extractSongName(message);
  if (songName) {
    const track = await switchToSong(songName, systemPrompt);
    const artistName = track
      ? (track.artists?.[0]?.name || track.ar?.[0]?.name || '')
      : '';
    const reply = track
      ? `好，切换到《${track.name}》— ${artistName}`
      : `没找到《${songName}》，可能版权限制或拼写有误，换一首试试？`;

    chatHistory.push({ role: 'user', content: message }, { role: 'assistant', content: reply });
    if (chatHistory.length > 20) chatHistory = chatHistory.slice(-20);
    return res.json({ reply, switched: !!track });
  }

  // ── Regular AI chat ─────────────────────────────────────────────────────────
  const reply = await ai.chat(message, chatHistory, systemPrompt);
  chatHistory.push(
    { role: 'user', content: message },
    { role: 'assistant', content: reply }
  );
  if (chatHistory.length > 20) chatHistory = chatHistory.slice(-20);

  res.json({ reply });
});

app.get('/api/tts', async (req, res) => {
  const text = (req.query.text || '').trim().slice(0, 200);
  if (!text) return res.status(400).end();
  try {
    const mp3 = await tts.synthesize(text);
    res.setHeader('Content-Type', 'audio/mpeg');
    res.setHeader('Content-Length', mp3.length);
    res.setHeader('Cache-Control', 'no-store');
    res.end(mp3);
  } catch (e) {
    logger.warn('Edge TTS error:', e.message);
    res.status(503).end();
  }
});

app.get('/api/history', (req, res) => {
  const limit = Math.max(1, Math.min(200, Number(req.query.limit) || 80));
  res.json(stats.getHistorySummary(limit));
});

app.get('/api/listening-report/today', (req, res) => {
  res.json(stats.getTodayReport());
});

app.get('/api/health', (req, res) => {
  res.json(health.buildHealthSnapshot({
    port: activePort,
    startedAt,
    env: process.env,
    qqCircuit: qqmusic.getCircuitState(),
    qqPlaybackAuth: qqmusic.getPlaybackAuthStatus(),
    playbackDiagnostics: playbackDiagnostics.snapshot(),
    playbackMemory: playbackMemory.snapshot(),
    weather: weatherText
  }));
});

app.get('/api/taste', (req, res) => {
  const fs = require('fs');
  try {
    const taste = fs.readFileSync(path.join(__dirname, '../user/taste.md'), 'utf8');
    res.json({ taste });
  } catch {
    res.json({ taste: '' });
  }
});

// ─── Startup ──────────────────────────────────────────────────────────────────
function listen(port) {
  return new Promise((resolve, reject) => {
    const onError = (err) => {
      server.off('listening', onListening);
      reject(err);
    };
    const onListening = () => {
      server.off('error', onError);
      resolve(port);
    };

    server.once('error', onError);
    server.once('listening', onListening);
    server.listen(port);
  });
}

async function listenWithFallback(startPort) {
  for (let offset = 0; offset <= PORT_RETRY_LIMIT; offset++) {
    const port = startPort + offset;
    try {
      return await listen(port);
    } catch (err) {
      if (err.code !== 'EADDRINUSE' || offset === PORT_RETRY_LIMIT) {
        throw err;
      }
      logger.warn(`⚠  端口 ${port} 已被占用，尝试 ${port + 1}...`);
    }
  }
  return startPort;
}

async function start() {
  logger.info('\n🎙️  Claudio FM 正在启动...\n');
  const startupSelfCheck = health.runStartupSelfCheck({
    env: process.env,
    qqEnabled: qqmusic.isEnabled()
  });
  if (startupSelfCheck.warnings.length) {
    logger.warn(startupSelfCheck.summary);
  }

  try {
    await music.startServer();
  } catch (e) {
    logger.warn('⚠  NeteaseCloudMusicApi 启动失败，将使用 mock 数据');
  }

  await loadPlaylist();
  await nextTrack();
  await ensureDailyBriefing();

  const actualPort = await listenWithFallback(PORT);
  activePort = actualPort;
  writeRuntimeInfo({ port: actualPort, startedAt });
  logger.info(`\n✅ Claudio FM 已启动！`);
  logger.info(`   本地访问：http://localhost:${actualPort}`);
  if (actualPort !== PORT) {
    logger.info(`   提示：.env 里的 PORT=${PORT} 已被占用，本次自动切换到 ${actualPort}`);
  }
  logger.info(`   PWA 安装：通过浏览器地址栏安装图标\n`);
}

start().catch(logger.error);
