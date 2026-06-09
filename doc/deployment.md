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

### QQ 音乐扫码刷新

`SET` 面板里的“QQ 音乐登录”可以启动扫码刷新流程。这个功能通过可选的 Python helper 调用 `qqmusic-api-python` 获取新的 `musicid/musickey`，成功后会自动写回 `.env` 的 `QQ_MUSIC_COOKIE`，并立即更新当前 Node 进程里的运行时 Cookie。

也就是说，通过 `SET` 面板扫码成功后不需要重新 `npm start`；只有手动编辑 `.env` 里的 Cookie 时，才需要重启服务让新配置生效。扫码成功后还会清空 QQ URL 缓存、单曲不可用缓存、熔断状态和 Cookie 健康提示，避免旧 Cookie 下的失败记录继续挡住新 Cookie。播放器连续遇到全音质 `empty purl` 或 QQ 接口鉴权失败时，会在 `SET` 面板提示 Cookie 疑似过期，请扫码刷新。

明确点歌（例如“切换 Simple Plan 的 Take My Hand”）会在 QQ 已登录时优先尝试 QQ 音乐同名同歌手候选，并做 CDN probe；QQ 不可播或未登录时才回落网易云。自动队列和分类播放仍可能按本地歌单 ID 使用网易云，前端会对网易云 `<=35s` 的试听片段自动换歌。

首次使用前安装辅助库：

```bash
python -m pip install qqmusic-api-python
```

如果界面提示缺少 `qqmusic-api-python`，说明当前环境还没有安装这个 helper。扫码刷新不会导出或显示真实 Cookie，只会在本机更新 `.env`。

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
