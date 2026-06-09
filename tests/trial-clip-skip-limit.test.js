const assert = require('assert');
const fs = require('fs');
const path = require('path');

const app = fs.readFileSync(path.join(__dirname, '..', 'public', 'app.js'), 'utf8');

assert.match(app, /TRIAL_CLIP_SKIP_LIMIT/);
assert.match(app, /TRIAL_CLIP_SKIP_WINDOW_MS/);
assert.match(app, /function canAutoSkipTrialClip/);
assert.match(app, /trialClipSkips = trialClipSkips\.filter/);
assert.match(app, /audio\.pause\(\)/);
assert.match(app, /连续遇到试听片段/);
assert.match(app, /requestNextTrack\(`《\$\{S\.track\?\.name \|\| '该歌曲'\}》只有试听版，马上换下一首。`, '', 'trial_clip'\)/);

console.log('trial clip skip limit tests passed');
