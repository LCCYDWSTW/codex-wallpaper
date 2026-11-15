# Verification scope — 0.1.0

Recorded on 2026-10-28. This report deliberately distinguishes automated checks from a real desktop sign-in.

## Completed for the release project

- 22 Node.js tests passed: empty/invalid PID output, port bounds, settings types and limits, range handling, directory traversal, invalid project filtering, configuration validation, local-only CDP endpoints, cold-start orchestration, reuse, helper repair and error propagation.
- JavaScript and Windows PowerShell syntax checks passed.
- Windows named-mutex integration test passed: only one synthetic worker owned the mutex; a concurrent worker was rejected; a later worker acquired it after the original worker was terminated. No Codex process was terminated by that test.
- Installer `-EnableStartup -PlanOnly` successfully discovered the local MSIX package, Node executable and Steam library. This was a read-only plan, not an installation.
- Source packaging uses an explicit file allowlist, includes hidden GitHub workflow files, and produces a SHA-256 checksum. The delivered archive was inspected for personal paths, runtime data and media assets.

## Existing prototype evidence

The separate local prototype displayed decoded 1920 x 1080 video and a single toolbar button/background layer on Codex 26.1023.6123.0. Three concurrent prototype launch attempts reused one main process and one helper. The release retains its renderer and streaming approach but changes installation and startup orchestration.

## Still requires real-user acceptance

- A clean installation and uninstall on a separate Windows account or PC.
- ~~An actual Windows sign-in/reboot with the release installed, including whether another launcher or Windows app restoration starts ordinary Codex.~~ Verified on 2026-11-15; see "Sign-in startup verification" below.
- UI compatibility across different Codex builds, locales and layouts.
- Optional FFmpeg conversion across different GPU drivers and codecs.
- Node.js 22 CI execution (local verification used Node.js 24; CI is configured for 22 and 24).

The source is published at `github.com/LCCYDWSTW/codex-wallpaper`. The `Check` and `Release source` workflows passed for the pushed `main`, and `v0.1.0` is published as a pre-release with the packaged ZIP and its SHA-256 file. No frame-zero wallpaper or universal compatibility claim is made.


## Local stability patch checks (after original 0.1.0)

The post-0.1.0 stage 2 source patch passed **27/27 Node.js tests** and
`npm run check` on Node.js 22.23.2 in a non-Windows test environment on
2026-10-28. The additional test checks that panel/blur CSS variables are
updated and cleaned up. This does **not** replace the real Windows checks
listed above. See `STABILITY_TEST.md` for manual acceptance and rollback steps.

## Local stability patch checks — stage 3

The stage 3 source patch passed **33/33 official Node.js tests**, `npm run check`
and the four Stage 2 supplemental CDP/settings/helper/FFmpeg tests on Node.js
22.23.2 under Linux on 2026-10-28. The complete official suite also passed 20
consecutive runs with no failures or test-process leftovers.

New checks execute the generated renderer script with hostile titles, verify
tracked child-process termination, exercise FFmpeg shutdown through a synthetic
helper/CDP session, exercise conservative runtime-temp cleanup, and check the
uninstall mutex ordering and corrected wait messages. These are Linux
simulations, not Windows real-machine results. PowerShell was unavailable, so
the edited `.ps1` files were not executed or syntax-checked here.

Residual limits: runtime-temp cleanup relies on PID liveness plus a ten-minute
age threshold and deliberately retains anything uncertain. FFmpeg termination
covers graceful helper shutdown and direct children only; a hard helper crash
or SIGKILL can still bypass cleanup. Real Windows named mutexes, CIM, COM,
shortcuts, registry/startup state, Codex CDP, media decoding, GPU/FFmpeg and
sign-in recovery remain unverified.

## Windows real-machine acceptance — 2026-10-28

The packaged Stage 3 source was checked on Windows 11 with the Microsoft Store
Codex MSIX, Node.js 24 and Wallpaper Engine Video items. The following were
observed on the actual desktop installation:

- SHA-256 and ZIP integrity checks passed before installation.
- `npm test`, `npm run check`, the Windows mutex test and the temporary shortcut
  restoration test passed; one platform-specific Node test was skipped.
- Manual installation without sign-in startup succeeded.
- Video playback, wallpaper switching, pause/resume, shade, blur and panel
  opacity controls worked, and settings persisted across a full application
  restart.
- Repeated shortcut activation and a quick restart left one current wallpaper
  helper in the sampled process checks.
- Navigation between conversations retained the wallpaper integration.
- Uninstall restored the original Codex entry and startup state, and no
  wallpaper helper remained afterward.

Not covered by this acceptance run: sign-in/reboot integration, an actual
FFmpeg conversion failure, conversion-in-progress shutdown, long-duration
CPU/GPU/memory measurements, and full-window reload (the application did not
respond to Ctrl+R). These remain documented release limitations.

## Sign-in startup verification — 2026-11-15

The sign-in integration listed as outstanding above was exercised on the installed
release after a real Windows sign-in, with Codex MSIX 26.1027.3384.0 and
Node.js 24.20.0:

