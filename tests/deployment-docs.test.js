const assert = require('assert');
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const readme = fs.readFileSync(path.join(root, 'readme.md'), 'utf8');
const envExample = fs.readFileSync(path.join(root, '.env.example'), 'utf8');
const deploymentPath = path.join(root, 'doc', 'deployment.md');

assert.ok(fs.existsSync(deploymentPath), 'doc/deployment.md should exist');
const deployment = fs.readFileSync(deploymentPath, 'utf8');

assert.match(envExample, /LOG_LEVEL=/);
assert.match(readme, /doc\/deployment\.md/);
assert.match(deployment, /本地运行/);
assert.match(deployment, /云部署/);
assert.match(deployment, /PWA 缓存/);
assert.match(deployment, /Cookie 更新/);
assert.match(deployment, /\/api\/health/);

console.log('deployment docs tests passed');
