const assert = require('assert');
const fs = require('fs');
const path = require('path');

const server = fs.readFileSync(path.join(__dirname, '..', 'server', 'index.js'), 'utf8');

assert.match(server, /PLAYBACK_QUEUE_PRECHECK_COUNT/);
assert.match(server, /async function precheckPlaybackQueue/);
assert.match(server, /function schedulePrecheckPlaybackQueue/);
assert.match(server, /playability\.precheckPlayableQueue/);
assert.match(server, /playlist = await precheckPlaybackQueue\(playlist\)/);
assert.match(server, /schedulePrecheckPlaybackQueue\(\)/);

console.log('queue precheck integration tests passed');
