'use strict';

function artistOf(track) {
  return track?.artists?.[0]?.name || track?.ar?.[0]?.name || '';
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

function mixRecommendationQueue({ localPool = [], externalPool = [], localRatio = 0.75, limit = 80, isBlocked = () => false } = {}) {
  const seen = new Set();
  const locals = uniqueTracks(localPool, isBlocked, seen);
  const externals = uniqueTracks(externalPool, isBlocked, seen);
  const ratio = Math.min(1, Math.max(0, Number(localRatio)));
  const localSlots = ratio <= 0 ? 0 : Math.max(1, Math.round(ratio * 4));
  const externalSlots = ratio >= 1 ? 0 : Math.max(1, 4 - localSlots);
  const mixed = [];
  let localIndex = 0;
  let externalIndex = 0;

  while (mixed.length < limit && (localIndex < locals.length || externalIndex < externals.length)) {
    for (let i = 0; i < localSlots && localIndex < locals.length && mixed.length < limit; i += 1) {
      mixed.push(locals[localIndex]);
      localIndex += 1;
    }
    for (let i = 0; i < externalSlots && externalIndex < externals.length && mixed.length < limit; i += 1) {
      mixed.push(externals[externalIndex]);
      externalIndex += 1;
    }
    if (localIndex >= locals.length && externalIndex < externals.length) {
      mixed.push(externals[externalIndex]);
      externalIndex += 1;
    }
    if (externalIndex >= externals.length && localIndex < locals.length) {
      mixed.push(locals[localIndex]);
      localIndex += 1;
    }
  }

  return mixed.slice(0, limit);
}

function querySeeds({ tasteSignals = {}, scene = null, slot = null } = {}) {
  const seeds = [];
  for (const item of tasteSignals.topArtists || []) {
    if (item?.name) seeds.push({ query: `${item.name} 热门`, reason: item.name });
  }
  for (const item of tasteSignals.topCategories || []) {
    if (item?.name) seeds.push({ query: `${item.name} 推荐`, reason: item.name });
  }
  if (scene?.name) seeds.push({ query: `${scene.name} 音乐`, reason: scene.name });
  const slotLabel = slot?.slotLabel || slot?.label;
  if (slotLabel) seeds.push({ query: `${slotLabel} 音乐`, reason: slotLabel });

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
  return uniqueTracks(candidates, isBlocked).slice(0, limit);
}

module.exports = {
  mixRecommendationQueue,
  buildExternalRecommendationPool,
  querySeeds,
  resolveExternalRecommendationRatio,
  ratioForExplorationMode,
  parseExplorationCommand,
  isCleanExternalCandidate,
  preferCleanVersions
};
