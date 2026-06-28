const assert = require('assert');
const fs = require('fs');
const path = require('path');

const server = fs.readFileSync(path.join(__dirname, '..', 'server', 'index.js'), 'utf8');
const readme = fs.readFileSync(path.join(__dirname, '..', 'readme.md'), 'utf8');

assert.match(server, /const health\s*=\s*require\('\.\/health'\)/);
assert.match(server, /let activePort/);
assert.match(server, /runStartupSelfCheck/);
assert.match(server, /app\.get\('\/api\/health'/);
assert.match(server, /health\.buildHealthSnapshot/);
assert.match(server, /health\.buildHealthSnapshot\(\{[\s\S]*qqPlaybackAuth:\s*qqmusic\.getPlaybackAuthStatus\(\)[\s\S]*\}\)/);
assert.match(readme, /\/api\/health/);

console.log('health api tests passed');
