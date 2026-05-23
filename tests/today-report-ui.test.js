const assert = require('assert');
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const html = fs.readFileSync(path.join(root, 'public', 'index.html'), 'utf8');
const app = fs.readFileSync(path.join(root, 'public', 'app.js'), 'utf8');
const css = fs.readFileSync(path.join(root, 'public', 'style.css'), 'utf8');
const server = fs.readFileSync(path.join(root, 'server', 'index.js'), 'utf8');

assert.match(html, /id="today-report"/);
assert.match(app, /const todayReport\s*=\s*\$\('today-report'\)/);
assert.match(app, /function renderTodayReport/);
assert.match(app, /renderTodayReport\(data\?\.todayReport\)/);
assert.match(server, /app\.get\('\/api\/listening-report\/today'/);
assert.match(css, /\.today-report/);
assert.match(css, /\.today-report-metrics/);

console.log('today report UI tests passed');
