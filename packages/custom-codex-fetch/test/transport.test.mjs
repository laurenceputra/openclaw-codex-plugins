import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { StdioServer, toml } from '../transport.mjs';
async function owned(body,run){
  const root=await mkdtemp(join(tmpdir(),'fake-codex-test-'));
  for(const p of ['codex','cwd','tmp'])await mkdir(join(root,p));
  const binary=join(root,'fake');await writeFile(binary,'#!/usr/bin/env node\n'+body,{mode:0o700});
  try{await run(root,binary);}finally{await rm(root,{recursive:true,force:true});}
}
test('TOML inline objects use equals not JSON colon',()=>assert.equal(toml({Stop:[]}),'{"Stop"=[]}'));
test('owned process abort pending initialize kills reaps and retires',async()=>owned('setInterval(()=>{},1000);',async(root,binary)=>{
  const ac=new AbortController(),s=new StdioServer(binary,root,{},ac.signal);
  const pending=s.request('initialize');ac.abort();await assert.rejects(pending);await s.close(500);
  assert(s.child.exitCode !== null || s.child.signalCode !== null);await assert.rejects(s.request('model/list'));
}));
test('owned fake stdio server protocol and clean retirement',async()=>owned(
  String.raw`process.stdin.setEncoding("utf8");let b="";process.stdin.on("data",c=>{b+=c;let i;while((i=b.indexOf("\n"))>=0){const m=JSON.parse(b.slice(0,i));b=b.slice(i+1);process.stdout.write(JSON.stringify({id:m.id,result:{ok:true}})+"\n");}});`,
  async(root,binary)=>{
    const ac=new AbortController(),s=new StdioServer(binary,root,{},ac.signal);
    const timeout=setTimeout(()=>ac.abort(),1000);
    try{assert.deepEqual(await s.request('initialize'),{ok:true});}finally{clearTimeout(timeout);await s.close(500);}
  }));

test('native oversized line fails closed and reaps',async()=>owned('process.stdout.write("x".repeat(2000001)+String.fromCharCode(10));setInterval(()=>{},1000);',async(root,binary)=>{const ac=new AbortController(),s=new StdioServer(binary,root,{},ac.signal);await assert.rejects(s.request('initialize'));await s.close(500);assert(s.retired);}));
