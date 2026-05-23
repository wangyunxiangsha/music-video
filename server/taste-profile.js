'use strict';

const fs = require('fs');

const REQUIRED_SECTIONS = [
  '# 我的音乐品味',
  '## 喜欢的类型',
  '## 喜欢的情绪',
  '## 不喜欢',
  '## 常听场景',
  '## 近期关注'
];

const INCOMPLETE_ENDING_PATTERN = /(依然|以及|同时|并且|而且|比如|例如|包括|作品依然|近期我|我依然|我仍然)$/;

function normalizeTasteMd(content) {
  return String(content || '').trim();
}

function validateTasteMd(content) {
  const text = normalizeTasteMd(content);
  if (!text) return { ok: false, reason: '生成内容为空' };
  if (text.length < 160) return { ok: false, reason: '生成内容过短' };

  for (const section of REQUIRED_SECTIONS) {
    if (!text.includes(section)) {
      return { ok: false, reason: `缺少章节：${section}` };
    }
  }

  const lastLine = text.split(/\r?\n/).map(line => line.trim()).filter(Boolean).pop() || '';
  if (INCOMPLETE_ENDING_PATTERN.test(lastLine)) {
    return { ok: false, reason: '生成内容结尾不完整' };
  }
  if (!/[。.!！?？）)]$/.test(lastLine)) {
    return { ok: false, reason: '生成内容缺少完整结尾' };
  }

  return { ok: true, reason: '' };
}

function writeTasteMdSafely(filePath, content) {
  const text = normalizeTasteMd(content);
  const validation = validateTasteMd(text);
  if (!validation.ok) return validation;
  fs.writeFileSync(filePath, `${text}\n`, 'utf8');
  return { ok: true, reason: '', tasteMd: `${text}\n` };
}

module.exports = {
  validateTasteMd,
  writeTasteMdSafely
};
