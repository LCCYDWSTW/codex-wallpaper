# Stability acceptance for the existing v0.1.0 feature set

Scope: Windows Codex MSIX + Wallpaper Engine **Video** wallpapers only. This checklist does not add features and is not proof of real-machine compatibility until completed on a Windows PC.

## Before changing an existing installation

- Keep the original ZIP as a rollback source.
- Back up `%LOCALAPPDATA%\CodexWallpaper\config.json` and `settings.json` if they exist. Never share them publicly: they may contain identifying local paths.
- Fully quit Codex. Do **not** terminate any process by guessing a PID.
- If v0.1.0 is already installed, run its own `uninstall.ps1` first, with Codex closed. This restores its recorded shortcut/startup state. Do not delete `%LOCALAPPDATA%\CodexWallpaper` if you want to preserve settings.
- During initial testing, do not enable automatic startup. Test the manual shortcut first.

## Manual installation and first-launch checks

Open PowerShell in the extracted project directory:

```powershell
powershell.exe -NoProfile -ExecutionPolicy Bypass -File .\install.ps1 -PlanOnly
powershell.exe -NoProfile -ExecutionPolicy Bypass -File .\install.ps1
```

1. Use the **Codex Wallpaper** desktop shortcut, not the original Codex shortcut. Codex should open with a video background and a settings button. Verify chat typing still works.
2. Open settings, move `背景暗化`, `面板雾化`, and `面板底色`; check effects are visible in multiple Codex panels. Select another Video wallpaper, then restore the first one.
3. Click pause, play, restore original appearance, and enable wallpaper again. Confirm ordinary chat remains usable throughout.
4. Close the Codex window **fully**, relaunch via Codex Wallpaper, and confirm chosen wallpaper/settings persist. Check Task Manager: repeated clicks should not leave an increasing number of Codex/Node processes.
5. Navigate within Codex and reload its main window if supported. The background and control button should return without manually restarting the helper.
6. Test an incompatible video only if you have a known test video and optional FFmpeg installed. Failure should leave Codex usable; no permanent `*.partial.mp4` should remain after conversion failure.
7. Inspect `%LOCALAPPDATA%\CodexWallpaper\launch.log` and `host-error.log` for repeated errors. Before sharing, redact usernames, personal directories, wall­paper names, or chat content.
8. After the above passes, optionally test `-EnableStartup` on a **separate Windows test account** and verify real sign-in, reboot, and normal Codex launcher behavior. This can change the native Codex startup-task user state.
9. With Codex closed, run the installed app's `uninstall.ps1` and confirm restored shortcuts and native startup state (if enabled). Never delete other programs' startup shortcuts.

## Stop and rollback

If the Codex app opens without a background, an existing Codex window stops working, repeated launch attempts create extra processes, or uninstall fails, **stop testing** rather than repeatedly launching.

- Collect the four **redacted** logs mentioned in README; record Windows, Codex, Node and Wallpaper Engine versions.
- Fully quit Codex. Run the installed patch's `uninstall.ps1` if it is safe to do so, then reinstall your saved original ZIP without `-EnableStartup` to isolate the regression.
- If uninstall fails, do not manually overwrite registry startup keys without first checking their recorded state and backups.

## Already validated separately

The supplied original VALIDATION.md records 22 Node tests and a Windows synthetic mutex test for the original source. This stability patch has its own Node test results below, but this environment cannot test real Windows MSIX launch, actual GPU video playback, or Windows startup/uninstall.

## Stage 2 quick-restart and uninstall acceptance

After installing the stage 2 source without `-EnableStartup`, fully close Codex and immediately reopen it through Codex Wallpaper. Repeat twice, including two rapid clicks on the shortcut. The wallpaper should recover, and Task Manager should show no growing count of Node helper processes. Check `host.log` for a debugging-endpoint change and `launch.log` for a successful new launch; redact paths before sharing.

For login integration, use a separate Windows test account. Back up its local Codex Wallpaper configuration and original source ZIP. Only after manual launches pass, install with `-EnableStartup`, sign out and sign in, then uninstall with Codex fully closed. Confirm the wallpaper login shortcut is removed and the original Codex startup state is restored. If uninstall reports an incomplete restoration, keep `install-state.json` and its backup directory intact; inspect the reported missing or changed shortcut and retry only after resolving it. Do not manually edit the registry or delete the retained state file.

## Stage 3 targeted regression acceptance

Use only a separate Windows test account and a synthetic or backed-up wallpaper library.

1. Include a Video wallpaper title containing `$'`, ``$` ``, `$&`, `$$`, quotes, a backslash and non-ASCII text. Confirm the helper becomes ready and the settings list shows the exact title rather than a missing or altered value.
2. Start an optional FFmpeg compatibility conversion, fully close Codex while it is running, and check Task Manager and the cache directory. No direct `ffmpeg.exe` child and no permanent `*.partial.mp4` should remain after graceful shutdown. Also record that a forced helper crash is outside the claimed cleanup path.
3. Rapidly close and reopen Codex twice, including two immediate shortcut activations. Confirm only one helper remains and no old runtime temp grows in number. Do not delete a temp file that belongs to a live PID.
4. Run `uninstall.ps1` with Codex closed and confirm it serializes against launch. If no installation state exists, it should report that while still releasing the named mutex.
5. Confirm error text reports the bounded wait that actually elapsed; do not extend waits or kill guessed PIDs to make a retry pass.
