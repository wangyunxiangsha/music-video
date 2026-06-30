const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const importer = require('../server/import');

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'claudio-qq-local-fallback-'));
const file = path.join(tmp, 'playlists.json');

fs.writeFileSync(file, JSON.stringify({
  netease: {
    playlists: [{
      id: 'n',
      name: '网易云',
      songs: [{ id: '254059', name: '情歌', artists: ['梁静茹'], album: '试听专辑' }]
    }]
  },
  qq: {
    playlists: [{
      id: 'q',
      name: 'QQ',
      songs: [{ mid: '001abc', mediaMid: '009media', name: '情歌', artists: ['梁静茹'], album: '完整专辑' }]
    }]
  },
  claudio: { playlists: [], removedTracks: [] }
}, null, 2));

const exact = importer.findLocalQqTrack('情歌', '梁静茹', { dataFile: file });
assert.strictEqual(exact.id, 'qq:001abc');
assert.strictEqual(exact._qqmid, '001abc');
assert.strictEqual(exact._qqMediaMid, '009media');
assert.strictEqual(exact.source, 'qq');

const byTitle = importer.findLocalQqTrack('情歌', '', { dataFile: file });
assert.strictEqual(byTitle.id, 'qq:001abc');

const pool = importer.buildPlaylistPool({ dataFile: file });
const song = pool.find(item => item.name === '情歌');
assert.strictEqual(song.id, 'qq:001abc');
assert.strictEqual(song.source, 'qq');

const missing = importer.findLocalQqTrack('小情歌', '梁静茹', { dataFile: file });
assert.strictEqual(missing, null);

console.log('qq local fallback tests passed');
