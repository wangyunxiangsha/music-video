const assert = require('assert');
const axios = require('axios');

process.env.QQ_MUSIC_COOKIE = 'uin=o123; qqmusic_key=test-key';
const qqmusic = require('../server/qqmusic');

const originalGet = axios.get;

(async () => {
  try {
    const plainLyric = '[00:01.00]The Phoenix\n[00:03.00]Put on your war paint';
    axios.get = async () => ({ data: { lyric: plainLyric } });
    const plain = await qqmusic.getLyric('001mid');
    assert.strictEqual(plain, plainLyric);

    const encodedLyric = Buffer.from('[00:02.00]Encoded line', 'utf8').toString('base64');
    axios.get = async () => ({ data: { lyric: encodedLyric } });
    const decoded = await qqmusic.getLyric('002mid');
    assert.strictEqual(decoded, '[00:02.00]Encoded line');

    const wrappedEncodedLyric = Buffer.from('[00:04.00]Wrapped line', 'utf8').toString('base64').replace(/(.{8})/g, '$1\n');
    axios.get = async () => ({ data: { lyric: wrappedEncodedLyric } });
    const wrapped = await qqmusic.getLyric('003mid');
    assert.strictEqual(wrapped, '[00:04.00]Wrapped line');

    console.log('qqmusic lyric tests passed');
  } finally {
    axios.get = originalGet;
  }
})().catch((error) => {
  axios.get = originalGet;
  console.error(error);
  process.exit(1);
});
