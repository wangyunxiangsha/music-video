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
assert.match(readme, /本地账号权益/);
assert.match(readme, /不重新分发音乐/);
assert.match(readme, /不会缓存下载音频/);
assert.match(readme, /\/api\/account-status/);
assert.match(deployment, /账号权益与隐私边界/);
assert.match(deployment, /Cookie 排查顺序/);
assert.match(deployment, /\/api\/account-status/);
assert.match(deployment, /\/api\/debug\/qq-circuit/);
assert.match(deployment, /不会包含 \.env、Cookie、API Key/);

console.log('deployment docs tests passed');
