import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import {within} from './core.mjs';

export function inventory(roots, cacheDir) {
  const list = [], seen = new Set();
  for (const root of roots) {
    if (!fs.existsSync(root)) continue;
    const canonicalRoot = fs.realpathSync(root);
    for (const entry of fs.readdirSync(root, {withFileTypes: true})) {
      if (!entry.isDirectory()) continue;
      try {
        const folder = fs.realpathSync(path.join(root, entry.name));
        if (!within(canonicalRoot, folder)) continue;
        const project = JSON.parse(fs.readFileSync(path.join(folder, 'project.json'), 'utf8').replace(/^\uFEFF/, ''));
        if (String(project.type).toLowerCase() !== 'video' || typeof project.file !== 'string') continue;
        const file = fs.realpathSync(path.resolve(folder, project.file));
        if (!within(folder, file) || !/\.(mp4|webm|m4v|mov)$/i.test(file) || seen.has(file)) continue;
        const stat = fs.statSync(file);
        if (!stat.isFile() || !stat.size) continue;
        seen.add(file);
        const id = crypto.createHash('sha256').update(file).digest('hex').slice(0, 24);
        const stamp = crypto.createHash('sha256').update(file + ':' + stat.mtimeMs + ':1080p30-v1').digest('hex').slice(0, 12);
        const cached = path.join(cacheDir, id + '-' + stamp + '.mp4');
        let preview = null;
        if (typeof project.preview === 'string') {
          try {
            const candidate = fs.realpathSync(path.resolve(folder, project.preview));
            if (within(folder, candidate) && /\.(png|jpe?g|gif|webp)$/i.test(candidate) && fs.statSync(candidate).size <= 10 * 1024 * 1024) preview = candidate;
          } catch {}
        }
        list.push({id, title: String(project.title || entry.name), file, size: stat.size, cached, preview});
      } catch {}
    }
  }
  return list.sort((a, b) => a.title.localeCompare(b.title, 'zh-CN'));
}
