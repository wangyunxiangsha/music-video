const assert = require('assert');
const axios = require('axios');

process.env.QQ_MUSIC_COOKIE = [
  'uin=o123456789',
  'qqmusic_key=music-key-value',
  'qm_keyst=music-key-value',
  'psrf_qqaccess_token=access-token',
  'psrf_qqrefresh_token=refresh-token'
].join('; ');

const qqmusic = require('../server/qqmusic');

const originalPost = axios.post;
const originalGet = axios.get;
let capturedBody = null;
let capturedHeaders = null;

axios.post = async (url, body, opts) => {
  capturedBody = body;
  capturedHeaders = opts && opts.headers;
  return {
    data: {
      req_0: {
        data: {
          sip: ['http://dl.stream.qqmusic.qq.com/'],
          midurlinfo: [{ purl: 'signed/member/song.mp3' }]
        }
      }
    }
  };
};

axios.get = async () => ({
  status: 206,
  data: Buffer.from([0])
});

(async () => {
  try {
    qqmusic.resetRuntimeState();
    const url = await qqmusic.getSongUrl('0018C4LJ40te4R', '003MEDIAID');

    assert.strictEqual(url, 'https://dl.stream.qqmusic.qq.com/signed/member/song.mp3');
    assert.strictEqual(capturedBody.comm.ct, 19);
    assert.strictEqual(capturedBody.comm.authst, 'music-key-value');
    assert.strictEqual(capturedBody.comm.uin, '123456789');
    assert.deepStrictEqual(capturedBody.req_0.param.songmid, ['0018C4LJ40te4R']);
    assert.deepStrictEqual(capturedBody.req_0.param.filename, ['M8000018C4LJ40te4R003MEDIAID.mp3']);
    assert.match(capturedHeaders.Cookie, /psrf_qqaccess_token=access-token/);
    assert.strictEqual(qqmusic.getPlaybackAuthStatus().playbackKeyReady, true);
    assert.strictEqual(qqmusic.getPlaybackAuthStatus().musicKey.present, true);

    console.log('qqmusic authst tests passed');
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
