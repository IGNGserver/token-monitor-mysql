# Token Monitor MySQL Hub

Token Monitor 是一个用来查看 AI 编程工具用量的桌面小组件。它可以显示 Token、费用、模型和会话，也可以把多台电脑的数据汇总到一个 Hub，方便你在电脑或手机上查看。

本仓库 fork 自 [Javis603/token-monitor](https://github.com/Javis603/token-monitor)。它保留了原项目的桌面采集能力，同时增加了 MySQL Hub、Docker Compose 部署和 Android 客户端，并继续使用 [MIT License](LICENSE)。

## 直接下载安装

如果你只想使用，不想安装 Node.js 或执行命令，请前往 [GitHub Releases](https://github.com/IGNGserver/token-monitor-mysql/releases) 下载：

- **Windows**：下载 `Token-Monitor-Setup-版本号.exe`，双击安装。
- **Android**：下载 `Token-Monitor-Android-版本号.apk`，在手机上安装。

安装后仍需要先部署一个 Hub，再在 Windows 小组件或 Android 应用中填写 Hub 地址和共享密钥。没有 Hub 时，Windows 小组件也可以选择“仅本机”模式使用。

## 你需要准备什么

最常见的使用方式是：

```text
常驻服务器（Docker Hub）
        ↑
电脑 A（采集）   电脑 B（采集）   Android 手机（查看）
```

- 只看一台电脑：只安装桌面小组件，不需要服务器。
- 看多台电脑：准备一台能长期运行 Docker 的服务器，部署 Hub。
- 想在手机查看：先部署 Hub，再安装 Android 客户端。

系统只上传 Token 和费用等汇总数据，不上传提示词、源代码、聊天内容或登录密钥。

## 第一步：部署 Hub

这一步只在一台常驻服务器上做一次。服务器可以是 Linux 主机、NAS、云服务器或个人设备，但必须能运行 Docker，并且电脑和手机能够访问它。

### 1. 安装 Docker

安装 Docker Engine 和 Docker Compose v2，然后确认：

```bash
docker --version
docker compose version
```

### 2. 下载项目并创建配置

```bash
git clone https://github.com/IGNGserver/token-monitor-mysql.git
cd token-monitor-mysql
cp .env.example .env
```

打开 .env，至少修改以下三项。请使用你自己生成的长随机值：

```dotenv
TOKEN_MONITOR_SECRET=请替换为随机共享密钥
MYSQL_PASSWORD=请替换为数据库密码
MYSQL_ROOT_PASSWORD=请替换为数据库管理员密码
```

TOKEN_MONITOR_SECRET 是之后连接电脑和手机时要填写的共享密钥。不要把 .env 上传到 GitHub。

### 3. 启动 Hub

```bash
docker compose up -d --build
docker compose ps
```

如果 hub 和 mysql 都在运行，就可以使用了。默认地址是：

```text
http://服务器地址:17321
```

在服务器本机检查：

```bash
curl http://127.0.0.1:17321/api/health
```

返回包含 "ok":true 即表示 Hub 正常。局域网设备直接使用服务器局域网地址；跨网络访问建议使用 VPN、Tailscale 或 HTTPS 反向代理。

## 第二步：连接桌面小组件

每台需要统计的电脑都要运行桌面小组件。

### 安装

当前仓库提供源码运行方式。电脑需要 Node.js 22.13 或更高版本：

```bash
git clone https://github.com/IGNGserver/token-monitor-mysql.git
cd token-monitor-mysql
npm ci
npm start
```

Windows 用户可以在 PowerShell 中运行相同的 git 和 npm 命令。

### 只使用本机数据

打开小组件的 **设置 → 多设备同步**，选择 **仅本机**。这种模式不需要 Hub，也不会向网络发送数据。

### 连接到 Hub

1. 打开 **设置 → 多设备同步**。
2. 选择 **连接到 Hub**。
3. Hub URL 填写服务器地址，例如 http://192.168.x.x:17321。
4. 共享密钥填写服务器 .env 中的 TOKEN_MONITOR_SECRET。
5. 保存设置。

连接成功后，小组件会读取本机 AI 工具用量并自动上报。其他连接到同一 Hub 的设备也会看到这台电脑的数据。

## 第三步：使用无界面 Agent（可选）

不需要桌面窗口的电脑可以只运行后台 Agent：

```bash
git clone https://github.com/IGNGserver/token-monitor-mysql.git
cd token-monitor-mysql
npm ci
cp .env.example .env
```

编辑 .env：

```env
TOKEN_MONITOR_HUB_URL=http://你的服务器地址:17321
TOKEN_MONITOR_SECRET=与服务器相同的共享密钥
TOKEN_MONITOR_DEVICE_ID=这台电脑的名称
TOKEN_MONITOR_SYNC_UPLOAD_INTERVAL_MS=0
TOKEN_MONITOR_CLIENTS=
TOKEN_MONITOR_PROJECTS_ENABLED=
TOKEN_MONITOR_HISTORY_ENABLED=
TOKEN_MONITOR_SESSION_USAGE_ARCHIVE_ENABLED=
TOKEN_MONITOR_LIMITS_ENABLED=
TOKEN_MONITOR_LIMIT_PROVIDERS=
```

先运行一次确认连接：

```bash
npm run agent:once
```

确认没有报错后持续运行：

```bash
npm run agent
```

实际使用时，建议把它注册为 Windows 服务、Linux systemd 服务或开机启动任务。

## 第四步：安装 Android 客户端

Android 客户端用于查看 Hub 数据和管理模型价格，本身不采集电脑上的 AI 用量。

使用 Android SDK 和 JDK 17 或更高版本构建：

```bash
cd android
./gradlew test
./gradlew assembleDebug
```

APK 位于：

```text
android/app/build/outputs/apk/debug/app-debug.apk
```

安装后打开应用的 **设置**：

1. Hub URL 填写与桌面端相同的服务器地址。
2. 共享密钥填写相同的 TOKEN_MONITOR_SECRET。
3. 保存并返回概览页面。

Android 客户端包含概览、模型、会话、设备、定价和设置页面。会话页显示 Hub 当前提供的会话快照，暂不提供单个会话的完整时间范围历史。

## 日常使用

部署完成后，只需要：

1. 保持服务器上的 Docker Hub 运行。
2. 保持每台采集电脑的小组件或 Agent 运行。
3. 在桌面小组件或 Android 客户端查看概览、模型、设备和费用。
4. 需要修改模型价格时，打开 Android 的 **定价** 页面，或使用桌面小组件的定价设置。

设备暂时关机时，Hub 会显示它离线；重新启动采集器后会自动恢复。删除设备只会删除当前设备显示，已记录的历史用量仍会保留。

## 常见问题

### 页面打不开

在服务器运行 docker compose ps，确认 hub 和 mysql 都在运行。客户端不能填写服务器内部的 127.0.0.1，应填写服务器在局域网或 VPN 中的地址。

### 提示未授权或 401

确认客户端和服务器的共享密钥完全一致。修改 .env 后重新执行：

```bash
docker compose up -d --build
```

### 看不到某台电脑

确认小组件选择了 **连接到 Hub**，或 Agent 的 TOKEN_MONITOR_HUB_URL 已填写。也可以运行 npm run agent:once 查看连接错误。

### 升级项目

在服务器执行：

```bash
git pull
docker compose up -d --build
```

不要使用 docker compose down -v，否则会删除 MySQL 数据卷。

## 隐私、致谢与许可证

系统只上传设备信息、Token/费用汇总、工具和模型明细、可选项目汇总及额度状态，不上传原始日志、提示词、代码、对话或登录凭据。请只向信任的设备开放 Hub，并优先使用局域网或 VPN。

感谢 [Javis603/token-monitor](https://github.com/Javis603/token-monitor)、[tokscale](https://github.com/junhoyeo/tokscale) 和 [CodexBar](https://github.com/steipete/CodexBar)。

本项目遵循 [MIT License](LICENSE)。
