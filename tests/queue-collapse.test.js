const assert = require('assert');
const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const html = fs.readFileSync(path.join(root, 'public', 'index.html'), 'utf8');
const css = fs.readFileSync(path.join(root, 'public', 'style.css'), 'utf8');
const js = fs.readFileSync(path.join(root, 'public', 'app.js'), 'utf8');

assert.match(html, /id="queue-toggle"/);
assert.match(html, /aria-expanded="true"/);
assert.match(html, /aria-controls="queue-actions queue-list"/);

assert.match(css, /\.queue-strip\.collapsed\s+\.queue-actions/);
assert.match(css, /\.queue-strip\.collapsed\s+\.queue-list/);
assert.match(css, /\.queue-toggle/);

assert.match(js, /queueCollapsed/);
assert.doesNotMatch(js, /localStorage\.getItem\('claudio\.queueCollapsed'\)/);
assert.doesNotMatch(js, /localStorage\.setItem\('claudio\.queueCollapsed'/);
assert.match(js, /localStorage\.removeItem\('claudio\.queueCollapsed'\)/);
assert.match(js, /aria-expanded/);

console.log('queue collapse tests passed');
