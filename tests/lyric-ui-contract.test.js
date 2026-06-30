const assert = require('assert');
const fs = require('fs');
const path = require('path');

const app = fs.readFileSync(path.join(__dirname, '..', 'public', 'app.js'), 'utf8');

assert.match(app, /let lyricRequestId = 0/);
assert.match(app, /const requestId = \+\+lyricRequestId/);
assert.match(app, /if \(requestId !== lyricRequestId \|\| String\(id\) !== String\(S\.track\?\.id \|\| ''\)\) return/);
assert.match(app, /lastLyricIdx = -1/);

const parseLyric = app.match(/function parseLyric\(raw\) \{[\s\S]*?\n  \}/)?.[0] || '';
assert.match(parseLyric, /matchAll/, 'LRC parser should support multiple timestamps per line');
assert.match(parseLyric, /\(\?:\[\.:\]\(\\d\+\)\)\?/, 'LRC parser should accept timestamps without milliseconds');
assert.match(parseLyric, /sort\(\(a, b\) => a\.time - b\.time\)/, 'LRC parser should sort expanded timestamp lines');

console.log('lyric UI contract tests passed');
