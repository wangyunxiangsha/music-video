const assert = require('assert');
const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const html = fs.readFileSync(path.join(root, 'public', 'index.html'), 'utf8');
const js = fs.readFileSync(path.join(root, 'public', 'app.js'), 'utf8');
const server = fs.readFileSync(path.join(root, 'server', 'index.js'), 'utf8');

assert.match(html, /id="btn-save-local"/);
assert.match(html, />SAVE<\/button>/);
assert.match(html, /id="btn-remove-local"/);
assert.match(html, />REMOVE<\/button>/);
const controls = html.match(/<div class="controls">[\s\S]*?<\/div>/)?.[0] || '';
const footer = html.match(/<footer>[\s\S]*?<\/footer>/)?.[0] || '';
assert.match(controls, /id="btn-save-local"/);
assert.match(controls, /id="btn-remove-local"/);
assert.doesNotMatch(footer, /id="btn-save-local"/);
assert.doesNotMatch(footer, /id="btn-remove-local"/);
assert.match(js, /const btnSaveLocal\s*=\s*\$\('btn-save-local'\)/);
assert.match(js, /const btnRemoveLocal\s*=\s*\$\('btn-remove-local'\)/);
assert.match(js, /function updateSaveLocalButton/);
assert.match(js, /function updateRemoveLocalButton/);
assert.match(js, /recommendationSource === 'external'/);
assert.match(js, /fetch\('\/api\/local-pool\/current'/);
assert.match(js, /fetch\('\/api\/local-pool\/remove-current'/);
const removeHandler = js.match(/btnRemoveLocal\.onclick = async \(\) => \{[\s\S]*?\n    \};/)?.[0] || '';
assert.doesNotMatch(removeHandler, /loadTrack\(/);
assert.match(server, /app\.post\('\/api\/local-pool\/current'/);
assert.match(server, /app\.post\('\/api\/local-pool\/remove-current'/);
const removeRoute = server.match(/app\.post\('\/api\/local-pool\/remove-current'[\s\S]*?\n\}\);/)?.[0] || '';
assert.doesNotMatch(removeRoute, /nextTrack\(/);

console.log('save external button tests passed');
