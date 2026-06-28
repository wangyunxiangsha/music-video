# Claudio FM — 个人 AI 音乐电台

> 读懂听歌习惯 → 规划声音 → 像 DJ 那样播报

## 快速开始

### 1. 配置 API Key
编辑 `.env` 文件，填入你的 DeepSeek API Key：
```
DEEPSEEK_API_KEY=你的Key
```

天气播报是可选功能；如果希望 DJ 在播报中参考本地天气，推荐使用高德天气：
```
AMAP_WEATHER_KEY=你的高德Web服务Key
AMAP_WEATHER_CITY=110000
```

`AMAP_WEATHER_CITY` 使用城市 adcode，`110000` 是北京。也可以保留 OpenWeather 作为兜底：
```
OPENWEATHER_API_KEY=你的OpenWeatherKey
WEATHER_CITY=Nanjing,CN
WEATHER_UNITS=metric
WEATHER_LANG=zh_cn
```

不配置天气 Key 时，天气上下文会自动跳过，不影响启动和播放。

### 2. 安装依赖（首次运行）
```bash
npm install
```

### 3. 启动服务
```bash
npm start
```

### 4. 打开播放器
浏览器访问：**http://localhost:8080**

如果 8080 已被占用，服务会自动尝试 8081、8082 等后续端口；以控制台打印的“本地访问”地址为准，也可以查看 `data/runtime.json` 里的 `url`。

部署、PWA 缓存刷新、Cookie 更新和日志分级说明见 [doc/deployment.md](doc/deployment.md)。

电台记忆可以在 `SET` 面板导出或导入，备份文件扩展名为 `.claudio`。它包含播放偏好、反馈、近期播放摘要和 `user/taste.md`，不会包含 `.env`、Cookie、API Key 或平台登录信息。

QQ 音乐 Cookie 失效时，可以在 `SET` 面板使用“扫码刷新”。播放器也会在连续出现全音质 empty purl 或 QQ 接口鉴权失败时，把 SET 状态标记为“疑似过期，请扫码刷新”。首次使用前需要安装可选 helper：`python -m pip install qqmusic-api-python`。

### 本地账号权益与隐私边界

Claudio FM 只使用你在本机配置或扫码得到的网易云 / QQ 音乐账号 Cookie。会员歌曲能否完整播放，取决于你自己的平台账号权益；普通会员、高级会员、地区版权和单曲限制都会影响结果。系统不会绕过平台权益，也不会把账号授权共享给其他用户。

Claudio FM 不重新分发音乐，不把平台音频保存成下载文件，也不会缓存下载音频；音频只通过本地服务代理给当前浏览器播放。电台记忆导出不会包含 `.env`、Cookie、API Key 或平台登录信息。

排查账号状态可先看 `SET` 面板的“平台状态”，或访问 `GET /api/account-status`；QQ 播放 URL、音质降级和 Cookie 健康细节可看 `GET /api/debug/qq-circuit`。

### 5. PWA 安装（可选）
在 Chrome/Edge 地址栏右侧点击安装图标，即可安装到桌面/手机。

---

## 功能介绍

