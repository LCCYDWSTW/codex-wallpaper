# Vendored WebWallGL

`webwallgl.global.min.js` is an unmodified copy of the browser build shipped by the
`webwallgl` npm package (version 3.0.2), which renders Wallpaper Engine **scene**
wallpapers in a WebGL canvas. `LICENSE` is the upstream MIT licence.

- Upstream: https://github.com/oneincase/webwallgl — https://www.npmjs.com/package/webwallgl
- Author: oneincase <462534624@qq.com>
- Licence: MIT (see `LICENSE`)
- Loaded as a classic script that registers `globalThis.WebWallGL`.

The file is vendored instead of installed because this project has no build step and
no `npm install`: the wallpaper helper reads it from disk and hands the source to the
Codex page over DevTools, so scene wallpapers work offline and without a package
manager.

Wallpaper Engine workshop content (scene.pkg, textures, audio, video) remains the
property of its respective authors; this repository ships no wallpaper assets.
