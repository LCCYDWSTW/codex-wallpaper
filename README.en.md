# Codex Wallpaper

[中文说明](README.md)

An unofficial Windows companion that plays local Wallpaper Engine **Video** wallpapers behind Codex, with glass panels and a settings drawer. **0.1.0 is experimental.** It does not patch Codex installation files and is not an OpenAI product or supported plugin API. Codex updates may break integration.

## Requirements and installation

- Windows 10/11, the current user's `OpenAI.Codex` MSIX package.
- Node.js 22 or newer. No npm runtime dependencies; no `npm install` needed.
- Existing Wallpaper Engine video projects with `project.json` and local media.
- Optional FFmpeg on PATH for incompatible codecs. None of these programs or wallpapers is bundled.

Fully quit Codex, extract the archive, and run in Windows PowerShell:

```powershell
powershell.exe -NoProfile -ExecutionPolicy Bypass -File .\install.ps1
# Optional sign-in startup, disabling the competing native MSIX startup task:
powershell.exe -NoProfile -ExecutionPolicy Bypass -File .\install.ps1 -EnableStartup
```

Installation is per-user at `%LOCALAPPDATA%\CodexWallpaper\app`. Use the new **Codex Wallpaper** desktop/Start menu shortcut. Node and Steam library paths are detected. Override with `-NodePath`, `-WorkshopDirectories`, `-WallpaperEngineDirectory`, or `-CodexProfile`. `-PlanOnly` prints the plan without changing the system. See the Chinese README for a complete example.

Settings and logs are kept in `%LOCALAPPDATA%\CodexWallpaper`, outside the source tree. `config.example.json` documents path fields. Changing library paths or subscribing to new videos requires restarting Codex and its helper.

## Startup and limitations

A Windows named mutex serializes launches and is released by the OS on a crash. The launcher does not terminate or restart existing Codex processes. If ordinary Codex is already open, fully quit it and use the wallpaper shortcut. When sign-in startup is enabled, the installer saves and disables native MSIX startup state before registering its own entry. That Windows state storage is an implementation detail and may change.

The background is attached after Codex starts: a brief original background can still appear before media is ready. No first-frame or fixed startup-latency guarantee is provided. Scene, Web and Application wallpapers are unsupported. This is independent video playback, not a live mirror of Wallpaper Engine rendering.

## Security and privacy

The companion uses a random Chromium debugging port bound to `127.0.0.1`. **Local processes may use that port to read or control Codex page content.** Use only on a trusted machine and follow organizational policies. The port closes when Codex exits. No CSP or sandbox settings are disabled.

The reserved `codex-wallpaper.invalid` media URLs are fulfilled locally through the debugging interface. This companion does not upload wallpapers or chat content; Codex's own network behavior is separate. Local project references are constrained to their project directory. The release contains no user configuration, account data, screenshots or wallpaper assets.

## Removal and troubleshooting

Fully quit Codex and allow a few minutes for the helper to exit, then run `uninstall.ps1` from this project or the installed app directory. Previous shortcuts and native startup state are restored. Local files, configuration and backups are retained; delete `%LOCALAPPDATA%\CodexWallpaper` manually if no longer needed. Uninstall before installing an update.

Inspect `launch.log`, `host.log`, `host-error.log` and `launcher-error.log` in the data directory. Redact usernames, paths and wallpaper titles before reporting issues. Never upload the full Codex profile or account information.

## Development and releases

Run `npm test`, `npm run check`, then `npm run package` on Windows. The allowlisted source ZIP and SHA-256 file are generated in `dist`. CI checks the project; pushing a version-matching tag such as `v0.1.0` runs the Release workflow. No repository is created or published by local packaging.

See [VALIDATION.md](VALIDATION.md) for actual verification scope. The prototype was used on Codex 26.1021.3705.0 and 26.1023.6123.0; that does not establish compatibility with every build or PC.

Inspired by [dsh-wallpaper-engine](https://github.com/elysia395/dsh-wallpaper-engine). The Codex integration was independently written; no upstream code, proprietary program files, logos or wallpaper assets are included. Source code is under [MIT](LICENSE). Third-party software and media retain their respective rights.
