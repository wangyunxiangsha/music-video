const assert = require('assert');
const fs = require('fs');
const path = require('path');

const app = fs.readFileSync(path.join(__dirname, '..', 'public', 'app.js'), 'utf8');

const renderTypewriterText = app.match(/function renderTypewriterText\(text\) \{[\s\S]*?\n  \}/)?.[0] || '';
assert.match(renderTypewriterText, /textContent\s*=\s*''/, 'DJ typewriter helper should clear with textContent');
assert.match(renderTypewriterText, /document\.createTextNode\(text \|\| ''\)/, 'DJ text should be inserted as a text node');

const typewriter = app.match(/function typewriter\(text\) \{[\s\S]*?\n  \}/)?.[0] || '';
assert.match(typewriter, /renderTypewriterText\(text\.slice\(0, \+\+i\)\)/, 'DJ typewriter should delegate safe text rendering');
assert.doesNotMatch(typewriter, /innerHTML\s*=\s*text\.slice/, 'DJ typewriter must not inject AI text through innerHTML');

const renderLyric = app.match(/function renderLyric\(activeIdx\) \{[\s\S]*?\n  \}/)?.[0] || '';
assert.match(renderLyric, /document\.createElement\('div'\)/, 'lyrics should be rendered as DOM text nodes');
assert.match(renderLyric, /textContent\s*=\s*l\.text/, 'lyric text should use textContent');
assert.doesNotMatch(renderLyric, /innerHTML\s*=\s*S\.lyricLines\.map/, 'lyrics must not be interpolated into innerHTML');

assert.match(app, /let trackLoadGeneration = 0/);
assert.match(app, /const generation = \+\+trackLoadGeneration/);
assert.match(app, /if \(generation === trackLoadGeneration\) setPlaying\(true\)/);
assert.match(app, /if \(generation === trackLoadGeneration\) setPlaying\(false\)/);

assert.match(app, /if \(!isDifferentTrack\)[\s\S]{0,400}return;/, 'same-track state updates should not reload audio');

console.log('frontend safety contract tests passed');
