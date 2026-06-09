const assert = require('assert');
const fs = require('fs');
const path = require('path');

const app = fs.readFileSync(path.join(__dirname, '..', 'public', 'app.js'), 'utf8');

assert.doesNotMatch(app, /没有可播放的版权/);
assert.doesNotMatch(app, /暂时没有可播放版权/);
assert.match(app, /当前音源暂时打不开/);
assert.match(app, /已自动换歌/);

console.log('frontend copy tests passed');
