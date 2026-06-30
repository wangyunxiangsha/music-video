const assert = require('assert');
const fs = require('fs');
const path = require('path');

const app = fs.readFileSync(path.join(__dirname, '..', 'public', 'app.js'), 'utf8');

assert.match(
  app,
  /function isTrialClipTrack/,
  'client should expose a single trial-clip predicate for playback guards'
);

assert.match(
  app,
  /if\s*\(isTrialClipTrack\(dur\)\)/,
  'metadata handling should use the shared trial-clip predicate'
);

assert.match(
  app,
  /if\s*\(!isTrialClipTrack\(audio\.duration\)[\s\S]{0,180}reportPlaybackProgress\('half_played'\)/,
  'client should not report half_played for Netease trial clips'
);

console.log('trial clip half-played guard tests passed');