| 功能 | 说明 |
|------|------|
| 🎵 AI DJ 播报 | DeepSeek 驱动，以复古电台风格介绍每首歌 |
| 🔉 语音朗读 | 服务端 Edge TTS（云扬男声播音员），实时朗读 DJ 播报词 |
| 💬 与 DJ 聊天 | 点击 💬 按钮，可以和 DJ 聊天、点歌（支持"周杰伦的稻香"格式） |
| 📄 查看歌词 | 点击 📄 按钮，查看同步滚动歌词 |
| 📻 黑胶唱片 | 复古唱片旋转动画，播放时自动转动 |
| 🎚️ 音量控制 | 播放器内置音量滑杆，实时调节当前音频音量 |
| 📊 电台频谱屏 | 播放时显示 Claudio 风格黑色音柱频谱；暂停时恢复时间/日期 |
| 🎧 歌单导入 | 支持从网易云音乐和 QQ 音乐 Cookie 拉取歌单到本地 data |
| 🗂️ 本地歌单池管理 | `SAVE` 可把外部推荐加入本地池并恢复已屏蔽歌曲；`REMOVE` 可把当前本地歌曲移出并长期屏蔽 |
| 🚫 屏蔽歌曲管理 | 在 `SET` 面板查看 `removedTracks`，可对单曲点 `RESTORE` 解除屏蔽 |
| 🌙 睡眠定时 | 在 `SET` 面板选择 15/30/45/60 分钟，到点后 30 秒渐弱停止 |
| ⏰ 闹钟电台 | 在 `SET` 面板设置当日时间，到点后渐强播放；仅当前前端会话生效 |
| 🧭 类型播放 | 支持“播放国风”“来点 KTV”“切到日语”等分类指令 |
| 🧠 品味学习 | 根据近期播放历史提取高频歌手/类型，注入 DJ 上下文并微调本地推荐 |
| 💾 电台记忆备份 | 在 `SET` 面板导出 / 导入 `.claudio` 记忆文件，迁移偏好和品味档案 |
| 📈 播放历史 | 底部 `HIST` 面板展示今日听歌报告、Claudio 学到的偏好变化、后续推荐调整、播放记录数、去重歌曲、常听歌手、常听类型和最近播放 |
| 🌦 天气显示 | 配置高德天气后，顶部时间下方显示北京天气，DJ 播报也会参考当前天气；OpenWeather 可作为兜底 |
| 🎙 MIC 输入 | 支持浏览器语音识别，把语音转为 DJ 指令 |
| 📱 PWA | 可安装到手机/桌面，像原生 App 一样使用 |

---

## 下一阶段路线

Claudio FM 下一阶段会继续强化“私人音乐电台”，重点不是堆播放器功能，而是降低操作、理解场景、形成偏好记忆。

| 方向 | 目标 |
|------|------|
| 喜欢 / 不喜欢反馈 | 支持“喜欢这首”“少放这类”“别放这个歌手”等轻量调教，让推荐越来越贴合 |
| 场景电台模式 | 支持深夜、工作、通勤、下雨、睡前、回忆杀、KTV 等场景队列 |
| DJ 播报策略 | 已支持按场景和指令控制 DJ 说话频率和语气，例如工作时少说、深夜多一点陪伴 |
| 队列预览和插队 | 已展示接下来 5 首歌，支持删除下一首、插队点歌、重新生成队列 |
| 每日私人电台 | 已结合时间、天气、作息和近期收听，生成每日 / 时段开场简报 |
| 智能扩展队列 | 已按 75% 我的歌单 / 25% 外部推荐保守混合，根据时间、场景和偏好探索新歌 |
| 今日听歌报告 | 已并入 `HIST` 面板，汇总当天播放、去重、外部推荐占比、跳过和不对味反馈 |
| 屏蔽管理 / 睡眠定时 / 闹钟电台 | 已在 `SET` 面板支持屏蔽列表恢复、睡眠渐弱停止和轻量闹钟渐强播放 |

推荐开发顺序：喜欢 / 不喜欢反馈系统、场景电台模式、DJ 播报策略、队列预览和轻量编辑、每日 / 时段自动电台简报、智能扩展队列、播放失败产品化提示、屏蔽管理、睡眠定时、闹钟电台、推荐质量微调、场景反馈细化、电台复盘增强和数据结构整理首版已完成。UPnP 家庭音响推送和飞书日历联动保留为低优先级外接能力，后续优先根据实际播放数据决定是否做 SQLite 迁移或新的集成。

---

## 切换歌曲指令

### 播放器按钮

| 操作 | 说明 |
|------|------|
| `>` | 切换下一首 |
| `<` | 当前播放超过 4 秒时，重播当前歌曲 |

### DJ 聊天 / 底部输入框

可以直接输入：

