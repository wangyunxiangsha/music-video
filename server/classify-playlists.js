require('dotenv').config();
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const INPUT = path.join(ROOT, 'data/playlists.json');
const CATEGORIES_OUT = path.join(ROOT, 'data/categories.json');
const SONGS_OUT = path.join(ROOT, 'data/songs-classified.json');

const CATEGORY_DEFS = [
  { id: 'chinese_pop', name: '华语流行', description: '华语流行、日常循环、热门单曲' },
  { id: 'nostalgia', name: '怀旧金曲', description: '90 后、00 后记忆里的华语与经典流行' },
  { id: 'sad_healing', name: '伤感疗愈', description: '失落、安静、疗愈、夜晚独处时适合播放' },
  { id: 'guofeng', name: '国风古风', description: '古风、国风、武侠感、中文传统意象' },
  { id: 'anime_acg', name: '动漫二次元', description: '日漫、国漫、二次元、ACG 相关歌曲' },
  { id: 'ost_film_tv', name: '影视 OST', description: '影视剧、台偶、剧集、电影、游戏配乐相关' },
  { id: 'bgm_instrumental', name: 'BGM/纯音乐', description: '背景音乐、视频配乐、纯音乐、氛围音乐' },
  { id: 'japanese', name: '日语', description: '日语歌曲、日本流行与动漫歌曲' },
  { id: 'korean', name: '韩语', description: '韩语流行与 K-Pop' },
  { id: 'english_rock_electronic', name: '英语/欧美摇滚电子', description: '英语歌、欧美摇滚、电子、燃向音乐' },
  { id: 'electronic_energy', name: '电音燃向', description: '电子、节奏、史诗感、运动和提神场景' },
  { id: 'ktv', name: 'KTV', description: '适合跟唱、聚会、练歌' },
  { id: 'artist_special', name: '歌手专题', description: '以特定歌手为主题的歌单' },
  { id: 'favorites_mixed', name: '喜欢/杂选', description: '喜欢、杂乱、单曲循环等综合收藏' }
];

const PLAYLIST_RULES = [
  { re: /伤心|治愈|心情|疗愈|孤独|夜|难过|悲|失恋/i, ids: ['sad_healing'] },
  { re: /怀旧|那些年|92|99|00|10|老歌|经典/i, ids: ['nostalgia', 'chinese_pop'] },
  { re: /国风|古风|二次元古风|武侠/i, ids: ['guofeng', 'chinese_pop'] },
  { re: /国漫|日漫|二次元|动漫|ACG/i, ids: ['anime_acg'] },
  { re: /日语|日本|J-?POP/i, ids: ['japanese'] },
  { re: /韩语|韩国|K-?POP/i, ids: ['korean'] },
  { re: /英语|欧美|摇滚|rock/i, ids: ['english_rock_electronic'] },
  { re: /电音|电子|燃|epic|battle|trailer/i, ids: ['electronic_energy', 'english_rock_electronic'] },
  { re: /BGM|背景|视频|纯音乐|配乐/i, ids: ['bgm_instrumental'] },
  { re: /OST|影视|台偶|电影|剧/i, ids: ['ost_film_tv'] },
  { re: /ktv|KTV|sing|练歌/i, ids: ['ktv'] },
  { re: /许嵩|任贤齐/i, ids: ['artist_special', 'chinese_pop'] },
  { re: /喜欢|杂乱|单曲循环|佳作|我喜欢/i, ids: ['favorites_mixed'] }
];

const SONG_RULES = [
  { re: /cover|翻自|翻唱/i, ids: ['favorites_mixed'] },
  { re: /ost|theme|soundtrack|主題歌|テーマ|原声|配乐|插曲/i, ids: ['ost_film_tv'] },
  { re: /instrumental|intro|bgm|piano|纯音乐/i, ids: ['bgm_instrumental'] },
  { re: /remix|dubstep|electro|edm|tobu|alan walker|two steps from hell|audiomachine/i, ids: ['electronic_energy'] },
  { re: /anime|op|ed|eva|railgun|dragonball|pokemon|conan|sawano|lisa/i, ids: ['anime_acg', 'japanese'] },
  { re: /nightwish|linkin park|fall out boy|bon jovi|green day|imagine dragons|coldplay|eminem/i, ids: ['english_rock_electronic'] }
];

function readJson(file) {
  return JSON.parse(fs.readFileSync(file, 'utf8'));
}

function normalizeText(value) {
  return String(value || '').trim();
}

function unique(values) {
  return [...new Set(values.filter(Boolean))];
}

function addScore(scores, id, amount = 1) {
  scores[id] = (scores[id] || 0) + amount;
}

function classifyByRules(text, rules, scores, amount) {
  for (const rule of rules) {
    if (rule.re.test(text)) {
      for (const id of rule.ids) addScore(scores, id, amount);
    }
  }
}

function sourceSongId(source, song) {
  if (source === 'qq') return `qq:${song.mid}`;
  return `netease:${song.id}`;
}

function playbackId(source, song) {
  if (source === 'qq') return `qq:${song.mid}`;
  return String(song.id);
}

function flattenSongs(data) {
  const rows = [];
  for (const source of ['netease', 'qq']) {
    const playlists = data[source]?.playlists || [];
    for (const playlist of playlists) {
      for (const song of playlist.songs || []) {
        rows.push({
          source,
          sourceSongId: sourceSongId(source, song),
          playbackId: playbackId(source, song),
          title: normalizeText(song.name),
          artists: Array.isArray(song.artists) ? song.artists.map(normalizeText).filter(Boolean) : [],
          album: normalizeText(song.album),
          playlist: {
            id: normalizeText(playlist.id),
            name: normalizeText(playlist.name)
          }
        });
      }
    }
  }
  return rows.filter(row => row.playbackId && row.title);
}

