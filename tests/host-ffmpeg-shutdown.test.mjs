import test from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';
import http from 'node:http';
import os from 'node:os';
import path from 'node:path';
import {spawn} from 'node:child_process';
import {once} from 'node:events';
import {fileURLToPath} from 'node:url';
import {isProcessAlive} from '../src/lifecycle.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const host = path.join(root, 'src/wallpaper-host.mjs');

function frame(text, opcode = 1) {
  const payload = Buffer.from(text);
  if (payload.length < 126) return Buffer.concat([Buffer.from([0x80 | opcode, payload.length]), payload]);
  const header = Buffer.alloc(4);
  header[0] = 0x80 | opcode;
  header[1] = 126;
  header.writeUInt16BE(payload.length, 2);
  return Buffer.concat([header, payload]);
}

function parseFrames(state, chunk) {
  state.buffer = Buffer.concat([state.buffer, chunk]);
  const messages = [];
  while (state.buffer.length >= 2) {
    const first = state.buffer[0], second = state.buffer[1], opcode = first & 0x0f;
    const masked = (second & 0x80) !== 0;
    let length = second & 0x7f, offset = 2;
    if (length === 126) {
      if (state.buffer.length < 4) break;
      length = state.buffer.readUInt16BE(2);
      offset = 4;
    }
    const maskLength = masked ? 4 : 0;
    if (state.buffer.length < offset + maskLength + length) break;
    let payload = state.buffer.subarray(offset + maskLength, offset + maskLength + length);
    if (masked) {
      const mask = state.buffer.subarray(offset, offset + 4);
      payload = Buffer.from(payload.map((value, index) => value ^ mask[index % 4]));
    }
    state.buffer = state.buffer.subarray(offset + maskLength + length);
    if (opcode === 1) messages.push(payload.toString('utf8'));
  }
  return messages;
}

async function waitFor(check, timeoutMs = 12000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const value = check();
    if (value) return value;
    await new Promise(resolve => setTimeout(resolve, 50));
  }
  throw Error('Timed out waiting for condition');
}

function bootFrom(expression) {
  const line = expression.split('\n').find(value => value.startsWith('  const boot = '));
  return line ? JSON.parse(line.slice('  const boot = '.length, -1)) : null;
}

