'use strict';

const categories = require('./categories');

const SCENES = [
  {
    id: 'late_night',
    name: '\u6df1\u591c\u6a21\u5f0f',
    aliases: ['\u6df1\u591c', '\u591c\u91cc', '\u534a\u591c', '\u665a\u4e0a\u5b89\u9759'],
    categoryIds: ['sad_healing', 'nostalgia', 'bgm_instrumental'],
    speech: 'warm'
  },
  {
    id: 'focus_work',
    name: '\u5de5\u4f5c\u4e13\u6ce8',
    aliases: ['\u5de5\u4f5c', '\u4e13\u6ce8', '\u5199\u4ee3\u7801', '\u5b66\u4e60'],
    categoryIds: ['bgm_instrumental', 'electronic_energy', 'chinese_pop'],
    speech: 'minimal'
  },
  {
    id: 'commute_energy',
    name: '\u901a\u52e4\u63d0\u795e',
    aliases: ['\u901a\u52e4', '\u63d0\u795e', '\u51fa\u95e8', '\u8def\u4e0a'],
    categoryIds: ['electronic_energy', 'english_rock_electronic', 'chinese_pop'],
    speech: 'short'
  },
  {
    id: 'rainy_quiet',
    name: '\u4e0b\u96e8\u5b89\u9759',
    aliases: ['\u4e0b\u96e8', '\u96e8\u5929', '\u9634\u5929', '\u5b89\u9759\u4e00\u70b9'],
    categoryIds: ['sad_healing', 'bgm_instrumental', 'nostalgia'],
    speech: 'warm'
  },
  {
    id: 'sleep_low',
    name: '\u7761\u524d\u4f4e\u523a\u6fc0',
    aliases: ['\u7761\u524d', '\u60f3\u7761', '\u52a9\u7720', '\u5b89\u7720'],
    categoryIds: ['bgm_instrumental', 'sad_healing'],
    speech: 'minimal'
  },
  {
    id: 'memory_lane',
    name: '\u56de\u5fc6\u6740',
    aliases: ['\u56de\u5fc6\u6740', '\u6000\u65e7', '\u8001\u6b4c', '\u7ae5\u5e74'],
    categoryIds: ['nostalgia', 'ost_film_tv', 'chinese_pop'],
    speech: 'warm'
  },
  {
    id: 'ktv_singalong',
    name: 'KTV',
    aliases: ['ktv', 'KTV', '\u8ddf\u5531', '\u5531\u6b4c'],
    categoryIds: ['ktv', 'chinese_pop', 'nostalgia'],
    speech: 'short'
  }
];

function normalize(text) {
  return String(text || '').toLowerCase().replace(/\s+/g, '');
}

function shuffle(items) {
  const copy = [...items];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

function findScene(query) {
  const q = normalize(query);
  if (!q) return null;
  return SCENES.find(scene => {
    const names = [scene.id, scene.name, ...(scene.aliases || [])].map(normalize);
    return names.some(name => name === q || q.includes(name) || name.includes(q));
  }) || null;
}

function buildScenePool(scene, limit = 80) {
  if (!scene) return [];
  const allCategories = categories.loadCategories();
  const byId = new Map(allCategories.map(category => [category.id, category]));
  const tracks = [];
  for (const categoryId of scene.categoryIds || []) {
    const category = byId.get(categoryId);
    if (!category) continue;
    tracks.push(...categories.buildCategoryPool(category, Math.ceil(limit / 2)));
  }
  return shuffle(tracks).slice(0, limit);
}

function summarizeScenes() {
  return SCENES.map(scene => ({
    id: scene.id,
    name: scene.name,
    aliases: scene.aliases,
    categoryIds: scene.categoryIds,
    speech: scene.speech
  }));
}

module.exports = { findScene, buildScenePool, summarizeScenes };
