const assert = require('assert');
const fs = require('fs');
const path = require('path');
const dailyStation = require('../server/daily-station');

const index = fs.readFileSync(path.join(__dirname, '..', 'server', 'index.js'), 'utf8');

const noon = dailyStation.getTimeSlotStrategy(new Date('2026-05-25T12:30:00+08:00'));
assert.strictEqual(noon.slot.id, 'noon');
assert.strictEqual(noon.scene.id, 'sleep_low');
assert.strictEqual(noon.djPolicyMode, 'minimal');
assert.ok(noon.recommendedVolume <= 0.55);
assert.match(noon.reason, /午休/);

const commute = dailyStation.getTimeSlotStrategy(new Date('2026-05-25T18:10:00+08:00'));
assert.strictEqual(commute.slot.id, 'evening_commute');
assert.strictEqual(commute.scene.id, 'commute_energy');
assert.strictEqual(commute.djPolicyMode, 'short');
assert.ok(commute.recommendedVolume >= 0.7);

const night = dailyStation.getTimeSlotStrategy(new Date('2026-05-25T22:30:00+08:00'));
assert.strictEqual(night.slot.id, 'night_low');
assert.strictEqual(night.scene.id, 'late_night');
assert.strictEqual(night.djPolicyMode, 'warm');
assert.ok(night.recommendedVolume <= 0.45);

assert.match(index, /function currentTimeStrategy/);
assert.match(index, /function getEffectiveScene/);
assert.match(index, /function getEffectivePolicy/);
assert.match(index, /timeStrategy/);

console.log('time slot strategy tests passed');