- The machine booted at 15:59:34; the logon shortcut started the launcher, which
  logged `Starting at logon` at 16:00:23, started Codex, and logged
  `Wallpaper ready on local port 57829` at 16:00:31. The wallpaper helper was
  still running 26 minutes later.
- The helper's runtime status reported `ready: true` and 72 video wallpapers in
  the configured Steam library.
- A read-only DevTools inspection of the live Codex window found the injected
  wallpaper root and one media element loaded from
  `https://codex-wallpaper.invalid/media/...` at 3840 x 2160 with `readyState` 4.
- The window was closed to the tray during that inspection, so the page reported
  `hidden` and playback was paused. Both are the documented behaviour while the
  window is not visible.
- `launcher-error.log` and `host-error.log` gained no entries from this sign-in.
- The test suite passed on the same machine, with the Linux-only child-process
  shutdown case skipped.

Not covered by this run: uninstall on a separate Windows account or PC, UI
compatibility across other Codex builds, locales and layouts, optional FFmpeg
conversion on other GPU drivers, and full-window reload.

## Library panel verification — 2026-11-15

Checks after replacing the wallpaper dropdown with a thumbnail card wall, a rescan
button, search, a content-rating filter and an optional audio toggle:

- `npm test` passed 34 of 35 cases on this machine; the skipped case is the
  Linux-only child-process shutdown test. `npm run check` passed.
- New tests cover the `view`/`sound`/`volume` settings, `contentrating` and `tags`
  extraction in `inventory()`, the renderer's `_rescan` request, and the card grid
  styles.
- Live check on the installed build (Codex MSIX 26.1027.3384.0, Node.js 24.20.0,
  72 video projects): the injected panel rendered 72 cards whose titles came from
  `project.json`; searching for a title fragment narrowed the grid and the counter
  with it; Refresh rescanned and returned the same count in the status line;
  picking a card moved the streamed media element to that wallpaper id.
- Layout was inspected by rendering the panel markup and `wallpaper.css` in
  headless Chrome in both card and list views. That step was necessary because the
  Codex window was closed to the tray during the check, and a hidden window does
  not composite frames even when the page is forced active. Those screenshots are
  not committed.

Not covered by this run: the panel inside a visible Codex window on a real
display, Scene and Web wallpapers (still unsupported), and audible output through
real speakers.

## Scene wallpaper verification — 2026-11-15

Scene projects are now rendered by the vendored WebWallGL engine instead of being
excluded from the library.

- `inventory()` reports **198** playable projects from this machine's workshop
  folder: 72 video and 126 scene. The folder holds 213 projects; 9 web projects stay
  unsupported (see below), 2 scene folders were skipped because their `scene.pkg` is
  missing, and 4 older projects declare no `type` field at all.
- The page CSP (`default-src 'none'`) has no `connect-src` entry for
  `codex-wallpaper.invalid`, so `fetch()` and `XMLHttpRequest` to the media origin
  fail with `TypeError: Failed to fetch`, while `media-src`/`img-src` let the video
  and poster routes through. Scene packages therefore travel from the helper over
  DevTools in 512 KB base64 chunks (a 25 MB package took about three seconds) and
  are assembled into an `ArrayBuffer` in the page.
- A hidden Codex window receives no `requestAnimationFrame`, and the engine reports
  `mount 首帧超时（60000ms）` there. The renderer now skips scene loading while
  `document.hidden` is true, shows `打开 Codex 窗口后加载场景壁纸`, and loads the
  scene when the window becomes visible.
- The engine path itself was verified with a real package: a headless Chrome page
  loading `vendor/webwallgl/webwallgl.global.min.js` and a 608 KB `scene.pkg` from
  this machine's library through `WebWallGL.createScene` + `bytesSource` produced a
  rendered 800 x 450 first frame (layers, city backdrop and snow particles). That
  screenshot is not committed.
- Live check on the installed build (Codex MSIX 26.1027.3384.0, Node.js 24.20.0):
  the 198 cards carry video/scene badges, the engine reports
  `Boolean(globalThis.WebWallGL) === true` after injection, and the helper log
  records `Scene package delivered` when a scene card is selected.
- End-to-end confirmation with the Codex window actually opened: the selected scene
  wallpaper loaded and rendered inside the running window — the renderer reported
  `1600 × 1000 · 场景壁纸 · 198 个壁纸` with `kind: scene`, and a capture of the live
  canvas returned a 1.6 MB PNG showing the animated scene with its clock layer and
  particle sparkles. That capture is not committed.
- `npm test` passed 35 of 36 cases (the skipped case is the Linux-only child-process
  shutdown test) and `npm run check` passed; `npm run package` produces a ZIP that
  includes `vendor/`.

Not covered: scene audio, performance on heavier scene packages (the largest
package in this library is 16 MB), and scene switching under long use. Web
wallpapers remain unsupported: the page CSP allows only `frame-src 'self' blob:`,
so a sandboxed third-party iframe cannot be mounted without disabling CSP for the
whole Codex window, which this project does not do.
