# Changelog

## Unreleased

### Smoothness

- Stop re-running the glass scanner's layout reads on every DOM mutation. The
  scanner now runs in idle time after a longer debounce and no longer re-measures
  the toolbar anchor, which removed the steady long tasks it caused while Codex
  streamed tokens. Measured on this machine: 1 scan costing 4 ms total over 83 s,
  against 68 long tasks in 200 s before the change.
- Add a "关闭毛玻璃" toggle: panels keep their tint but drop `backdrop-filter`, the
  part that re-blurs the moving wallpaper every frame.
- Add scene render resolution (1x / 1.5x / 2x, default 1.5x) next to the existing
  scene frame-rate control, and keep the scene frame rate at 30 by default.
- Add lightweight diagnostics to `status()`: visibility/focus flips, video
  play/pause transitions, long-task count and longest task, glass scans and their
  cost, plus decoded/dropped video frames.
- Slider drags no longer re-blur the whole window on every pointer move: the blur
  radius and panel tint are applied when the drag ends. Measured on this machine,
  dragging the blur slider went from p50 93 ms / p95 224 ms per frame to p50 7 ms /
  p95 24 ms, and grid scrolling from p50 9.3 ms / p95 21.7 ms to p50 7.3 ms /
  p95 9.5 ms.
- The drawer itself no longer applies `backdrop-filter` (it was 86% opaque anyway),
  and cards use paint containment.
### Scene wallpapers

- Play Wallpaper Engine **scene** projects (`project.json` + `scene.pkg`) instead
  of hiding them: the package is handed to the page and rendered by a bundled
  WebWallGL engine (vendored MIT build in `vendor/webwallgl/`, 3.0.2).
- Scene packages travel over DevTools in base64 chunks because the Codex page CSP
  has no `connect-src` entry for the local media origin, so `fetch()` is blocked
  there; `media-src`/`img-src` allow the byte-range video and poster routes.
- Skip scene loading while the Codex window is hidden (a hidden page gets no
  `requestAnimationFrame`, so the engine cannot produce a first frame) and load it
  when the window becomes visible again.
- Cards now carry a video/scene badge, the panel filters by type, and scene
  wallpapers honour the existing pause, mute and volume controls.
- `inventory()` reports scene projects and their package size; projects whose
  `scene.pkg` is missing are skipped.
- Web wallpapers stay unsupported: the page CSP allows only `frame-src 'self' blob:`,
  so a sandboxed third-party iframe cannot be mounted without weakening Codex's
  own policy. This is documented in the README.

### Wallpaper library panel

- Replace the wallpaper dropdown with a card wall: each card shows the project's
  `preview` image and title, the current wallpaper is highlighted, and the panel
  offers a card/list view toggle.
- Add title and tag search plus a content-rating filter that appears when the
  library contains a non-`Everyone` project.
- Add a Refresh button that rescans the configured workshop directories without
  restarting Codex; newly subscribed videos appear immediately and
  `runtime.json` `videoCount` follows the rescan.
- Add optional wallpaper audio with a volume slider. Playback still starts muted.
- `inventory()` now reports `contentrating` and `tags`; settings accept `view`,
  `sound` and `volume`. The renderer payload version is 7.

### Verification notes

- Sign-in startup verified on 2026-11-15 with Codex MSIX 26.1027.3384.0 and
  Node.js 24.20.0: after a real sign-in the logon shortcut started Codex and the
  wallpaper helper, the helper reported ready with 72 video wallpapers, and the
  injected wallpaper element loaded a 3840 x 2160 video from the local media
  route. Details in `VALIDATION.md`.
- Documentation only. No runtime code changed and no new release is published.

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
