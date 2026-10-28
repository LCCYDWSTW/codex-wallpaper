import fs from 'node:fs';
import path from 'node:path';

export function loadConfig(env = process.env) {
  if (!env.LOCALAPPDATA || !env.APPDATA) throw Error('Windows APPDATA and LOCALAPPDATA are required');
  const dataDir = env.CODEX_WALLPAPER_HOME || path.join(env.LOCALAPPDATA, 'CodexWallpaper');
  if (!path.isAbsolute(dataDir)) throw Error('Data directory must be absolute');
  const file = path.join(dataDir, 'config.json');
  let input;
  try { input = JSON.parse(fs.readFileSync(file, 'utf8').replace(/^\uFEFF/, '')); }
  catch (error) { throw Error(`Cannot read ${file}. Run install.ps1 first. ${error.message}`); }
  if (!input || !Array.isArray(input.workshopDirs) || !input.workshopDirs.length ||
      input.workshopDirs.some(v => typeof v !== 'string' || !path.isAbsolute(v))) {
    throw Error('config.json: workshopDirs must contain absolute directory paths');
  }
  const profile = input.codexProfile || path.join(env.APPDATA, 'Codex', 'web', 'Codex');
  if (typeof profile !== 'string' || !path.isAbsolute(profile)) throw Error('codexProfile must be absolute');
  if (input.wallpaperEngineConfig != null && (typeof input.wallpaperEngineConfig !== 'string' || !path.isAbsolute(input.wallpaperEngineConfig))) throw Error('wallpaperEngineConfig must be absolute or null');
  if (input.ffmpegPath != null && typeof input.ffmpegPath !== 'string') throw Error('ffmpegPath must be a string');
  fs.mkdirSync(dataDir, {recursive: true});
  return {dataDir, profile, workshopDirs: input.workshopDirs, weConfig: input.wallpaperEngineConfig || null, ffmpegPath: input.ffmpegPath || 'ffmpeg'};
}
