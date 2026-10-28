import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import {parsePids, validPort, sanitizeSettings, mediaRange, within} from '../src/core.mjs';

for (const [input, expected] of [['', []], ['  ', []], ['0', []], ['-1,NaN,1.2,Infinity', []], ['123,456', [123,456]], ['0, 123,', [123]], ['9007199254740992', []]]) {
  test(`PID output ${JSON.stringify(input)}`, () => assert.deepEqual(parsePids(input), expected));
}
test('debugging port bounds', () => {
  for (const value of ['', 0, -1, 65536, '1.2', '80/foo']) assert.equal(validPort(value), false);
  assert.equal(validPort('60978'), true);
});
test('settings types and limits', () => {
  assert.deepEqual(sanitizeSettings({enabled:'yes', paused:false, shade:99, blur:-2, panel:Infinity, surprise:1}), {paused:false, shade:.8, blur:0});
  assert.deepEqual(sanitizeSettings(null), {});
});
test('media range bounded memory, explicit and suffix ranges', () => {
  assert.deepEqual(mediaRange('bytes=4-7', 10), {start:4,end:7,size:4});
  assert.deepEqual(mediaRange('bytes=-3', 10), {start:7,end:9,size:3});
  assert.deepEqual(mediaRange('bytes=0-', 10000000), {start:0,end:2097151,size:2097152});
  assert.deepEqual(mediaRange('bytes=8-100', 10), {start:8,end:9,size:2});
  for (const range of ['bytes=-0','bytes=10-','bytes=8-2','bytes=0-1,3-5','invalid','bytes=-']) assert.equal(mediaRange(range,10),null);
  assert.equal(mediaRange(undefined,0),null);
});
test('path containment rejects parent and sibling prefix', () => {
  const root=path.resolve('fixture');
  assert.equal(within(root,path.join(root,'clip.mp4')),true);
  assert.equal(within(root,root),false);
  assert.equal(within(root,path.resolve('fixture-other','clip.mp4')),false);
  assert.equal(within(root,path.resolve('outside.mp4')),false);
});
