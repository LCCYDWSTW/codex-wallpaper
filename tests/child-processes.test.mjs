import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {ChildProcesses} from '../src/child-processes.mjs';
import {isProcessAlive} from '../src/lifecycle.mjs';

async function waitFor(check, timeoutMs = 5000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (check()) return;
    await new Promise(resolve => setTimeout(resolve, 25));
  }
  throw Error('Timed out waiting for child process');
}

test('child process group force-stops a tracked child and rejects new work', async t => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'cw-child-processes-'));
  const marker = path.join(directory, 'pid');
  t.after(() => fs.rmSync(directory, {recursive: true, force: true}));
  const source = [
    "require('node:fs').writeFileSync(process.argv[1], String(process.pid))",
    "process.on('SIGTERM',()=>{})",
    'setInterval(()=>{},1000)'
  ].join(';');
  const group = new ChildProcesses();
  const result = group.run(process.execPath, ['-e', source, marker], {windowsHide: true}).catch(error => error);
  await waitFor(() => fs.existsSync(marker));
  const pid = Number(fs.readFileSync(marker, 'utf8'));
  assert.equal(isProcessAlive(pid), true);
  t.after(() => {try {process.kill(pid, 'SIGKILL');} catch {}});

  await group.stopAll({graceMs: 100});
  assert.ok((await result) instanceof Error);
  await waitFor(() => !isProcessAlive(pid));
  await assert.rejects(group.run(process.execPath, ['-e', '']), /stopped/);
});
