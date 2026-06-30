const assert = require('assert');
const axios = require('axios');
const qqmusic = require('../server/qqmusic');

const originalPost = axios.post;
const originalGet = axios.get;
const originalCookie = process.env.QQ_MUSIC_COOKIE;

(async () => {
  const postCalls = [];
  const getCalls = [];
  try {
    process.env.QQ_MUSIC_COOKIE = 'uin=o123456; qqmusic_key=token; qm_keyst=token';
    qqmusic.resetRuntimeState();

    axios.post = async (url, body) => {
      postCalls.push({ url, body });
      if (body?.req?.method === 'DoSearchForQQMusicDesktop') {
        return { data: { code: 0, req: { code: 500003, subcode: 860100005 } } };
      }
      if (body?.songinfo?.method === 'get_song_detail_yqq') {
        return {
          data: {
            songinfo: {
              code: 0,
              data: {
                track_info: {
                  mid: '001abc',
                  name: '情歌',
                  singer: [{ name: '梁静茹' }],
                  album: { name: '崇拜', mid: '002alb' },
                  file: { media_mid: '009media' }
                }
              }
            }
          }
        };
      }
      throw new Error('unexpected post');
    };

    axios.get = async (url, options = {}) => {
      getCalls.push({ url, options });
      if (String(url).includes('client_search_cp')) {
        const error = new Error('legacy HTTP 500');
        error.response = { status: 500 };
        throw error;
      }
      if (String(url).includes('smartbox_new.fcg')) {
        assert.strictEqual(options.params.key, '情歌');
        return {
          data: {
            code: 0,
            data: {
              song: {
                itemlist: [{
                  mid: '001abc',
                  id: '123',
                  name: '情歌',
                  singer: '梁静茹'
                }]
              }
            }
          }
        };
      }
      throw new Error('unexpected get');
    };

    const songs = await qqmusic.searchSongs('情歌', 3);
    assert.strictEqual(songs.length, 1);
    assert.strictEqual(songs[0].id, 'qq:001abc');
    assert.strictEqual(songs[0]._qqmid, '001abc');
    assert.strictEqual(songs[0]._qqMediaMid, '009media');
    assert.strictEqual(songs[0].source, 'qq');
    assert.strictEqual(songs[0].artists[0].name, '梁静茹');
    assert.match(songs[0].album.picUrl, /002alb/);

    assert.ok(getCalls.some(call => String(call.url).includes('smartbox_new.fcg')));
    assert.ok(postCalls.some(call => call.body?.songinfo?.method === 'get_song_detail_yqq'));
    const health = qqmusic.getSearchHealth();
    assert.strictEqual(health.state, 'ok');
    assert.strictEqual(health.lastQuery, '情歌');
    assert.match(health.lastReason, /smartbox fallback ok/);
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

  console.log('qqmusic smartbox fallback tests passed');
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
