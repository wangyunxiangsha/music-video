const fs = require('fs');
const path = require('path');

const DATA_FILE = path.join(__dirname, '../data/categories.json');

function loadCategories() {
  try {
    const data = JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));
    return data.categories || [];
  } catch {
    return [];
  }
}

function normalize(text) {
  return String(text || '').toLowerCase().replace(/\s+/g, '');
}

function findCategory(query) {
  const q = normalize(query);
  if (!q) return null;
  const aliases = {
    华语: '华语流行',
    流行: '华语流行',
    怀旧: '怀旧金曲',
    老歌: '怀旧金曲',
    伤感: '伤感疗愈',
    治愈: '伤感疗愈',
    疗愈: '伤感疗愈',
    国风: '国风古风',
    古风: '国风古风',
    动漫: '动漫二次元',
    二次元: '动漫二次元',
    acg: '动漫二次元',
    影视: '影视 OST',
    ost: '影视 OST',
    bgm: 'BGM/纯音乐',
    纯音乐: 'BGM/纯音乐',
    日语: '日语',
    韩语: '韩语',
    英语: '英语/欧美摇滚电子',
    欧美: '英语/欧美摇滚电子',
    摇滚: '英语/欧美摇滚电子',
    电音: '电音燃向',
    燃向: '电音燃向',
    ktv: 'KTV',
    歌手: '歌手专题',
    专题: '歌手专题',
    喜欢: '喜欢/杂选',
    杂选: '喜欢/杂选'
  };
  const wanted = aliases[q] || aliases[Object.keys(aliases).find(key => q.includes(normalize(key)))] || query;
  const normalizedWanted = normalize(wanted);
  return loadCategories().find(category => {
    const id = normalize(category.id);
    const name = normalize(category.name);
    return id === q || name === normalizedWanted || name.includes(q) || q.includes(name);
  }) || null;
}

function shuffle(items) {
  const copy = [...items];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

function trackFromCategorySong(song, category) {
  const playbackId = song.playbackIds?.find(id => !id.startsWith('qq:')) || song.playbackIds?.[0];
  if (!playbackId) return null;
  return {
    id: playbackId,
    source: playbackId.startsWith('qq:') ? 'qq' : 'netease',
    _qqmid: playbackId.startsWith('qq:') ? playbackId.slice(3) : undefined,
    name: song.title,
    artists: (song.artists || []).map(name => ({ name })),
    album: {},
    privilege: { pl: 1 },
    categoryIds: [category.id],
    categoryName: category.name
  };
}

function buildCategoryPool(category, limit = 80) {
  if (!category) return [];
  return shuffle(category.songs || [])
    .map(song => trackFromCategorySong(song, category))
    .filter(Boolean)
    .slice(0, limit);
}

function summarizeCategories() {
  return loadCategories().map(c => ({ id: c.id, name: c.name, songCount: c.songCount, playbackCount: c.playbackCount }));
}

module.exports = { loadCategories, findCategory, buildCategoryPool, summarizeCategories };
