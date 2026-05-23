const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');

const importer = require('../server/import');

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'claudio-local-pool-'));
const file = path.join(tmp, 'playlists.json');

function track(id, name = 'External Song') {
  return {
    id,
    source: String(id).startsWith('qq:') ? 'qq' : 'netease',
    name,
    artists: [{ name: 'External Artist' }],
    album: { name: 'External Album' },
    recommendationSource: 'external'
  };
}

function run() {
  const first = importer.addTrackToLocalPool(track('qq:abc'), { dataFile: file });
  assert.strictEqual(first.ok, true);
  assert.strictEqual(first.added, true);
  assert.strictEqual(first.playlistName, 'Claudio 收藏');

  const saved = JSON.parse(fs.readFileSync(file, 'utf8'));
  assert.strictEqual(saved.claudio.playlists[0].songs.length, 1);
  assert.deepStrictEqual(saved.claudio.playlists[0].songs[0], {
    mid: 'abc',
    mediaMid: '',
    name: 'External Song',
    artists: ['External Artist'],
    album: 'External Album',
    source: 'qq'
  });

  const duplicate = importer.addTrackToLocalPool(track('qq:abc'), { dataFile: file });
  assert.strictEqual(duplicate.ok, true);
  assert.strictEqual(duplicate.added, false);
  assert.strictEqual(JSON.parse(fs.readFileSync(file, 'utf8')).claudio.playlists[0].songs.length, 1);

  const pool = importer.buildPlaylistPool({ dataFile: file });
  assert.strictEqual(pool.some(item => item.id === 'qq:abc' && item.recommendationSource === 'local'), true);

  console.log('local pool save tests passed');
}

run();
