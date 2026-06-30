const assert = require('assert');
const music = require('../server/music');

(async () => {
  {
    let attempts = 0;
    const ready = await music.waitForNcmReady({
      maxAttempts: 5,
      intervalMs: 0,
      probe: async () => {
        attempts += 1;
        return attempts >= 3;
      },
      sleep: async () => {}
    });

    assert.strictEqual(ready, true);
    assert.strictEqual(attempts, 3);
  }

  {
    let attempts = 0;
    const ready = await music.waitForNcmReady({
      maxAttempts: 4,
      intervalMs: 0,
      probe: async () => {
        attempts += 1;
        return false;
      },
      sleep: async () => {}
    });

    assert.strictEqual(ready, false);
    assert.strictEqual(attempts, 4);
  }

  console.log('ncm startup ready tests passed');
})().catch((error) => {
  throw error;
});
