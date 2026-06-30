const assert = require('assert');
const fs = require('fs');
const path = require('path');

const app = fs.readFileSync(path.join(__dirname, '../public/app.js'), 'utf8');
const server = fs.readFileSync(path.join(__dirname, '../server/index.js'), 'utf8');

assert.match(
  app,
  /reportPlaybackFailure\('trial_clip'/,
  'client should report trial clips as playback failures before skipping'
);

assert.match(
  server,
  /reason === 'trial_clip'[\s\S]{0,500}handlePlaybackFailure/,
  'server should record trial clips through playback failure handling'
);

assert.match(
  server,
  /reason:\s*'trial_clip'/,
  'server should store trial_clip as the failure reason'
);

console.log('trial clip failure loop tests passed');
