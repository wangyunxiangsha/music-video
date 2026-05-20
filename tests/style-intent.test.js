const assert = require('assert');
const fs = require('fs');
const path = require('path');
const categories = require('../server/categories');
const server = fs.readFileSync(path.join(__dirname, '..', 'server', 'index.js'), 'utf8');

assert.strictEqual(categories.findCategory('上午我想听轻音乐')?.name, 'BGM/纯音乐');
assert.strictEqual(categories.findCategory('阴天来点轻音乐')?.name, 'BGM/纯音乐');
assert.strictEqual(categories.findCategory('下午想听国风')?.name, '国风古风');
assert.match(server, /function extractStyleCategory/);
assert.ok(server.indexOf('const styleCategory = extractStyleCategory(message)') < server.indexOf('const scene = extractScene(message)'));
assert.match(server, /安排「\$\{styleCategory\.name\}」/);

console.log('style intent tests passed');
