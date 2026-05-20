const assert = require('assert');
const fs = require('fs');
const path = require('path');

const html = fs.readFileSync(path.join(__dirname, '..', 'public', 'index.html'), 'utf8');
const css = fs.readFileSync(path.join(__dirname, '..', 'public', 'style.css'), 'utf8');

assert.match(html, /<button id="btn-history"[^>]*>HIST<\/button>/);
assert.match(html, /<button id="btn-history-fab"[^>]*class="history-fab"[^>]*>HIST<\/button>/);
assert.match(css, /\.history-fab\s*\{[\s\S]*position:\s*fixed/);
assert.match(css, /\.history-fab\s*\{[\s\S]*bottom:\s*max\(14px, env\(safe-area-inset-bottom\)\)/);
assert.match(css, /\.history-fab\s*\{[\s\S]*right:\s*max\(12px, calc\(\(100vw - 430px\) \/ 2 \+ 12px\)\)/);
assert.match(css, /\.history-fab\s*\{[\s\S]*z-index:\s*70/);

const app = fs.readFileSync(path.join(__dirname, '..', 'public', 'app.js'), 'utf8');
assert.match(app, /const btnHistoryFab = \$\('btn-history-fab'\)/);
assert.match(app, /btnHistoryFab\.onclick = btnHistory\.onclick/);

console.log('footer nav layout tests passed');
