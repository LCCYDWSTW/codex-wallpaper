import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {spawn} from 'node:child_process';
import {once} from 'node:events';
import {cleanupRuntimeTemps, isProcessAlive, runtimeTempPath} from '../src/lifecycle.mjs';

test('runtime temp cleanup preserves live, current and recent files', async t => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'cw-runtime-temp-'));
  const runtimeFile = path.join(directory, 'runtime.json');
  const live = spawn(process.execPath, ['-e', 'setInterval(()=>{},1000)'], {stdio: 'ignore'});
  const dead = spawn(process.execPath, ['-e', ''], {stdio: 'ignore'});
  const recentDead = spawn(process.execPath, ['-e', ''], {stdio: 'ignore'});
  await Promise.all([once(live, 'spawn'), once(dead, 'spawn'), once(dead, 'exit'), once(recentDead, 'spawn'), once(recentDead, 'exit')]);
  t.after(() => {
    if (live.exitCode === null && live.signalCode === null) live.kill('SIGKILL');
    fs.rmSync(directory, {recursive: true, force: true});
  });

  assert.equal(isProcessAlive(live.pid), true);
  assert.equal(isProcessAlive(dead.pid), false);
  const liveTemp = runtimeTempPath(runtimeFile, live.pid);
  const deadTemp = runtimeTempPath(runtimeFile, dead.pid);
  const currentTemp = runtimeTempPath(runtimeFile, process.pid);
  const recentTemp = runtimeTempPath(runtimeFile, recentDead.pid);
  const unrelated = path.join(directory, 'runtime.json.bak');
  for (const file of [liveTemp, deadTemp, currentTemp, recentTemp, unrelated]) fs.writeFileSync(file, 'temp');
  const old = new Date(Date.now() - 60 * 60 * 1000);
  for (const file of [liveTemp, deadTemp, currentTemp, unrelated]) fs.utimesSync(file, old, old);

  assert.deepEqual(cleanupRuntimeTemps(runtimeFile, {now: Date.now(), minAgeMs: 2 * 60 * 60 * 1000}), []);
  assert.equal(fs.existsSync(deadTemp), true);

  assert.deepEqual(cleanupRuntimeTemps(runtimeFile, {now: Date.now(), minAgeMs: 60 * 1000}), [deadTemp]);
  for (const file of [liveTemp, currentTemp, recentTemp, unrelated]) assert.equal(fs.existsSync(file), true);
  assert.equal(fs.existsSync(deadTemp), false);
});
