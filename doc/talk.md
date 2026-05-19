# Claudio FM — 对话记录

## 会话：2026-05-17（Bug修复会话）

### 用户反馈的问题

1. 切换歌曲播放的不对（要周杰伦的稻香，播的是别的歌）
2. TTS DJ 声音是女声浏览器声，需要换成播音男声
3. 歌曲不到 1 分钟就切换（试听片段）
4. 切换歌曲后立即跳到下一首（audio.onerror 触发自动跳过）
5. QQ 音乐完全无法使用（所有歌曲切换都失败）

---

### 技术排查过程

#### 问题一：TTS 声音

**根因**：前端使用浏览器 `SpeechSynthesis` API，不同浏览器/系统声音不一致，115浏览器无声，Firefox 为女声。

**解决方案**：
- 新建 `server/tts.js`，使用 `msedge-tts` npm 包连接微软 Edge TTS WebSocket 服务
- 声音选用 `zh-CN-YunyangNeural`（云扬，男声播音员）
- 新增 `/api/tts?text=` 接口，服务端合成 MP3 返回给前端
- 前端改用 `fetch('/api/tts')` + `new Audio(blob)` 播放

**遇到的坑**：
- 第一版自定义 WebSocket 实现返回 403（TrustedClientToken 过期）
- `msedge-tts` 的 `toStream()` 返回 `{ audioStream, metadataStream, requestId }` 对象，不是直接的流，需要 `const { audioStream } = edgeTTS.toStream(text)`

#### 问题二：Service Worker 缓存

**根因**：SW 使用 cache-first 策略，浏览器一直运行旧版 app.js（还是 Web Speech API）。

**修复**：
- `sw.js` cache 版本从 v1 升为 v4
- JS/CSS 文件完全不被 SW 拦截（直接 network-first）
- Express 中间件对 .js/.css 添加 `Cache-Control: no-cache, no-store`

#### 问题三：Autoplay Policy

**根因**：浏览器在用户首次交互前阻止 audio.play()，TTS 队列积压后无声。

**修复**：前端添加 `audioUnlocked` 标志，监听 click/keydown/touchstart 事件后才 drainTTS。

#### 问题四：用户点歌后立即跳歌

**根因**：`audio.onerror` 无论什么情况都调用 `/api/next`，用户点的歌报错也被自动跳过了。

**修复**：
- 前端 `S.userRequested` 标志区分用户主动点歌 vs 自动播放
- 用户点歌失败时：打开聊天框显示提示，不自动跳歌
- 自动播放失败时：2 秒后自动跳下一首

#### 问题五：QQ 音乐 CDN 全量 404

**深度排查过程**：
1. 测试 HTTP/HTTPS 两种协议 → 都 404
2. 测试 M800/M500/C400/C200 所有格式 → 都 404
3. 测试不同 CDN 域名（aqqmusic.tc.qq.com / dl.stream.qqmusic.qq.com）→ 都 404
4. 读取 404 响应体：`{"errorcode":-46628,"errormsg":"file not exist, retcode:-46628"}`
5. 用正确 songmid（0039MnYb0qxYhV）重新测试 → vkey API 返回 purl 但 CDN 仍 404

**根本原因**：当前 QQ_MUSIC_COOKIE 对应的账号**没有 VIP 流媒体权限**，vkey API 会返回 purl（误导性地表示"可以播放"），但 CDN 实际上拒绝交付文件。

**代码层面的 bug**：`getSongUrl()` 拿到 purl 就直接返回 URL，从不验证 CDN 是否真的可访问。`switchToSong()` 看到非空 URL 就 `activateTrack()`，结果浏览器播放时 `audio.onerror` 触发，因为 `userRequested=true` 不自动跳歌，用户看到"歌曲没有版权"。

