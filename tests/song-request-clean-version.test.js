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
assert.match(index, /findLocalQqTrack\(requestedTitle,\s*artist/);
assert.match(index, /QQ 本地歌单兜底命中/);
assert.match(index, /async function resolveQqEquivalentTrack/);
assert.match(index, /resolveQqEquivalentTrack\(track\)/);
assert.match(index, /async function resolvePlayableAudio/);
assert.match(index, /resolvePlayableAudio\(track\)/);
assert.match(index, /const resolved = await resolvePlayableAudio\(track\)/);
assert.match(index, /QQ 音乐已有完整版本，已替换网易云试听候选/);
assert.match(index, /function artistHintsOf/);
assert.match(index, /some\(hint => recommendationMixer\.preferArtistMatches/);
assert.ok(
  index.indexOf('const qqResults') < index.indexOf('const neteaseResults'),
  'explicit song requests should try QQ Music before Netease to avoid 30-second Netease previews'
);
assert.ok(
  index.indexOf('findLocalQqTrack') < index.indexOf('const neteaseResults'),
  'explicit song requests should try local QQ playlist fallback before Netease preview fallback'
);

console.log('song request clean version tests passed');
