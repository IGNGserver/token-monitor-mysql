# 发布说明

本仓库在推送 `v*` tag 后，由 `.github/workflows/release.yml` 自动构建并创建 GitHub Release。

## 首次配置 Android 签名

Android 正式包必须使用长期保存的签名密钥。不要把 keystore 文件或密码提交到仓库。

在安全环境生成 keystore 后，将 keystore 转成 base64，并在 GitHub 仓库的 **Settings → Secrets and variables → Actions** 中配置以下 Repository secrets：

- `ANDROID_KEYSTORE_BASE64`
- `ANDROID_KEYSTORE_PASSWORD`
- `ANDROID_KEY_ALIAS`
- `ANDROID_KEY_PASSWORD`

签名密钥一旦用于公开发布，就必须永久保留。后续版本必须使用同一密钥，否则 Android 无法覆盖更新旧版本。

## 发布新版本

1. 在 `package.json` 中更新桌面版本号。
2. 提交并推送代码。
3. 创建并推送同名版本 tag，例如：

   ```bash
   git tag v0.31.0
   git push origin v0.31.0
   ```

4. GitHub Actions 会构建 Windows 安装包、Linux AppImage 和 Android release APK，并同步发布 Hub 镜像。
5. Release 资产中会包含：

   - `Token-Monitor-Setup-0.37.13.exe`
   - `Token-Monitor-0.37.13.AppImage`
   - `Token-Monitor-Android-0.37.13.apk`

Android 的 `versionName` 和 `versionCode` 会根据 tag 自动生成，保证 Windows 与 Android 版本保持一致。

## Windows 签名

当前 Windows 安装包可以正常构建。未配置 `SIGNPATH_API_TOKEN` 时，Release workflow 会自动跳过 SignPath，发布**未签名**的 Windows 包（用户首次运行可能看到 SmartScreen 警告）。配置 SignPath 的 `SIGNPATH_API_TOKEN` secret 后，同一 workflow 会走 SignPath 双阶段签名（应用本体 + 安装包/便携版）。

## Hub Docker 镜像（GHCR）

推送 `v*` tag 后，Release workflow 会额外：

1. 多架构构建并推送 `ghcr.io/<owner>/token-monitor-hub`（`linux/amd64` + `linux/arm64`）。
2. 打标签：`<version>`、`v<version>`、`latest`。
3. 打包 `Token-Monitor-Hub-Compose-<version>.zip`（最小 compose 部署包）并挂到 Release Assets。

镜像名固定为 **`token-monitor-hub`**。Compose 通过环境变量 `TOKEN_MONITOR_VERSION` 选择标签，默认 `latest`。

首次在组织/账号下推送 GHCR 包后，如需匿名拉取，请到 GitHub → Packages → `token-monitor-hub` → Package settings 将可见性设为 **Public**。

本地验证 compose 包（不推镜像）：

```bash
node scripts/package-hub-compose.js 0.34.2
```

本地从源码构建（不经过 GHCR）：

```bash
docker compose -f docker-compose.yml -f docker-compose.build.yml build hub
```
