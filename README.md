# Codex Wallpaper

[English](README.en.md)

Windows 上的非官方 Codex 外观伴侣：把 Wallpaper Engine 的 **Video 视频壁纸**放到 Codex 窗口背景，提供毛玻璃面板、细边框和从右侧滑出的设置抽屉。

这是社区运行时扩展，不是 OpenAI 官方插件，也不修改 Codex 的安装文件。当前发布为 **0.1.0 实验版**。Codex 更新可能改变页面结构，使样式或按钮定位需要适配。

## 为什么用它

- **不压缩、不转码、不限大小。** 直接按字节区间读取壁纸原文件，4K/120 帧照样播放 —— 不会先转成 1080p，也没有单文件体积上限。
- **切换即时生效。** 视频壁纸之间切换不需要重启 Codex。
- **复用你已有的库。** 直接扫描 Wallpaper Engine 的 `431960` 创意工坊目录，可跟随主屏当前壁纸，无需重新下载或导入。
- **零运行时依赖。** 不需要 `npm install`，没有第三方运行时包。

> 多数同类工具会先把视频降为 1080p，或限制单文件大小（常见为 128 MB）；本项目不做这两件事。

## 功能

- 静音循环播放本机 Video 壁纸；从本地按区间读取，避免先复制整个大视频。
- 右上角图片按钮打开侧边设置，支持暗化、面板雾化、面板底色、暂停和恢复原版外观。
- 拖动滑条时合并画面更新，暂停背景视频以减少竞争，停止拖动后恢复。
- 可选跟随 Wallpaper Engine 主屏所选视频；不依赖 Wallpaper Engine 窗口保持打开。
- 可选 Windows 登录启动，只启用壁纸入口，备份并关闭原版 Codex 的重复登录任务。
- 安装时发现 Node.js、Codex 商店安装位置和 Steam 游戏库；支持手动指定库目录。

## 环境要求

- Windows 10/11，当前用户安装的 **MSIX 版 Codex**，包名 `OpenAI.Codex`。
- Node.js **22 或更高版本**，安装程序能从 PATH 找到 `node.exe`，或使用 `-NodePath` 指定。
- 本机已有 Wallpaper Engine 视频壁纸，每个项目包含 `project.json` 以及项目内的视频文件。
- FFmpeg 可选：正常支持的视频直接播放；编码不兼容时才调用 FFmpeg 转换。若需要此功能，请自行安装 FFmpeg 并加入 PATH。

没有 npm 运行时依赖，**不需要运行 npm install**。不提供 Codex、Node.js、FFmpeg 或任何壁纸资源。

## 安装

解压源码 ZIP，在该目录打开 Windows PowerShell。首次安装前请完全退出 Codex。

```powershell
# 只创建桌面和开始菜单中的 Codex Wallpaper 入口
powershell.exe -NoProfile -ExecutionPolicy Bypass -File .\install.ps1

# 或启用开机登录启动；同时关闭原版 Codex 的登录启动任务
powershell.exe -NoProfile -ExecutionPolicy Bypass -File .\install.ps1 -EnableStartup
```

安装到 `%LOCALAPPDATA%\CodexWallpaper\app`，设置、日志及缓存在其上一级目录。安装后点击 **Codex Wallpaper**。如需固定任务栏，请使用该入口；直接点击商店原始入口可能绕过壁纸启动器。

`-ExecutionPolicy Bypass` 只对这次 PowerShell 进程生效；安装脚本不永久改变系统执行策略。安装不需要管理员权限。

自动发现失败时可明确指定路径：

```powershell
.\install.ps1 -EnableStartup `
  -NodePath 'C:\Program Files\nodejs\node.exe' `
  -WorkshopDirectories 'D:\SteamLibrary\steamapps\workshop\content\431960' `
  -WallpaperEngineDirectory 'D:\SteamLibrary\steamapps\common\wallpaper_engine'
