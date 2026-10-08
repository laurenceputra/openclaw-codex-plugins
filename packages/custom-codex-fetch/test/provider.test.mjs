import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile, access, rm } from 'node:fs/promises';
import { descriptor } from '../index.mjs';
import { fetchPage as search } from '../fetch.mjs';
import { MODEL, searchPolicy, validateConfig, attestConfig } from '../policy.mjs';
import { createAuthAdapter } from '../auth-adapter.mjs';
const config={agentDir:'/owner',profileId:'openai:locked',binaryPath:'/fake',timeoutMs:1000,startupMs:100,cleanupMs:100};
const token={accessToken:'offline-fake',chatgptAccountId:'fake-account',chatgptPlanType:'plus'};
function fake(mode='ok', selected={model:MODEL,effort:'low'}, catalogOverrides={}, ackOverrides={}){
  const state={closed:0,roots:[],calls:[]};
  state.createServer=(bin,root,policy,signal)=>{
    state.roots.push(root);assert.equal(policy.web_search,'live');
    const s={events:[],send(){},async close(){state.closed++;if(mode==='closefail')throw Error('reap failed');},async request(method,p){
      state.calls.push([method,p]);
      if(mode===method)return new Promise(()=>{});
      if(method==='initialize')return {};
      if(method==='account/login/start')return {};
      if(method==='account/read'&&mode==='refresh'){await s.onRequest({method:'account/chatgptAuthTokens/refresh',params:{previousAccountId:'fake-account'}});} if(method==='account/read')return {account:{type:'chatgpt'}};
      if(method==='configRequirements/read')return {requirements:null};
      if(method==='config/read')return {layers:[],config:{features:Object.fromEntries(Object.keys(searchPolicy).filter(k=>k.startsWith('features.')).map(k=>[k.slice(9),false])),web_search:'live'}};
      if(method==='model/list'&&mode==='modelconfig')return {data:[{id:'gpt-test',model:'gpt-test',inputModalities:['text'],supportedReasoningEfforts:[{reasoningEffort:'high'}]}]};
      if(method==='model/list'&&mode==='noModel')return {data:[]}; if(method==='model/list')return {data:[{id:selected.model,model:selected.model,hidden:true,inputModalities:['text'],supportedReasoningEfforts:[{reasoningEffort:selected.effort}],...catalogOverrides}]};
      if(method==='thread/start')return {model:mode==='reroute'?'gpt-other':mode==='modelconfig'?'gpt-test':selected.model,modelProvider:mode==='providerReroute'?'other':'openai',reasoningEffort:mode==='effortreroute'?'medium':mode==='modelconfig'?'high':selected.effort,thread:{id:'t'},...ackOverrides};
      if(method==='turn/start'){
        const items=[{type:'userMessage',id:'input',clientId:null,content:p.input},{id:'answer',phase:'final_answer',memoryCitation:null,delivery:null,questions:null,type:'agentMessage',text:mode==='citations'?'No sources':JSON.stringify({url:'https://example.com/page',status:'retrieved',chunks:['Offline sample body'],error:''}),extra:'strip-me'}];
        if(mode!=='missingsearch')items.push({type:'webSearch',id:'search',query:'q',action:{type:'openPage',url:'https://example.com/page'},results:null});
        for(const item of items)s.events.push({method:'item/completed',params:{threadId:'t',turnId:'u',item}});
        if(mode==='capability')s.events.push({method:'item/completed',params:{threadId:'t',turnId:'u',item:{type:'commandExecution',id:'cmd'}}});
        if(['bufferedreroute','later reroute','retry','foreign'].includes(mode)){const event={method:mode==='retry'?'error':'model/rerouted',params:{threadId:mode==='foreign'?'other':'t',turnId:'u',fromModel:MODEL,toModel:'gpt-6.1',reason:'highRiskCyberActivity',error:{message:'disconnected',codexErrorInfo:null,additionalDetails:null},willRetry:true}};if(mode==='later reroute')setTimeout(()=>s.onEvent(event),5);else s.events.push(event);}
        const m={method:'turn/completed',params:{threadId:'t',turn:{id:'u',status:mode==='failure'?'failed':'completed'}}};if(mode!=='later reroute'){s.events.push(m);s.onEvent?.(m);}return {turn:{id:'u'}};
      } throw new Error('Unexpected method');
    }};return s;
  };state.preflight=async()=>{};state.auth=async()=>token;return state;
}
test('auth exact lock force refresh and invariant',async()=>{
  const calls=[];let account='a';const adapter=createAuthAdapter(async p=>{calls.push(p);return {profileId:p.profileId,mode:'oauth',apiKey:'fake'};},()=>({accountId:account,chatgptPlanType:'plus'}));
  const signal=new AbortController().signal;await adapter({...config,cfg:{},signal});await adapter({...config,cfg:{},signal,forceRefresh:true,accountId:'a'});
  assert(calls.every(p=>p.lockedProfile&&p.provider==='openai'&&p.signal===signal));assert.equal(calls[1].forceRefresh,true);
  account='b';await assert.rejects(adapter({...config,signal,accountId:'a'}));
  for(const auth of [{profileId:'other',mode:'oauth',apiKey:'fake'},{profileId:config.profileId,mode:'api-key',apiKey:'fake'},{profileId:config.profileId,mode:'oauth',authFlow:'chatgpt-identity',apiKey:'fake'}])await assert.rejects(createAuthAdapter(async()=>auth,()=>({accountId:'a',chatgptPlanType:'plus'}))({...config,signal}));
});
test('success private home cleanup and sanitized evidence',async()=>{
  const d=fake();let proof;const o=await search(config,{}, {url:'https://example.com/page'}, {},{...d,onEvidence:e=>proof=e});assert.equal(o.extractor,'codex-native-agent-extraction');assert.equal(proof.model,MODEL);assert.equal(d.closed,1);await assert.rejects(access(d.roots[0]));
  assert.deepEqual(d.calls.find(([m])=>m==='thread/start')[1].dynamicTools,[]);
});
for(const mode of ['reroute','missingsearch','failure','citations'])test('reject '+mode,async()=>{const d=fake(mode);await assert.rejects(search(config,{}, {url:'https://example.com/page'}, {},d));assert.equal(d.closed,1);});
for(const phase of ['initialize','thread/start','turn/start'])test('abort race '+phase,async()=>{
  const d=fake(phase),ac=new AbortController();const work=search(config,{}, {url:'https://example.com/page'}, {signal:ac.signal},d);setTimeout(()=>ac.abort(),20);await assert.rejects(work);assert.equal(d.closed,1);
});
test('startup deadline',async()=>{const d=fake('initialize');await assert.rejects(search(config,{}, {url:'https://example.com/page'}, {},d));assert.equal(d.closed,1);});
test('concurrency cancellation independence',async()=>{const a=fake('turn/start'),b=fake(),ac=new AbortController();const first=search(config,{}, {url:'https://example.com/page'}, {signal:ac.signal},a);const second=search(config,{}, {url:'https://example.com/page'}, {},b);setTimeout(()=>ac.abort(),20);await assert.rejects(first);assert.equal((await second).extractor,'codex-native-agent-extraction');assert.notEqual(a.roots[0],b.roots[0]);});
test('assertCurrent prevents late output',async()=>{const d=fake();let n=0;await assert.rejects(search(config,{}, {url:'https://example.com/page'}, {assertCurrent(){if(++n>12)throw Error('stale');}},d));});
test('invalid limits fail before execution',()=>{assert.throws(()=>validateConfig({...config,timeoutMs:0}));});

