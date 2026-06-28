# Claudio FM 部署与运维

## 本地运行

1. 复制 `.env.example` 为 `.env`。
2. 填入 `DEEPSEEK_API_KEY`，可选填 `NETEASE_COOKIE`、`QQ_MUSIC_COOKIE`、`AMAP_WEATHER_KEY`。
3. 安装依赖：

```bash
npm install
```

4. 启动服务：

```bash
npm start
```

默认从 `PORT=8080` 启动；如果端口被占用，会按 `PORT_RETRY_LIMIT` 自动尝试后续端口。控制台打印的“本地访问”地址是本次真实地址，也会写入 `data/runtime.json`，其中的 `url` 可用于确认本次实际端口。

## 云部署

- 运行命令使用 `npm start`。
- 对外暴露 `.env` 中的 `PORT`，或让平台注入 `PORT`。
- 持久化目录至少包括 `data/` 与 `user/`，否则播放历史、偏好反馈和品味档案会随部署重建丢失。
- 建议把 `LOG_LEVEL` 设为 `info` 或 `warn`；排查 QQ 播放链路时再临时设为 `debug`。
- 部署后访问 `GET /api/health`，确认配置、自检、QQ circuit 和播放诊断状态。

## 账号权益与隐私边界

Claudio FM 依赖你自己的网易云 / QQ 音乐账号权益播放音乐。普通会员、高级会员、地区版权、单曲限制和平台风控都会影响会员歌曲能否完整播放；系统只使用本机 Cookie 请求平台接口，不绕过平台权益，也不把账号授权共享给其他用户。

Claudio FM 不重新分发音乐，不提供下载入口，不把平台音频保存成文件，也不会缓存下载音频。运行时音频只通过本地服务代理给当前浏览器播放，失败时会自动换源、换音质或提示重新登录。

`SET` 面板导出的 `.claudio` 电台记忆只包含播放偏好、反馈、近期播放摘要和 `user/taste.md`。备份文件不会包含 .env、Cookie、API Key 或平台登录信息；这些敏感信息只留在本机运行环境和 `.env` 里。

## PWA 缓存刷新

如果浏览器仍显示旧页面：

1. 刷新页面一次，当前服务端会对 HTML、JS、CSS 设置 `no-cache`。
2. Chrome/Edge 可在开发者工具 Application 面板注销旧 Service Worker。
3. 手机 PWA 可关闭应用后重新打开；必要时删除桌面图标后重新安装。

## Cookie 更新

网易云或 QQ 音乐播放异常时，优先更新 Cookie：

1. 浏览器登录对应音乐网站。
2. 打开开发者工具 Network 面板。
3. 复制任意有效请求的完整 `Cookie` 请求头。
4. 写入 `.env` 中的 `NETEASE_COOKIE` 或 `QQ_MUSIC_COOKIE`。
5. 重启服务并访问 `/api/health`、`/api/debug/qq-circuit` 查看状态。

## Cookie 排查顺序

1. 先打开 `SET` 面板的平台状态，或请求 `GET /api/account-status`，确认 QQ / 网易云是否已登录、QQ 是否具备播放授权、Cookie 是否被标记为疑似过期。
2. 再请求 `GET /api/health`，确认服务端配置、自检、音乐源状态、QQ circuit 和播放失败诊断是否正常。
3. QQ 可登录但会员歌仍不可播时，请求 `GET /api/debug/qq-circuit`，查看最近一次 URL 尝试、`empty purl`、CDN HTTP 状态、音质策略和 Cookie 健康摘要。
4. 如果 `qqPlaybackAuth` 缺失、连续鉴权失败或 `empty purl`，优先在 `SET` 面板执行 QQ 扫码刷新；扫码成功后不需要重启服务。
5. 如果网易云只返回 `<=35s` 试听片段，先在 `SET` 面板执行网易云扫码登录；登录后仍不可播，通常是账号权益、地区版权或单曲限制。
6. 手动编辑 `.env` 里的 `NETEASE_COOKIE` 或 `QQ_MUSIC_COOKIE` 后需要重启服务；通过 `SET` 面板扫码刷新会立即更新当前 Node 进程。

### QQ 音乐扫码刷新

`SET` 面板里的“QQ 音乐登录”可以启动扫码刷新流程。这个功能通过可选的 Python helper 调用 `qqmusic-api-python` 获取新的 `musicid/musickey`，成功后会自动写回 `.env` 的 `QQ_MUSIC_COOKIE`，并立即更新当前 Node 进程里的运行时 Cookie。

也就是说，通过 `SET` 面板扫码成功后不需要重新 `npm start`；只有手动编辑 `.env` 里的 Cookie 时，才需要重启服务让新配置生效。扫码成功后还会清空 QQ URL 缓存、单曲不可用缓存、熔断状态和 Cookie 健康提示，避免旧 Cookie 下的失败记录继续挡住新 Cookie。播放器连续遇到全音质 `empty purl` 或 QQ 接口鉴权失败时，会在 `SET` 面板提示 Cookie 疑似过期，请扫码刷新。

明确点歌（例如“切换 Simple Plan 的 Take My Hand”）会在 QQ 已登录时优先尝试 QQ 音乐同名同歌手候选，并做 CDN probe；QQ 不可播或未登录时才回落网易云。自动队列和分类播放仍可能按本地歌单 ID 使用网易云，前端会对网易云 `<=35s` 的试听片段自动换歌。

首次使用前安装辅助库：

```bash
python -m pip install qqmusic-api-python
```

如果界面提示缺少 `qqmusic-api-python`，说明当前环境还没有安装这个 helper。扫码刷新不会导出或显示真实 Cookie，只会在本机更新 `.env`。

### 网易云音乐扫码刷新

`SET` 面板里的“网易云登录”可以启动网易云二维码登录流程。登录成功后，服务端会把新的 `MUSIC_U` 等 Cookie 写回 `.env` 的 `NETEASE_COOKIE`，并立即让当前运行中的 NeteaseCloudMusicApi 子进程使用新 Cookie。

网易云扫码刷新同样只在本机完成，不会把真实 Cookie 显示在界面里。登录成功后可以通过 `GET /api/account-status` 查看网易云登录状态和可播放状态；如果仍然遇到试听片段，优先按账号权益或版权限制处理。

## 日志分级

`LOG_LEVEL` 支持：

| 级别 | 说明 |
|------|------|
| `debug` | 输出详细调试信息，适合排查 QQ URL、队列和启动细节 |
| `info` | 默认级别，输出启动、队列加载和重要状态 |
| `warn` | 只输出降级、失败和告警 |
| `error` | 只输出错误 |
| `silent` | 尽量静默 |

QQ 音质逐档 probe 的额外细节仍由 `QQ_DEBUG_URL=1` 控制。

## 健康检查

```text
GET /api/health
```

返回服务端口、启动时间、关键配置自检、音乐源状态、QQ circuit、播放失败诊断、播放记忆和天气状态。部署后优先看这个接口，再看日志。

账号和 Cookie 诊断还可以看：

```text
GET /api/account-status
GET /api/debug/qq-circuit
GET /api/qq-login/status
GET /api/netease-login/status
```
