const assert = require('assert');
const fs = require('fs');
const path = require('path');

const html = fs.readFileSync(path.join(__dirname, '..', 'public', 'index.html'), 'utf8');
const css = fs.readFileSync(path.join(__dirname, '..', 'public', 'style.css'), 'utf8');

assert.match(html, /<button id="btn-history"[^>]*>HIST<\/button>/);
assert.doesNotMatch(html, /id="btn-taste"/);
assert.doesNotMatch(html, />TASTE<\/button>/);
assert.doesNotMatch(html, /btn-history-fab/);
assert.doesNotMatch(css, /\.history-fab/);
assert.match(css, /grid-template-columns:\s*repeat\(6,\s*1fr\)/);

const app = fs.readFileSync(path.join(__dirname, '..', 'public', 'app.js'), 'utf8');
assert.doesNotMatch(app, /btnHistoryFab/);
assert.doesNotMatch(app, /btnTaste\.onclick/);

console.log('footer nav layout tests passed');
