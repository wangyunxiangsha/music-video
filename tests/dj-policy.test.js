'use strict';

const assert = require('assert');

const ai = require('../server/ai');
const context = require('../server/context');
const djPolicy = require('../server/dj-policy');

async function run() {
  const silent = djPolicy.parsePolicyCommand('只播歌').policy;
  const prompt = context.buildSystemPrompt({ djPolicy: silent });

  assert(
    prompt.includes('播报模式：只播歌'),
    'system prompt should include the active DJ speech policy'
  );

  const announcement = await ai.generateAnnouncement(
    { id: '1', name: '晴天', artists: [{ name: '周杰伦' }] },
    prompt,
    silent
  );

  assert.strictEqual(
    announcement,
    '',
    'silent policy should suppress DJ announcements'
  );
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
