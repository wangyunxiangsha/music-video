const assert = require('assert');
const fs = require('fs');
const path = require('path');

const server = fs.readFileSync(path.join(__dirname, '..', 'server', 'index.js'), 'utf8');
const readme = fs.readFileSync(path.join(__dirname, '..', 'readme.md'), 'utf8');

assert.match(server, /const tasteProfile\s*=\s*require\('\.\/taste-profile'\)/);
assert.match(server, /tasteProfile\.writeTasteMdSafely/);
assert.match(server, /生成内容不完整/);
assert.match(readme, /品味档案生成/);
assert.match(readme, /不会覆盖/);

console.log('taste profile api tests passed');
