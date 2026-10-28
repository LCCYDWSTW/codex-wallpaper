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
- An actual Windows sign-in/reboot with the release installed, including whether another launcher or Windows app restoration starts ordinary Codex.
- UI compatibility across different Codex builds, locales and layouts.
- Optional FFmpeg conversion across different GPU drivers and codecs.
- Node.js 22 CI execution (local verification used Node.js 24; CI is configured for 22 and 24).

The delivered source package has not been pushed to GitHub, so remote CI and Release workflows have not run. No frame-zero wallpaper or universal compatibility claim is made.


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
