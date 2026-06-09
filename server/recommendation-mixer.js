'use strict';

function artistOf(track) {
  return track?.artists?.[0]?.name || track?.ar?.[0]?.name || '';
}

function normalizeText(value) {
  return String(value || '').trim().toLowerCase().replace(/\s+/g, '');
}

function editDistance(a, b) {
  const left = Array.from(normalizeText(a));
  const right = Array.from(normalizeText(b));
  const dp = Array.from({ length: left.length + 1 }, () => Array(right.length + 1).fill(0));
  for (let i = 0; i <= left.length; i++) dp[i][0] = i;
  for (let j = 0; j <= right.length; j++) dp[0][j] = j;
  for (let i = 1; i <= left.length; i++) {
    for (let j = 1; j <= right.length; j++) {
      const cost = left[i - 1] === right[j - 1] ? 0 : 1;
      dp[i][j] = Math.min(
        dp[i - 1][j] + 1,
        dp[i][j - 1] + 1,
        dp[i - 1][j - 1] + cost
      );
    }
  }
  return dp[left.length][right.length];
}

function titleOf(track) {
  return track?.name || track?.songname || track?.title || '';
}

function titleMatches(track, titleHint) {
  const hint = normalizeText(titleHint);
  const title = normalizeText(titleOf(track));
  if (!hint) return true;
  if (!title) return false;
  if (title.includes(hint) || hint.includes(title)) return true;
  const minLength = Math.min(Array.from(title).length, Array.from(hint).length);
  return minLength >= 4 && editDistance(title, hint) <= 1;
}

function artistMatches(track, artistHint) {
  const hint = normalizeText(artistHint);
  if (!hint) return true;
  const names = [
    ...(track?.artists || []),
    ...(track?.ar || [])
  ].map(a => normalizeText(a?.name)).filter(Boolean);
  return names.some(name => name.includes(hint) || hint.includes(name));
}

const ORIGINAL_ARTISTS = new Map([
  ['寄明月', 'SING女团'],
  ['夜笙歌', 'SING女团']
]);

function originalArtistForSong(songName) {
  const text = String(songName || '').trim();
  if (!text) return '';
  const normalized = text.replace(/[《》「」【】]/g, '').trim();
  return ORIGINAL_ARTISTS.get(normalized) || '';
}

function trackKey(track) {
  const id = String(track?.id || '').trim();
  if (id) return `id:${id}`;
  return `meta:${String(track?.name || '').trim().toLowerCase()}::${artistOf(track).trim().toLowerCase()}`;
}

function uniqueTracks(items, isBlocked = () => false, seen = new Set()) {
  const result = [];
  for (const item of items || []) {
    if (!item || isBlocked(item)) continue;
    const key = trackKey(item);
    if (!key || seen.has(key)) continue;
    seen.add(key);
    result.push(item);
  }
  return result;
}

function spreadByArtist(items = []) {
  const groups = new Map();
  const order = [];
  for (const item of items) {
    const artist = artistOf(item) || `track:${item?.id || order.length}`;
    if (!groups.has(artist)) {
      groups.set(artist, []);
      order.push(artist);
    }
    groups.get(artist).push(item);
  }

  const result = [];
  let added = true;
  while (added) {
    added = false;
    for (const artist of order) {
      const group = groups.get(artist);
      if (!group?.length) continue;
      result.push(group.shift());
      added = true;
    }
  }
  return result;
}

function weightedShuffle(items = [], weightOf = () => 1, random = Math.random) {
  return [...items]
    .map((item, index) => {
      const weight = Math.max(0.1, Number(weightOf(item)) || 1);
      const roll = Math.max(Number.EPSILON, Math.min(1 - Number.EPSILON, random()));
      return { item, index, key: Math.log(roll) / weight };
    })
    .sort((a, b) => b.key - a.key || a.index - b.index)
    .map(entry => entry.item);
}

function withRecommendationReason(track, source) {
  if (!track) return track;
  if (track.recommendationReason) return track;
  if (source === 'external') {
    const reason = track.sourceReason || '你的近期口味';
    return { ...track, recommendationReason: `因为「${reason}」推荐` };
  }
  return { ...track, recommendationSource: track.recommendationSource || 'local', recommendationReason: '来自你的歌单' };
}

function clampRatio(value, fallback = 0.25) {
  const n = Number(value);
  if (!Number.isFinite(n)) return fallback;
  return Math.min(0.8, Math.max(0, n));
}

function resolveExternalRecommendationRatio({ env = process.env, fallback = 0.25 } = {}) {
  return clampRatio(env.EXTERNAL_RECOMMEND_RATIO, fallback);
}

function ratioForExplorationMode(mode, fallback = 0.25) {
  if (mode === 'localOnly') return 0;
  if (mode === 'conservative') return 0.1;
  if (mode === 'discovery') return 0.4;
  return clampRatio(fallback, 0.25);
}

