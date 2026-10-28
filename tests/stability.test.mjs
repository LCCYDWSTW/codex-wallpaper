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
