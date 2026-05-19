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

function mixRecommendationQueue({ localPool = [], externalPool = [], localRatio = 0.75, limit = 80, isBlocked = () => false } = {}) {
  const seen = new Set();
  const locals = uniqueTracks(localPool, isBlocked, seen);
  const externals = uniqueTracks(externalPool, isBlocked, seen);
  const localSlots = Math.max(1, Math.round(localRatio * 4));
  const externalSlots = Math.max(1, 4 - localSlots);
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
      candidates.push(...(found || []).map(track => normalizeSearchTrack(track, seed.reason)).filter(Boolean));
    } catch {}
    if (candidates.length < limit && qqmusic?.isEnabled?.()) {
      try {
        const found = await qqmusic.searchSongs(seed.query, 4);
        candidates.push(...(found || []).map(track => normalizeSearchTrack(track, seed.reason)).filter(Boolean));
      } catch {}
    }
  }
  return uniqueTracks(candidates, isBlocked).slice(0, limit);
}

module.exports = {
  mixRecommendationQueue,
  buildExternalRecommendationPool,
  querySeeds
};
