const assert = require('assert');
const fs = require('fs');
const path = require('path');

const server = fs.readFileSync(path.join(__dirname, '..', 'server', 'index.js'), 'utf8');

assert.match(server, /const upstream = response\.data/);
assert.match(server, /upstream\.on\('error'/);
assert.match(server, /res\.on\('close'/);
assert.match(server, /upstream\.destroy\(\)/);
assert.doesNotMatch(server, /response\.data\.pipe\(res\)/);

console.log('stream resilience tests passed');
