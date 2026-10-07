import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile, access } from 'node:fs/promises';
import { descriptor } from '../index.mjs';
import { search } from '../search.mjs';
import { MODEL, searchPolicy, normalize, validateConfig, attestConfig } from '../policy.mjs';
import { createAuthAdapter } from '../auth-adapter.mjs';
const config={agentDir:'/owner',profileId:'openai:locked',binaryPath:'/fake',timeoutMs:1000,startupMs:100,cleanupMs:100};
const token={accessToken:'offline-fake',chatgptAccountId:'fake-account',chatgptPlanType:'plus'};
function fake(mode='ok'){
  const state={closed:0,roots:[],calls:[]};
  state.createServer=(bin,root,policy,signal)=>{
    state.roots.push(root);assert.equal(policy.web_search,'live');
    const s={events:[],send(){},async close(){state.closed++;if(mode==='closefail')throw Error('reap failed');},async request(method,p){
      state.calls.push([method,p]);
      if(mode===method)return new Promise(()=>{});
      if(method==='initialize')return {};
      if(method==='account/login/start')return {};
      if(method==='account/read')return {account:{type:'chatgpt'}};
      if(method==='configRequirements/read')return {requirements:null};
      if(method==='config/read')return {layers:[],config:{features:Object.fromEntries(Object.keys(searchPolicy).filter(k=>k.startsWith('features.')).map(k=>[k.slice(9),false])),web_search:'live'}};
      if(method==='model/list'&&mode==='modelconfig')return {data:[{id:'gpt-test',model:'gpt-test',inputModalities:['text'],supportedReasoningEfforts:[{reasoningEffort:'high'}]}]};
      if(method==='model/list')return {data:[{id:MODEL,model:MODEL,hidden:true,inputModalities:['text'],supportedReasoningEfforts:[{reasoningEffort:'low'}]}]};
      if(method==='thread/start')return {model:mode==='reroute'?'gpt-other':mode==='modelconfig'?'gpt-test':MODEL,modelProvider:'openai',reasoningEffort:mode==='effortreroute'?'medium':mode==='modelconfig'?'high':'low',thread:{id:'t'}};
      if(method==='turn/start'){
        const items=[{type:'userMessage',id:'input',clientId:null,content:p.input},{id:'answer',phase:'final_answer',memoryCitation:null,delivery:null,questions:null,type:'agentMessage',text:mode==='citations'?'No sources':'Answer [source](https://example.com/page)',extra:'strip-me'}];
        if(mode!=='missingsearch')items.push({type:'webSearch',id:'search',query:'q',action:{type:'openPage',url:'https://example.com/page'},results:null});
        for(const item of items)s.events.push({method:'item/completed',params:{threadId:'t',turnId:'u',item}});
        if(mode==='capability')s.events.push({method:'item/completed',params:{threadId:'t',turnId:'u',item:{type:'commandExecution',id:'cmd'}}});
        if(['bufferedreroute','later reroute','retry','foreign'].includes(mode)){const event={method:mode==='retry'?'error':'model/rerouted',params:{threadId:mode==='foreign'?'other':'t',turnId:'u',fromModel:MODEL,toModel:'gpt-6.1',reason:'highRiskCyberActivity',error:{message:'disconnected',codexErrorInfo:null,additionalDetails:null},willRetry:true}};if(mode==='later reroute')setTimeout(()=>s.onEvent(event),5);else s.events.push(event);}
        const m={method:'turn/completed',params:{threadId:'t',turn:{id:'u',status:mode==='failure'?'failed':'completed'}}};if(mode!=='later reroute'){s.events.push(m);s.onEvent?.(m);}return {turn:{id:'u'}};
      } throw new Error('Unexpected method');
    }};return s;
  };state.auth=async()=>token;return state;
}
test('manifest and descriptor independently register custom ID',async()=>{
  const manifest=JSON.parse(await readFile(new URL('../openclaw.plugin.json',import.meta.url)));
  assert.deepEqual(manifest.contracts.webSearchProviders,['custom-codex-search']);assert.equal(descriptor(()=>config).id,manifest.id);
});
test('normalization strips extras and validates sources',()=>{
  const o=normalize('a [s](https://example.com)',[{type:'webSearch',action:{type:'openPage',url:'https://example.com'},extra:'secret'}],'q');assert.equal(o.citations.length,1);assert.equal(o.extra,undefined);
  for(const text of ['no sources','[x](http://localhost/a)','[x](https://user:pass@example.com)'])assert.throws(()=>normalize(text,[],'q'));
});
test('auth exact lock force refresh and invariant',async()=>{
  const calls=[];let account='a';const adapter=createAuthAdapter(async p=>{calls.push(p);return {profileId:p.profileId,mode:'oauth',apiKey:'fake'};},()=>({accountId:account,chatgptPlanType:'plus'}));
  const signal=new AbortController().signal;await adapter({...config,cfg:{},signal});await adapter({...config,cfg:{},signal,forceRefresh:true,accountId:'a'});
  assert(calls.every(p=>p.lockedProfile&&p.provider==='openai'&&p.signal===signal));assert.equal(calls[1].forceRefresh,true);
  account='b';await assert.rejects(adapter({...config,signal,accountId:'a'}));
  for(const auth of [{profileId:'other',mode:'oauth',apiKey:'fake'},{profileId:config.profileId,mode:'api-key',apiKey:'fake'},{profileId:config.profileId,mode:'oauth',authFlow:'chatgpt-identity',apiKey:'fake'}])await assert.rejects(createAuthAdapter(async()=>auth,()=>({accountId:'a',chatgptPlanType:'plus'}))({...config,signal}));
});
test('success private home cleanup and sanitized evidence',async()=>{
  const d=fake();let proof;const o=await search(config,{}, {query:'q'}, {},{...d,onEvidence:e=>proof=e});assert.equal(o.provider,'custom-codex-search');assert.equal(proof.model,MODEL);assert.equal(d.closed,1);await assert.rejects(access(d.roots[0]));
  assert.deepEqual(d.calls.find(([m])=>m==='thread/start')[1].dynamicTools,[]);
});
for(const mode of ['reroute','missingsearch','failure','citations'])test('reject '+mode,async()=>{const d=fake(mode);await assert.rejects(search(config,{}, {query:'q'}, {},d));assert.equal(d.closed,1);});
for(const phase of ['initialize','thread/start','turn/start'])test('abort race '+phase,async()=>{
  const d=fake(phase),ac=new AbortController();const work=search(config,{}, {query:'q'}, {signal:ac.signal},d);setTimeout(()=>ac.abort(),20);await assert.rejects(work);assert.equal(d.closed,1);
});
test('startup deadline',async()=>{const d=fake('initialize');await assert.rejects(search(config,{}, {query:'q'}, {},d));assert.equal(d.closed,1);});
test('concurrency cancellation independence',async()=>{const a=fake('turn/start'),b=fake(),ac=new AbortController();const first=search(config,{}, {query:'a'}, {signal:ac.signal},a);const second=search(config,{}, {query:'b'}, {},b);setTimeout(()=>ac.abort(),20);await assert.rejects(first);assert.equal((await second).provider,'custom-codex-search');assert.notEqual(a.roots[0],b.roots[0]);});
test('assertCurrent prevents late output',async()=>{const d=fake();let n=0;await assert.rejects(search(config,{}, {query:'q'}, {assertCurrent(){if(++n>12)throw Error('stale');}},d));});
test('invalid limits fail before execution',()=>{assert.throws(()=>validateConfig({...config,timeoutMs:0}));});

