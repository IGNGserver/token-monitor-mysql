# Token Monitor MySQL Hub

Token Monitor MySQL Hub 是一个面向 AI 编程工具的自托管用量监控系统。它从桌面小组件或无界面 Agent 收集 Token 与费用汇总，将数据保存到 MySQL Hub，并在桌面端和 Android 端显示当前数据。

## 与上游项目的关系

本仓库 fork 自 [Javis603/token-monitor](https://github.com/Javis603/token-monitor)，保留了上游的 Electron 桌面小组件和本地采集器基础，并继续遵循原始 [MIT License](LICENSE)。

本 fork 调整了服务端部署方式，并新增了移动端客户端：

- 使用 MySQL 替代 Node Hub 原先的 JSON 文件存储。
- 将两次设备快照之间的用量变化保存为仅追加的用量事件。
- 在 Hub 中管理模型价格；每条事件在写入时取得不可变的价格快照。
- 通过 Docker Compose 一次部署 Hub 和 MySQL。
- `android/` 提供原生 Android 客户端，用于查看 Hub 数据和管理价格。

`worker/` 目录中的 Cloudflare Worker 仍兼容上游协议，但它不使用 MySQL，也不提供本 fork 的事件流水账和 Hub 定价功能。

## 监控内容

桌面采集器使用 [tokscale](https://github.com/junhoyeo/tokscale) 汇总本机受支持 AI 编程工具的用量，包括 Claude Code、Codex、OpenCode、Hermes、Cursor、Antigravity，以及上游项目支持的其他工具。它可记录 Token 总量、可用的费用数据、工具与模型明细、可用时的会话数据、项目汇总和可选的服务商额度窗口。

Hub 记录的是累计设备快照之间的变化量，不会解析提示词、源代码、原始对话或单个服务商 API 请求。

## 选择使用方式

| 目标 | 推荐方式 |
| --- | --- |
| 只监控一台电脑 | 使用 Electron 小组件的本地模式，不需要 Hub、Docker 或数据库。 |
| 监控多台电脑 | 在一台常驻 Linux 服务器部署 MySQL Hub，再连接每台小组件或无界面 Agent。 |
| 在手机上查看数据 | 部署 MySQL Hub，构建并安装 Android 客户端，然后输入 Hub 地址和共享密钥。 |

## 部署 MySQL Hub

将此部分部署在可运行 Docker、且所有要采集的设备均可访问的服务器上。Hub 默认监听端口 `17321`。

### 前置条件

- Docker Engine 和 Docker Compose v2
- 可被桌面设备和 Android 设备访问的服务器
- 允许可信客户端访问 Hub 端口的防火墙规则，或提供相同访问能力的反向代理/VPN

### 启动服务

在服务器上克隆本仓库，然后创建本地配置：

```bash
cp .env.example .env
```

编辑 `.env`，至少为以下变量设置强且互不相同的值：

```dotenv
TOKEN_MONITOR_SECRET=replace-with-a-long-random-shared-secret
MYSQL_PASSWORD=replace-with-a-strong-app-password
MYSQL_ROOT_PASSWORD=replace-with-a-strong-root-password
```

如端口 `17321` 已被占用，可修改 `TOKEN_MONITOR_PORT`。不要提交 `.env`，也不要在截图、Issue 或消息中泄露共享密钥。

启动 Hub 和 MySQL：

```bash
docker compose up -d --build
docker compose ps
```

检查 Hub 健康状态：

```bash
curl http://127.0.0.1:17321/api/health
```

健康检查接口无需认证；其他 Hub 接口均要求共享密钥，可使用 `Authorization: Bearer <secret>` 或 `X-Token-Monitor-Secret: <secret>` 请求头。

拉取新代码后，重新构建 Hub 镜像即可升级。Hub 启动前会自动执行数据库迁移。

```bash
git pull
docker compose up -d --build
docker compose logs -f hub
```

MySQL 数据存储于具名 Docker 卷 `token-monitor-mysql`。重建 Hub 容器不会删除数据。除非你明确要清空全部 Hub 数据，否则不要运行 `docker compose down -v`。

## 连接桌面采集器

### Electron 小组件

按[从源码构建](#从源码构建)安装或构建桌面小组件，之后打开 **设置 -> 多设备同步**。

1. 选择 **连接到 Hub**。
2. 填写完整 Hub 地址，例如 `http://your-server:17321`。
3. 填写服务器配置的同一个 `TOKEN_MONITOR_SECRET`。
4. 保存设置。

小组件会继续采集本机用量，并将该设备的汇总上报到 Hub。它通过 Server-Sent Events 接收聚合后的实时更新。

### 无界面 Agent

在不需要 Electron 界面的设备上使用 Agent。安装 Node.js 22.13 或更高版本及项目依赖，将 `.env.example` 复制为 `.env`，然后配置以下值：

```env
TOKEN_MONITOR_HUB_URL=http://your-server:17321
TOKEN_MONITOR_SECRET=the-same-secret-used-by-the-hub
TOKEN_MONITOR_DEVICE_ID=optional-stable-device-name
TOKEN_MONITOR_SYNC_UPLOAD_INTERVAL_MS=0
TOKEN_MONITOR_CLIENTS=
TOKEN_MONITOR_PROJECTS_ENABLED=
TOKEN_MONITOR_HISTORY_ENABLED=
TOKEN_MONITOR_SESSION_USAGE_ARCHIVE_ENABLED=
TOKEN_MONITOR_LIMITS_ENABLED=
TOKEN_MONITOR_LIMIT_PROVIDERS=
```

留空的可选值将采用默认行为。`TOKEN_MONITOR_CLIENTS` 接受逗号分隔的工具列表；设为空值可禁用 Token 采集。`TOKEN_MONITOR_HISTORY_ENABLED=0` 会关闭本地趋势历史采集，`TOKEN_MONITOR_LIMITS_ENABLED=0` 会跳过 AI 服务商额度探测。全部受支持的配置项及说明见 `.env.example`。

执行一次采集并上报：

```bash
npm ci
npm run agent:once
```

持续运行：

```bash
npm run agent
```

使用操作系统的服务管理器或计划任务保持 Agent 持续运行。若只想检查采集结果、不向 Hub 上报，可执行：

```bash
node src/agent/agent.js --once --dry-run
```

## 使用 Android 客户端

Android 应用是 Hub 客户端：它不采集本机 AI 工具用量，也不会自行写入用量事件。它可显示聚合概览、模型、当前可用会话、设备、价格以及 Hub 连接设置。

使用本地 Android SDK 和 JDK 17 或更高版本构建调试 APK：

```bash
cd android
./gradlew test
./gradlew assembleDebug
```

APK 输出路径：

```text
android/app/build/outputs/apk/debug/app-debug.apk
```

安装后，在应用的 **设置** 中输入 Hub 地址和 `TOKEN_MONITOR_SECRET`。连接信息通过 Android 加密共享偏好设置保存。

会话页展示 `/api/stats` 返回的当前会话。Hub 目前没有单个会话的按时间范围事件历史接口，因此 Android 应用不能显示细粒度的历史会话时间线。

## 管理模型定价

Hub 会保存当前模型价格表并提供给连接的客户端。你可以手动设置价格，或让 Hub 通过 `tokscale pricing` 获取上游价格；必要时会回退至可配置的 `models.dev` 价格目录。

以下接口均需要认证：

```text
GET  /api/pricing
PUT  /api/pricing/:model
POST /api/pricing/:model/fetch-upstream
POST /api/pricing/fetch-upstream-all
```

手动价格的单位为每百万 Token 的美元价格：

```bash
curl -X PUT "http://your-server:17321/api/pricing/gpt-5" \
  -H "Authorization: Bearer $TOKEN_MONITOR_SECRET" \
  -H "Content-Type: application/json" \
  --data '{"inputPricePerMillion":2.5,"outputPricePerMillion":10,"cacheReadPricePerMillion":0.25,"cacheWritePricePerMillion":3.75}'
```

写入用量事件时，Hub 会复制当时生效的价格、来源和时间戳，并计算该事件费用。之后修改模型当前价格不会重新计算历史事件。若 Hub 中没有配置该模型价格，Hub 会保留 tokscale 传来的费用变化，并标记为 `payload_fallback`，不会凭空写入零费用。

## 存储与保留策略

`usage_events` 是仅追加的流水账。每条事件表示设备两次累计上报之间观察到的用量差值；`recorded_at` 是记录该差值的时间，而非精确的服务商 API 请求时间。

通过 `DELETE /api/devices/:id` 删除设备时，Hub 会删除该设备当前记录和可变会话汇总，但保留历史用量事件。事件的设备引用会变为 `null`，以保留审计记录。

## 本地开发与验证

Node 项目要求 Node.js 22.13 或更高版本。

```bash
npm ci
npm run verify
```

若 MySQL 已就绪并已通过 `.env` 配置，可不使用 Docker 直接运行 Hub：

```bash
npm run migrate
npm run hub
```

运行 Docker MySQL 集成测试：

```bash
docker compose -f docker-compose.test.yml up -d
npm run test:mysql
```

启动生产 Compose 服务后，可导出当前 shell 的共享密钥并运行端到端检查：

```bash
export TOKEN_MONITOR_SECRET=your-secret
./scripts/smoke-test.sh
```

## 从源码构建

Electron 小组件要求 Node.js 22.13 或更高版本。

```bash
npm ci
npm start
```

常用命令：

```bash
npm start          # Electron 小组件
npm run hub        # Node Hub
npm run agent      # 持续运行的无界面采集器
npm run agent:once # 采集一次并上报
npm run verify     # ESLint 和 Node 测试套件
```

## 隐私

采集器仅发送标准化的用量汇总：设备元数据、Token/费用总量、工具/模型明细、可选的项目汇总和 AI 工具额度状态。它不会发送原始 AI 日志、提示词、源代码、对话、OAuth 凭据、刷新令牌或服务商原始响应。

仅向可信用户开放 Hub。客户端跨互联网连接时，建议通过反向代理使用 HTTPS，或使用 VPN 等私有网络。

## 致谢

- [Javis603/token-monitor](https://github.com/Javis603/token-monitor)，原始 Token Monitor 项目。
- [tokscale](https://github.com/junhoyeo/tokscale)，负责日志解析和 Token 统计。
- [CodexBar](https://github.com/steipete/CodexBar)，提供 AI 工具额度研究参考。

## 许可证

[MIT](LICENSE) © [@Javis](https://github.com/Javis603)
