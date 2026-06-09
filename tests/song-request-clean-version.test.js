const assert = require('assert');
const fs = require('fs');
const path = require('path');

const index = fs.readFileSync(path.join(__dirname, '..', 'server', 'index.js'), 'utf8');

assert.match(index, /preferCleanVersions\(neteaseResults\)/);
assert.match(index, /preferCleanVersions\(qqResults\)/);
assert.match(index, /preferTitleMatches\(neteaseClean, requestedTitle\)/);
assert.match(index, /preferTitleMatches\(qqClean, requestedTitle\)/);
assert.match(index, /originalArtistForSong\(songName\)/);
assert.match(index, /preferOriginalArtist\(neteaseArtistMatched, requestedTitle\)/);
assert.match(index, /preferOriginalArtist\(qqArtistMatched, requestedTitle\)/);
assert.match(index, /preferArtistMatches\(neteaseTitleMatched, artist\)/);
assert.match(index, /preferArtistMatches\(qqTitleMatched, artist\)/);
assert.ok(
  index.indexOf('const qqResults') < index.indexOf('const neteaseResults'),
  'explicit song requests should try QQ Music before Netease to avoid 30-second Netease previews'
);

console.log('song request clean version tests passed');
