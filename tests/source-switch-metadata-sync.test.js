const assert = require('assert');
const fs = require('fs');
const path = require('path');

const server = fs.readFileSync(path.join(__dirname, '..', 'server', 'index.js'), 'utf8');

function extractAsyncFunction(source, name) {
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

const activateTrack = extractAsyncFunction(server, 'activateTrack');

assert.match(
  activateTrack,
  /await\s+resolvePlayableAudio\(track\)/,
  'activateTrack should resolve playable audio before broadcasting metadata'
);

assert.match(
  activateTrack,
  /currentTrack\s*=\s*playable\?\.track\s*\|\|\s*track/,
  'activateTrack should broadcast the resolved replacement track when a source switch happens'
);

assert.match(
  activateTrack,
  /stats\.savePlay\(currentTrack\)/,
  'play stats should use the same track metadata that is broadcast to the client'
);

console.log('source switch metadata sync tests passed');
