const assert = require('assert');
const fs = require('fs');
const path = require('path');

const server = fs.readFileSync(path.join(__dirname, '../server/index.js'), 'utf8');

const routeStart = server.indexOf("app.get('/api/music/search'");
assert.notStrictEqual(routeStart, -1, 'music search endpoint should exist');
const route = server.slice(routeStart, server.indexOf("app.get('/api/categories'", routeStart));

assert.match(route, /qqmusic\.isEnabled\(\)/, 'music search should check QQ availability');
assert.match(route, /qqmusic\.searchSongs\(q, requestedLimit\)/, 'music search should try QQ search first');
assert.match(route, /if \(!songs\.length\)/, 'music search should only fall back to Netease when QQ has no results');
assert.match(route, /music\.searchSongs\(q, requestedLimit\)/, 'music search should keep Netease fallback');
assert.ok(
  route.indexOf('qqmusic.searchSongs') < route.indexOf('music.searchSongs'),
  'QQ search should be attempted before Netease'
);

console.log('music search QQ-first tests passed');
