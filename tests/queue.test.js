const assert = require('assert');
const queue = require('../server/queue');

function track(id, name, artist = 'Artist') {
  return {
    id,
    name,
    artists: [{ name: artist }],
    album: { name: `Album ${id}` },
    categoryName: 'Test'
  };
}

function run() {
  const current = track('0', 'Current', 'Now');
  const upcoming = [
    track('1', 'One'),
    track('2', 'Two'),
    track('3', 'Three'),
    track('4', 'Four'),
    track('5', 'Five'),
    track('6', 'Six')
  ];

  const summary = queue.summarizeQueue({
    currentTrack: current,
    playlist: upcoming,
    limit: 5,
    scene: { id: 'work', name: '工作专注' },
    djPolicy: { mode: 'minimal', name: '少说一点' }
  });

  assert.strictEqual(summary.count, 6);
  assert.strictEqual(summary.next.length, 5);
  assert.strictEqual(summary.next[0].name, 'One');
  assert.strictEqual(summary.next[4].name, 'Five');
  assert.strictEqual(summary.current.artist, 'Now');
  assert.strictEqual(summary.scene.name, '工作专注');
  assert.strictEqual(summary.djPolicy.mode, 'minimal');

  const removed = queue.removeNext(upcoming);
  assert.strictEqual(removed.removed.name, 'One');
  assert.deepStrictEqual(removed.playlist.map(item => item.name), ['Two', 'Three', 'Four', 'Five', 'Six']);
  assert.deepStrictEqual(upcoming.map(item => item.name), ['One', 'Two', 'Three', 'Four', 'Five', 'Six']);

  const rebuilt = queue.rebuildQueue([track('a', 'A'), track('b', 'B')]);
  assert.deepStrictEqual(rebuilt.map(item => item.name), ['A', 'B']);

  const inserted = queue.insertNext([track('2', 'Two')], track('9', 'Inserted'));
  assert.deepStrictEqual(inserted.map(item => item.name), ['Inserted', 'Two']);

  console.log('queue tests passed');
}

run();