```text
下一首
换一首
切歌
```

也可以按类型切歌，类型来自 `data/categories.json`：

```text
播放国风
来点 KTV
切到日语
换成电音
我想听怀旧
```

当前支持的播放类型：

| 类型 | 可用口令示例 |
|------|--------------|
| 华语流行 | `播放华语`、`来点流行` |
| 怀旧金曲 | `播放怀旧`、`来点老歌` |
| 伤感疗愈 | `播放伤感`、`来点治愈`、`我想听疗愈` |
| 国风古风 | `播放国风`、`来点古风` |
| 动漫二次元 | `播放动漫`、`来点二次元`、`切到 ACG` |
| 影视 OST | `播放影视`、`来点 OST` |
| BGM/纯音乐 | `播放 BGM`、`来点纯音乐` |
| 日语 | `播放日语`、`切到日语` |
| 韩语 | `播放韩语`、`切到韩语` |
| 英语/欧美摇滚电子 | `播放英语`、`来点欧美`、`切到摇滚` |
| 电音燃向 | `播放电音`、`来点燃向` |
| KTV | `播放 KTV`、`来点 KTV` |
| 歌手专题 | `播放歌手专题`、`来点歌手` |
| 喜欢/杂选 | `播放喜欢`、`来点杂选` |

也可以点指定歌曲：

```text
播放黄昏
我想听周传雄的黄昏
来一首稻香
点歌：晴天
换成起风了
切换到海阔天空
```

明确点歌会优先走 QQ 音乐同名同歌手候选，并先做 CDN probe；QQ 可播时会返回 `qq:` 音源，避免网易云 30 秒试听片段提前截胡。QQ 不可播或未登录时才回落到网易云。自动队列和分类播放仍以本地歌单池策略为主，可能继续使用网易云 ID；前端会自动跳过网易云 `<=35s` 的试听片段。

### API 调用

```bash
curl -X POST http://localhost:8080/api/next
```

如果启动时控制台显示实际端口是 `8081` 或其他端口，把 URL 里的端口改成对应端口。

当前版本暂未实现历史上一首回退，左箭头主要用于重播当前歌曲。

---

## 偏好反馈指令

可以用按钮或自然语言调教电台。播放器控制区的 `LIKE` 会发送“喜欢这首”，`LESS` 会发送“少放这首”。

当前播放区还提供本地歌单池管理：`SAVE` 用于把外部推荐加入本地歌单池；如果这首歌之前被 `REMOVE` 屏蔽过，`SAVE` 会自动从 `removedTracks` 里移除它，相当于重新喜欢。`REMOVE` 只对本地歌单池歌曲启用，会把当前歌曲从本地池删除并写入长期屏蔽列表，后续自动队列会跳过它。也可以在 `SET` 面板的 `BLOCKED` 区域查看屏蔽列表，并对单曲点 `RESTORE` 解除屏蔽。

`SET` 面板还提供 `SLEEP` 睡眠定时：可选择 15 / 30 / 45 / 60 分钟，倒计时结束后会用 30 秒把音量渐弱到 0 并暂停播放；`OFF` 会取消本次定时。该定时只保存在当前浏览器会话中，刷新页面后会重置。

`ALARM` 闹钟电台同样是轻量前端会话功能：选择一个时间并点 `ON`，到点后如果当前没在播放，会从低音量渐强启动电台；如果已经在播放，只显示轻提示，不打断当前歌曲。刷新页面后闹钟会重置。

也可以直接对 DJ 说：

```text
喜欢这首
这首不错
不喜欢这首
少放这首
多放这个歌手
少放这个歌手
别放这类
这个场景别放这首
当前模式不适合
这个场景适合这首
安静一点
热闹一点
少放重复歌手
恢复默认调音
```

这些反馈会写入本地 `data/stats.json`，后续本地歌单推荐会优先考虑喜欢的歌曲/歌手，并减少不喜欢的歌曲、歌手或类型。

