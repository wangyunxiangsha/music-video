const assert = require('assert');
const fs = require('fs');
const path = require('path');

const app = fs.readFileSync(path.join(__dirname, '..', 'public', 'app.js'), 'utf8');
const failure = fs.readFileSync(path.join(__dirname, '..', 'server', 'playback-failure.js'), 'utf8');

assert.match(app, /PLAYBACK_STALL_MS/);
assert.match(app, /lastProgressAt/);
assert.match(app, /audio\.onwaiting/);
assert.match(app, /audio\.onstalled/);
assert.match(app, /setInterval\(\(\) => \{/);
assert.match(failure, /播放卡住，已自动换歌/);
assert.match(app, /showPlaybackNotice/);
assert.doesNotMatch(app, /stationStatus\.textContent = v \? 'Speaking\.\.\.' : 'Standby'/);

console.log('playback watchdog tests passed');
