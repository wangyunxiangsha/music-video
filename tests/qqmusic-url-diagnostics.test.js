const assert = require('assert');
const axios = require('axios');

process.env.QQ_MUSIC_COOKIE = 'uin=o123; qqmusic_key=test-key; qm_keyst=test-key';
const qqmusic = require('../server/qqmusic');

const originalPost = axios.post;
const originalGet = axios.get;

axios.post = async () => ({
  data: {
    req_0: {
      data: {
        sip: ['https://dl.stream.qqmusic.qq.com/'],
        midurlinfo: [{ purl: '' }]
      }
    }
  }
});

axios.get = async () => {
  throw new Error('unexpected CDN probe');
};

(async () => {
  try {
    qqmusic.resetRuntimeState();
    const url = await qqmusic.getSongUrl('0018C4LJ40te4R', '003MEDIAID');
    assert.strictEqual(url, null);

    const state = qqmusic.getCircuitState();
    assert.strictEqual(state.latestUrlAttempt.songmid, '0018C4LJ40te4R');
    assert.strictEqual(state.latestUrlAttempt.result, 'failed');
    assert.strictEqual(state.latestUrlAttempt.category, 'membership_insufficient');
    assert.strictEqual(state.qualityStrategy.preferStable, false);
    assert.strictEqual(state.qualityStrategy.threshold, 2);
    assert.match(state.latestUrlAttempt.summary, /M800: empty purl/);
    assert.ok(state.recentUrlAttempts[0].category);

    console.log('qqmusic url diagnostics tests passed');
  } finally {
    axios.post = originalPost;
    axios.get = originalGet;
  }
})().catch((error) => {
  axios.post = originalPost;
  axios.get = originalGet;
  console.error(error);
  process.exit(1);
});