场景内反馈只影响当前场景：例如在“工作专注”里说“这个场景别放这首”，Claudio 只会降低这首歌在工作场景中的权重，不会把它从深夜、睡前或其他场景里全局屏蔽。

推荐质量微调会影响接下来队列的生成方式：“安静一点”会偏保守并减少 DJ 打扰，“热闹一点”会增加探索和提神感，“少放重复歌手”会降低近期已出现歌手的权重，“恢复默认调音”会回到平衡策略。

---

## 场景电台指令

可以直接输入场景，让 Claudio 按多个分类组合生成队列：

```text
深夜模式
工作专注
通勤提神
下雨安静
睡前低刺激
回忆杀
KTV
```

场景电台会复用本地分类数据，并继续尊重 LIKE / LESS 记录下来的偏好。

如果没有手动指定场景，Claudio 会按当前时段自动套用更细的默认策略：午休会偏向低刺激，傍晚通勤会偏向提神，22 点后会切到夜间低音量倾向。`/api/now` 和 WebSocket 状态会返回 `timeStrategy`、`effectiveScene` 和 `effectiveDjPolicy`，方便确认当前自动策略。

`HIST` 面板的 `TODAY` 区块会补充电台复盘：除了播放数量和常听歌手/类型，也会显示“Claudio 今天学到了什么”和后续队列会如何调整，例如提高某个类型权重、保留一点外部探索或降低负反馈方向。

---

## DJ 播报策略指令

场景电台会自动切换播报策略：深夜、下雨、回忆杀会更有陪伴感；工作、睡前会少说一点；通勤、KTV 会更短促。

也可以直接对 DJ 说：

```text
少说话
多介绍一点
只播歌
恢复播报
```

当前策略可通过 `GET /api/dj-policy` 查看；`GET /api/now` 和 WebSocket 状态也会包含 `djPolicy` 与当前场景。

---

## 队列预览和轻量编辑

播放器中部的 `QUEUE` 区域会显示接下来 5 首待播歌曲，并提供三个轻量操作：

| 控件 | 说明 |
|------|------|
| `DROP` | 删除下一首，不影响当前正在播放的歌曲 |
| `RESHUFFLE` | 按当前场景或本地偏好重新生成待播队列 |
| `INSERT` | 将输入框中的歌曲插到下一首 |

也可以直接对 DJ 说：

```text
插队稻香
插队播放周杰伦的晴天
把海阔天空插到下一首
下一首听起风了
```

---

## 智能扩展队列

播放队列默认采用保守探索策略：约 75% 来自你的本地歌单，约 25% 来自外部推荐。

外部推荐会根据近期常听歌手、常听类型、当前场景和当前时间段生成搜索种子，从网易云 / QQ 音乐搜索候选歌曲；同时继续尊重 `LIKE` / `LESS`、屏蔽歌手和屏蔽类型，避免把明确不喜欢的内容重新放回队列。

触发时机包括：启动加载队列、队列快空时补队列、切换场景 / 类型，以及点击 `RESHUFFLE` 重新生成队列。

---

## 每日 / 时段自动电台简报

Claudio 会在启动或首次打开页面时，根据当前时间段、天气、`user/routines.md`、近期播放历史和偏好生成一句私人电台开场。简报会进入 DJ 文案区和聊天气泡，同一天同一时段只生成一次，避免刷新页面时反复打扰。

当前时段包括：早晨、工作时段、午休、下午、晚间、睡前和深夜。DeepSeek 不可用时会使用本地模板兜底。

调试接口：

```text
GET /api/daily-briefing
```

---

## 视觉回归测试

播放器 UI 支持 Playwright 截图回归检查：

```bash
npm run test:visual
```

脚本会启动一个临时本地静态服务，使用 mock 播放状态检查桌面端和移动端的暂停态/播放态，并生成：

