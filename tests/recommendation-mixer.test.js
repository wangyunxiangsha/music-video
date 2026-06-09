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

  const preferred = mixer.preferCleanVersions([
    track('live', '寄明月 (Live)', 'SING女团', { album: { name: '炙热的我们 第8期' } }),
    track('clean', '寄明月', 'SING女团', { album: { name: '寄明月' } })
  ]);
  assert.deepStrictEqual(preferred.map(item => item.id), ['clean']);

  const noCleanFallback = mixer.preferCleanVersions([
    track('live-only', '空白格 (Live)', '蔡健雅', { album: { name: '演唱会' } })
  ]);
  assert.deepStrictEqual(noCleanFallback.map(item => item.id), ['live-only']);

  const artistPreferred = mixer.preferArtistMatches([
    track('cover', '寄明月', '鱼忆'),
    track('original', '寄明月', 'SING女团')
  ], 'sing');
  assert.deepStrictEqual(artistPreferred.map(item => item.id), ['original']);

  const noArtistFallback = mixer.preferArtistMatches([
    track('cover-only', '寄明月', '鱼忆')
  ], 'sing');
  assert.deepStrictEqual(noArtistFallback, []);

  assert.strictEqual(mixer.originalArtistForSong('寄明月'), 'SING女团');
  assert.strictEqual(mixer.originalArtistForSong('夜笙歌'), 'SING女团');
  const originalPreferred = mixer.preferOriginalArtist([
    track('cover2', '夜笙歌', '小贝酱酱酱'),
    track('original2', '夜笙歌', 'SING女团')
  ], '夜笙歌');
  assert.deepStrictEqual(originalPreferred.map(item => item.id), ['original2']);

  const originalFallback = mixer.preferOriginalArtist([
    track('cover3', '夜笙歌', '小贝酱酱酱')
  ], '夜笙歌');
  assert.deepStrictEqual(originalFallback.map(item => item.id), ['cover3']);

  assert.strictEqual(mixer.titleMatches(track('title1', '漫步人生路', '邓丽君'), '漫漫人生路'), true);
  assert.strictEqual(mixer.titleMatches(track('title2', '時の流れに身をまかせ', '邓丽君'), '漫漫人生路'), false);
  const titlePreferred = mixer.preferTitleMatches([
    track('wrong-title', '時の流れに身をまかせ', '邓丽君'),
    track('fuzzy-title', '漫步人生路', '邓丽君')
  ], '漫漫人生路');
  assert.deepStrictEqual(titlePreferred.map(item => item.id), ['fuzzy-title']);

  const localOnly = mixer.mixRecommendationQueue({ localPool, externalPool, localRatio: 1, limit: 6 });
  assert.deepStrictEqual(localOnly.map(item => item.id), ['l1', 'l2', 'l3', 'l4', 'l5', 'l6']);

  const artistHeavy = mixer.mixRecommendationQueue({
    localPool: [
      track('jj1', 'JJ 1', '林俊杰'),
      track('jj2', 'JJ 2', '林俊杰'),
      track('jj3', 'JJ 3', '林俊杰'),
      track('vae1', 'V 1', '许嵩'),
      track('sing1', 'S 1', 'SING女团')
    ],
    externalPool: [],
    localRatio: 1,
    limit: 5
  });
  assert.deepStrictEqual(
    artistHeavy.map(item => item.artist || item.artists?.[0]?.name),
    ['林俊杰', '许嵩', 'SING女团', '林俊杰', '林俊杰']
  );

  const externalArtistHeavy = mixer.mixRecommendationQueue({
    localPool: [],
    externalPool: [
      track('ejj1', 'EJJ 1', '林俊杰', { recommendationSource: 'external' }),
      track('ejj2', 'EJJ 2', '林俊杰', { recommendationSource: 'external' }),
      track('evae1', 'EV 1', '许嵩', { recommendationSource: 'external' }),
      track('esing1', 'ES 1', 'SING女团', { recommendationSource: 'external' })
    ],
    localRatio: 0,
    limit: 4
  });
  assert.deepStrictEqual(
    externalArtistHeavy.map(item => item.artists?.[0]?.name),
    ['林俊杰', '许嵩', 'SING女团', '林俊杰']
  );

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

  const seeds = mixer.querySeeds({
    tasteSignals: {
      topArtists: [{ name: '林俊杰', count: 26 }, { name: '许嵩', count: 18 }],
      topCategories: [{ name: '国风古风', count: 23 }, { name: 'BGM/纯音乐', count: 12 }]
    },
    slot: { slotLabel: '上午' }
  });
  assert.deepStrictEqual(seeds.map(seed => seed.query), [
    '国风古风 推荐',
    'BGM/纯音乐 推荐',
    '上午 音乐',
    '林俊杰 相似推荐'
  ]);

  const rolls = [0.25, 0.9];
  const weighted = mixer.weightedShuffle(
    [
      track('top', 'Top', '林俊杰'),
      track('other', 'Other', '冷门歌手')
    ],
    item => item.id === 'top' ? 4 : 1,
    () => rolls.shift()
  );
  assert.deepStrictEqual(weighted.map(item => item.id), ['other', 'top']);

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