**最终修复**：
1. `server/qqmusic.js`：`getSongUrl()` 在返回 URL 前做 CDN probe（`Range: bytes=0-0`），只有 200/206 才返回，否则继续试下一个格式，全部失败返回 null
2. `server/index.js`：`switchToSong()` 的 QQ 候选逻辑：
   - 指定了艺术家：只试同艺术家候选，最多 3 个
   - 未指定艺术家：只试 top-1（防止拿到 cover 版本），失败直接走网易云
   - QQ 全部失败 → 正确 fallback 到网易云

**验证结果**：
| 请求 | 结果 | 来源 |
|------|------|------|
| 周杰伦的稻香 | 稻香 (Demo) / 周杰伦 ~4min | QQ（demo 是完整录音室版本） |
| 周杰伦的晴天 | 晴天 / 周杰伦 | 网易云 |
| 起风了 | 起风了 / 买辣椒也用券 | 网易云 |
| 海阔天空 | 海阔天空 / Beyond | 网易云 |

---

### 本次会话修改的文件

| 文件 | 改动内容 |
|------|----------|
| `server/tts.js` | 新建，msedge-tts 服务端语音合成 |
| `server/index.js` | 添加 /api/tts 接口、no-cache 中间件、parseArtistSong、rankByArtist、switchToSong QQ 优先逻辑、userRequested 参数 |
| `server/qqmusic.js` | getSongUrl 添加 CDN probe，M500 格式，force HTTPS |
| `public/app.js` | TTS 改为服务端、audioUnlocked 解锁逻辑、userRequested 错误处理、试听检测排除QQ |
| `public/sw.js` | 缓存版本升至 v4，JS/CSS 不缓存 |

---

## 会话：2026-05-17（歌单导入与 UI 改版阶段）

### 用户新增需求

1. 读取 `doc` 与 `readme.md`，将网易云音乐和 QQ 音乐歌单下载到本地 `data`。
2. 用户提供网易云 Cookie 后，先拉取网易云 12 个歌单。
3. 用户提供 QQ 音乐 DevTools 请求与 Cookie 后，继续拉取 QQ 音乐歌单。
4. 参考 `demo.mp4`、`index.jpg`、`index_2.png` 优化播放器界面。
5. DJ 音色尽量接近 demo 的电台音色。
6. 播放页面去掉不协调的白色区域，改为 Claudio 暗色模板。
7. 播放态上方显示黑色旋律/波形区域；停止态只显示时间日期。
8. 增加时间日期、音量调节、底部 DJ 输入功能。
9. 将 DJ 头像替换为 `头像.jpg`。
10. 修复启动时报 `EADDRINUSE: address already in use :::8080` 的问题。

### 歌单导入排查

#### 网易云音乐

- 用户在 `.env` 中更新 `NETEASE_COOKIE`。
- 排查发现 Cookie 中含 `#` 时 dotenv 会截断，需要用引号包裹。
- 修正后成功从网易云账号拉取歌单并写入 `data/playlists.json`。

#### QQ 音乐

- 用户通过 DevTools 提供 `qq-playlist-curl.txt.txt`。
- 从请求中定位到 QQ 用户创建歌单接口：`fcg_user_created_diss`。
- 详情接口使用 `fcg_ucc_getcdinfo_byids_cp.fcg`。
- 详情接口对 referer/origin 敏感：referer 需保持 `https://y.qq.com/`，错误 Origin 会导致失败。
- 最终将 QQ 音乐歌单同步进本地 `data/playlists.json`。

### UI 改版过程

#### 第一轮

- 参考 `demo.mp4` 提取帧，确认 Claudio 的核心视觉：暗色玻璃面板、点阵背景、电台终端感、DJ 消息气泡、底部命令输入。
- 初版保留了白色 DJ 区块，用户反馈整体不协调。

#### 第二轮

- 按 `source/index.jpg` 改为全暗色模板。
- 去掉白色大块，统一黑色/蓝黑/墨绿色调。
- 添加顶部时间日期、音量滑杆、底部 DJ 快捷输入。
- 将底部输入框接入 `/api/chat`，避免只是装饰。

