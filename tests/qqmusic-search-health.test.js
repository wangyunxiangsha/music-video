const assert = require('assert');
const axios = require('axios');
const qqmusic = require('../server/qqmusic');

const originalPost = axios.post;
const originalGet = axios.get;
const originalCookie = process.env.QQ_MUSIC_COOKIE;

(async () => {
  try {
    process.env.QQ_MUSIC_COOKIE = 'uin=o123456; qqmusic_key=token';
    qqmusic.resetRuntimeState();

    axios.post = async () => ({
      data: { code: 0, req: { code: 500003, subcode: 860100005 } }
    });
    axios.get = async () => {
      const error = new Error('fallback HTTP 500');
      error.response = { status: 500 };
      throw error;
    };

    const empty = await qqmusic.searchSongs('情歌', 3);
    assert.deepStrictEqual(empty, []);
    const failed = qqmusic.getSearchHealth();
    assert.strictEqual(failed.state, 'warn');
    assert.strictEqual(failed.lastQuery, '情歌');
    assert.match(failed.message, /QQ 搜索接口最近失败/);
    assert.match(failed.lastReason, /new api code 500003/);
    assert.match(failed.lastReason, /fallback HTTP 500/);

    axios.post = async () => ({
      data: {
        req: {
          data: {
            body: {
              song: {
                list: [{
                  mid: '001abc',
                  name: '情歌',
                  singer: [{ name: '梁静茹' }],
                  album: { name: '崇拜', mid: '002alb' },
                  file: { media_mid: '009media' }
                }]
              }
            }
          }
        }
      }
    });

    const songs = await qqmusic.searchSongs('情歌 梁静茹', 3);
    assert.strictEqual(songs[0].id, 'qq:001abc');
    const ok = qqmusic.getSearchHealth();
    assert.strictEqual(ok.state, 'ok');
    assert.strictEqual(ok.lastQuery, '情歌 梁静茹');
    assert.match(ok.message, /QQ 搜索最近正常/);
  } finally {
    axios.post = originalPost;
    axios.get = originalGet;
    if (originalCookie === undefined) {
      delete process.env.QQ_MUSIC_COOKIE;
    } else {
      process.env.QQ_MUSIC_COOKIE = originalCookie;
    }
    qqmusic.resetRuntimeState();
  }

  console.log('qqmusic search health tests passed');
})().catch((error) => {
  axios.post = originalPost;
  axios.get = originalGet;
  if (originalCookie === undefined) {
    delete process.env.QQ_MUSIC_COOKIE;
  } else {
    process.env.QQ_MUSIC_COOKIE = originalCookie;
  }
  qqmusic.resetRuntimeState();
  throw error;
});