```

`-WorkshopDirectories` 接受多个目录。`-CodexProfile` 可指定现有 Codex 用户目录，默认 `%APPDATA%\Codex\web\Codex`。不要指定其他人的配置目录。

预览安装计划，不写入配置、快捷方式或注册表：

```powershell
.\install.ps1 -EnableStartup -PlanOnly
```

## 开机与启动行为

开启登录启动后，安装器备份 MSIX 启动任务的用户状态，将其设为 `DisabledByUser`，然后创建壁纸登录快捷方式。它不会禁用其他应用的启动项。当前 Windows 的 MSIX 状态存储属于系统实现细节；版本变动时安装器可能拒绝操作，需要重新适配。

Windows 命名互斥锁保证同一用户的一次启动流程持有唯一所有权，进程崩溃后系统自动释放，不使用可能残留的 PID 锁文件。辅助进程完成页面接入后，启动器才结束。

如果已有普通 Codex 打开，启动器提示先完全退出；它**不会强制结束、自动重启 Codex 或循环重开窗口**。若开机时出现该提示，请检查是否还有手动配置的第三方启动项，或 Windows 恢复应用功能从另一路径打开了 Codex。

壁纸仍是在 Codex 启动后接入的运行时效果，窗口出现到壁纸首帧之间可能短暂显示原背景。**不承诺开机第一帧已有壁纸，也不保证不同电脑上的切换耗时。**

## 设置与卸载

右上角图片图标打开设置；若原生工具栏定位失效，图标会回退到右上角固定位置。点击抽屉外侧、关闭按钮或按 Esc 收起。

`config.json` 保存本机路径，可参考 [config.example.json](config.example.json)。修改路径后需完全退出 Codex，等待辅助进程自动退出，再从壁纸入口重开。视频列表在辅助进程启动时扫描，新增订阅壁纸后同样需要重开。

卸载前完全退出 Codex，等待辅助进程自动退出（可能需要几分钟）：

```powershell
powershell.exe -NoProfile -ExecutionPolicy Bypass -File .\uninstall.ps1
```

也可运行 `%LOCALAPPDATA%\CodexWallpaper\app\uninstall.ps1`。卸载会恢复安装前的快捷方式和原版启动状态，保留设置、缓存、日志和备份。确认不再需要后可手动删除 `%LOCALAPPDATA%\CodexWallpaper`。更新版本请先卸载旧版再安装；旧文件会保留为 `previous-*`，不自动清除。

## 范围与安全

- 仅支持 Video；不支持 Scene/`scene.pkg`、Web、Application，也不镜像 Wallpaper Engine 的实时渲染画面。
- 通过绑定 `127.0.0.1` 的随机 Chromium 调试端口接入自己的样式和视频层，不更改 CSP，不解除浏览器沙箱。
- **本机调试端口具有读取、控制 Codex 页面内容的能力**，同机进程也可能访问。只在信任本机软件的个人环境启用；受管设备需遵守组织策略。端口随 Codex 退出而关闭。
- `https://codex-wallpaper.invalid/` 是由辅助进程拦截的媒体占位域名，没有远程壁纸服务器。资源来自已配置目录；本工具不上传壁纸或聊天内容，Codex 自己的联网行为不受此声明覆盖。
- 项目文件引用必须在各自壁纸项目目录内部。预览图片至多 10 MB，视频每次请求至多读取 2 MB。
- 巨大视频、复杂雾化和多个窗口仍可能消耗显卡、内存和电池。恢复原版外观或暂停壁纸可降低负担。

## 故障排查

日志位于 `%LOCALAPPDATA%\CodexWallpaper`：`launch.log`、`host.log`、`host-error.log`、`launcher-error.log`。

| 现象 | 检查 |
| --- | --- |
| 提示 Node.js 不存在 | Node 被升级或移动；卸载并使用正确 `-NodePath` 重装 |
| 找不到视频壁纸 | 确认目录为 `steamapps\workshop\content\431960`，并订阅了 Video 类型 |
| 提示 Codex 已打开 | 完全退出后，使用 Codex Wallpaper 入口 |
| helper 未就绪 | 查看 `host-error.log`；可能是库路径、编码、端口或 Codex 页面结构不兼容 |
| 开机重复启动 | 检查原版 ChatGPT/Codex 启动任务、第三方启动项与 Windows 应用恢复 |

提交 Issue 前请脱敏日志中的用户名、绝对路径和壁纸名称。不要上传 Codex 配置目录、Cookie、令牌、聊天内容、整段壁纸或 `%LOCALAPPDATA%\CodexWallpaper` 的整体副本。

## 开发、测试与发布

```powershell
npm test
npm run check
npm run package
```

`dist` 内生成源码 ZIP 与 SHA-256 校验文件。打包使用明确允许列表，不包含本机安装配置、日志、缓存、截图或壁纸。自动化测试覆盖进程空输出、启动分支、设置校验、视频区间、目录边界；Windows 互斥锁另有子进程测试。

原型曾在 Codex `26.1021.3705.0`、`26.1023.6123.0` 上运行。发布版有独立测试记录 [VALIDATION.md](VALIDATION.md)，原型的验证不等同于本发行版已在所有机器完成开机验收。

上传到 GitHub 时，将**本项目目录内的文件**作为仓库根目录。建议仓库名 `codex-wallpaper`。CI 会执行检查；推送与 package.json 版本一致的 `v0.1.0` 标签时，Release 工作流生成并上传源码包。此项目包本身不会建立仓库或自动推送。

## 致谢与许可

### 灵感来源

本项目的功能构想来自 **dsh-wallpaper-engine** —— 一个 DeepSeek Harness 的壁纸插件：

- 项目：[github.com/elysia395/dsh-wallpaper-engine](https://github.com/elysia395/dsh-wallpaper-engine)
- 作者：elysia395
- 许可：MIT License，Copyright (c) 2026 elysia395

Codex 接入层为本项目**独立实现**。两者的运行环境与技术路径不同：该项目作为插件运行在 DSH 自身的 Web 服务与 React 客户端中，本项目则是独立进程，通过本地 CDP 调试接口连接 Codex 应用并提供媒体流。两者没有共享源代码。

**本发行包不包含该项目的任何源代码、二进制文件、图标或壁纸素材。** 如果你希望在 DeepSeek Harness 中直接使用壁纸功能，请前往上述项目获取原版。

### 本项目许可

本项目代码采用 [MIT License](LICENSE)，Copyright (c) 2026 Codex Wallpaper contributors。

### 第三方权利

OpenAI、Codex、ChatGPT、Wallpaper Engine 等名称与标识归其权利人所有；本项目的 MIT 许可**不授予**任何第三方软件、Wallpaper Engine 订阅壁纸或游戏/动漫素材的使用与分发权利。发行包内不含任何第三方程序文件或壁纸资源。

本项目为非官方社区扩展，与 OpenAI 及 Wallpaper Engine 的开发者无隶属关系，也未获其背书。