#### 第三轮

- 用户指出播放态频谱区域应占满上方区域，且播放时不应显示 hero 时间日期。
- 通过 `.app.playing` 控制播放态：
  - 播放时隐藏 hero 大时间、星期、日期。
  - 播放时显示黑色频谱屏与 `ON AIR`。
  - 暂停/停止时隐藏频谱，恢复时间日期。

#### 第四轮

- 用户反馈播放停止时仍渲染旋律和波形。
- 修复 CSS：停止态隐藏 `.melody-stage`、`.waveform`、`.on-air`，仅播放态显示。

#### 第五轮

- 用户反馈频谱区域仍不好看。
- 按 demo 重新调整为“居中音柱阵列”：
  - 音柱围绕中线呼吸，而非从底部硬撑满。
  - 音柱采用上白下绿渐变。
  - `ON AIR` 置于底部中央，减少视觉拥挤。

### TTS 音色调整

- 将 `server/tts.js` 的声音参数环境变量化：
  - `TTS_VOICE`
  - `TTS_RATE`
  - `TTS_PITCH`
  - `TTS_VOLUME`
- 默认继续使用 `zh-CN-YunyangNeural`，并降低语速与音高，使其更接近 demo 的电台播报感。

### 启动错误修复

用户启动时出现：

```text
Error: listen EADDRINUSE: address already in use :::8080
```

根因：
- `.env` 配置 `PORT=8080`。
- 旧的 Claudio 服务已经占用 8080。
- 新进程再次监听同一端口，且原代码没有处理 `server.listen` 的 `EADDRINUSE`。

修复：
- `server/index.js` 增加 `listenWithFallback()`。
- 默认从 `PORT` 开始，端口占用则自动尝试下一个端口。
- `.env.example` 增加 `PORT_RETRY_LIMIT=10`。

验证：
- `node --check server/index.js` 通过。
- 模拟占用 8080 时，服务可成功启动到 8081。

### 本阶段修改的文件

| 文件 | 改动内容 |
|------|----------|
| `server/sync-playlists.js` | 网易云/QQ 歌单同步逻辑完善 |
| `server/index.js` | 导入接口、端口回退、前端静态资源服务与 UI 状态相关接口 |
| `server/tts.js` | TTS 参数环境变量化 |
| `public/index.html` | Claudio 暗色模板结构、频谱区域、底部 DJ 输入、头像引用 |
| `public/style.css` | 暗色玻璃风格、播放态/停止态、频谱音柱、音量与聊天样式 |
| `public/app.js` | 播放态类控制、音量控制、快捷输入接入聊天、头像不再被专辑封面覆盖 |
| `public/avatar.jpg` | DJ 头像资源 |
| `.env.example` | 新增 TTS 参数与 `PORT_RETRY_LIMIT` |
| `data/playlists.json` | 网易云 + QQ 音乐歌单同步结果 |

---

## 会话：2026-05-17（歌单歌曲分类）

### 用户需求

将所有歌单中的歌曲重新整理分类，分类结果放在 `data` 中，后续可新增“按类型播放”功能。

### 实现

- 新增 `server/classify-playlists.js`。
- 新增 npm 脚本：`npm run classify`。
- 读取 `data/playlists.json` 中网易云与 QQ 音乐的全部歌单歌曲。
- 按歌单名称和歌曲元数据进行规则分类。
- 同一首歌如果出现在多个歌单或多个平台，会合并为去重歌曲，同时保留全部 `playbackIds`、来源平台和来源歌单。

### 输出文件

| 文件 | 说明 |
|------|------|
| `data/categories.json` | 类型分类队列，包含分类名、说明、歌曲列表、`playbackIds` |
| `data/songs-classified.json` | 去重歌曲明细，包含主分类、所有分类、来源歌单、来源平台 |

### 分类结果

