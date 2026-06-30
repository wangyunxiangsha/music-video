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
const removeButtonUpdater = js.match(/function updateRemoveLocalButton\(\) \{[\s\S]*?\n  \}/)?.[0] || '';
assert.doesNotMatch(
  removeButtonUpdater,
  /source !== 'external'/,
  'REMOVE should stay available for external tracks so they can be blocked'
);
assert.match(js, /fetch\('\/api\/local-pool\/current'/);
assert.match(js, /body:\s*JSON\.stringify\(\{\s*id:\s*trackId\s*\}\)/);
assert.match(js, /fetch\('\/api\/local-pool\/remove-current'/);
const removeHandler = js.match(/btnRemoveLocal\.onclick = async \(\) => \{[\s\S]*?\n    \};/)?.[0] || '';
assert.doesNotMatch(removeHandler, /loadTrack\(/, 'REMOVE should rely on track broadcasts instead of double-loading the response track');
assert.doesNotMatch(
  removeHandler,
  /source === 'external'/,
  'REMOVE click handler should not ignore external tracks'
);
assert.match(server, /app\.post\('\/api\/local-pool\/current'/);
assert.match(server, /app\.post\('\/api\/local-pool\/remove-current'/);
const removeRoute = server.match(/app\.post\('\/api\/local-pool\/remove-current'[\s\S]*?\n\}\);/)?.[0] || '';
assert.match(
  removeRoute,
  /await nextTrack\(/,
  'remove-current should immediately advance playback after blocking the current track'
);
assert.match(
  removeRoute,
  /assertCurrentTrackRequest\(req,\s*res\)/,
  'remove-current should reject stale requests for older tracks'
);
assert.match(
  server,
  /app\.post\('\/api\/local-pool\/current'[\s\S]*assertCurrentTrackRequest\(req,\s*res\)/,
  'save-current should reject stale requests for older tracks'
);
assert.doesNotMatch(
  removeRoute,
  /recommendationSource === 'external'/,
  'remove-current should not reject external tracks'
);
assert.match(
  removeRoute,
  /stats\.saveFeedback\(\{[\s\S]*type:\s*'dislike'/,
  'remove-current should save a dislike signal so removed external tracks stop coming back'
);

console.log('save external button tests passed');
