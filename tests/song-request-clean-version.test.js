const assert = require('assert');
const fs = require('fs');
const path = require('path');

const index = fs.readFileSync(path.join(__dirname, '..', 'server', 'index.js'), 'utf8');

assert.match(index, /preferCleanVersions\(neteaseResults\)/);
assert.match(index, /preferCleanVersions\(qqResults\)/);
assert.match(index, /originalArtistForSong\(songName\)/);
assert.match(index, /preferOriginalArtist\(neteaseArtistMatched, songName\)/);
assert.match(index, /preferOriginalArtist\(qqArtistMatched, songName\)/);
assert.match(index, /preferArtistMatches\(neteaseClean, artist\)/);
assert.match(index, /preferArtistMatches\(qqClean, artist\)/);

console.log('song request clean version tests passed');
