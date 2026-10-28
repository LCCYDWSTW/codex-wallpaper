import test from 'node:test';
import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {once} from 'node:events';
import {parseEndpoint, sameEndpoint, runtimeTempPath, waitForPreviousHelper} from '../src/lifecycle.mjs';
import {ensureStarted} from '../src/startup.mjs';

const old = parseEndpoint('49152\n/devtools/browser/old-session\n');
const fresh = parseEndpoint('49152\n/devtools/browser/new-session\n');

test('quick restart detects a new browser even when the port is reused', () => {
  assert.deepEqual(old, {port:49152,browserPath:'/devtools/browser/old-session'});
  assert.equal(sameEndpoint(old, fresh), false);
  assert.equal(sameEndpoint(old, {...old}), true);
  assert.equal(parseEndpoint('49152\n'), null);
  assert.equal(parseEndpoint('0\n/devtools/browser/old-session'), null);
  assert.notEqual(runtimeTempPath('runtime.json', 101), runtimeTempPath('runtime.json', 102));
});

test('quick restart waits for old helper, then repeated launch reuses the new one', async () => {
  let oldAlive=true, helperAlive=false, created=0, checked=0;
  const api={livePort:async()=>fresh.port, mainPids:async()=>{throw Error('must not inspect cold start');},
    helperIsRunning:async()=>{
      if (helperAlive) return true;
      assert.equal(await waitForPreviousHelper(async()=>oldAlive, async()=>{checked++;oldAlive=false;}, 3),true);
      return false;
    },
    startHelper:async()=>{assert.equal(oldAlive,false);created++;helperAlive=true;return {pid:123};},
    waitForHelper:async()=>true,focus:async()=>{}};
  await ensureStarted(api);
  await ensureStarted(api);
  assert.equal(created,1);
  assert.equal(checked,1);
});

test('unresponsive previous helper blocks replacement', async () => {
  assert.equal(await waitForPreviousHelper(async()=>true,async()=>{},2),false);
  let started=false;
  await assert.rejects(ensureStarted({livePort:async()=>fresh.port,
    helperIsRunning:async()=>{if(!await waitForPreviousHelper(async()=>true,async()=>{},1))throw Error('previous helper still running');return false;},
    startHelper:async()=>{started=true;return {pid:1};}}),/previous helper/);
  assert.equal(started,false);
});

test('abnormally terminated synthetic helper is observed as exited', async t => {
  const child=spawn(process.execPath,['-e','setInterval(()=>{},1000)'],{stdio:'ignore'});
  t.after(()=>{if(child.exitCode===null && child.signalCode===null)child.kill();});
  await once(child,'spawn');
  child.kill(); // Only the synthetic child started by this test.
  assert.equal(await waitForPreviousHelper(async()=>child.exitCode===null && child.signalCode===null,async()=>new Promise(r=>setTimeout(r,10)),100),true);
});
