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

4. GitHub Actions 会构建 Windows 安装包和 Android release APK。
5. Release 资产中会包含：

   - `Token-Monitor-Setup-0.31.0.exe`
   - `Token-Monitor-Android-0.31.0.apk`

Android 的 `versionName` 和 `versionCode` 会根据 tag 自动生成，保证 Windows 与 Android 版本保持一致。

## Windows 签名

当前 Windows 安装包可以正常构建，但未配置 Windows 代码签名证书时，用户首次运行可能看到 SmartScreen 警告。配置 electron-builder 支持的 `CSC_LINK` 和 `CSC_KEY_PASSWORD` secrets 后，Release workflow 会使用证书签名 Windows 包。
