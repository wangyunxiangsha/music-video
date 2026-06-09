const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');

const importer = require('../server/import');

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'claudio-sync-'));
const file = path.join(tmp, 'playlists.json');

function run() {
  const existing = {
    lastUpdated: '2026-05-23T00:00:00.000Z',
    netease: {
      playlists: [{
        id: 'n1',
        name: '旧网易歌单',
        songCount: 2,
        songs: [
          { id: '1', name: '旧歌名', artists: ['旧歌手'], album: '旧专辑' },
          { id: '2', name: '平台已删歌曲', artists: ['歌手'], album: '专辑' }
        ]
      }]
    },
    qq: {
      playlists: [{
        id: 'q1',
        name: '旧QQ歌单',
        songCount: 1,
        songs: [{ mid: 'blocked', mediaMid: 'old-media', name: '已屏蔽歌曲', artists: ['QQ歌手'], album: '旧专辑' }]
      }]
    },
    claudio: {
      playlists: [{
        id: 'claudio-saved',
        name: 'Claudio 收藏',
        songCount: 1,
        songs: [{ id: 'saved', source: 'netease', name: '本地收藏', artists: ['本地歌手'], album: '本地专辑' }]
      }],
      removedTracks: [{
        key: 'qq:blocked',
        name: '已屏蔽歌曲',
        artist: 'QQ歌手',
        removedAt: '2026-05-23T01:00:00.000Z'
      }]
    }
  };

  const imported = {
    netease: {
      playlists: [{
        id: 'n1',
        name: '新网易歌单名',
        songCount: 2,
        songs: [
          { id: '1', name: '新歌名', artists: ['新歌手'], album: '新专辑' },
          { id: '3', name: '平台新增歌曲', artists: ['新歌手'], album: '新专辑' }
        ]
      }]
    },
    qq: {
      playlists: [{
        id: 'q1',
        name: '旧QQ歌单',
        songCount: 1,
        songs: [{ mid: 'blocked', mediaMid: 'new-media', name: '已屏蔽歌曲', artists: ['QQ歌手'], album: '新专辑' }]
      }]
    }
  };

  const { data, summary } = importer.mergeImportedPlaylists(existing, imported);

  assert.strictEqual(data.claudio.playlists[0].songs[0].id, 'saved');
  assert.strictEqual(data.claudio.removedTracks[0].key, 'qq:blocked');
  assert.deepStrictEqual(data.netease.playlists[0].songs.map(song => song.id), ['1', '3']);
  assert.strictEqual(data.netease.playlists[0].songs[0].name, '新歌名');
  assert.strictEqual(data.qq.playlists[0].songs[0].mediaMid, 'new-media');
  assert.strictEqual(summary.netease.addedSongs, 1);
  assert.strictEqual(summary.netease.updatedSongs, 1);
  assert.strictEqual(summary.netease.removedSongs, 1);
  assert.strictEqual(summary.preservedRemovedTracks, 1);

  fs.writeFileSync(file, JSON.stringify(data, null, 2), 'utf8');
  const pool = importer.buildPlaylistPool({ dataFile: file });
  assert.strictEqual(pool.some(track => track.id === 'qq:blocked'), false);
  assert.strictEqual(pool.some(track => track.id === 'saved'), true);

  const partial = importer.mergeImportedPlaylists(data, { netease: null });
  assert.deepStrictEqual(partial.data.netease.playlists[0].songs.map(song => song.id), ['1', '3']);

  console.log('incremental sync tests passed');
}

run();
