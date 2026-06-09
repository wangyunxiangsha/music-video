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

  const neteaseTrack = track('123', 'Old Netease Song');
  importer.addTrackToLocalPool(neteaseTrack, { dataFile: file });
  let data = JSON.parse(fs.readFileSync(file, 'utf8'));
  data.netease.playlists.push({
    id: 'n1',
    name: 'Old List',
    songCount: 1,
    songs: [{ id: '123', name: 'Old Netease Song', artists: ['External Artist'], album: 'External Album' }]
  });
  data.qq.playlists.push({
    id: 'q1',
    name: 'QQ Old List',
    songCount: 1,
    songs: [{ mid: 'abc', name: 'External Song', artists: ['External Artist'], album: 'External Album' }]
  });
  fs.writeFileSync(file, JSON.stringify(data, null, 2), 'utf8');

  const removedNetease = importer.removeTrackFromLocalPool(neteaseTrack, { dataFile: file });
  assert.strictEqual(removedNetease.ok, true);
  assert.strictEqual(removedNetease.removedCount, 2);
  data = JSON.parse(fs.readFileSync(file, 'utf8'));
  assert.strictEqual(data.claudio.removedTracks.some(item => item.key === 'netease:123'), true);
  assert.strictEqual(importer.buildPlaylistPool({ dataFile: file }).some(item => item.id === '123'), false);

  const removedQQ = importer.removeTrackFromLocalPool(track('qq:abc'), { dataFile: file });
  assert.strictEqual(removedQQ.ok, true);
  assert.strictEqual(removedQQ.removedCount, 2);
  data = JSON.parse(fs.readFileSync(file, 'utf8'));
  assert.strictEqual(data.claudio.removedTracks.some(item => item.key === 'qq:abc'), true);
  assert.strictEqual(importer.buildPlaylistPool({ dataFile: file }).some(item => item.id === 'qq:abc'), false);

  const restoredQQ = importer.addTrackToLocalPool(track('qq:abc'), { dataFile: file });
  assert.strictEqual(restoredQQ.ok, true);
  data = JSON.parse(fs.readFileSync(file, 'utf8'));
  assert.strictEqual(data.claudio.removedTracks.some(item => item.key === 'qq:abc'), false);
  assert.strictEqual(importer.buildPlaylistPool({ dataFile: file }).some(item => item.id === 'qq:abc'), true);

  console.log('local pool save tests passed');
}

run();