- 输入：1371 条歌单歌曲记录
- 去重：1156 首歌曲
- 分类：14 个类型
- 类型包括：华语流行、怀旧金曲、伤感疗愈、国风古风、动漫二次元、影视 OST、BGM/纯音乐、日语、韩语、英语/欧美摇滚电子、电音燃向、KTV、歌手专题、喜欢/杂选。

### 额外修复

分类时发现 QQ 音乐歌曲名称为空。根因是运行时导入模块没有兼容 QQ 详情接口中的 `songname/songmid/albumname` 字段。

已修复：
- `server/import.js`：QQ 歌曲格式化补充 `songname`、`songorig`、`songmid`、`albumname`。
- 重新运行 `npm run sync` 后，QQ 625 首歌曲均恢复歌名。

---

## 会话：2026-05-17（DJ 播报时长调整）

### 用户反馈

DJ 内容太少，当前播报只有一句短句，希望播报时长接近 demo，大约 5-10 秒。

### 根因

- `server/ai.js` 中生成播报词的 prompt 明确要求“25字以内”。
- `prompts/dj-persona.md` 中也写了“20-30 字以内”。
- AI 不可用时的 fallback 模板同样较短。

### 修改

- 将 AI 播报词要求改为 50-90 个中文字符，约 5-10 秒。
- 要求 2-3 个短句，不写成长段落。
- fallback 模板同步加长，避免 AI 连接失败时仍只有一句短话。
- 更新 `doc/standard.md` 与 `doc/summary.md` 中关于播报长度的旧说明。

### 追加调整

用户确认 20-40 个字符、约 5 秒也可以，因此再次收窄播报长度：

- `server/ai.js` prompt 改为 20-40 个中文字符，约 5 秒。
- fallback 模板同步缩短为 1-2 个短句。
- `prompts/dj-persona.md`、`doc/standard.md`、`doc/summary.md` 同步更新。

---

## 会话：2026-05-18（完成中优先级功能）

### 用户需求

根据 `doc/plan.md` 完成未实现的中优先级功能。

### 完成内容

- 用户品味自动学习：`server/stats.js` 会从近期播放历史提取高频歌手、类型和最近歌曲；`server/context.js` 将这些信号注入 DJ 上下文。
- 天气 API：新增 `server/weather.js`，当前优先支持高德天气，OpenWeather 作为兜底；未配置天气 Key 时自动跳过。
- 搜索结果去重：`server/index.js` 对网易云和 QQ 搜索候选按“歌曲名 + 艺人”去重。
- 语音输入：底部 MIC 接入浏览器 `SpeechRecognition` / `webkitSpeechRecognition`，识别结果复用 `/api/chat`。
- 歌单导入日志可视化：前端导入完成后显示网易云歌单数、QQ 歌单数、歌曲总数和日志详情。
- 按类型播放：新增 `server/categories.js`，从 `data/categories.json` 构建分类播放池，支持“播放国风”“来点 KTV”“切到日语”“换成电音”等指令。

### 本阶段修改的文件

| 文件 | 改动内容 |
|------|----------|
| `server/index.js` | 运行时上下文聚合、搜索去重、下一首指令、分类播放指令、`/api/categories` |
| `server/stats.js` | 播放记录补充分类字段，新增近期偏好统计 |
| `server/context.js` | DJ prompt 注入自动学习偏好 |
| `server/weather.js` | 高德天气优先、OpenWeather 兜底的可选天气上下文 |
| `server/categories.js` | 分类数据读取、别名匹配、分类播放池构建 |
| `public/app.js` | MIC 语音识别与导入日志摘要 |
| `public/style.css` | 导入日志摘要样式 |
| `.env.example` | 天气 API 配置项 |
| `readme.md`、`doc/plan.md`、`doc/standard.md`、`doc/summary.md` | 同步记录中优先级功能完成情况 |

### 后续调整：切换为国内天气 API

用户希望将 OpenWeather 换成中国天气 API。已调整为：

