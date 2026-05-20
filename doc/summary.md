# Claudio FM — 项目总结（2026-05-17）

## 项目概况

个人 AI 音乐电台 PWA。用户打开网页即可听到 AI DJ 自动播报并播放推荐歌曲，支持与 DJ 聊天、点歌、查看歌词、语音播报。

## 技术栈（最终）

| 层 | 技术 |
|----|------|
| 后端 | Node.js + Express + WebSocket (ws) |
| 音乐来源 | 网易云（NeteaseCloudMusicApi 子进程）+ QQ 音乐（辅助，非VIP账号） |
| AI | DeepSeek API（OpenAI 兼容接口） |
| TTS | 服务端 msedge-tts（zh-CN-YunyangNeural，男声播音员） |
| 前端 | Vanilla JS + CSS + PWA Service Worker |
| 持久化 | JSON 文件（data/stats.json） |

## 已完成功能

- [x] 复古电台 UI（黑胶唱片旋转、打字机效果、暗色调）
- [x] AI DJ 播报（DeepSeek，每首歌播报约 5 秒）
- [x] 服务端 Edge TTS 语音（云扬男声播音员）
- [x] WebSocket 实时状态同步（多端同步）
- [x] 与 DJ 聊天 + 点歌（中文自然语言，支持"周杰伦的稻香"格式）
- [x] 歌词同步显示（LRC 解析 + 自动滚动）
- [x] QQ 音乐集成（搜索 + URL 获取，非VIP账号 fallback 到网易云）
- [x] CDN probe 机制（防止无权限 URL 被激活）
- [x] QQ URL 熔断机制（连续 probe 失败后短时间跳过 QQ 候选）
- [x] 播放历史可视化（底部 HIST 面板展示记录数、常听歌手/类型和最近播放）
- [x] 用户点歌 vs 自动播放 区分错误处理
- [x] 试听片段自动跳过（Netease ≤35s 自动切歌，QQ 不跳）
- [x] PWA 可安装（manifest + Service Worker）

## 关键设计决策

### QQ 音乐策略（非VIP账号）
- vkey API 对无权限格式仍返回 purl，但 CDN 返回 404
- 通过 CDN probe 检测真实可用性，失败 fallback 到网易云
- 连续 QQ URL 解析失败后会打开 circuit breaker，默认 10 分钟内直接跳过 QQ URL probe
- 指定艺术家时只试同艺人候选（避免 cover 混入）
- 未指定艺术家时只试 top-1 QQ 结果（避免等待过久后拿到 cover）

### TTS 架构
- 前端不再使用 `SpeechSynthesis`（各浏览器声音不一致，且可能被 autoplay 拦截）
- 服务端生成 MP3 → 前端 blob URL 播放
- audioUnlocked 标志确保首次用户交互后才开始播放队列

### Service Worker 缓存策略
- JS/CSS 完全不被 SW 拦截（always network）
- Express 对 JS/CSS 加 no-cache 头（双重保障）
- 只缓存 manifest.json 和图标

## 已知问题与限制

- **QQ 音乐 VIP 内容受限**：当前 Cookie 是普通账号，320kbps 全量歌曲无法访问，仅部分 Demo/Live 版本可用
- **点歌响应时间**：首次 QQ CDN probe 仍可能较慢；连续失败后会触发熔断，默认 10 分钟内跳过 QQ URL probe
- **网易云版权限制**：部分热门歌曲（如某些周杰伦专辑）在网易云也无法播放，返回试听片段

## 下一步改进计划

见 [plan.md](plan.md) 改进计划部分。下一阶段产品重点是把 Claudio FM 从“会说话的播放器”推进为“懂场景、会记忆、可轻量调教的私人音乐电台”。

推荐优先顺序：
- 喜欢 / 不喜欢反馈系统：记录喜欢、少放、屏蔽、跳过、完整听完等信号，形成推荐闭环。
- 场景电台模式：支持深夜、工作、通勤、下雨、睡前、回忆杀、KTV 等场景队列。
- DJ 播报策略控制：按场景控制 DJ 说话频率、长度和语气。
- 队列预览和插队：展示接下来几首，支持删除下一首、插队点歌、重新生成队列。
- 每日 / 时段自动电台：结合天气、时间、作息和近期收听生成开场与推荐。

---

## 阶段总结：歌单导入与 Claudio UI 改版（2026-05-17）

### 目标

把网易云音乐与 QQ 音乐歌单沉淀到本地数据，并将播放器界面从基础复古风格推进到接近 demo / index 模板的 Claudio 暗色电台界面。

### 完成内容