function parseExplorationCommand(message) {
  const text = String(message || '').trim();
  if (!text) return null;
  if (/(只听我的歌单|只放我的歌单|不要外部推荐|关闭外部推荐)/.test(text)) {
    return { mode: 'localOnly', reply: '好，接下来只从你的歌单里安排。' };
  }
  if (/(保守一点|少一点新歌|少推荐外面的|外部推荐少一点)/.test(text)) {
    return { mode: 'conservative', reply: '好，我会保守一点，主要放你的歌单。' };
  }
  if (/(多发现新歌|多推荐新歌|探索多一点|外部推荐多一点)/.test(text)) {
    return { mode: 'discovery', reply: '好，我会多放一点外部发现，但还是贴着你的口味。' };
  }
  if (/(恢复默认推荐|正常推荐|平衡推荐)/.test(text)) {
    return { mode: 'balanced', reply: '好，恢复默认的推荐探索比例。' };
  }
  return null;
}

function parseQualityTuningCommand(message) {
  const text = String(message || '').trim();
  if (!text) return null;
  if (/(安静一点|安静些|低刺激|柔和一点|别太吵)/.test(text)) {
    return {
      mood: 'quiet',
      explorationMode: 'conservative',
      djPolicyMode: 'minimal',
      reply: '好，我会安静一点，少说少折腾，主要放更稳的歌。'
    };
  }
  if (/(热闹一点|来点热闹|提神一点|活跃一点|嗨一点)/.test(text)) {
    return {
      mood: 'lively',
      explorationMode: 'discovery',
      djPolicyMode: 'short',
      reply: '好，接下来热闹一点，多一点新鲜和提神的歌。'
    };
  }
  if (/(少放重复歌手|歌手别重复|换些不同歌手|别老同一个歌手)/.test(text)) {
    return {
      artistRepeatMode: 'less',
      reply: '收到，后面会更注意分散歌手，少让重复歌手挤在一起。'
    };
  }
  if (/(恢复默认调音|默认调音|恢复默认口味|正常调音)/.test(text)) {
    return {
      mood: 'balanced',
      artistRepeatMode: 'normal',
      explorationMode: 'balanced',
      reply: '好，恢复默认调音。'
    };
  }
  return null;
}

function tasteWeightForTrack({
  track,
  tasteSignals = {},
  feedbackSignals = {},
  topArtists = new Set((tasteSignals.topArtists || []).map(i => i.name)),
  topCategories = new Set((tasteSignals.topCategories || []).map(i => i.name)),
  recentArtists = new Set(),
  artistRepeatMode = 'normal'
} = {}) {
  const artist = artistOf(track);
  const trackKeyValue = `${String(track?.name || '').trim().toLowerCase()}::${String(artist).trim().toLowerCase()}`;
  const versionText = `${track?.name || ''} ${track?.album?.name || track?.al?.name || ''}`.toLowerCase();
  let weight = 1;
  if (topArtists.has(artist)) weight += 0.8;
  if (track?.categoryName && topCategories.has(track.categoryName)) weight += 0.5;
  if (feedbackSignals.likedTrackKeys?.has(trackKeyValue)) weight += 2;
  if (feedbackSignals.skippedTrackKeys?.has(trackKeyValue)) weight -= 1.2;
  if (feedbackSignals.skippedArtists?.has(artist)) weight -= 0.5;
  for (const keyword of feedbackSignals.skippedVersionKeywords || []) {
    if (versionText.includes(keyword)) weight -= 0.4;
  }
  if (feedbackSignals.temporaryReducedTrackKeys?.has(trackKeyValue)) weight -= 0.8;
  if (feedbackSignals.boostArtists?.has(artist)) weight += 1.5;
  if (feedbackSignals.reduceArtists?.has(artist)) weight -= 0.7;
  if (feedbackSignals.sceneReducedTrackKeys?.has(trackKeyValue)) weight -= 1.6;
  if (feedbackSignals.sceneBoostedTrackKeys?.has(trackKeyValue)) weight += 1.2;
  if ((tasteSignals.recentSongs || []).includes(track?.name)) weight -= 0.9;
  if (artistRepeatMode === 'less' && recentArtists.has(artist)) weight -= 1.1;
  return weight;
}

const BAD_EXTERNAL_VERSION_RE = /(live|现场|演唱会|伴奏|翻唱|cover|remix|dj|片段|剪辑|铃声|karaoke|纯伴奏)/i;

function isCleanExternalCandidate(track) {
  const haystack = [
    track?.name,
    track?.album?.name,
    track?.al?.name,
    track?.alia?.join?.(' ')
  ].filter(Boolean).join(' ');
  return !BAD_EXTERNAL_VERSION_RE.test(haystack);
}

function preferCleanVersions(items = []) {
  const clean = (items || []).filter(isCleanExternalCandidate);
  return clean.length ? clean : (items || []);
}

function preferArtistMatches(items = [], artistHint = '') {
  if (!artistHint) return items || [];
  return (items || []).filter(item => artistMatches(item, artistHint));
}

