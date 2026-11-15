import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import {within} from './core.mjs';

const MEDIA = /\.(mp4|webm|m4v|mov)$/i;
const PREVIEW = /\.(png|jpe?g|gif|webp)$/i;

function inside(folder, candidate) {
  try {
    const file = fs.realpathSync(path.resolve(folder, candidate));
    return within(folder, file) ? file : null;
  } catch {
    return null;
  }
}

function previewOf(folder, project) {
  if (typeof project.preview !== 'string') return null;
  const candidate = inside(folder, project.preview);
  if (!candidate || !PREVIEW.test(candidate)) return null;
  try {
    return fs.statSync(candidate).size <= 10 * 1024 * 1024 ? candidate : null;
  } catch {
    return null;
  }
}

/**
 * Scan Wallpaper Engine workshop folders for playable projects.
 *
 * Supports three project types: `video` (media file played with byte ranges),
 * `scene` (`scene.pkg` rendered by the bundled WebWallGL engine) and `web`
 * (an HTML entry served from its project folder into a sandboxed iframe).
 *
 * @param {string[]} roots Workshop directories to scan.
 * @param {string} cacheDir Directory for generated video conversions.
 * @returns {Array<object>} Playable wallpapers sorted by title.
 */
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
        const type = String(project.type).toLowerCase();
        const rating = typeof project.contentrating === 'string' ? project.contentrating : '';
        const tags = Array.isArray(project.tags) ? project.tags.filter(tag => typeof tag === 'string').slice(0, 8) : [];
        const preview = previewOf(folder, project);
        const title = String(project.title || entry.name);
        const id = file => crypto.createHash('sha256').update(file).digest('hex').slice(0, 24);

        if (type === 'video') {
          if (typeof project.file !== 'string') continue;
          const file = inside(folder, project.file);
          if (!file || !MEDIA.test(file) || seen.has(file)) continue;
          const stat = fs.statSync(file);
          if (!stat.isFile() || !stat.size) continue;
          seen.add(file);
          const stamp = crypto.createHash('sha256').update(file + ':' + stat.mtimeMs + ':1080p30-v1').digest('hex').slice(0, 12);
          list.push({id: id(file), type, title, file, size: stat.size, cached: path.join(cacheDir, id(file) + '-' + stamp + '.mp4'), preview, rating, tags});
        } else if (type === 'scene') {
          // scene.pkg holds scene.json plus textures; WebWallGL parses it in the page.
          const file = inside(folder, 'scene.pkg');
          if (!file || seen.has(file)) continue;
          const stat = fs.statSync(file);
          if (!stat.isFile() || !stat.size) continue;
          seen.add(file);
          list.push({id: id(file), type, title, file, size: stat.size, preview, rating, tags});
        }
      } catch {}
    }
  }
  return list.sort((a, b) => a.title.localeCompare(b.title, 'zh-CN'));
}
