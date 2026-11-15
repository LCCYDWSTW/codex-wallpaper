import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

// Regression checks for renderer styles that don't run inside Node's DOM-less test runner.
test('panel/blur sliders update both inline glass surfaces and CSS-controlled surfaces', () => {
  const renderer = fs.readFileSync(path.join(root, 'src/renderer.js'), 'utf8');
  const css = fs.readFileSync(path.join(root, 'src/wallpaper.css'), 'utf8');
  assert.match(css, /var\(--cw-panel/);
  assert.match(css, /var\(--cw-blur/);
  assert.match(renderer, /root\.style\.setProperty\('--cw-panel',String\(config\.panel\)\)/);
  assert.match(renderer, /root\.style\.setProperty\('--cw-blur',`\$\{config\.blur\}px`\)/);
  assert.match(renderer, /root\.style\.removeProperty\(name\)/);
});

test('library panel wires cards, rating filter and a rescan request', () => {
  const renderer = fs.readFileSync(path.join(root, 'src/renderer.js'), 'utf8');
  const css = fs.readFileSync(path.join(root, 'src/wallpaper.css'), 'utf8');
  assert.match(renderer, /id="cw-grid"/);
  assert.match(renderer, /_rescan:true/);
  assert.match(renderer, /poster\/'\+encodeURIComponent\(item\.id\)/);
  assert.match(renderer, /textContent=item\.title/);
  assert.match(css, /\.cw-grid\s*\{/);
  assert.match(css, /\.cw-card\[aria-selected="true"\]/);
  assert.match(css, /\[data-view="list"\]/);
});

test('scene wallpapers load through the vendored engine and the control channel', () => {
  const renderer = fs.readFileSync(path.join(root, 'src/renderer.js'), 'utf8');
  const host = fs.readFileSync(path.join(root, 'src/wallpaper-host.mjs'), 'utf8');
  const css = fs.readFileSync(path.join(root, 'src/wallpaper.css'), 'utf8');
  // The page cannot fetch the fake media origin (its CSP has no connect-src entry), so packages travel as base64 chunks.
  assert.match(renderer, /_sceneRequest/);
  assert.match(renderer, /scenePackage\(id,parts\)/);
  assert.match(renderer, /createScene\(/);
  assert.match(renderer, /bytesSource/);
  assert.match(renderer, /if\(document\.hidden\)/);
  assert.match(host, /async function pushScene/);
  assert.match(host, /_sceneRequest/);
  assert.match(host, /vendor',\s*'webwallgl'/);
  assert.match(css, /#cw-scene canvas/);
});