test('helper shutdown terminates FFmpeg and leaves no partial or duplicate conversion', {
  skip: process.platform === 'win32' && 'Linux launcher exercises the real child-process shutdown path'
}, async t => {
  const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'cw-host-ffmpeg-shutdown-'));
  const data = path.join(temp, 'data'), profile = path.join(temp, 'profile');
  const workshop = path.join(temp, 'workshop'), project = path.join(workshop, '123');
  const cache = path.join(data, 'cache'), pidFile = path.join(temp, 'ffmpeg.pid');
  const invocationFile = path.join(temp, 'ffmpeg-invocations');
  const ffmpeg = path.join(temp, 'fake-ffmpeg');
  fs.mkdirSync(data, {recursive: true});
  fs.mkdirSync(profile, {recursive: true});
  fs.mkdirSync(project, {recursive: true});
  fs.writeFileSync(path.join(project, 'project.json'), JSON.stringify({type: 'video', title: 'Synthetic', file: 'video.mp4'}));
  fs.writeFileSync(path.join(project, 'video.mp4'), Buffer.alloc(4096));
  const fakeSource = [
    `#!${process.execPath}`,
    "const fs=require('node:fs');",
    `fs.appendFileSync(${JSON.stringify(invocationFile)},'1\\n');`,
    `fs.writeFileSync(${JSON.stringify(pidFile)},String(process.pid));`,
    "process.on('SIGTERM',()=>{});",
    'setInterval(()=>{},1000);'
  ].join('\n');
  fs.writeFileSync(ffmpeg, fakeSource, {mode: 0o755});
  fs.writeFileSync(path.join(data, 'config.json'), JSON.stringify({
    workshopDirs: [workshop],
    wallpaperEngineConfig: null,
    codexProfile: profile,
    ffmpegPath: ffmpeg
  }));

  const sockets = new Set();
  let mediaErrorSent = false, fakePid = null;
  const server = http.createServer();
  server.on('connection', socket => {
    sockets.add(socket);
    socket.on('close', () => sockets.delete(socket));
  });
  server.on('request', (request, response) => {
    if (request.url === '/json/list') {
      response.setHeader('Content-Type', 'application/json');
      response.end(JSON.stringify([{
        id: 'target-1',
        type: 'page',
        url: 'app://-/index.html',
        webSocketDebuggerUrl: `ws://127.0.0.1:${server.address().port}/devtools/page/target-1`
      }]));
      return;
    }
    response.statusCode = 404;
    response.end();
  });
  server.on('upgrade', (request, socket) => {
    const accept = crypto.createHash('sha1')
      .update(request.headers['sec-websocket-key'] + '258EAFA5-E914-47DA-95CA-C5AB0DC85B11')
      .digest('base64');
    socket.write([
      'HTTP/1.1 101 Switching Protocols',
      'Upgrade: websocket',
      'Connection: Upgrade',
      `Sec-WebSocket-Accept: ${accept}`,
      '', ''
    ].join('\r\n'));
    const state = {buffer: Buffer.alloc(0)};
    socket.on('data', chunk => {
      for (const text of parseFrames(state, chunk)) {
        const message = JSON.parse(text);
        if (!message.id) continue;
        const result = message.method === 'Runtime.evaluate' ? {result: {value: true}} : {};
        socket.write(frame(JSON.stringify({id: message.id, result})));
        if (message.method !== 'Runtime.evaluate') continue;
        const boot = bootFrom(message.params.expression);
        if (boot && !mediaErrorSent) {
          mediaErrorSent = true;
          setTimeout(() => socket.write(frame(JSON.stringify({
            method: 'Runtime.bindingCalled',
            params: {name: 'codexWallpaperControl', payload: JSON.stringify({_mediaError: boot.library[0].id})}
          }))), 20);
        }
      }
    });
  });
  server.listen(0, '127.0.0.1');
  await once(server, 'listening');
  t.after(() => {
    for (const socket of sockets) socket.destroy();
    server.closeAllConnections();
    server.close();
    if (fakePid && isProcessAlive(fakePid)) {
      try {process.kill(fakePid, 'SIGKILL');} catch {}
    }
    fs.rmSync(temp, {recursive: true, force: true});
  });

  const endpoint = path.join(profile, 'DevToolsActivePort');
  fs.writeFileSync(endpoint, `${server.address().port}\n/devtools/browser/session-1\n`);
  const child = spawn(process.execPath, [host], {
    env: {...process.env, LOCALAPPDATA: temp, APPDATA: temp, CODEX_WALLPAPER_HOME: data},
    stdio: ['ignore', 'pipe', 'pipe']
  });
  let stderr = '';
  child.stderr.on('data', chunk => {stderr += chunk;});
  t.after(() => {
    if (child.exitCode === null && child.signalCode === null) child.kill('SIGKILL');
  });

  await waitFor(() => fs.existsSync(pidFile) && fs.existsSync(invocationFile));
  fakePid = Number(fs.readFileSync(pidFile, 'utf8'));
  assert.equal(isProcessAlive(fakePid), true);
  fs.writeFileSync(endpoint, `${server.address().port}\n/devtools/browser/session-2\n`);
  await waitFor(() => child.exitCode !== null || child.signalCode !== null, 15000);
  assert.equal(child.signalCode, null);
  assert.equal(child.exitCode, 0, stderr);
  await waitFor(() => !isProcessAlive(fakePid));
  assert.equal(fs.readFileSync(invocationFile, 'utf8').trim().split('\n').length, 1);
  assert.equal(fs.existsSync(path.join(data, 'runtime.json')), false);
  assert.equal(fs.existsSync(path.join(data, `runtime.json.${child.pid}.tmp`)), false);
  const partial = fs.existsSync(cache) ? fs.readdirSync(cache).filter(name => name.endsWith('.partial.mp4')) : [];
  assert.deepEqual(partial, []);
});
