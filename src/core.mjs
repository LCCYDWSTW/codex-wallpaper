import path from 'node:path';

export const positivePid = value => Number.isSafeInteger(value) && value > 0;
export function parsePids(output) {
  return String(output).split(',').map(v => v.trim()).filter(v => /^\d+$/.test(v))
    .map(Number).filter(positivePid);
}
export function validPort(value) {
  return /^\d+$/.test(String(value)) && Number(value) > 0 && Number(value) <= 65535;
}
export function within(folder, file) {
  const relative = path.relative(folder, file);
  return relative !== '' && !relative.startsWith('..' + path.sep) && relative !== '..' && !path.isAbsolute(relative);
}
export function sanitizeSettings(input = {}) {
  const clean = {};
  if (!input || typeof input !== 'object') return clean;
  for (const key of ['enabled', 'paused', 'followDesktop']) {
    if (typeof input[key] === 'boolean') clean[key] = input[key];
  }
  for (const [key, min, max] of [['shade', .1, .8], ['panel', .12, .85], ['blur', 0, 40]]) {
    if (Number.isFinite(input[key])) clean[key] = Math.min(max, Math.max(min, input[key]));
  }
  if (typeof input.wallpaperId === 'string') clean.wallpaperId = input.wallpaperId;
  return clean;
}
export function mediaRange(header, total, chunk = 2 * 1024 * 1024) {
  if (!Number.isSafeInteger(total) || total <= 0) return null;
  let start = 0, end = total - 1;
  if (header !== undefined) {
    const match = /^bytes=(\d*)-(\d*)$/.exec(String(header));
    if (!match || (!match[1] && !match[2])) return null;
    if (match[1]) {
      start = Number(match[1]);
      if (match[2]) end = Math.min(end, Number(match[2]));
    } else {
      const suffix = Number(match[2]);
      if (!Number.isSafeInteger(suffix) || suffix <= 0) return null;
      start = Math.max(0, total - suffix);
    }
  }
  if (!Number.isSafeInteger(start) || !Number.isSafeInteger(end) || start >= total || end < start) return null;
  end = Math.min(end, start + chunk - 1);
  return {start, end, size: end - start + 1};
}