test('total deadline covers unresolved turn/start',async()=>{const d=fake('turn/start');await assert.rejects(search(config,{}, {url:'https://example.com/page'}, {},d));assert.equal(d.closed,1);});
test('abort during auth creates no process',async()=>{const d=fake(),ac=new AbortController();d.auth=()=>new Promise(()=>{});const work=search(config,{}, {url:'https://example.com/page'}, {signal:ac.signal},d);setTimeout(()=>ac.abort(),10);await assert.rejects(work);assert.equal(d.roots.length,0);});

for(const mode of ['bufferedreroute','later reroute','retry','capability'])test('native regression '+mode,async()=>{const d=fake(mode);await assert.rejects(search(config,{}, {url:'https://example.com/page'}, {},d));assert.equal(d.closed,1);});
test('foreign reroute does not poison owned turn',async()=>{await search(config,{}, {url:'https://example.com/page'}, {},fake('foreign'));});
test('suppressed administrative hooks rejected in original layer',()=>{for(const type of ['mdm','system','enterpriseManaged'])assert.throws(()=>attestConfig({layers:[{name:{type},version:'1',disabledReason:null,config:{hooks:{SessionStart:[{hooks:[{type:'command',command:'admin'}]}]}}}],config:{features:Object.fromEntries(Object.keys(searchPolicy).filter(k=>k.startsWith('features.')).map(k=>[k.slice(9),false])),web_search:'live',hooks:{SessionStart:[]}}}),/Administrative hooks/);});
test('native unbounded retries disabled without forbidden built-in provider override',()=>{assert.equal(searchPolicy['features.unbounded_connection_retries'],false);assert.equal(searchPolicy['model_providers.openai.request_max_retries'],undefined);});
test('failed reap uses one cleanup and retains private directory without publication',async()=>{const d=fake('closefail');let published=false;await assert.rejects(search(config,{}, {url:'https://example.com/page'}, {},{...d,onEvidence(){published=true;}}));assert.equal(d.closed,1);assert.equal(published,false);await access(d.roots[0]);await rm(d.roots[0],{recursive:true,force:true});});


