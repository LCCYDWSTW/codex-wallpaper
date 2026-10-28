import test from 'node:test';
import assert from 'node:assert/strict';
import {ensureStarted} from '../src/startup.mjs';

function fixture(overrides={}) {
  const calls=[];
  const api={livePort:async()=>null, mainPids:async()=>[], startCodex:async()=>calls.push('codex'), waitForPort:async()=>43210,
    helperIsRunning:async()=>false, startHelper:async()=>{calls.push('helper');return {pid:123};},
    waitForHelper:async()=>{calls.push('ready');return true;}, focus:async()=>calls.push('focus'), ...overrides};
  return {api,calls};
}
test('cold start with no processes reaches ready before focus', async()=>{
  const {api,calls}=fixture(); assert.equal(await ensureStarted(api),43210); assert.deepEqual(calls,['codex','helper','ready','focus']);
});
test('existing styled app is reused', async()=>{
  const {api,calls}=fixture({livePort:async()=>43210,helperIsRunning:async()=>true});await ensureStarted(api);assert.deepEqual(calls,['focus']);
});
test('missing helper is repaired without restarting Codex', async()=>{
  const {api,calls}=fixture({livePort:async()=>43210});await ensureStarted(api);assert.deepEqual(calls,['helper','ready','focus']);
});
test('ordinary Codex is never closed or force-killed', async()=>{
  const {api,calls}=fixture({mainPids:async()=>[123]});await assert.rejects(ensureStarted(api),/already open/);assert.deepEqual(calls,[]);
});
test('slow or failed app startup does not trigger repeated starts', async()=>{
  const {api,calls}=fixture({waitForPort:async()=>null});await assert.rejects(ensureStarted(api),/90 seconds/);assert.deepEqual(calls,['codex']);
});
test('helper failure is visible and does not report success', async()=>{
  const {api,calls}=fixture({waitForHelper:async()=>false});await assert.rejects(ensureStarted(api),/helper did not/);assert.deepEqual(calls,['codex','helper']);
});
test('process inspection failure stops startup instead of assuming absence', async()=>{
  const {api,calls}=fixture({mainPids:async()=>{throw Error('CIM denied');}});await assert.rejects(ensureStarted(api),/CIM denied/);assert.deepEqual(calls,[]);
});
test('spawn failure propagates',async()=>{
  const {api}=fixture({startCodex:async()=>{throw Error('ENOENT');}});await assert.rejects(ensureStarted(api),/ENOENT/);
});
