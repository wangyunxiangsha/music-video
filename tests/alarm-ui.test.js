const assert = require('assert');
const fs = require('fs');
const path = require('path');

const html = fs.readFileSync(path.join(__dirname, '..', 'public', 'index.html'), 'utf8');
const js = fs.readFileSync(path.join(__dirname, '..', 'public', 'app.js'), 'utf8');
const css = fs.readFileSync(path.join(__dirname, '..', 'public', 'style.css'), 'utf8');

assert.match(html, /class="alarm-panel"/);
assert.match(html, /id="alarm-time"/);
assert.match(html, /id="alarm-on"/);
assert.match(html, /id="alarm-off"/);
assert.match(html, /id="alarm-status"/);

assert.match(js, /function startAlarmTimer/);
assert.match(js, /function cancelAlarmTimer/);
assert.match(js, /function triggerAlarm/);
assert.match(js, /function beginAlarmFadeIn/);
assert.match(js, /alarmOn\.onclick/);
assert.match(js, /alarmOff\.onclick/);
assert.match(js, /audio\.play\(\)/);

assert.match(css, /\.alarm-panel/);
assert.match(css, /\.alarm-actions/);
assert.match(css, /\.alarm-status/);

console.log('alarm UI tests passed');