test('total deadline covers unresolved turn/start',async()=>{const d=fake('turn/start');await assert.rejects(search(config,{}, {query:'q'}, {},d));assert.equal(d.closed,1);});
test('abort during auth creates no process',async()=>{const d=fake(),ac=new AbortController();d.auth=()=>new Promise(()=>{});const work=search(config,{}, {query:'q'}, {signal:ac.signal},d);setTimeout(()=>ac.abort(),10);await assert.rejects(work);assert.equal(d.roots.length,0);});

for(const mode of ['bufferedreroute','later reroute','retry','capability'])test('native regression '+mode,async()=>{const d=fake(mode);await assert.rejects(search(config,{}, {query:'q'}, {},d));assert.equal(d.closed,1);});
test('foreign reroute does not poison owned turn',async()=>{await search(config,{}, {query:'q'}, {},fake('foreign'));});
test('answer-only and invented annotation URLs rejected',()=>{for(const items of [[],[{type:'agentMessage',annotations:[{type:'url_citation',url:'https://example.com'}]}]])assert.throws(()=>normalize('[s](https://example.com)',items,'q'));});
test('suppressed administrative hooks rejected in original layer',()=>{for(const type of ['mdm','system','enterpriseManaged'])assert.throws(()=>attestConfig({layers:[{name:{type},version:'1',disabledReason:null,config:{hooks:{SessionStart:[{hooks:[{type:'command',command:'admin'}]}]}}}],config:{features:Object.fromEntries(Object.keys(searchPolicy).filter(k=>k.startsWith('features.')).map(k=>[k.slice(9),false])),web_search:'live',hooks:{SessionStart:[]}}}),/Administrative hooks/);});
test('native unbounded retries disabled without forbidden built-in provider override',()=>{assert.equal(searchPolicy['features.unbounded_connection_retries'],false);assert.equal(searchPolicy['model_providers.openai.request_max_retries'],undefined);});
test('failed reap uses one cleanup and retains private directory without publication',async()=>{const d=fake('closefail');let published=false;await assert.rejects(search(config,{}, {query:'q'}, {},{...d,onEvidence(){published=true;}}));assert.equal(d.closed,1);assert.equal(published,false);await access(d.roots[0]);});

test('configured model effort and requested count reach native protocol',async()=>{const d=fake('modelconfig');await search({...config,model:'gpt-test',effort:'high'}, {},{query:'q',count:2},{},d);assert.equal(d.calls.find(([m])=>m==='thread/start')[1].model,'gpt-test');assert.match(d.calls.find(([m])=>m==='thread/start')[1].developerInstructions,/at most 2/);assert.equal(d.calls.find(([m])=>m==='turn/start')[1].effort,'high');});
test('unavailable configured model fails closed before turn',async()=>{const d=fake();await assert.rejects(search({...config,model:'gpt-unavailable'}, {},{query:'q'},{},d));assert(!d.calls.some(([m])=>m==='turn/start'));});

test('native effort acknowledgement mismatch rejected',async()=>{const d=fake('effortreroute');await assert.rejects(search(config,{}, {query:'q'}, {},d));assert(!d.calls.some(([m])=>m==='turn/start'));});
