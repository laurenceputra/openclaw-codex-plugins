import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {normalize,validateConfig} from '../policy.mjs';
import plugin,{descriptor} from '../index.mjs';
const config={agentDir:'/synthetic-owner',profileId:'openai:synthetic',binaryPath:'/synthetic-binary'};
const results=Array.from({length:10},(_,i)=>({type:'text_result',url:'https://example.com/'+i,title:'Source '+i,snippet:'Fact '+i}));
test('shared default and explicit count unique budget with no extra summary URLs',()=>{
 for(const count of [undefined,1,3,10]){
  const o=normalize(results.map(r=>'[source]('+r.url+')').join(' ')+' bare https://extra.example/outside',[{type:'webSearch',results:[results[0],...results]}],'q',{count});
  assert.equal(o.citations.length,count??5);
  assert.equal((o.content.match(/Key facts \(native snippet/g)??[]).length,count??5);
  assert(!o.content.includes('https://extra.example'));
  if((count??5)<10)assert(!o.content.includes('https://example.com/'+(count??5)));
 }
});
test('sparse evidence stays sparse and metadata facts excluded',()=>{
 const o=normalize('Summary',[{type:'webSearch',results:[results[0],results[0]]}],'q',{count:10});assert.equal(o.citations.length,1);
 assert.throws(()=>normalize('No evidence',[{type:'webSearch',results:[]}],'q'));
});
test('bounded snippet and summary explicit truncation',()=>{
 const o=normalize('x'.repeat(1000),[{type:'webSearch',results:[{...results[0],snippet:'y'.repeat(1000)}]}],'q',{snippetChars:100,summaryChars:100});
 assert.match(o.content,/TRUNCATED snippet/);assert.match(o.content,/TRUNCATED summary/);assert(!o.content.includes('x'.repeat(101)));assert(!o.content.includes('y'.repeat(101)));
});
test('config defaults ranges model effort and root inline settings',()=>{
 const c=validateConfig(config);assert.equal(c.model,'gpt-6-sol');assert.equal(c.effort,'low');assert.equal(c.snippetChars,1500);assert.equal(c.summaryChars,24000);assert.deepEqual(descriptor(()=>c).configPath,[]);
 assert.equal(validateConfig({...config,model:'gpt-other',effort:'high'}).effort,'high');
 for(const value of [{model:'unsafe model'},{effort:'research'},{snippetChars:99},{summaryChars:48001}])assert.throws(()=>validateConfig({...config,...value}));
});
test('package allowlist excludes operational artifacts and is private pending publication',async()=>{
 const p=JSON.parse(await readFile(new URL('../package.json',import.meta.url)));assert.equal(p.version,'0.2.0');assert.equal(p.private,true);assert.equal(p.peerDependencies.openclaw,'2026.9.8');assert(!p.files.some(f=>/canary|EVIDENCE|config-snapshot/.test(f)));
});

test('runtime host version and registration API fail closed',()=>{for(const api of [{},{runtime:{version:'2026.9.9'},registerWebSearchProvider(){}},{runtime:{version:'2026.9.8'}}])assert.throws(()=>plugin.register(api));let registered;plugin.register({runtime:{version:'2026.9.8'},registerWebSearchProvider(p){registered=p;}});assert.equal(registered.id,'custom-codex-search');});

test('uppercase and network-path URLs share retained budget in every displayed section',()=>{
 const links='[upper](HTTPS://second.example/source) [network](//third.example/source) bare HTTPS://fourth.example/source //fifth.example/source';
 const o=normalize(links,[{type:'webSearch',results:[{...results[0],title:links,snippet:links},{type:'text_result',url:'https://inventory.example/source',ref_id:'turn1view0',title:links,snippet:'Total lines: 10'}]}],'q',{count:1});
 assert.deepEqual(o.citations,[{url:results[0].url}]);
 for(const host of ['second','third','fourth','fifth','inventory'])assert(!o.content.includes(host+'.example'));
 assert.match(o.content,/source omitted: count budget/);
 const retained=normalize('[upper](HTTPS://example.com/0) [network](//example.com/0)',[{type:'webSearch',results:[results[0]]}],'q',{count:1});
 assert(retained.content.includes('HTTPS://example.com/0'));assert(retained.content.includes('//example.com/0'));assert.equal(retained.citations.length,1);
});
test('post-scrub budgets bound replacement expansion and exact boundaries',()=>{
 const sections=o=>({snippet:o.content.split('Key facts (native snippet; date only if present): ')[1].split('\nNative URL inventory')[0],summary:o.content.split('Limited summary (unverified claims):\n')[1].split('\n</UNTRUSTED')[0]});
 for(const size of [99,100,101]){
  const input='x'.repeat(size),o=sections(normalize(input,[{type:'webSearch',results:[{...results[0],snippet:input}]}],'q',{snippetChars:100,summaryChars:100}));
  for(const [section,value] of Object.entries(o))assert.equal(value,'x'.repeat(Math.min(size,100))+(size>100?' [TRUNCATED '+section+']':''));
 }
 const input='https://a '.repeat(10);assert.equal(input.length,100);
 const o=sections(normalize(input,[{type:'webSearch',results:[{...results[0],snippet:input}]}],'q',{snippetChars:100,summaryChars:100}));
 const scrubbed='[source omitted: count budget] '.repeat(10);
 for(const [section,value] of Object.entries(o))assert.equal(value,scrubbed.slice(0,100)+' [TRUNCATED '+section+']');
});