- `server/weather.js` 优先调用高德天气 Web 服务 API。
- 新增环境变量 `AMAP_WEATHER_KEY`、`AMAP_WEATHER_CITY`，当前城市配置为北京 `110000`。
- OpenWeather 仍保留为兜底，避免已有配置失效。
- `.env.example`、`readme.md`、`doc/standard.md`、`doc/summary.md` 同步更新为高德优先。
- 顶部时间下方新增可见天气行，通过 `/api/now` 和 WebSocket 状态同步展示北京天气。

### 后续调整：切歌时同步停止旧 DJ 播报

用户反馈版权失败自动切歌时，DJ 仍在朗读上一首播报。已在前端统一处理：

- 新增 `stopCurrentDjVoice()`，清空 TTS 队列、停止当前 TTS 音频、停止打字机。
- 新增 `requestNextTrack()`，试听片段、播放错误、歌曲结束、手动下一首都先停止旧 DJ，再请求 `/api/next`。
- TTS 增加 `ttsGeneration` 世代号，避免旧的异步 TTS 请求返回后继续播放。

---

## 会话：2026-05-18（播放器截图回归测试）

### 用户需求

完成高优先级中的播放器截图回归测试。

### 实现

- 新增 `scripts/visual-regression.js`。
- 新增 npm 脚本：`npm run test:visual`。
- 新增开发依赖：`playwright`。
- 测试脚本会启动临时本地静态服务，mock `/api/now` 和音频接口，不依赖真实音乐服务。
- 覆盖两个视口：
  - desktop：1280 × 900
  - mobile：390 × 844
- 每个视口生成暂停态和播放态截图，输出到 `data/screenshots/`。

### 检查内容

- 页面截图非空且不是单色图。
- 顶部时间、天气、播放器、DJ 区、输入区、底部按钮可见。
- 播放态必须显示频谱和小波形，隐藏 hero 时间。
- 暂停态必须隐藏频谱和小波形，显示 hero 时间。
- 品牌区与时间天气区、播放器与 DJ 区、DJ 区与输入区、输入区与底部按钮不能发生关键重叠。

### 验证

已运行：

```bash
npm run test:visual
```

结果通过，生成：

- `data/screenshots/desktop-paused.png`
- `data/screenshots/desktop-playing.png`
- `data/screenshots/mobile-paused.png`
- `data/screenshots/mobile-playing.png`

---

## 会话：2026-05-18（QQ 点歌延迟熔断）

### 用户需求

先做高优先级中的点歌延迟优化 circuit breaker。

### 实现

- 在 `server/qqmusic.js` 中新增 QQ URL 熔断状态。
- `getSongUrl()` 连续完整解析失败达到阈值后打开熔断。
- 熔断打开时，后续 QQ URL 请求直接返回 `null`，不再等待 vkey 和 CDN probe。
- 任意一次 QQ URL 成功会重置熔断状态。
- 默认配置：
  - `QQ_CIRCUIT_THRESHOLD=3`
  - `QQ_CIRCUIT_COOLDOWN_MS=600000`
- 新增只读调试接口：`GET /api/debug/qq-circuit`。

### 验证

- `node --check server/qqmusic.js`
- `node --check server/index.js`
- 使用临时环境变量将阈值设为 1、冷却设为 2 秒，验证首次失败打开熔断，第二次调用 0ms 跳过 QQ probe。

---

## 会话：2026-05-18（播放历史可视化界面）

### 用户需求

先完成低优先级中的播放历史可视化界面，为后续按历史偏好和类型播放扩展做准备。

### 实现

- `/api/history` 从原来的最近播放列表扩展为历史摘要，支持 `limit` 参数。
- `server/stats.js` 新增 `getHistorySummary()`，统计总记录、本次样本、去重歌曲、常听歌手、常听类型和最近播放。
- 前端底部新增 `HIST` 按钮，打开暗色历史面板。
- 历史面板展示统计卡片、歌手/类型条形图和最近播放列表。
- 移动端补充历史面板和 5 个底部按钮的响应式样式。

