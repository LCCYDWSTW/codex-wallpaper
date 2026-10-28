import {execFile} from 'node:child_process';

export class ChildProcesses {
  constructor() {
    this.children = new Set();
    this.stopped = false;
  }

  run(file, args, options = {}) {
    if (this.stopped) return Promise.reject(Error('Child process group is stopped'));
    return new Promise((resolve, reject) => {
      let child;
      try {
        child = execFile(file, args, options, (error, stdout, stderr) => {
          this.children.delete(child);
          if (error) {
            reject(error);
          } else {
            resolve({stdout, stderr});
          }
        });
      } catch (error) {
        reject(error);
        return;
      }
      this.children.add(child);
    });
  }

  stopAll({graceMs = 1000} = {}) {
    this.stopped = true;
    return Promise.all([...this.children].map(child => new Promise(resolve => {
      if (child.exitCode !== null || child.signalCode !== null) {
        this.children.delete(child);
        resolve();
        return;
      }
      let forceTimer, exitTimer;
      const done = () => {
        clearTimeout(forceTimer);
        clearTimeout(exitTimer);
        this.children.delete(child);
        resolve();
      };
      child.once('close', done);
      try {child.kill();} catch {}
      forceTimer = setTimeout(() => {
        try {child.kill('SIGKILL');} catch {}
        exitTimer = setTimeout(done, 250);
      }, graceMs);
    })));
  }
}