- 网易云音乐：通过 Cookie 拉取用户歌单，写入 `data/playlists.json`。
- QQ 音乐：通过用户提供的 DevTools curl 请求定位真实接口，完成创建歌单列表与详情接口适配，写入同一份本地歌单数据。
- 播放器界面：改为暗色玻璃面板、点阵背景、顶部时间日期、播放态频谱屏、DJ 消息区与底部命令输入。
- 播放状态：播放时显示居中呼吸音柱和小波形；暂停/停止时隐藏动态频谱，恢复时间日期。
- DJ 头像：统一使用 `public/avatar.jpg`，避免专辑封面覆盖 Claudio 身份。
- 音量控制：新增播放器内音量滑杆与百分比显示。
- DJ 快捷输入：底部输入框接入 `/api/chat`，可直接发送消息给 DJ。
- TTS 参数：`TTS_VOICE`、`TTS_RATE`、`TTS_PITCH`、`TTS_VOLUME` 环境变量化，便于调成接近 demo 的电台音色。
- 启动稳定性：HTTP/WebSocket 端口占用时自动尝试后续端口，避免 `EADDRINUSE` 直接崩溃。
- 歌曲分类：`npm run classify` 将 1371 条歌单歌曲记录整理为 14 个类型分类，写入 `data/categories.json` 和 `data/songs-classified.json`。
- 中优先级功能：完成品味自动学习、高德天气上下文、搜索去重、MIC 语音输入、歌单导入日志可视化和按类型播放。

### 技术细节

- QQ 音乐用户歌单列表接口使用 `fcg_user_created_diss`，详情接口使用 `fcg_ucc_getcdinfo_byids_cp.fcg`；详情请求需要正确 referer，且不应带错误 Origin。
- 本地静态资源只从 `public/` 暴露，因此 `source/头像.jpg` 被复制为 `public/avatar.jpg`。
- 播放态由 `.app.playing` 驱动，CSS 中通过该类控制 hero 时间/日期、ON AIR、频谱、波形的显示状态。
- 端口回退逻辑在 `server/index.js` 中实现，默认从 `.env` 的 `PORT` 开始，最多尝试 `PORT_RETRY_LIMIT` 次。
- 分类脚本位于 `server/classify-playlists.js`，按歌单名称与歌曲元数据规则打标签；分类结果保留 `playbackIds`，便于后续实现按类型播放。
- 分类播放由 `server/categories.js` 提供，支持别名匹配（国风、KTV、日语、电音等），播放池优先使用网易云 ID，QQ 音乐作为备用。
- 运行时上下文由 `server/index.js` 聚合近期收听、自动学习到的偏好和可选天气信息，再交给 `server/context.js` 拼入 DJ 提示词。
- 前端 MIC 使用浏览器 `SpeechRecognition` / `webkitSpeechRecognition`，识别后复用底部 DJ 输入流程。
- 前端切歌会先停止旧 DJ 打字机和 TTS；版权失败、试听片段跳过、手动下一首都不会继续朗读上一首播报。
- 视觉回归：`npm run test:visual` 使用 Playwright 生成桌面/移动端播放态与暂停态截图，并断言关键元素可见、状态正确、截图非空、核心区域不重叠。

### 当前状态

项目已具备可用的个人音乐电台雏形：可导入个人歌单、可播放、可播报、可聊天，并有较完整的 Claudio 暗色电台体验。

2026-05-18 更新后，项目还具备按类型播放和基础自学习能力；用户可以直接输入“播放国风”“来点 KTV”“切到日语”等指令切换分类队列。
播放历史也已可视化，底部 `HIST` 面板会从 `/api/history` 读取统计摘要，辅助后续按历史偏好扩展更多播放策略。

2026-05-18 继续推进后，喜欢 / 不喜欢反馈系统已落地：播放器新增 `LIKE` / `LESS` 控件，聊天指令支持“喜欢这首”“少放这个歌手”“别放这类”等反馈，反馈事件会写入 `data/stats.json` 并影响本地推荐排序。

场景电台模式也已接入：新增 `server/scenes.js`，支持“深夜模式”“工作专注”“通勤提神”“下雨安静”“睡前低刺激”“回忆杀”“KTV”等指令，并通过多个分类组合生成队列，同时继续尊重 LIKE / LESS 偏好。

DJ 播报策略控制已接入：`server/dj-policy.js` 管理 normal、minimal、short、warm、silent 策略；场景会自动套用对应播报方式，用户也可以用“少说话”“多介绍一点”“只播歌”“恢复播报”调整。当前策略会注入 DJ prompt，并通过 `/api/dj-policy`、`/api/now` 和 WebSocket 状态暴露给前端。