for(const mode of ['providerReroute','effortreroute','noModel'])test('exact protocol reject '+mode,async()=>{const d=fake(mode);await assert.rejects(search(config,{}, {url:'https://example.com/page'}, {},d));assert(!d.calls.some(([m])=>m==='turn/start'));});
test('preflight block precedes auth and process',async()=>{const d=fake();d.preflight=async()=>{throw Error('blocked');};let auth=false;d.auth=async()=>{auth=true;return token;};await assert.rejects(search(config,{}, {url:'https://example.com/page'}, {},d));assert(!auth);assert.equal(d.roots.length,0);});
test('pre-aborted caller launches no process',async()=>{const d=fake(),ac=new AbortController();ac.abort();await assert.rejects(search(config,{}, {url:'https://example.com/page'}, {signal:ac.signal},d));assert.equal(d.roots.length,0);});
test('process cap rejects third concurrent operation without retry',async()=>{const a=fake('initialize'),b=fake('initialize'),c=fake(),ac=new AbortController();const x=search(config,{}, {url:'https://example.com/page'},{signal:ac.signal},a),y=search(config,{}, {url:'https://example.com/page'},{signal:ac.signal},b);const settled=Promise.allSettled([x,y]);await assert.rejects(search(config,{}, {url:'https://example.com/page'},{},c),/concurrency/);assert.equal(c.roots.length,0);ac.abort();await settled;});
test('schema sent and developer instructions contain no fixture answer',async()=>{const d=fake();await search(config,{}, {url:'https://example.com/page'}, {},d);const turn=d.calls.find(([m])=>m==='turn/start')[1];assert.equal(turn.outputSchema.additionalProperties,false);const developer=d.calls.find(([m])=>m==='thread/start')[1].developerInstructions;assert(!developer.includes('Offline sample body'));assert.match(developer,/verbatim/);});

test('native refresh locks original account and forces framework refresh',async()=>{const d=fake('refresh'),calls=[];d.auth=async p=>{calls.push(p);return token;};await search(config,{}, {url:'https://example.com/page'}, {},d);assert.equal(calls.length,2);assert.equal(calls[1].forceRefresh,true);assert.equal(calls[1].accountId,token.chatgptAccountId);assert.equal(calls[1].profileId,config.profileId);});

