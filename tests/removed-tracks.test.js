const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');

const importer = require('../server/import');

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'claudio-removed-'));
const file = path.join(tmp, 'playlists.json');

function run() {
  fs.writeFileSync(file, JSON.stringify({
    lastUpdated: '2026-05-24T00:00:00.000Z',
    netease: { playlists: [] },
    qq: { playlists: [] },
    claudio: {
      playlists: [],
      removedTracks: [
        { key: 'qq:def', name: '后删歌曲', artist: '歌手B', removedAt: '2026-05-24T02:00:00.000Z' },
        { key: 'netease:123', name: '先删歌曲', artist: '歌手A', removedAt: '2026-05-24T01:00:00.000Z' }
      ]
    }
  }, null, 2), 'utf8');

  const list = importer.listRemovedTracks({ dataFile: file });
  assert.strictEqual(list.length, 2);
  assert.strictEqual(list[0].key, 'qq:def');

  const restored = importer.restoreRemovedTrack('netease:123', { dataFile: file });
  assert.strictEqual(restored.ok, true);
  assert.strictEqual(restored.restored.key, 'netease:123');

  const after = importer.listRemovedTracks({ dataFile: file });
  assert.deepStrictEqual(after.map(item => item.key), ['qq:def']);

  const missing = importer.restoreRemovedTrack('netease:missing', { dataFile: file });
  assert.strictEqual(missing.ok, false);
  assert.match(missing.reason, /不在屏蔽列表/);

  console.log('removed tracks tests passed');
}

run();
