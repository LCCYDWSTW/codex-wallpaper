import fs from 'node:fs';
import path from 'node:path';

// The second line is Chromium's browser WebSocket path. It changes on restart,
// even if the operating system later assigns the same debugging port.
export function parseEndpoint(text) {
  const [port, browserPath] = String(text).trim().split(/\r?\n/);
  if (!/^\d+$/.test(port) || Number(port) < 1 || Number(port) > 65535 ||
      !/^\/devtools\/browser\/[\w-]+$/.test(browserPath || '')) return null;
  return {port: Number(port), browserPath};
}

export function sameEndpoint(a, b) {
  return !!a && !!b && a.port === b.port && a.browserPath === b.browserPath;
}

export const runtimeTempPath = (file, pid) => `${file}.${pid}.tmp`;

// Unknown process-check failures are treated as alive so cleanup never guesses.
export function isProcessAlive(pid, kill = process.kill) {
  if (!Number.isSafeInteger(pid) || pid < 1) return false;
  try {kill(pid, 0); return true;}
  catch (error) {return error?.code !== 'ESRCH';}
}

// Only remove old temp files whose owning PID is gone. Live, current and
// recently written files are retained because a PID may have been reused.
export function cleanupRuntimeTemps(file, {
  isAlive = isProcessAlive,
  now = Date.now(),
  minAgeMs = 10 * 60 * 1000
} = {}) {
  const directory = path.dirname(file), prefix = path.basename(file) + '.', removed = [];
  let entries;
  try {entries = fs.readdirSync(directory, {withFileTypes: true});} catch {return removed;}
  for (const entry of entries) {
    if (!entry.isFile() || !entry.name.startsWith(prefix) || !entry.name.endsWith('.tmp')) continue;
    const text = entry.name.slice(prefix.length, -4), pid = Number(text);
    if (!/^[1-9]\d*$/.test(text) || !Number.isSafeInteger(pid) || pid === process.pid) continue;
    const candidate = path.join(directory, entry.name);
    try {
      const stat = fs.statSync(candidate);
      if (!stat.isFile() || now - stat.mtimeMs < minAgeMs || isAlive(pid)) continue;
      fs.unlinkSync(candidate);
      removed.push(candidate);
    } catch {}
  }
  return removed;
}

// Never start a replacement while the previous helper is still alive.
export async function waitForPreviousHelper(isAlive, pause, attempts = 30) {
  for (let i = 0; i < attempts; i++) {
    if (!await isAlive()) return true;
    await pause(500);
  }
  return !await isAlive();
}
