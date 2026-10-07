import { spawn } from 'node:child_process';
import { createInterface } from 'node:readline';
export function toml(value) {
  if (Array.isArray(value)) return '[' + value.map(toml).join(',') + ']';
  if (value && typeof value === 'object') return '{' + Object.entries(value).map(([k,v])=>JSON.stringify(k)+'='+toml(v)).join(',') + '}';
  return JSON.stringify(value);
}
export class StdioServer {
  constructor(binaryPath, root, policy, signal) {
    this.pending = new Map(); this.events = []; this.nextId = 1; this.retired = false;
    const args = Object.entries(policy).flatMap(([k,v])=>['-c', k+'='+toml(v)]);
    // A small allowlist avoids all inherited auth/config/environment tool sources.
    const env = { PATH: process.env.PATH ?? '/usr/bin:/bin', HOME: root, CODEX_HOME: root+'/codex', TMPDIR: root+'/tmp' };
    this.child = spawn(binaryPath, [...args,'app-server','--listen','stdio://'], { cwd: root+'/cwd', env, stdio: ['pipe','pipe','pipe'] });
    this.closed = new Promise(resolve => this.child.once('close', ()=>{ this.fail(); resolve(); }));
    this.child.once('error', ()=>this.fail());
    this.child.stdin.on('error', ()=>this.fail());
    this.child.stderr.resume(); // Never retain native diagnostics containing secrets.
    this.lines = createInterface({ input: this.child.stdout });
    this.lines.on('line', line => {
      if (line.length > 2_000_000) return this.fail();
      let m; try { m=JSON.parse(line); } catch { return this.fail(); }
      if (m.method && m.id !== undefined) {
        Promise.resolve(this.onRequest?.(m)).then(result=>this.send({id:m.id,result}),()=>{ this.send({id:m.id,error:{code:-32603,message:'Request rejected'}}); this.fail(); });
      } else if (m.id !== undefined) {
        const p=this.pending.get(m.id); if (!p) return;
        this.pending.delete(m.id); m.error ? p.reject(new Error('Native RPC failed')) : p.resolve(m.result);
      } else {
        if (this.events.length >= 10000) return this.fail();
        this.events.push(m); this.onEvent?.(m);
      }
    });
    this.abort = ()=>this.fail(); signal.addEventListener('abort',this.abort,{once:true}); this.signal=signal;
    if(signal.aborted) this.fail();
  }
  send(m) { if (!this.retired && this.child.stdin.writable) this.child.stdin.write(JSON.stringify(m)+'\n'); }
  request(method,params={}) {
    if (this.retired) return Promise.reject(new Error('Owned process retired'));
    return new Promise((resolve,reject)=>{const id=this.nextId++; this.pending.set(id,{resolve,reject}); this.send({id,method,params});});
  }
  fail() { if(this.retired)return; this.retired=true; for(const p of this.pending.values())p.reject(new Error('Owned process retired')); this.pending.clear(); this.onFailure?.(); this.child.kill('SIGTERM'); }
  async close(ms) {
    this.signal.removeEventListener('abort',this.abort);
    this.fail();
    const timer=setTimeout(()=>this.child.kill('SIGKILL'),Math.min(250,ms/2));
    let deadline;
    try { await Promise.race([this.closed,new Promise((_,reject)=>{deadline=setTimeout(()=>reject(new Error('Owned process did not reap within cleanup budget')),ms);})]); }
    finally { clearTimeout(timer); clearTimeout(deadline); this.lines.close(); }
  }
}