| 截图 | 说明 |
|------|------|
| `data/screenshots/desktop-paused.png` | 桌面端暂停态 |
| `data/screenshots/desktop-playing.png` | 桌面端播放态 |
| `data/screenshots/mobile-paused.png` | 移动端暂停态 |
| `data/screenshots/mobile-playing.png` | 移动端播放态 |

检查内容包括：页面非空、顶部天气可见、播放态频谱可见、暂停态时间可见、频谱/时间/DJ/输入区不发生关键重叠。

---

## 项目结构

```
music-video/
├── server/
│   ├── index.js      — Express 主服务 + WebSocket
│   ├── music.js      — 网易云音乐 API 封装
│   ├── qqmusic.js    — QQ 音乐 API 封装（搜索+URL+歌词）
│   ├── tts.js        — 服务端 Edge TTS（msedge-tts）
│   ├── ai.js         — DeepSeek AI 适配器
│   ├── context.js    — 提示词组装
│   ├── recommendation-mixer.js — 75/25 智能扩展队列混合
│   └── stats.js      — JSON 状态持久化
├── public/
│   ├── index.html    — PWA 主页面
│   ├── style.css     — 复古电台样式
│   ├── app.js        — 前端逻辑
│   ├── manifest.json — PWA 配置
│   ├── avatar.jpg    — DJ 头像
│   └── sw.js         — Service Worker
├── user/
│   ├── taste.md      — 你的音乐品味（可编辑）
│   └── routines.md   — 你的日常作息（可编辑）
├── prompts/
│   └── dj-persona.md — DJ 人设提示词（可编辑）
├── data/
│   ├── playlists.json — 本地歌单数据（导入生成）
│   ├── categories.json — 按类型整理的播放队列（分类生成）
│   ├── songs-classified.json — 去重歌曲分类明细（分类生成）
│   └── stats.json     — 播放历史、偏好、反馈和每日简报缓存（自动生成）
└── .env              — API Key 配置
```

---

## 个性化配置

### 自定义音乐品味
编辑 `user/taste.md`，告诉 AI 你喜欢什么风格的音乐。
品味档案生成通过 `/api/generate-taste` 完成，服务端会先校验 Markdown 是否包含完整章节和完整结尾；如果 AI 返回半截内容，旧的 `taste.md` 不会覆盖。

### 自定义作息
编辑 `user/routines.md`，设置你的时间规律，AI 会在合适的时段推荐合适的音乐。

### 自定义 DJ 风格
编辑 `prompts/dj-persona.md`，修改 DJ 的说话方式和人设。

### 导入网易云 / QQ 音乐歌单
在 `.env` 中配置 `NETEASE_COOKIE`、`QQ_MUSIC_COOKIE` 后运行：
```bash
npm run sync
```

导入结果会写入 `data/playlists.json`，播放器会从本地歌单数据中加载歌曲。同步采用增量合并：网易云 / QQ 歌单作为平台镜像更新，Claudio 本地收藏和 `removedTracks` 长期屏蔽会保留；已屏蔽歌曲即使被重新加回平台歌单，也只有在播放器里点 `SAVE` 才会恢复。

### QQ 音乐熔断设置

普通 QQ Cookie 经常会拿到看似有效但 CDN 拒绝的地址。播放器会先做 CDN probe；如果 QQ URL 连续失败，会短时间跳过 QQ 候选，直接尝试网易云或下一首。

通过 `SET` 面板扫码刷新 QQ 登录成功后，服务端会立即更新运行时 Cookie，并清空 QQ URL 缓存、单曲不可用缓存、熔断状态和 Cookie 健康提示；不需要重启服务。手动编辑 `.env` 里的 `QQ_MUSIC_COOKIE` 时仍需要重启。

```env
QQ_CIRCUIT_THRESHOLD=3
QQ_CIRCUIT_COOLDOWN_MS=600000
QQ_UNAVAILABLE_CACHE_MS=900000
QQ_COOKIE_HEALTH_THRESHOLD=3
# QQ_DEBUG_URL=1
```

