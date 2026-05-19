const assert = require('assert');
const fs = require('fs');
const path = require('path');

const app = fs.readFileSync(path.join(__dirname, '..', 'public', 'app.js'), 'utf8');

assert.match(app, /PLAYBACK_STALL_MS/);
assert.match(app, /lastProgressAt/);
assert.match(app, /audio\.onwaiting/);
assert.match(app, /audio\.onstalled/);
assert.match(app, /setInterval\(\(\) => \{/);
assert.match(app, /播放卡住了，马上换下一首/);
assert.doesNotMatch(app, /stationStatus\.textContent = v \? 'Speaking\.\.\.' : 'Standby'/);

console.log('playback watchdog tests passed');
