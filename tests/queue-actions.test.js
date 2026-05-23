const assert = require('assert');
const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const js = fs.readFileSync(path.join(root, 'public', 'app.js'), 'utf8');

assert.match(js, /function setQueueActionPending/);
assert.match(js, /button\.disabled = pending/);
assert.match(js, /button\.textContent = pending \? 'BUSY' : idleLabel/);
assert.match(js, /setQueueActionPending\(queueRebuild, true, 'RESHUFFLE'\)/);
assert.match(js, /renderQueueStatus\('正在重新生成队列/);
assert.match(js, /finally\s*{\s*setQueueActionPending\(queueRebuild, false, 'RESHUFFLE'\)/);

console.log('queue action tests passed');
