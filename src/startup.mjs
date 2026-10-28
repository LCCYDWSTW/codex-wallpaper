// The Windows wrapper holds a named mutex for the entire operation.
// Dependencies are injected so cold-start and failure paths can be tested without closing Codex.
export async function ensureStarted(api) {
  let port = await api.livePort();
  if (!port) {
    const pids = await api.mainPids();
    if (pids.length) throw Error('Codex is already open without wallpaper support. Fully quit Codex, then use the Codex Wallpaper shortcut.');
    await api.startCodex();
    port = await api.waitForPort();
    if (!port) throw Error('Codex did not become ready within 90 seconds. See launch.log.');
  }
  if (!await api.helperIsRunning(port)) {
    const helper = await api.startHelper();
    if (!await api.waitForHelper(helper)) throw Error('Wallpaper helper did not become ready. See host-error.log.');
  }
  await api.focus();
  return port;
}
