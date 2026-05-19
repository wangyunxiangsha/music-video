# Claudio FM — 开发规范文档

## 代码风格
- 使用 CommonJS（`require`/`module.exports`），不用 ESM
- 异步操作全部使用 async/await，避免 callback hell
- 错误处理：关键路径 try/catch，降级到 mock 数据而非崩溃
- 变量命名：camelCase，常量 UPPER_SNAKE_CASE

## 文件结构规范
```
music-video/
├── server/         # 后端逻辑（Node.js）
├── public/         # 前端静态文件（PWA）
├── user/           # 用户配置文件（Markdown）
├── prompts/        # AI 提示词模板
├── data/           # 运行时数据（SQLite，自动生成）
└── *.md            # 项目文档
```

## 后端规范
- 所有环境变量通过 `.env` 文件配置，不硬编码 API Keys
- NeteaseCloudMusicApi 作为子进程启动，通过 HTTP 调用
- DeepSeek API 使用 openai npm 包，设置 baseURL 为 DeepSeek 地址
- 状态数据使用 JSON 文件 `data/stats.json`（自动创建目录，不需要原生依赖）
- WebSocket 服务与 HTTP 服务共享同一端口（默认 8080）
- 启动时如默认端口被占用，应自动尝试后续端口，并在控制台输出实际访问地址
- 所有 API 返回 JSON 格式
- 音频 URL 通过服务端代理（避免浏览器 CORS 问题）
- 网易云和 QQ 音乐 Cookie 只从 `.env` 读取；Cookie 中含 `#` 时必须用引号包裹，避免 dotenv 截断
- 歌单导入结果统一写入 `data/playlists.json`，前端播放逻辑只消费本地规范化后的歌曲结构
- 歌曲分类结果统一写入 `data/categories.json` 和 `data/songs-classified.json`
- 分类数据应保留去重歌曲、来源平台、来源歌单、`playbackIds`，方便后续按类型播放
- 按类型播放必须通过 `server/categories.js` 读取 `data/categories.json`，不要在主服务中重复解析分类文件
- 搜索与点歌候选需要按“歌曲名 + 艺人”去重，避免同曲多版本反复进入候选列表
- 运行时 DJ 上下文应统一从 `buildRuntimeContext()` 聚合近期播放、自动学习偏好和可选天气信息
- 天气 API 为可选依赖：优先使用高德 `AMAP_WEATHER_KEY`，OpenWeather 仅作为兜底；未配置天气 Key 时必须静默跳过，不影响播放主流程

## 前端规范
- 纯 Vanilla JS + HTML/CSS，不引入框架（保持轻量）
- PWA 必须包含：manifest.json + service worker（sw.js）
- 播放器视觉改动后应运行 `npm run test:visual`，覆盖桌面/移动端播放态与暂停态截图回归
- 所有媒体操作通过单个 `<audio>` 元素管理
- WebSocket 连接断线自动重连（指数退避）
- TTS 使用服务端 `msedge-tts`（zh-CN-YunyangNeural），通过 `/api/tts` 接口返回 MP3，前端用 blob URL 播放（不用浏览器 SpeechSynthesis，各浏览器声音不一致）
- TTS 语音、语速、音高、音量通过环境变量配置，不在代码中硬编码单一参数
- UI 状态驱动：播放态通过 `.app.playing` 统一控制视觉变化，暂停/停止态不得渲染动态频谱或波形
- 底部 DJ 快捷输入框必须复用 `/api/chat`，避免出现只作装饰但不可用的控件
- MIC 按钮使用浏览器 `SpeechRecognition` / `webkitSpeechRecognition`，识别结果必须复用底部 DJ 输入和 `/api/chat`
- 歌单导入完成后应在 UI 中展示导入摘要和日志，不只显示一句完成提示
- 播放历史可视化统一消费 `/api/history` 摘要，不在前端直接解析 `data/stats.json`
- 顶部 Claudio 头像与 DJ 消息头像使用固定 `public/avatar.jpg`，专辑封面只用于唱片/歌曲展示，不覆盖 DJ 身份头像

## 设计规范
### 色彩
- 背景：接近黑色的蓝黑/墨绿渐变，避免大面积白色块
- 面板：半透明暗色玻璃面板，使用细边框和点阵纹理
- 主强调：`#31f2a2` 一类电台绿色，用于 LIVE、VOICE、ON AIR、频谱高亮
- 文本：白色/灰白分层，降低非关键信息亮度
- 禁止：播放页出现突兀的大面积白色区域

### 字体
- 标题/站名：点阵/复古像素感字体，贴近 Claudio 模板
- 时间/代码：等宽字体，保持电台终端感
- 正文：清晰易读，控制字号，避免中文文本撑破控件

### 动画
- 黑胶唱片：4s 线性旋转，播放时开启，暂停时停止
- DJ 文字：打字机逐字显示效果（30ms/字）
- 播放态频谱：音柱围绕中线呼吸，上白下绿渐变；暂停/停止态隐藏频谱，只显示时间日期
- 控件动效以状态表达为主，避免无意义装饰动画

## AI 提示词规范
- dj-persona.md 定义 DJ 人设（轻松复古，亲切自然）
- 默认播报词控制在 20-40 个中文字符，朗读约 5 秒；具体长度和频率可由 `server/dj-policy.js` 的当前策略覆盖
- 场景电台和用户指令应统一通过 DJ 播报策略控制“少说话 / 多介绍 / 只播歌 / 恢复播报”，不要在各个业务分支里硬编码播报长度
- 所有 AI 调用都有降级模板（API 不可用时不崩溃）
- 历史消息保留最近 10 轮对话
- 自动学习到的近期偏好只作为轻量上下文注入，不覆盖 `user/taste.md` 的长期偏好

## 安全规范
- API Keys 存储在 `.env` 文件，不提交到 Git
- `.env` 已加入 `.gitignore`
- 音频代理时设置合理的 timeout（10s）
- 用户输入进行基本长度限制（消息 ≤ 500 字）

## 启动流程
1. `npm install` — 安装依赖
2. 复制 `.env.example` 为 `.env`，填入 DeepSeek API Key
3. `npm start` — 启动服务（自动启动 NeteaseCloudMusicApi 子进程）
4. 浏览器访问 `http://localhost:8080`
5. 如需 PWA 安装：须通过 HTTPS 或 localhost 访问
6. 如需重建分类：运行 `npm run classify`
