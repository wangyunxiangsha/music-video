const assert = require('assert');
const fs = require('fs');
const path = require('path');

const serverIndex = fs.readFileSync(path.join(__dirname, '../server/index.js'), 'utf8');
const appJs = fs.readFileSync(path.join(__dirname, '../public/app.js'), 'utf8');

function extractFunction(source, name) {
  const start = source.indexOf(`async function ${name}`);
  assert.notStrictEqual(start, -1, `${name} should exist`);
  let depth = 0;
  let seenBody = false;
  for (let i = start; i < source.length; i += 1) {
    if (source[i] === '{') {
      depth += 1;
      seenBody = true;
    } else if (source[i] === '}') {
      depth -= 1;
      if (seenBody && depth === 0) return source.slice(start, i + 1);
    }
  }
  throw new Error(`Unable to extract ${name}`);
}

const nextTrackBody = extractFunction(serverIndex, 'nextTrack');

assert.match(
  serverIndex,
  /function scheduleTrackAnnouncement/,
  'server should schedule DJ announcements outside the critical track-switch path'
);

assert.doesNotMatch(
  nextTrackBody,
  /await\s+ai\.generateAnnouncement/,
  'nextTrack should not wait for AI announcement before returning'
);

assert.match(
  serverIndex,
  /type:\s*'djMessage'/,
  'server should broadcast async DJ message updates separately'
);

assert.match(
  appJs,
  /d\.type === 'djMessage'/,
  'frontend should handle async DJ message updates'
);

assert.match(
  appJs,
  /String\(d\.trackId\) === String\(S\.track\?\.id/,
  'frontend should ignore stale DJ messages for older tracks'
);

console.log('next-track fast response contract ok');
