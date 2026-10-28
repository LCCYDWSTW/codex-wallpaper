import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import {fileURLToPath} from 'node:url';
import {buildBootScript} from '../src/renderer-boot.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

test('generated renderer script executes with every hostile title character', () => {
  const renderer = fs.readFileSync(path.join(root, 'src/renderer.js'), 'utf8');
  const titles = [
    "single-quote replacement $'",
    'backtick replacement $`',
    'whole-match replacement $&',
    'literal dollar replacement $$',
    'quotes \' and " plus backslash \\',
    'Unicode 中文 😀 \u2028 \u2029',
    "mixed $' $` $& $$ \" \\ 中文 😀"
  ];
  const boot = {
    config: {wallpaperId: 'wallpaper-1'},
    library: titles.map((title, index) => ({id: `wallpaper-${index + 1}`, title})),
    css: 'body{}'
  };
  const seen = [];
  const sandbox = {
    window: {
      __codexWallpaper: {
        version: 4,
        update(value) {seen.push(value);}
      }
    }
  };

  vm.runInNewContext(buildBootScript(renderer, boot), sandbox, {filename: 'generated-renderer.js'});

  assert.equal(seen.length, 1);
  assert.deepEqual(JSON.parse(JSON.stringify(seen[0])), boot);
});