function preferTitleMatches(items = [], titleHint = '') {
  if (!titleHint) return items || [];
  return (items || []).filter(item => titleMatches(item, titleHint));
}

function preferOriginalArtist(items = [], songName = '') {
  const originalArtist = originalArtistForSong(songName);
  if (!originalArtist) return items || [];
  const matched = preferArtistMatches(items, originalArtist);
  return matched.length ? matched : (items || []);
}

function mixRecommendationQueue({ localPool = [], externalPool = [], localRatio = 0.75, limit = 80, isBlocked = () => false } = {}) {
  const seen = new Set();
  const locals = spreadByArtist(uniqueTracks(localPool, isBlocked, seen));
  const externals = spreadByArtist(uniqueTracks(externalPool, isBlocked, seen));
  const ratio = Math.min(1, Math.max(0, Number(localRatio)));
  const localSlots = ratio <= 0 ? 0 : Math.max(1, Math.round(ratio * 4));
  const externalSlots = ratio >= 1 ? 0 : Math.max(1, 4 - localSlots);
  const mixed = [];
  let localIndex = 0;
  let externalIndex = 0;

  while (mixed.length < limit && (localIndex < locals.length || externalIndex < externals.length)) {
    for (let i = 0; i < localSlots && localIndex < locals.length && mixed.length < limit; i += 1) {
      mixed.push(withRecommendationReason(locals[localIndex], 'local'));
      localIndex += 1;
    }
    for (let i = 0; i < externalSlots && externalIndex < externals.length && mixed.length < limit; i += 1) {
      mixed.push(withRecommendationReason(externals[externalIndex], 'external'));
      externalIndex += 1;
    }
    if (localIndex >= locals.length && externalIndex < externals.length) {
      mixed.push(withRecommendationReason(externals[externalIndex], 'external'));
      externalIndex += 1;
    }
    if (externalIndex >= externals.length && localIndex < locals.length) {
      mixed.push(withRecommendationReason(locals[localIndex], 'local'));
      localIndex += 1;
    }
  }

  return mixed.slice(0, limit);
}

function querySeeds({ tasteSignals = {}, scene = null, slot = null } = {}) {
  const seeds = [];
  for (const item of tasteSignals.topCategories || []) {
    if (item?.name) seeds.push({ query: `${item.name} 推荐`, reason: item.name });
  }
  if (scene?.name) seeds.push({ query: `${scene.name} 音乐`, reason: scene.name });
  const slotLabel = slot?.slotLabel || slot?.label;
  if (slotLabel) seeds.push({ query: `${slotLabel} 音乐`, reason: slotLabel });
  for (const item of tasteSignals.topArtists || []) {
    if (item?.name) seeds.push({ query: `${item.name} 相似推荐`, reason: item.name });
  }

  const seen = new Set();
  return seeds.filter(seed => {
    const key = seed.query.toLowerCase();
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  }).slice(0, 4);
}

function normalizeSearchTrack(track, reason) {
  if (!track?.id || !track?.name) return null;
  return {
    ...track,
    id: String(track.id),
    source: track.source || (String(track.id).startsWith('qq:') ? 'qq' : 'netease'),
    recommendationSource: 'external',
    sourceReason: reason,
    recommendationReason: `因为「${reason}」推荐`,
    privilege: track.privilege || { pl: 1 }
  };
}

async function buildExternalRecommendationPool({ music, qqmusic, tasteSignals = {}, scene = null, slot = null, limit = 24, isBlocked = () => false } = {}) {
  const seeds = querySeeds({ tasteSignals, scene, slot });
  const candidates = [];
  for (const seed of seeds) {
    if (candidates.length >= limit) break;
    try {
      const found = await music.searchSongs(seed.query, 6);
      candidates.push(...(found || []).map(track => normalizeSearchTrack(track, seed.reason)).filter(Boolean).filter(isCleanExternalCandidate));
    } catch {}
    if (candidates.length < limit && qqmusic?.isEnabled?.()) {
      try {
        const found = await qqmusic.searchSongs(seed.query, 4);
        candidates.push(...(found || []).map(track => normalizeSearchTrack(track, seed.reason)).filter(Boolean).filter(isCleanExternalCandidate));
      } catch {}
    }
  }
  return spreadByArtist(uniqueTracks(candidates, isBlocked)).slice(0, limit);
}

module.exports = {
  mixRecommendationQueue,
  buildExternalRecommendationPool,
  querySeeds,
  weightedShuffle,
  resolveExternalRecommendationRatio,
  ratioForExplorationMode,
  parseExplorationCommand,
  parseQualityTuningCommand,
  tasteWeightForTrack,
  isCleanExternalCandidate,
  preferCleanVersions,
  preferTitleMatches,
  titleMatches,
  preferArtistMatches,
  artistMatches,
  originalArtistForSong,
  preferOriginalArtist
};
