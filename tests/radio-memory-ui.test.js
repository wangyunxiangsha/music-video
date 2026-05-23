const assert = require('assert');
const fs = require('fs');
const path = require('path');

const html = fs.readFileSync(path.join(__dirname, '..', 'public', 'index.html'), 'utf8');
const js = fs.readFileSync(path.join(__dirname, '..', 'public', 'app.js'), 'utf8');
const css = fs.readFileSync(path.join(__dirname, '..', 'public', 'style.css'), 'utf8');
const server = fs.readFileSync(path.join(__dirname, '..', 'server', 'index.js'), 'utf8');
const readme = fs.readFileSync(path.join(__dirname, '..', 'readme.md'), 'utf8');

assert.match(html, /id="memory-export"/);
assert.match(html, /id="memory-import"/);
assert.match(html, /id="memory-import-file"/);
assert.match(html, /\.claudio/);

assert.match(js, /downloadRadioMemory/);
assert.match(js, /importRadioMemory/);
assert.match(js, /\/api\/memory\/export/);
assert.match(js, /\/api\/memory\/import/);
assert.match(js, /Claudio.*\.claudio/);

assert.match(css, /\.memory-actions/);
assert.match(css, /\.memory-status/);

assert.match(server, /const radioMemory\s*=\s*require\('\.\/radio-memory'\)/);
assert.match(server, /app\.get\('\/api\/memory\/export'/);
assert.match(server, /app\.post\('\/api\/memory\/import'/);
assert.match(server, /Content-Disposition/);

assert.match(readme, /电台记忆备份/);
assert.match(readme, /\.claudio/);

console.log('radio memory ui tests passed');
