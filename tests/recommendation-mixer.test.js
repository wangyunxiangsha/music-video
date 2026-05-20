const assert = require('assert');
const mixer = require('../server/recommendation-mixer');

function track(id, name, artist = 'Artist', extra = {}) {
  return {
    id,
    name,
    artists: [{ name: artist }],
    album: { name: `Album ${id}` },
    ...extra
  };
}

async function run() {
  const localPool = [
    track('l1', 'Local 1'),
    track('l2', 'Local 2'),
    track('l3', 'Local 3'),
    track('l4', 'Local 4'),
    track('l5', 'Local 5'),
    track('l6', 'Local 6')
  ];
  const externalPool = [
    track('e1', 'External 1', 'New', { recommendationSource: 'external' }),
    track('e2', 'External 2', 'New', { recommendationSource: 'external' })
  ];

  const mixed = mixer.mixRecommendationQueue({ localPool, externalPool, limit: 8 });
  assert.deepStrictEqual(
    mixed.map(item => item.id),
    ['l1', 'l2', 'l3', 'e1', 'l4', 'l5', 'l6', 'e2']
  );
  assert.strictEqual(mixed.filter(item => item.recommendationSource === 'external').length, 2);

  const localOnly = mixer.mixRecommendationQueue({ localPool, externalPool, localRatio: 1, limit: 6 });
  assert.deepStrictEqual(localOnly.map(item => item.id), ['l1', 'l2', 'l3', 'l4', 'l5', 'l6']);

  const deduped = mixer.mixRecommendationQueue({
    localPool: [track('same', 'Same'), track('l2', 'Local 2')],
    externalPool: [track('same', 'Same', 'Artist', { recommendationSource: 'external' }), track('e1', 'External 1', 'New', { recommendationSource: 'external' })],
    limit: 4
  });
  assert.deepStrictEqual(deduped.map(item => item.id), ['same', 'l2', 'e1']);

  const filtered = mixer.mixRecommendationQueue({
    localPool,
    externalPool: [track('e1', 'External 1', 'Blocked', { recommendationSource: 'external' }), track('e2', 'External 2', 'New', { recommendationSource: 'external' })],
    isBlocked: item => item.artists?.[0]?.name === 'Blocked',
    limit: 8
  });
  assert.ok(filtered.every(item => item.artists?.[0]?.name !== 'Blocked'));
  assert.ok(filtered.some(item => item.id === 'e2'));

  const fakeMusic = {
    async searchSongs(query) {
      if (query.includes('林俊杰')) {
        return [
          track('bad1', '新推荐 Live', '林俊杰', { privilege: { pl: 1 } }),
          track('bad2', '新推荐 DJ Remix', '林俊杰', { privilege: { pl: 1 } }),
          track('n1', '新推荐', '林俊杰', { privilege: { pl: 1 } })
        ];
      }
      return [];
    }
  };
  const external = await mixer.buildExternalRecommendationPool({
    music: fakeMusic,
    tasteSignals: { topArtists: [{ name: '林俊杰', count: 3 }], topCategories: [], recentSongs: [] },
    limit: 4
  });
  assert.strictEqual(external[0].recommendationSource, 'external');
  assert.strictEqual(external[0].sourceReason, '林俊杰');
  assert.deepStrictEqual(external.map(item => item.id), ['n1']);

  assert.strictEqual(mixer.resolveExternalRecommendationRatio({ env: { EXTERNAL_RECOMMEND_RATIO: '0.4' } }), 0.4);
  assert.strictEqual(mixer.resolveExternalRecommendationRatio({ env: { EXTERNAL_RECOMMEND_RATIO: 'bad' } }), 0.25);
  assert.strictEqual(mixer.ratioForExplorationMode('localOnly', 0.25), 0);
  assert.strictEqual(mixer.ratioForExplorationMode('conservative', 0.25), 0.1);
  assert.strictEqual(mixer.ratioForExplorationMode('discovery', 0.25), 0.4);
  assert.strictEqual(mixer.parseExplorationCommand('保守一点')?.mode, 'conservative');
  assert.strictEqual(mixer.parseExplorationCommand('多发现新歌')?.mode, 'discovery');
  assert.strictEqual(mixer.parseExplorationCommand('只听我的歌单')?.mode, 'localOnly');

  console.log('recommendation mixer tests passed');
}

run().catch((error) => {
  console.error(error);
  process.exit(1);
});
