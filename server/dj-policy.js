'use strict';

const POLICIES = {
  normal: {
    mode: 'normal',
    name: '\u6b63\u5e38\u64ad\u62a5',
    maxChars: 40,
    announceEvery: 1,
    instruction: '\u6bcf\u9996\u6b4c\u7528 20-40 \u4e2a\u4e2d\u6587\u5b57\u7b26\u7b80\u77ed\u64ad\u62a5\uff0c\u4fdd\u6301\u6e29\u6696\u3001\u514b\u5236\u3002'
  },
  minimal: {
    mode: 'minimal',
    name: '\u5c11\u8bf4\u8bdd',
    maxChars: 24,
    announceEvery: 3,
    instruction: '\u5c11\u8bf4\u8bdd\uff0c\u53ea\u5728\u5fc5\u8981\u65f6\u7528 10-24 \u4e2a\u4e2d\u6587\u5b57\u7b26\u63d0\u793a\uff0c\u4e0d\u6253\u6270\u7528\u6237\u3002'
  },
  short: {
    mode: 'short',
    name: '\u77ed\u53e5\u64ad\u62a5',
    maxChars: 30,
    announceEvery: 1,
    instruction: '\u7528 12-30 \u4e2a\u4e2d\u6587\u5b57\u7b26\u7684\u77ed\u53e5\u64ad\u62a5\uff0c\u8282\u594f\u8f7b\u5feb\uff0c\u4e0d\u94fa\u57ab\u592a\u591a\u60c5\u7eea\u3002'
  },
  warm: {
    mode: 'warm',
    name: '\u966a\u4f34\u64ad\u62a5',
    maxChars: 48,
    announceEvery: 1,
    instruction: '\u53ef\u4ee5\u7a0d\u5fae\u591a\u4e00\u70b9\u966a\u4f34\u611f\uff0c20-48 \u4e2a\u4e2d\u6587\u5b57\u7b26\uff0c\u6e29\u67d4\u3001\u5b89\u9759\u3001\u50cf\u6df1\u591c\u7535\u53f0\u3002'
  },
  silent: {
    mode: 'silent',
    name: '\u53ea\u64ad\u6b4c',
    maxChars: 0,
    announceEvery: 0,
    instruction: '\u4e0d\u64ad\u62a5\uff0c\u53ea\u64ad\u653e\u97f3\u4e50\u3002'
  }
};

function clonePolicy(mode) {
  return { ...(POLICIES[mode] || POLICIES.normal) };
}

function defaultPolicy() {
  return clonePolicy('normal');
}

function policyFromScene(scene) {
  return clonePolicy(scene?.speech || 'normal');
}

function shouldAnnounce(policy, playCount = 0) {
  const p = policy || POLICIES.normal;
  if (p.mode === 'silent' || p.announceEvery === 0) return false;
  if (p.announceEvery <= 1) return true;
  return playCount % p.announceEvery === 0;
}

function formatForPrompt(policy) {
  const p = policy || POLICIES.normal;
  return [
    `- \u64ad\u62a5\u6a21\u5f0f\uff1a${p.name}`,
    `- \u64ad\u62a5\u7b56\u7565\uff1a${p.instruction}`
  ].join('\n');
}

function parsePolicyCommand(message) {
  const text = String(message || '').trim();
  if (!text) return null;
  if (['\u53ea\u64ad\u6b4c', '\u522b\u8bf4\u8bdd', '\u5b89\u9759\u64ad\u653e'].some(word => text.includes(word))) {
    return { policy: clonePolicy('silent'), reply: '\u597d\uff0c\u63a5\u4e0b\u6765\u53ea\u64ad\u6b4c\u3002' };
  }
  if (['\u5c11\u8bf4\u8bdd', '\u5c11\u8bf4\u4e00\u70b9', '\u8bdd\u5c11\u4e00\u70b9'].some(word => text.includes(word))) {
    return { policy: clonePolicy('minimal'), reply: '\u597d\uff0c\u6211\u5c11\u8bf4\u4e00\u70b9\uff0c\u8ba9\u97f3\u4e50\u81ea\u5df1\u8d70\u3002' };
  }
  if (['\u591a\u8bf4\u4e00\u70b9', '\u591a\u4ecb\u7ecd\u4e00\u70b9', '\u591a\u966a\u6211\u8bf4\u8bf4'].some(word => text.includes(word))) {
    return { policy: clonePolicy('warm'), reply: '\u597d\uff0c\u6211\u591a\u7559\u4e00\u70b9\u966a\u4f34\u611f\u3002' };
  }
  if (['\u6062\u590d\u64ad\u62a5', '\u6b63\u5e38\u64ad\u62a5', '\u6062\u590d\u8bf4\u8bdd'].some(word => text.includes(word))) {
    return { policy: clonePolicy('normal'), reply: '\u597d\uff0c\u6062\u590d\u6b63\u5e38\u64ad\u62a5\u3002' };
  }
  return null;
}

module.exports = {
  defaultPolicy,
  clonePolicy,
  policyFromScene,
  shouldAnnounce,
  formatForPrompt,
  parsePolicyCommand
};
