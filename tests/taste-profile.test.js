const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');

const tasteProfile = require('../server/taste-profile');

const valid = `# 我的音乐品味

## 喜欢的类型
喜欢旋律性强的华语流行、国风、日漫和影视原声。

## 喜欢的情绪
偏爱热血、怀旧、治愈、伤感和有故事感的音乐。

## 不喜欢
不太喜欢缺少旋律、过于单调或情绪表达薄弱的作品。

## 常听场景
通勤、工作、深夜和 KTV 场景都会切换不同歌单。

## 近期关注
近期仍然关注日漫经典、古风歌曲和 SING 女团等作品。`;

assert.strictEqual(tasteProfile.validateTasteMd(valid).ok, true);
assert.strictEqual(tasteProfile.validateTasteMd('# 我的音乐品味\n\n## 喜欢的类型\n半句').ok, false);
assert.strictEqual(tasteProfile.validateTasteMd(`${valid}\n`).ok, true);
assert.strictEqual(tasteProfile.validateTasteMd(`${valid}\n近期依然`).ok, false);

{
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'taste-profile-'));
  const file = path.join(dir, 'taste.md');
  fs.writeFileSync(file, valid, 'utf8');

  const rejected = tasteProfile.writeTasteMdSafely(file, '# 我的音乐品味\n\n## 喜欢的类型\n半句');
  assert.strictEqual(rejected.ok, false);
  assert.strictEqual(fs.readFileSync(file, 'utf8'), valid);

  const next = valid.replace('SING 女团', 'SING女团');
  const accepted = tasteProfile.writeTasteMdSafely(file, next);
  assert.strictEqual(accepted.ok, true);
  assert.strictEqual(fs.readFileSync(file, 'utf8'), next.endsWith('\n') ? next : `${next}\n`);
}

console.log('taste profile tests passed');