2026-05-19 更新后，队列预览和轻量编辑已接入：播放器 `QUEUE` 区域会展示接下来 5 首歌曲，并支持 `DROP` 删除下一首、`RESHUFFLE` 按当前场景或本地偏好重新生成队列、`INSERT` 将输入框中的歌曲插到下一首。后端新增 `server/queue.js` 作为纯队列助手模块，并通过 `/api/queue`、`/api/queue/skip-next`、`/api/queue/rebuild`、`/api/queue/insert` 暴露能力；WebSocket 状态也会同步队列快照。

2026-05-19 继续推进后，每日 / 时段自动电台简报已接入：`server/daily-station.js` 会按早晨、工作、午休、下午、晚间、睡前和深夜判断时段，并用日期 + 时段生成缓存 key；`server/stats.js` 会把同一天同一时段的简报写入 `data/stats.json`，避免刷新或重连时重复生成。简报会结合天气、`user/routines.md`、近期播放和偏好，通过 DeepSeek 生成；AI 不可用时使用本地模板兜底。`/api/now`、WebSocket 初始状态和 `GET /api/daily-briefing` 都会暴露当前简报，前端只展示一次。

2026-05-19 队列体验补充了按需折叠：播放器 `QUEUE` 标题行新增 `HIDE / SHOW` 按钮，收起后仅保留队列标题、曲目数量和展开入口，隐藏 `DROP / RESHUFFLE / INSERT` 操作与预览列表。折叠状态会保存到浏览器 `localStorage`，刷新页面后保持用户上次选择。

2026-05-19 针对折叠按钮未出现和 QQ 会员播放问题继续修复：service worker 升级到 `claudio-v5`，HTML 导航页不再 cache-first，服务端也对首页和 HTML 设置 no-cache，避免浏览器继续显示旧版页面。QQ 音频从 302 直连 CDN 改为 `/api/music/stream/:id` 同源代理，并转发 Range 请求，减少浏览器请求头、跨域和缓存差异造成的播放失败。

2026-05-19 智能扩展队列已接入：播放队列不再只从用户歌单取歌，而是以 75% 本地歌单 + 25% 外部推荐的保守比例混合。外部推荐根据近期常听歌手、常听类型、当前场景和时间段生成搜索种子，从网易云 / QQ 搜索候选，并继续尊重 LIKE / LESS、屏蔽歌手和屏蔽类型。

2026-05-19 针对 QQ 404 候选继续做了播放前校验：自动切歌不再直接激活队首，而是先探测候选 URL，跳过暂不可播的 QQ / 网易云歌曲后再播放。QQ 失败 songmid 会短期缓存，避免同一首歌反复触发 M800/M500/C400 探测；默认日志也改为一条简短跳过提示。

2026-05-19 播放失败提示已纠偏：前端不再把浏览器音频加载失败直接描述为“没有可播放版权”，而是提示“当前音源暂时打不开”。这样可以区分账号版权权限与 QQ CDN 临时 404、签名 URL 过期、代理流中断等播放链路问题。

2026-05-19 播放稳定性补充：音频代理现在会监听上游 stream 的 `error`，并在浏览器关闭连接时主动销毁上游流。单首歌打不开会退化为前端提示 / 自动切歌，不应再因为远端音频流中途断开而导致服务崩溃。

2026-05-19 前端播放卡死保护已补充：音乐播放状态文案从 `Speaking...` 调整为 `Playing...`，缓冲时显示 `Buffering...`；如果播放中进度长时间不前进，前端会自动提示并切到下一首，避免页面停在中途不动。

2026-05-20 连续失败保护和播放诊断接口已接入：新增 `server/playback-diagnostics.js`，统一记录 URL 不可用、上游 HTTP 失败、stream 中断和前端 stalled / audio error；`GET /api/debug/playback` 可查看诊断快照，`POST /api/playback/failure` 支持前端上报。连续失败达到阈值后会自动重建后续队列并广播新队列。

### 剩余风险

- QQ 音乐仍受账号权限影响，非 VIP Cookie 对部分歌曲只能拿到不可播放 URL。
- MIC 语音输入依赖浏览器支持；Chrome/Edge 通常可用，部分浏览器会降级为文字输入提示。
- 天气上下文优先使用高德天气，需要用户自行配置 `AMAP_WEATHER_KEY`；当前顶部时间下方会显示北京天气，未配置时会自动跳过。
- 播报策略影响的是播报频率和 prompt 约束；最终文本仍受模型输出、TTS 可用性和用户是否开启 VOICE 影响。
- 插队点歌会先解析到可播放歌曲再进入队列；如果平台版权不可用或 QQ Cookie 权限不足，仍可能插队失败并给出提示。
- 每日简报缓存按服务端本地日期和时段计算；如果长期运行跨时段，下一次请求 `/api/daily-briefing` 或页面重连时会刷新到新时段。
