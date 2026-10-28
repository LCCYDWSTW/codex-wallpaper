# Changelog

## 0.1.0 — 2026-10-28

- Initial experimental Windows source release, extracted from a local prototype.
- Video backgrounds, glass styles, toolbar button and side drawer.
- Portable per-user installation, Steam library discovery and explicit path overrides.
- Optional sign-in integration with backup/restore of native startup state.
- Named mutex startup serialization; positive-PID validation and bounded startup waits.
- No forced termination or automatic restart of existing Codex instances.
- Tests for startup decisions, invalid PID results, media ranges and project boundaries.
- Allowlisted source packaging, checksums, CI and tag-driven releases.

### Stability fixes

- Synchronize blur/panel slider values with CSS-driven surfaces.
- Retry renderer attachment on the next health tick if a page navigation interrupts injection.
- Prevent a closed, older page connection from unregistering a newer connection for the same target.
- Avoid reusing a helper reporting a different local Codex debugging port.
- Recheck preview sizes at request time to avoid unexpectedly large allocations.
- Remove partial FFmpeg outputs after a failed conversion and display a clear retry instruction.
- Add a regression check for CSS variable synchronization.

These changes are source/test fixes only; Windows desktop acceptance is still required before claiming a stable release.

### Stability repair, stage 2

- Bind each helper to one Chromium debugging session (port and browser identity). On a quick Codex restart, the old helper exits instead of attaching to the new session. The launcher waits for the old process to exit and refuses to start a second helper if it remains alive, including when its runtime status file is missing.
- Give each helper its own temporary runtime status filename, avoiding concurrent writes to `runtime.json.tmp`.
- Before uninstall restoration, verify shortcut backups and native startup task records. Restore shortcuts before re-enabling the original Codex startup task. Keep installation state on failure so restoration can be retried.
- Verify shortcut target as well as arguments and working directory before overwriting a shortcut changed by the user. An edited login shortcut blocks automatic startup restoration with an explicit error.
- Add Node tests for fast restart, repeated launch, blocked replacement, abnormal synthetic process exit and distinct status temp files. Add a Windows-only, temporary-shortcut restoration test for missing backups, interrupted restore, retry and edited shortcuts.

No new wallpaper features or change to installation commands. Real Windows sign-in, GUI and uninstall acceptance remains outstanding.

### Stability repair, stage 3

- Build the renderer boot payload with a function replacement callback. Titles containing `$'`, ``$` ``, `$&`, `$$`, quotes, backslashes, U+2028/U+2029 or other Unicode text can no longer alter or break the generated JavaScript.
- Track direct FFmpeg children and terminate them during graceful helper shutdown. Conversion fallback cannot start after shutdown has begun, and shutdown waits briefly for conversion cleanup.
- Remove only old `runtime.json.<pid>.tmp` files whose PID is no longer alive. Current, live, recent and unrecognized files are retained.
- Acquire the uninstall mutex before checking `install-state.json`, closing the state-check race with launch.
- Align helper wait errors with the existing 15-second previous-helper and 30-second readiness windows instead of suggesting an unsupported two-minute extension.
- Add executable renderer, child-process, runtime-temp, helper/FFmpeg shutdown and Windows-script contract regressions.

Graceful shutdown cannot run after a hard helper crash or SIGKILL; direct FFmpeg cleanup for that case is not claimed. Windows process, PowerShell and real FFmpeg behavior still require acceptance testing.

### Windows acceptance status

- Verified on Windows 11 with Codex MSIX 26.1023.6123.0 and Node.js 24.20.0: manual install, launch, video playback, visual controls, wallpaper switching, pause/resume, settings persistence, quick restart, repeated launch protection, navigation and uninstall restoration.
- No duplicate wallpaper helper remained in the sampled restart and repeated-launch checks. Uninstall restored the original Codex entry and left no wallpaper helper running.
- Windows sign-in/reboot integration, real FFmpeg conversion failure, long-duration resource use and full-window reload remain unverified. This release remains experimental.
