const assert = require('assert');
const fs = require('fs');
const path = require('path');

const server = fs.readFileSync(path.join(__dirname, '..', 'server', 'index.js'), 'utf8');
const app = fs.readFileSync(path.join(__dirname, '..', 'public', 'app.js'), 'utf8');

assert.match(server, /playbackSwitchReason/);
assert.match(server, /QQ 音乐候选暂时不可播/);
assert.match(server, /qqmusic\.getCircuitState\(\)\.latestUrlAttempt/);

assert.match(app, /track\.playbackSwitchReason/);
assert.match(app, /const reason = track\.playbackSwitchReason \|\| track\.recommendationReason/);

console.log('source switch explanation tests passed');