test('tiny caller budget fails before preflight/auth/process',async()=>{const d=fake();await assert.rejects(search(config,{}, {url:'https://example.com/page',maxChars:100},{},d),/maxChars/);assert.equal(d.roots.length,0);assert.equal(d.calls.length,0);});

const alternate={model:'gpt-6-luna',effort:'high'};
test('alternate catalog model and effort explicitly requested and acknowledged',async()=>{
  const d=fake('ok',alternate);let evidence;
  await search({...config,model:'  gpt-6-luna  ',effort:'high'},{},{url:'https://example.com/page'},{},{...d,onEvidence:e=>evidence=e});
  const thread=d.calls.find(([m])=>m==='thread/start')[1],turn=d.calls.find(([m])=>m==='turn/start')[1];
  assert.equal(thread.model,alternate.model);assert.equal(thread.modelProvider,'openai');assert.equal(thread.config.model_reasoning_effort,'high');
  assert.equal(turn.model,alternate.model);assert.equal(turn.effort,'high');assert.equal(evidence.model,alternate.model);assert.equal(evidence.effort,'high');
});
for(const [label,catalog,ack] of [
  ['absent selected model',{id:MODEL,model:MODEL},{}],
  ['catalog identifier mismatch',{id:MODEL},{}],
  ['no text input',{inputModalities:['image']},{}],
  ['unsupported selected effort',{supportedReasoningEfforts:[{reasoningEffort:'low'}]},{}],
  ['missing catalog effort',{supportedReasoningEfforts:undefined},{}],
  ['different ACK model',{}, {model:MODEL}],
  ['missing ACK model',{}, {model:undefined}],
  ['different ACK provider',{}, {modelProvider:'other'}],
  ['missing ACK provider',{}, {modelProvider:undefined}],
  ['different ACK effort',{}, {reasoningEffort:'low'}],
  ['missing ACK effort',{}, {reasoningEffort:undefined}]
])test('selected model rejects '+label,async()=>{
  const d=fake('ok',alternate,catalog,ack);
  await assert.rejects(search({...config,...alternate},{},{url:'https://example.com/page'},{},d));
  assert(!d.calls.some(([m])=>m==='turn/start'));assert.equal(d.closed,1);
});
test('config selector defaults and strict validation',()=>{
  const defaults=validateConfig({agentDir:config.agentDir,profileId:config.profileId,binaryPath:config.binaryPath});
  assert.equal(defaults.model,MODEL);assert.equal(defaults.effort,'low');assert.equal(defaults.timeoutMs,90000);assert.equal(defaults.startupMs,15000);assert.equal(defaults.cleanupMs,5000);
  assert.equal(validateConfig({...config,model:' arbitrary/model ID '}).model,'arbitrary/model ID');
  for(const model of ['', '  ',null,42,{},[]])assert.throws(()=>validateConfig({...config,model}),/Invalid model/);
  for(const effort of ['', ' low ',null,42,{},'extreme'])assert.throws(()=>validateConfig({...config,effort}),/Invalid effort/);
  for(const effort of ['none','minimal','low','medium','high','xhigh','max','ultra'])assert.equal(validateConfig({...config,effort}).effort,effort);
});
test('manifest selectors match runtime defaults and accepted effort enum',async()=>{
  const manifest=JSON.parse(await readFile(new URL('../openclaw.plugin.json',import.meta.url)));
  const p=manifest.configSchema.properties;assert.equal(p.model.const,undefined);assert.equal(p.model.default,MODEL);assert.equal(p.effort.default,'low');
  assert.deepEqual(p.effort.enum,['none','minimal','low','medium','high','xhigh','max','ultra']);
  for(const effort of p.effort.enum)assert.equal(validateConfig({...config,effort}).effort,effort);
  assert(!new RegExp(p.model.pattern).test('   '));assert(new RegExp(p.model.pattern).test(' gpt-6-luna '));
});
