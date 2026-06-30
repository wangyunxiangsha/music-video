const assert = require('assert');
const fs = require('fs');
const path = require('path');

const server = fs.readFileSync(path.join(__dirname, '..', 'server', 'index.js'), 'utf8');

assert.match(server, /const qqEquivalentCache = new Map\(\)/);
assert.match(server, /QQ_EQUIVALENT_CACHE_MS/);
assert.match(server, /function qqEquivalentCacheKey/);
assert.match(server, /qqEquivalentCache\.set/);
assert.match(server, /qqEquivalentCache\.delete/);

console.log('qq equivalent cache tests passed');
