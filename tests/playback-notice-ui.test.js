const assert = require('assert');
const fs = require('fs');
const path = require('path');

const html = fs.readFileSync(path.join(__dirname, '..', 'public', 'index.html'), 'utf8');
const app = fs.readFileSync(path.join(__dirname, '..', 'public', 'app.js'), 'utf8');
const css = fs.readFileSync(path.join(__dirname, '..', 'public', 'style.css'), 'utf8');

assert.match(html, /id="playback-notice"/);
assert.match(html, /aria-live="polite"/);
assert.match(app, /const playbackNotice = \$\('playback-notice'\)/);
assert.match(app, /function showPlaybackNotice/);
assert.match(app, /data\?\.playbackNotice/);
assert.match(app, /reportPlaybackFailure\('client_error', 'audio element error'\)/);
assert.match(app, /reportPlaybackFailure\('stalled', `no progress for \$\{PLAYBACK_STALL_MS\}ms`\)/);
assert.match(app, /addBubble\('dj', `《\$\{name\}》当前音源暂时打不开/);
assert.doesNotMatch(app, /requestNextTrack\(`《\$\{S\.track\?\.name \|\| '该歌曲'\}》当前音源暂时打不开，已跳过。`\)/);
assert.doesNotMatch(app, /requestNextTrack\(`《\$\{S\.track\?\.name \|\| '该歌曲'\}》播放卡住了，马上换下一首。`\)/);
assert.match(css, /\.playback-notice/);
assert.match(css, /\.playback-notice\.show/);

console.log('playback notice ui tests passed');