### 验证

- `node --check public/app.js`
- `node --check server/stats.js`
- `node --check server/index.js`
- `node -e "const s=require('./server/stats'); console.log(JSON.stringify(s.getHistorySummary(5), null, 2))"`

---

## 会话：2026-05-18（下一阶段产品路线）

### 用户需求

用户认可“喜欢/不喜欢反馈系统、场景电台模式、DJ 播报策略、队列预览、每日/时段自动电台”的下一阶段路线，希望写入相关文档并准备后续开发。

### 产品分析结论

Claudio FM 的定位应继续围绕“私人 AI 音乐电台”，而不是普通音乐播放器。用户核心需要包括：

- 少操作：打开即听，少点按钮、少调配置。
- 符合当下状态：音乐能跟随时间、天气、情绪、工作/休息场景变化。
- 有陪伴感：DJ 用合适频率和语气说话，而不是机械报歌名。
- 不被打断：版权失败、切歌延迟、TTS 错位等问题应被系统自动消化。
- 可控但不复杂：用户用自然语言表达“多放这个”“别放这类”“安静一点”即可。

### 文档更新

- `doc/plan.md`：新增下一阶段产品路线、用户需求、推荐实施顺序和优先级任务。
- `readme.md`：新增“下一阶段路线”说明，便于从用户视角理解后续功能。
- `doc/summary.md`：补充下一步改进计划摘要。
- `docs/superpowers/plans/2026-05-18-radio-personalization.md`：新增下一阶段开发计划。

---

## 会话：2026-05-18（喜欢 / 不喜欢反馈系统）

### 用户需求

按照 `doc/plan.md` 开始进行下一阶段改进，优先实现产品路线中的喜欢 / 不喜欢反馈系统。

### 实现

- `server/stats.js`：新增 `feedback` 数据结构，支持保存反馈事件、读取反馈信号、判断歌曲是否被屏蔽。
- `server/feedback.js`：新增自然语言反馈解析，支持“喜欢这首”“少放这首”“多放这个歌手”“少放这个歌手”“别放这类”等指令。
- `server/index.js`：在 `/api/chat` 中优先处理反馈指令；本地歌单推荐排序接入反馈信号；新增 `GET /api/feedback` 调试接口。
- `public/index.html`：播放器控制区新增 `LIKE` 和 `LESS` 两个轻量按钮。
- `public/app.js`：按钮复用 DJ 聊天接口发送偏好反馈。
- `public/style.css`：新增反馈按钮样式，保持 Claudio 暗色电台视觉。
- `readme.md`、`doc/plan.md`、`doc/summary.md`：同步记录功能和命令。

### 验证

- `node --check server/stats.js`
- `node --check server/feedback.js`
- `node --check server/index.js`
- `node --check public/app.js`
- `npm.cmd run test:visual`

### 剩余风险

反馈会影响本地歌单推荐排序，但最终效果仍受可播放歌曲数量、版权可用性和本地分类质量影响。如果用户屏蔽过多歌手或类型，系统仍需要保留兜底队列避免无歌可播。

### 后续修复：LIKE 误触发切歌

用户反馈点击 `LIKE` 会直接切歌。排查后确认根因是反馈指令在前端/解析模块中存在编码不稳定风险，导致“喜欢这首”没有被稳定识别为反馈，可能继续落入分类/点歌逻辑。

修复：
- `server/feedback.js` 改为使用 Unicode escape 定义中文关键词和回复，避免源码编码影响运行时匹配。
- `public/app.js` 的 `LIKE` / `LESS` 发送内容也改为 Unicode escape，运行时仍发送正常中文。

验证：
- `node --check server/feedback.js`
- `node --check public/app.js`
- `node --check server/index.js`
- `node --check server/stats.js`
- 使用 `node -e` 验证“喜欢这首”“少放这首”“多放这个歌手”“别放这类”均进入反馈解析。
- `npm.cmd run test:visual`

