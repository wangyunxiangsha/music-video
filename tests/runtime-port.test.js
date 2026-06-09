const assert = require('assert');
const fs = require('fs');
const path = require('path');

const server = fs.readFileSync(path.join(__dirname, '..', 'server', 'index.js'), 'utf8');
const readme = fs.readFileSync(path.join(__dirname, '..', 'readme.md'), 'utf8');
const deployment = fs.readFileSync(path.join(__dirname, '..', 'doc', 'deployment.md'), 'utf8');

assert.match(server, /const RUNTIME_FILE/);
assert.match(server, /function writeRuntimeInfo/);
assert.match(server, /writeRuntimeInfo\(\{ port: actualPort/);
assert.match(server, /data\/runtime\.json/);
assert.match(server, /JSON\.stringify\(runtimeInfo, null, 2\)/);
assert.match(readme, /data\/runtime\.json/);
assert.match(deployment, /data\/runtime\.json/);

console.log('runtime port tests passed');