| 变量 | 说明 |
|------|------|
| `QQ_CIRCUIT_THRESHOLD` | 连续失败多少次后打开熔断 |
| `QQ_CIRCUIT_COOLDOWN_MS` | 熔断持续时间，默认 10 分钟 |
| `QQ_UNAVAILABLE_CACHE_MS` | 单首 QQ 歌曲失败后的短期跳过缓存，默认 15 分钟 |
| `QQ_COOKIE_HEALTH_THRESHOLD` | 连续多少次 empty purl / 鉴权失败后提示 Cookie 疑似过期，默认 3 |
| `QQ_DEBUG_URL` | 设为 `1` 时输出每个 QQ 音质格式的详细 probe 日志 |

调试接口：

```text
GET /api/debug/qq-circuit
```

### 重新分类歌单歌曲

导入歌单后，可以按类型重新整理全部歌曲：

```bash
npm run classify
```

分类结果会写入：

| 文件 | 用途 |
|------|------|
| `data/categories.json` | 按类型播放使用的分类队列，每个分类含 `playbackIds` |
| `data/songs-classified.json` | 去重后的歌曲明细，包含来源、歌单、主分类和所有分类 |

当前分类明细：

| 类型 ID | 类型 | 歌曲数 | 说明 |
|---------|------|--------|------|
| `chinese_pop` | 华语流行 | 448 | 华语流行、日常循环、热门单曲 |
| `nostalgia` | 怀旧金曲 | 271 | 90 后、00 后记忆里的华语与经典流行 |
| `sad_healing` | 伤感疗愈 | 248 | 失落、安静、疗愈、夜晚独处时适合播放 |
| `guofeng` | 国风古风 | 81 | 古风、国风、武侠感、中文传统意象 |
| `anime_acg` | 动漫二次元 | 119 | 日漫、国漫、二次元、ACG 相关歌曲 |
| `ost_film_tv` | 影视 OST | 137 | 影视剧、台偶、剧集、电影、游戏配乐相关 |
| `bgm_instrumental` | BGM/纯音乐 | 92 | 背景音乐、视频配乐、纯音乐、氛围音乐 |
| `japanese` | 日语 | 119 | 日语歌曲、日本流行与动漫歌曲 |
| `korean` | 韩语 | 14 | 韩语流行与 K-Pop |
| `english_rock_electronic` | 英语/欧美摇滚电子 | 57 | 英语歌、欧美摇滚、电子、燃向音乐 |
| `electronic_energy` | 电音燃向 | 26 | 电子、节奏、史诗感、运动和提神场景 |
| `ktv` | KTV | 209 | 适合跟唱、聚会、练歌 |
| `artist_special` | 歌手专题 | 41 | 以特定歌手为主题的歌单 |
| `favorites_mixed` | 喜欢/杂选 | 199 | 喜欢、杂乱、单曲循环等综合收藏 |

分类播放会优先使用网易云可播放 ID，QQ 音乐 ID 作为备用，减少普通 QQ Cookie 下的 CDN 权限失败。明确点歌路径相反：QQ 登录可用时优先试 QQ，以减少网易云试听片段。

---

