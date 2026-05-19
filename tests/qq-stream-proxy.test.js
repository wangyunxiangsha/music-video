const assert = require('assert');
const fs = require('fs');
const path = require('path');

const server = fs.readFileSync(path.join(__dirname, '..', 'server', 'index.js'), 'utf8');

assert.doesNotMatch(server, /if \(isQQ\) \{\s*return res\.redirect\(302, url\);\s*\}/);
assert.match(server, /const streamHeaders = isQQ/);
assert.match(server, /req\.headers\.range/);
assert.match(server, /res\.status\(206\)/);

console.log('qq stream proxy tests passed');
