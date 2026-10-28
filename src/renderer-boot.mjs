export function buildBootScript(renderer, boot) {
  const data = JSON.stringify(boot)
    .replace(/\u2028/g, '\\u2028')
    .replace(/\u2029/g, '\\u2029');
  return renderer.replace('__CW_BOOT__', () => data);
}
