const assert = require('assert');
const axios = require('axios');
const logger = require('../server/logger');
const qqmusic = require('../server/qqmusic');

const originalPost = axios.post;
const originalGet = axios.get;
const originalWarn = logger.warn;
const originalCookie = process.env.QQ_MUSIC_COOKIE;

(async () => {
  const warnings = [];
  try {
    process.env.QQ_MUSIC_COOKIE = 'uin=o123456; qqmusic_key=token; qm_keyst=token';
    qqmusic.resetRuntimeState();

    logger.warn = (...args) => warnings.push(args.join(' '));
    axios.post = async () => ({
      data: { code: 0, req: { code: 500003, subcode: 860100005 } }
    });
    axios.get = async (url) => {
      const error = new Error(String(url).includes('smartbox') ? 'smartbox HTTP 500' : 'legacy HTTP 500');
      error.response = { status: 500 };
      throw error;
    };

    const songs = await qqmusic.searchSongs('情歌', 3);
    assert.deepStrictEqual(songs, []);
    assert.strictEqual(qqmusic.getSearchHealth().state, 'warn');
    assert.deepStrictEqual(
      warnings.filter(line => /search fallback|smartbox search/i.test(line)),
      []
    );
  } finally {
    axios.post = originalPost;
    axios.get = originalGet;
    logger.warn = originalWarn;
    if (originalCookie === undefined) {
      delete process.env.QQ_MUSIC_COOKIE;
    } else {
      process.env.QQ_MUSIC_COOKIE = originalCookie;
    }
    qqmusic.resetRuntimeState();
  }

  console.log('qqmusic search log noise tests passed');
})().catch((error) => {
  axios.post = originalPost;
  axios.get = originalGet;
  logger.warn = originalWarn;
  if (originalCookie === undefined) {
    delete process.env.QQ_MUSIC_COOKIE;
  } else {
    process.env.QQ_MUSIC_COOKIE = originalCookie;
  }
  qqmusic.resetRuntimeState();
  throw error;
});