---

## 会话：2026-05-18（场景电台模式）

### 用户需求

继续按照 `doc/plan.md` 的下一阶段路线做下一个任务：场景电台模式。

### 实现

- `server/scenes.js`：新增场景定义和队列构建，支持深夜、工作、通勤、下雨、睡前、回忆杀、KTV。
- `server/index.js`：接入场景识别，`/api/chat` 会优先于分类播放识别场景命令；新增 `GET /api/scenes`。
- 场景队列复用 `data/categories.json` 的分类数据，并通过 `boostPlaylistByTaste()` 继续尊重 LIKE / LESS 偏好。
- `readme.md`：新增场景电台指令和 `/api/scenes` 说明。
- `doc/plan.md`、`doc/summary.md`：同步更新完成状态。

### 验证

- 先运行红灯检查，确认 `server/scenes` 不存在时测试失败。
- `node --check server/scenes.js`
- `node --check server/index.js`
- `node -e` 验证“深夜模式”“工作专注”“通勤提神”“下雨安静”“睡前”“回忆杀”“KTV”均能映射到场景。

### 剩余风险

场景效果取决于已有分类数据质量。当前第一版采用“场景 -> 多个分类组合”的轻量方案，还没有接入独立 DJ 播报策略；后续应继续做“少说话 / 多介绍 / 只播歌”等 DJ 策略控制。

---

## 会话：2026-05-18（DJ 播报策略控制）

### 用户需求

继续按照 `doc/plan.md` 的下一阶段路线，实现 DJ 播报策略控制。

### 实现

- `server/dj-policy.js` 作为策略模块，定义 normal、minimal、short、warm、silent 等播报模式。
- `server/context.js` 将当前播报策略注入 DJ 系统 prompt。
- `server/ai.js` 支持根据策略抑制播报或裁剪播报长度；silent/只播歌模式返回空播报。
- `server/index.js` 维护当前场景和播报策略；场景切换时自动套用对应策略，并支持“少说话”“多介绍一点”“只播歌”“恢复播报”等聊天指令。
- `GET /api/dj-policy`、`GET /api/now` 和 WebSocket 状态会暴露当前策略与场景。
- `public/app.js` 处理空播报，避免只播歌时继续朗读旧 DJ 文案或触发空 TTS。

### 验证

- 先新增 `tests/dj-policy.test.js`，确认策略 prompt 和 silent 播报抑制在实现前失败。
- `node tests\dj-policy.test.js`

### 剩余风险

播报策略已能控制频率、长度和是否播报，但更细的“开场白 / 切歌短句 / 每日问候”仍适合作为后续每日电台或队列预览阶段继续扩展。

---

## 会话：2026-05-19（队列预览和轻量编辑）

### 用户需求

用户确认继续按照下一阶段策略推进，并要求每次更新都写入 `doc` 相关文档。本阶段优先实现“队列预览和轻量编辑”。

### 实现

- 新增 `server/queue.js`：提供纯队列助手函数，负责生成队列摘要、删除下一首、重建队列和插入下一首。
- 新增 `tests/queue.test.js`：覆盖接下来 5 首预览、删除下一首、重建队列和插队。
- `server/index.js`：新增 `GET /api/queue`、`POST /api/queue/skip-next`、`POST /api/queue/rebuild`、`POST /api/queue/insert`；`/api/now`、WebSocket 状态和 track 广播都会带上 `queue` 快照。
- `server/index.js`：新增自然语言插队指令，支持“插队稻香”“插队播放周杰伦的晴天”“把海阔天空插到下一首”“下一首听起风了”。
- `public/index.html`：将静态 `QUEUE / 0 TRACKS` 替换为实时队列面板。
- `public/app.js`：渲染队列，接入 `DROP`、`RESHUFFLE`、`INSERT` 操作，并在 WebSocket 状态变化后同步刷新。
- `public/style.css`：补充队列面板、操作按钮和队列条目样式，保持 Claudio 暗色电台视觉。
- `docs/superpowers/plans/2026-05-19-queue-preview-editing.md`：记录本阶段实施计划。

