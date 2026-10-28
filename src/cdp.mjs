export class CDP {
  constructor(url) {
    this.pending = new Map(); this.listeners = new Map(); this.seq = 0;
    const parsed = new URL(url);
    if (parsed.protocol !== 'ws:' || !['127.0.0.1', 'localhost', '[::1]'].includes(parsed.hostname)) throw Error('CDP endpoint must be local');
    this.ws = new WebSocket(url);
    this.ready = new Promise((resolve, reject) => {
      const timer = setTimeout(() => {reject(Error('CDP connection timed out')); this.close();}, 10000);
      this.ws.addEventListener('open', () => {clearTimeout(timer); resolve();}, {once: true});
      this.ws.addEventListener('error', () => {clearTimeout(timer); reject(Error('CDP connection failed'));}, {once: true});
      this.ws.addEventListener('close', () => {clearTimeout(timer); reject(Error('CDP closed before connection'));}, {once: true});
    });
    this.ready.catch(() => {});
    this.ws.addEventListener('message', event => {
      let message; try {message = JSON.parse(event.data);} catch {return;}
      if (message.id) {
        const p = this.pending.get(message.id);
        if (p) {clearTimeout(p.timer); this.pending.delete(message.id); message.error ? p.reject(Error(message.error.message)) : p.resolve(message.result);}
      } else {
        for (const fn of this.listeners.get(message.method) || []) Promise.resolve().then(() => fn(message.params)).catch(error => console.error(message.method, error.message));
      }
    });
    this.ws.addEventListener('close', () => {
      for (const p of this.pending.values()) {clearTimeout(p.timer); p.reject(Error('CDP closed'));}
      this.pending.clear();
    });
  }
  on(event, fn) {const list = this.listeners.get(event) || []; list.push(fn); this.listeners.set(event, list);}
  async send(method, params = {}) {
    await this.ready;
    const id = ++this.seq;
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {this.pending.delete(id); reject(Error(`CDP timeout: ${method}`));}, 20000);
      this.pending.set(id, {resolve, reject, timer});
      try {this.ws.send(JSON.stringify({id, method, params}));}
      catch (error) {clearTimeout(timer); this.pending.delete(id); reject(error);}
    });
  }
  async evaluate(expression) {
    const result = await this.send('Runtime.evaluate', {expression, returnByValue: true, awaitPromise: true});
    if (result.exceptionDetails) throw Error(result.exceptionDetails.text || 'Renderer evaluation failed');
    return result.result.value;
  }
  close() {try {this.ws.close();} catch {}}
}
