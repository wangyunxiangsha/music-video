const assert = require('assert');
const fs = require('fs');
const path = require('path');

const sw = fs.readFileSync(path.join(__dirname, '..', 'public', 'sw.js'), 'utf8');
const server = fs.readFileSync(path.join(__dirname, '..', 'server', 'index.js'), 'utf8');

assert.match(sw, /const CACHE = 'claudio-v5'/);
assert.match(sw, /e\.request\.mode === 'navigate'/);
assert.match(sw, /url\.pathname\.endsWith\('\.html'\)/);

assert.match(server, /req\.path === '\/'/);
assert.match(server, /req\.path\.endsWith\('\.html'\)/);

console.log('service worker cache tests passed');