function classifySong(row) {
  const scores = {};
  const text = [
    row.title,
    row.album,
    row.playlist.name,
    row.artists.join(' ')
  ].join(' ');

  classifyByRules(row.playlist.name, PLAYLIST_RULES, scores, 4);
  classifyByRules(text, SONG_RULES, scores, 2);

  if (/周杰伦|林俊杰|陈奕迅|薛之谦|许嵩|任贤齐|张信哲|S\.H\.E|王菲|张惠妹|五月天|周传雄/i.test(text)) {
    addScore(scores, 'chinese_pop', 2);
  }
  if (/日语|日漫|J-?POP|LiSA|宇多田|花澤|高橋|松本|Sawano|WANDS|SNoW/i.test(text)) {
    addScore(scores, 'japanese', 2);
  }
  if (/韩语|K-?POP|MOMOLAND|BLACKPINK|BTS|BIGBANG|IU/i.test(text)) {
    addScore(scores, 'korean', 2);
  }

  if (!Object.keys(scores).length) {
    addScore(scores, row.source === 'qq' ? 'favorites_mixed' : 'chinese_pop', 1);
  }

  const sorted = Object.entries(scores).sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));
  const categoryIds = sorted.map(([id]) => id);
  return {
    ...row,
    primaryCategory: categoryIds[0],
    categoryIds,
    categoryScores: Object.fromEntries(sorted)
  };
}

function mergeDuplicateSongs(rows) {
  const byKey = new Map();
  for (const row of rows) {
    const key = `${row.title.toLowerCase()}::${row.artists.join('/').toLowerCase()}`;
    const existing = byKey.get(key);
    if (!existing) {
      byKey.set(key, {
        ...row,
        sourceSongIds: [row.sourceSongId],
        playbackIds: [row.playbackId],
        sources: [row.source],
        playlists: [row.playlist],
      });
      continue;
    }

    existing.sourceSongIds = unique([...existing.sourceSongIds, row.sourceSongId]);
    existing.playbackIds = unique([...existing.playbackIds, row.playbackId]);
    existing.sources = unique([...existing.sources, row.source]);
    existing.playlists.push(row.playlist);
    existing.categoryIds = unique([...existing.categoryIds, ...row.categoryIds]);
    for (const [id, score] of Object.entries(row.categoryScores)) {
      existing.categoryScores[id] = (existing.categoryScores[id] || 0) + score;
    }
    const sorted = Object.entries(existing.categoryScores).sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));
    existing.primaryCategory = sorted[0][0];
    existing.categoryIds = sorted.map(([id]) => id);
    existing.categoryScores = Object.fromEntries(sorted);
  }
  return [...byKey.values()].map((row, index) => ({
    uid: `song:${String(index + 1).padStart(5, '0')}`,
    title: row.title,
    artists: row.artists,
    album: row.album,
    primaryCategory: row.primaryCategory,
    categoryIds: row.categoryIds,
    categoryScores: row.categoryScores,
    sources: row.sources,
    playbackIds: row.playbackIds,
    sourceSongIds: row.sourceSongIds,
    playlists: row.playlists
  }));
}

function buildCategories(songs) {
  const categories = CATEGORY_DEFS.map(def => ({ ...def, songCount: 0, songs: [] }));
  const byId = new Map(categories.map(category => [category.id, category]));

  for (const song of songs) {
    for (const id of song.categoryIds) {
      const category = byId.get(id);
      if (!category) continue;
      category.songs.push({
        uid: song.uid,
        title: song.title,
        artists: song.artists,
        playbackIds: song.playbackIds,
        sources: song.sources,
        primary: song.primaryCategory === id
      });
    }
  }

  for (const category of categories) {
    category.songCount = category.songs.length;
    category.playbackIds = unique(category.songs.flatMap(song => song.playbackIds));
    category.playbackCount = category.playbackIds.length;
    category.songs.sort((a, b) => Number(b.primary) - Number(a.primary) || a.title.localeCompare(b.title, 'zh-CN'));
  }
  return categories.filter(category => category.songCount > 0);
}

function main() {
  const raw = readJson(INPUT);
  const classifiedRows = flattenSongs(raw).map(classifySong);
  const songs = mergeDuplicateSongs(classifiedRows);
  const categories = buildCategories(songs);
  const generatedAt = new Date().toISOString();
  const sourceTrackCount = classifiedRows.length;

  const categoriesPayload = {
    generatedAt,
    sourceFile: 'data/playlists.json',
    categoryCount: categories.length,
    sourceTrackCount,
    uniqueSongCount: songs.length,
    categories
  };
  const songsPayload = {
    generatedAt,
    sourceFile: 'data/playlists.json',
    sourceTrackCount,
    uniqueSongCount: songs.length,
    songs
  };

  fs.writeFileSync(CATEGORIES_OUT, JSON.stringify(categoriesPayload, null, 2), 'utf8');
  fs.writeFileSync(SONGS_OUT, JSON.stringify(songsPayload, null, 2), 'utf8');

  console.log(`✓ 分类完成：${sourceTrackCount} 条歌单歌曲记录，${songs.length} 首去重歌曲，${categories.length} 个分类`);
  for (const category of categories) {
    console.log(`  - ${category.name}: ${category.songCount} 首去重歌曲 / ${category.playbackCount} 个播放 ID`);
  }
  console.log(`✓ 已写入 ${CATEGORIES_OUT}`);
  console.log(`✓ 已写入 ${SONGS_OUT}`);
}

main();
