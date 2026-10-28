import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

test('uninstall checks installation state only after acquiring the mutex', () => {
  const source = fs.readFileSync(path.join(root, 'uninstall.ps1'), 'utf8');
  const mutex = source.indexOf('$mutex=Get-InstallMutex');
  const state = source.indexOf("if(-not (Test-Path -LiteralPath $statePath))");
  assert.ok(mutex >= 0, 'uninstall must acquire the installation mutex');
  assert.ok(state > mutex, 'state must be checked while holding the mutex');
  assert.match(source.slice(mutex), /finally \{\$mutex\.ReleaseMutex\(\);\$mutex\.Dispose\(\)\}/);
});

test('helper wait errors match the bounded retry windows', () => {
  const source = fs.readFileSync(path.join(root, 'src/launch.mjs'), 'utf8');
  assert.doesNotMatch(source, /wait two minutes/);
  assert.match(source, /wait about 15 seconds/);
  assert.match(source, /wait about 30 seconds/);
});