### 验证

- 先运行 `node tests\queue.test.js`，确认红灯失败原因是 `server/queue.js` 不存在。
- 实现后运行 `node tests\queue.test.js`。
- 运行 `node --check server\queue.js`。
- 运行 `node --check server\index.js`。
- 运行 `node --check public\app.js`。

### 剩余风险

- 插队点歌依赖现有网易云 / QQ 搜索和版权探测，无法保证所有歌曲都能插入。
- `RESHUFFLE` 会优先沿用当前场景；若当前场景分类数据较少，会回退到本地歌单池。
- 队列编辑只修改待播队列，不改变当前正在播放的歌曲。

---

## 会话：2026-05-19（每日 / 时段自动电台简报）

### 用户需求

用户确认继续完成“每日 / 时段自动电台简报”，并批准设计：启动或首次进入页面时根据时间段、天气、`user/routines.md`、近期播放历史和偏好生成一句私人电台开场，同一天同一时段只生成一次。

### 实现

- 新增 `docs/superpowers/plans/2026-05-19-daily-station-briefing.md`，记录本阶段实施计划。
- 新增 `tests/daily-station.test.js`，先验证红灯：`server/daily-station.js` 不存在时测试失败。
- 新增 `server/daily-station.js`：负责时段判断、日期 + 时段缓存 key、兜底简报文案，以及 `getOrCreateBriefing()` 编排。
- `server/stats.js`：新增 `dailyBriefings` 数据结构，支持 `saveDailyBriefing()` 和 `getDailyBriefing()`。
- `server/ai.js`：新增 `generateDailyBriefing()`，DeepSeek 可用时生成 35-70 字简报，不可用时使用本地模板。
- `server/index.js`：启动后生成简报；`/api/now`、WebSocket 初始状态和 `GET /api/daily-briefing` 都返回 `dailyBriefing`。
- `public/app.js`：收到 `dailyBriefing` 后只展示一次，进入 DJ 文案区和聊天气泡，避免 WebSocket 重连重复刷屏。
- `readme.md`、`doc/plan.md`、`doc/standard.md`、`doc/summary.md`、`doc/document.md` 同步记录。

### 验证

- `node tests\daily-station.test.js`
- `node --check server\daily-station.js`
- `node --check server\stats.js`
- `node --check server\ai.js`
- `node --check server\index.js`
- `node --check public\app.js`

### 剩余风险

- 简报缓存按服务端本地日期和时段计算，跨时段后需要通过 `/api/daily-briefing` 或页面重连刷新。
- AI 生成质量受 DeepSeek 可用性和上下文质量影响；不可用时会用本地模板保证不阻塞启动。

---

## 会话：2026-05-19（队列同步兼容修复）

### 用户反馈

页面 `QUEUE` 区域显示“队列暂时无法同步”。

### 排查

- 访问 `http://localhost:8080/api/queue?limit=5` 返回 404。
- 当前磁盘里的 `server/index.js` 已包含 `/api/queue` 路由。
- 访问 `http://localhost:8080/api/now` 返回旧状态结构，缺少 `queue` 和 `dailyBriefing` 字段。
- 根因：浏览器加载了新版前端静态文件，但 8080 上运行的是旧版 Node 进程，前后端版本不一致。

### 修复

- `public/app.js` 的 `refreshQueue()` 在 `/api/queue` 不可用时，不再直接显示“队列暂时无法同步”。
- 前端会退回请求 `/api/now`，用旧接口里的 `next` 显示至少下一首，并提示“当前服务需重启后同步完整队列”。
- 完整队列能力仍需要重启服务到新版后端。

### 验证

- `node --check public\app.js`
- `npm.cmd run test:visual`
