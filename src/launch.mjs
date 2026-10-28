import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {execFile, spawn} from 'node:child_process';
import {promisify} from 'node:util';
import {loadConfig} from './config.mjs';
import {positivePid} from './core.mjs';
import {ensureStarted} from './startup.mjs';
import {parseEndpoint, sameEndpoint, waitForPreviousHelper} from './lifecycle.mjs';

const dir = path.dirname(fileURLToPath(import.meta.url));
const exec = promisify(execFile), pause = ms => new Promise(r => setTimeout(r, ms));
const quote = value => "'" + String(value).replaceAll("'", "''") + "'";
const powershell = path.join(process.env.SystemRoot, 'System32', 'WindowsPowerShell', 'v1.0', 'powershell.exe');
async function ps(script) {
  const encoded = Buffer.from('[Console]::OutputEncoding=[System.Text.UTF8Encoding]::new();$ErrorActionPreference="Stop";' + script, 'utf16le').toString('base64');
  return (await exec(powershell, ['-NoProfile', '-NonInteractive', '-EncodedCommand', encoded], {windowsHide: true, timeout: 20000})).stdout.trim();
}
let log = message => console.error(message);
try {
  if (process.env.CODEX_WALLPAPER_WRAPPED !== '1') throw Error('Use Start.vbs or scripts/launcher.ps1 to start safely.');
  const config = loadConfig();
  log = message => fs.appendFileSync(path.join(config.dataDir, 'launch.log'), new Date().toISOString() + ' ' + message + '\n');
  const location = await ps('(Get-AppxPackage -Name OpenAI.Codex | Select-Object -First 1 -ExpandProperty InstallLocation)');
  if (!location) throw Error('The Windows MSIX package OpenAI.Codex is not installed for this user.');
  const executable = path.join(location, 'app', 'ChatGPT.exe');
  if (!fs.existsSync(executable)) throw Error('The installed Codex executable layout is unsupported.');
  const runtimeFile = path.join(config.dataDir, 'runtime.json');
  const hostFile = path.join(dir, 'wallpaper-host.mjs');
  async function hostPids() {
    const output = await ps(`$items=@(Get-CimInstance Win32_Process | Where-Object { $_.CommandLine -and $_.CommandLine.IndexOf(${quote(hostFile)},[StringComparison]::OrdinalIgnoreCase) -ge 0 } | Select-Object -ExpandProperty ProcessId); ConvertTo-Json -InputObject $items -Compress`);
    return JSON.parse(output || '[]').filter(positivePid);
  }
  function currentEndpoint() {
    try {return parseEndpoint(fs.readFileSync(path.join(config.profile, 'DevToolsActivePort'), 'utf8'));}
    catch {return null;}
  }
  async function mainPids() {
    const output = await ps(`$items=@(Get-CimInstance Win32_Process -Filter "Name='ChatGPT.exe'" | Where-Object { $_.ExecutablePath -eq ${quote(executable)} -and $_.CommandLine -notmatch '--type=' } | Select-Object -ExpandProperty ProcessId); ConvertTo-Json -InputObject $items -Compress`);
    return JSON.parse(output || '[]').filter(positivePid);
  }
  async function focus() {
    await start(executable, [`--user-data-dir=${config.profile}`]);
  }
  async function livePort() {
    try {
      const endpoint = currentEndpoint();
      if (!endpoint) return null;
      const targets = await (await fetch(`http://127.0.0.1:${endpoint.port}/json/list`, {signal: AbortSignal.timeout(1500)})).json();
      return targets.some(t => t.type === 'page' && t.url.startsWith('app://-/index.html')) ? endpoint.port : null;
    } catch {return null;}
  }
  async function start(file, args, stdio = 'ignore') {
    const child = spawn(file, args, {windowsHide: true, detached: true, stdio});
    await new Promise((resolve, reject) => {child.once('spawn', resolve); child.once('error', reject);});
    child.unref();
    return child;
  }
  async function waitForHelper(helper) {
    for (let i = 0; i < 60; i++) {
      if (helper.exitCode != null) throw Error('Wallpaper helper exited. See host-error.log.');
      try {
        const runtime = JSON.parse(fs.readFileSync(runtimeFile, 'utf8'));
        if (runtime.pid === helper.pid && runtime.ready && sameEndpoint(runtime, currentEndpoint()) && Date.now() - runtime.updatedAt < 10000) return true;
      } catch {}
      await pause(500);
    }
    return false;
  }
  if (process.argv.includes('--focus-only')) {
    if ((await mainPids()).length) await focus();
    log('Another launcher owns the startup mutex; focus only');
  } else {
    log(process.argv.includes('--at-logon') ? 'Starting at logon' : 'Starting');
    const port = await ensureStarted({
      livePort, mainPids, focus,
      startCodex: async () => {
        const child = await start(executable, [`--user-data-dir=${config.profile}`, '--remote-debugging-address=127.0.0.1', '--remote-debugging-port=0']);
        log('Started Codex: ' + child.pid);
      },
      waitForPort: async () => {
        for (let i = 0; i < 90; i++) {await pause(1000); const port = await livePort(); if (port) return port;}
        return null;
      },
      helperIsRunning: async (port) => {
        let runtime; try {runtime = JSON.parse(fs.readFileSync(runtimeFile, 'utf8'));} catch {return false;}
        if (!positivePid(runtime.pid) || !Number.isFinite(runtime.startedAt) || typeof runtime.profile !== 'string' || path.resolve(runtime.profile).toLowerCase() !== path.resolve(config.profile).toLowerCase()) return false;
        const output = await ps(`$item=Get-CimInstance Win32_Process -Filter 'ProcessId=${runtime.pid}'; if($item){ @{command=$item.CommandLine;created=$item.CreationDate.ToUniversalTime().ToString('o')} | ConvertTo-Json -Compress }`);
        if (!output) return false;
        const item = JSON.parse(output);
        if (!String(item.command).toLowerCase().includes(hostFile.toLowerCase()) || Math.abs(Date.parse(item.created) - runtime.startedAt) > 30000) return false;
        // A previous helper may still be shutting down after a fast restart.
        // It must leave before another one can use runtime.json or attach.
        if (!sameEndpoint(runtime, currentEndpoint()) || runtime.port !== port) {
          const exited = await waitForPreviousHelper(async () => !!(await ps(`$item=Get-CimInstance Win32_Process -Filter 'ProcessId=${runtime.pid}'; if($item){$item.ProcessId}`)), pause);
          if (!exited) throw Error('The previous wallpaper helper is still running. Fully quit Codex, wait about 15 seconds and try again.');
          return false;
        }
        if (!await waitForHelper({pid: runtime.pid})) throw Error('The existing wallpaper helper is not ready. Fully quit Codex, wait about 30 seconds and try again.');
        return true;
      },
      startHelper: async () => {
        // A helper can be alive without a readable runtime file after a failed first tick.
        if (!await waitForPreviousHelper(async () => (await hostPids()).length > 0, pause))
          throw Error('A wallpaper helper is still running. Fully quit Codex, wait about 15 seconds and try again.');
        const out = fs.openSync(path.join(config.dataDir, 'host.log'), 'a');
        const err = fs.openSync(path.join(config.dataDir, 'host-error.log'), 'a');
        try {const child = await start(process.execPath, [hostFile], ['ignore', out, err]); log('Started helper: ' + child.pid); return child;}
        finally {fs.closeSync(out); fs.closeSync(err);}
      },
      waitForHelper
    });
    log('Wallpaper ready on local port ' + port);
  }
} catch (error) {
  log(error.stack || error.message);
  console.error(error.message);
  process.exitCode = 1;
}