## API 接口

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | /api/now | 当前播放状态 |
| POST | /api/next | 切换下一首 |
| GET | /api/queue | 查看当前队列预览 |
| POST | /api/queue/skip-next | 删除下一首 |
| POST | /api/queue/rebuild | 重新生成待播队列 |
| POST | /api/queue/insert | 将歌曲插到下一首，body: `{ "message": "歌名" }` |
| GET | /api/music/stream/:id | 音频流（代理） |
| GET | /api/music/lyric/:id | 歌词 |
| GET | /api/music/search?q= | 搜索音乐 |
| POST | /api/chat | 与 AI DJ 对话 |
| GET | /api/categories | 查看本地歌曲分类摘要 |
| GET | /api/scenes | 查看场景电台摘要 |
| GET | /api/dj-policy | 查看当前 DJ 播报策略 |
| GET | /api/daily-briefing | 查看当前每日 / 时段电台简报 |
| GET | /api/history | 播放历史摘要：今日报告、记录数、常听歌手、常听类型、最近播放 |
| GET | /api/listening-report/today | 今日听歌报告：播放数、去重、外部推荐占比、反馈统计 |
| GET | /api/health | 健康检查：服务端口、配置自检、音乐源状态、QQ circuit、播放失败诊断 |
| GET | /api/account-status | 查看 QQ / 网易云登录、播放授权、Cookie 健康和可播放状态 |
| GET | /api/qq-login/status | 查看 QQ 登录、播放授权和扫码刷新状态 |
| GET | /api/netease-login/status | 查看网易云登录和扫码刷新状态 |
| GET | /api/debug/qq-circuit | 查看 QQ 熔断、最近 URL 尝试、音质策略和 Cookie 健康摘要 |
| GET | /api/debug/stats-storage | 查看 `data/stats.json` 体积、记录数量和是否建议拆分 |
| POST | /api/local-pool/current | 将当前外部推荐加入本地歌单池；如果曾被移除，会同步解除屏蔽 |
| POST | /api/local-pool/remove-current | 将当前本地歌曲移出本地歌单池，并写入长期屏蔽列表 |
| GET | /api/local-pool/removed | 查看长期屏蔽歌曲列表 |
| POST | /api/local-pool/restore | 按歌曲 key 从长期屏蔽列表恢复 |
| POST | /api/import-playlists | 导入网易云和 QQ 音乐歌单 |
| POST | /api/generate-taste | 根据歌单生成用户音乐品味档案 |
| WS | /stream | 实时状态推送 |

---

## 技术栈

- **后端**: Node.js + Express + WebSocket (ws)
- **音乐**: 网易云（NeteaseCloudMusicApi 子进程）+ QQ 音乐（已接通高级权限，保留自动 fallback）
- **AI**: DeepSeek API（OpenAI 兼容接口）
- **TTS**: 服务端 msedge-tts（zh-CN-YunyangNeural 男声播音员）
- **持久化**: JSON 文件（无需数据库）
- **前端**: Vanilla JS + CSS + PWA

---

## 2026-05-17 阶段更新

- 已完成网易云与 QQ 音乐歌单本地化导入，当前本地数据可从 `data/playlists.json` 读取。
- 播放器视觉改为 Claudio 暗色电台模板：顶部时间、暗色玻璃面板、播放态频谱屏、底部 DJ 输入栏。
- 播放态才显示频谱和波形，暂停/停止态恢复时间日期并隐藏动态频谱。
- DJ 头像统一使用 `public/avatar.jpg`。
- TTS 支持通过 `.env` 调整声音、语速、音高、音量。
- 启动服务遇到端口占用时会自动回退到后续端口，避免 `EADDRINUSE` 直接崩溃；实际访问地址会同步写入 `data/runtime.json`。

## 2026-05-18 中优先级更新

- DJ 上下文会读取近期播放历史，自动总结高频歌手、类型和最近播放歌曲，用于后续播报和本地推荐排序。
- 天气上下文改为高德天气优先：配置 `AMAP_WEATHER_KEY` 后，天气会注入 DJ 播报上下文；OpenWeather 仅作为兜底，未配置时自动跳过。
- 顶部时间下方新增天气显示，当前配置为北京 `AMAP_WEATHER_CITY=110000`。
- 音乐搜索结果增加同名同艺人去重，减少重复版本干扰。
- MIC 按钮接入浏览器 `SpeechRecognition` / `webkitSpeechRecognition`，支持语音转文字后直接发送给 DJ。
- 歌单导入完成后，UI 会显示网易云、QQ 音乐、总歌曲数和导入日志。
- 已支持按类型播放指令，分类来自 `data/categories.json`。
- 播放历史新增可视化面板：点击底部 `HIST` 可查看历史样本、去重歌曲、常听歌手/类型和最近播放列表。
