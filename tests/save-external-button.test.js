const assert = require('assert');
const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const html = fs.readFileSync(path.join(root, 'public', 'index.html'), 'utf8');
const js = fs.readFileSync(path.join(root, 'public', 'app.js'), 'utf8');
const server = fs.readFileSync(path.join(root, 'server', 'index.js'), 'utf8');

assert.match(html, /id="btn-save-local"/);
assert.match(html, />SAVE<\/button>/);
assert.match(js, /const btnSaveLocal\s*=\s*\$\('btn-save-local'\)/);
assert.match(js, /function updateSaveLocalButton/);
assert.match(js, /recommendationSource === 'external'/);
assert.match(js, /fetch\('\/api\/local-pool\/current'/);
assert.match(server, /app\.post\('\/api\/local-pool\/current'/);

console.log('save external button tests passed');
