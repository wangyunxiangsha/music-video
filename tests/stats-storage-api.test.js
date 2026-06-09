const assert = require('assert');
const fs = require('fs');
const path = require('path');

const server = fs.readFileSync(path.join(__dirname, '..', 'server', 'index.js'), 'utf8');
const stats = fs.readFileSync(path.join(__dirname, '..', 'server', 'stats.js'), 'utf8');

assert.match(server, /app\.get\('\/api\/debug\/stats-storage'/);
assert.match(server, /stats\.getStorageReport\(\)/);
assert.match(stats, /const statsStore = require\('\.\/stats-store'\)/);
assert.match(stats, /function getStorageReport/);

console.log('stats storage api tests passed');
