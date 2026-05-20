const assert = require('assert');
const fs = require('fs');
const path = require('path');
const mixer = require('../server/recommendation-mixer');

const index = fs.readFileSync(path.join(__dirname, '..', 'server', 'index.js'), 'utf8');

assert.strictEqual(mixer.parseExplorationCommand('只听我的歌单')?.mode, 'localOnly');
assert.strictEqual(mixer.parseExplorationCommand('保守一点')?.mode, 'conservative');
assert.strictEqual(mixer.parseExplorationCommand('多发现新歌')?.mode, 'discovery');

assert.match(index, /let activeExplorationMode/);
assert.match(index, /parseExplorationCommand\(message\)/);
assert.match(index, /savePreference\('explorationMode'/);
assert.match(index, /ratioForExplorationMode\(\s*activeExplorationMode/);
assert.match(index, /EXTERNAL_RECOMMEND_RATIO/);

console.log('exploration command tests passed');
