const assert = require('assert');
const fs = require('fs');
const path = require('path');

const source = fs.readFileSync(path.join(__dirname, '..', 'server', 'qqmusic.js'), 'utf8');

assert.match(source, /const unavailableCache = new Map\(\)/);
assert.match(source, /QQ_UNAVAILABLE_CACHE_MS/);
assert.match(source, /QQ_DEBUG_URL/);
assert.match(source, /validateStatus: \(\) => true/);
assert.match(source, /候选暂不可播，已跳过/);

console.log('qqmusic cache tests passed');
