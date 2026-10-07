import { mkdtemp, mkdir, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { loadAuthAdapter } from './auth-adapter.mjs';
import { StdioServer } from './transport.mjs';
import { MODEL, searchPolicy, validateConfig, attestConfig, normalize } from './policy.mjs';
export async function search(config, cfg, args, context={}, dependencies={}) {
  const c=validateConfig(config);
  if(typeof args.query!=='string'||!args.query.trim()||args.query.length>8000)throw new Error('Valid query required');
  for(const k of Object.keys(args)) if(!['query','count'].includes(k))throw new Error('Unsupported search argument: '+k);
  if(args.count!==undefined&&(!Number.isInteger(args.count)||args.count<1||args.count>10))throw new Error('Invalid count');
  const started=Date.now(), ac=new AbortController();
  const abort=()=>ac.abort(new Error('Search cancelled')); context.signal?.addEventListener('abort',abort,{once:true});
  if(context.signal?.aborted)abort();
  const total=setTimeout(()=>ac.abort(new Error('Search deadline exceeded')),c.timeoutMs);
  let stage='auth', startup=setTimeout(()=>ac.abort(new Error('Search startup deadline exceeded')),c.startupMs), root, server, cleanup;
  const retire=()=>cleanup ??= (async()=>{if(server)await server.close(c.cleanupMs);if(root)await rm(root,{recursive:true,force:true});})();
  const current=()=>{ac.signal.throwIfAborted(); context.assertCurrent?.();};
  const bounded=async promise=>{
    current(); let listener;
    try {return await Promise.race([promise,new Promise((_,reject)=>{listener=()=>reject(ac.signal.reason);ac.signal.addEventListener('abort',listener,{once:true});if(ac.signal.aborted)listener();})]);}
    finally{ac.signal.removeEventListener('abort',listener);} };
  try {
    current();
    const auth=dependencies.auth ?? await bounded(loadAuthAdapter());
    const token=await bounded(auth({cfg,agentDir:c.agentDir,profileId:c.profileId,signal:ac.signal})); current();
    root=await mkdtemp(join(tmpdir(),'custom-codex-search-')); current();
    await Promise.all(['codex','cwd','tmp'].map(x=>mkdir(join(root,x),{mode:0o700})));current();
    server=(dependencies.createServer ?? ((...a)=>new StdioServer(...a)))(c.binaryPath,root,searchPolicy,ac.signal);
    server.onRequest=async m=>{
      current();
      if(m.method!=='account/chatgptAuthTokens/refresh')throw new Error('Native tool request forbidden');
      if(m.params?.previousAccountId && m.params.previousAccountId!==token.chatgptAccountId)throw new Error('Refresh account changed');
      const fresh=await bounded(auth({cfg,agentDir:c.agentDir,profileId:c.profileId,signal:ac.signal,forceRefresh:true,accountId:token.chatgptAccountId}));current();return fresh;
    };
    const rpc=async(method,p)=>{stage=method;current();const r=await bounded(server.request(method,p));current();return r;};
    await rpc('initialize',{clientInfo:{name:'custom_codex_search',version:'0.2.0'},capabilities:{experimentalApi:true}});server.send({method:'initialized'});
    await rpc('account/login/start',{type:'chatgptAuthTokens',...token});
    const account=await rpc('account/read',{refreshToken:false});
    if(account?.account?.type!=='chatgpt')throw new Error('Native subscription account unavailable');
    const requirements=await rpc('configRequirements/read',{});
    // Conservative fail-closed: this standalone provider does not interpret admin mandates.
    if(!requirements || requirements.requirements===undefined || (requirements.requirements!==null && Object.keys(requirements.requirements).length))throw new Error('Administrator requirements unsupported');
    await rpc('config/read',{includeLayers:true,cwd:root+'/cwd'}).then(attestConfig);
    let cursor=null,found=false;const seen=new Set();
    for(let page=0;page<20;page++){
      const r=await rpc('model/list',{includeHidden:true,limit:100,cursor});
      if(!Array.isArray(r?.data))throw new Error('Invalid native model catalog');
      found ||= r.data.some(m=>m.id===c.model && m.model===c.model && m.inputModalities?.includes('text') && m.supportedReasoningEfforts?.some(e=>e.reasoningEffort===c.effort));
      cursor=r.nextCursor;if(!cursor)break;if(seen.has(cursor)||page===19)throw new Error('Invalid catalog pagination');seen.add(cursor);
    }
    if(!found)throw new Error('Required native Sol text/low model unavailable');
    clearTimeout(startup);startup=null;
    const thread=await rpc('thread/start',{model:c.model,modelProvider:'openai',cwd:root+'/cwd',ephemeral:true,dynamicTools:[],environments:[],approvalPolicy:'never',sandbox:'read-only',config:{...searchPolicy,model_reasoning_effort:c.effort},developerInstructions:'Return at most '+(args.count ?? 5)+' unique source entries; fewer when evidence is insufficient, never pad. Search-only worker. Use native live web_search. Return concise resource summaries: title, markdown source URL, publication date where available, and key facts. State whether each summary uses page content or only search snippets; never claim a page was read if inaccessible. If sources cannot be checked, explicitly mark unverified source candidates and limited claims. No other tools, delegation, file operations or follow-up questions.'});
    if(thread.model!==c.model||thread.modelProvider!=='openai'||thread.reasoningEffort!==c.effort||!thread.thread?.id)throw new Error('Native model/provider reroute rejected');
    const threadId=thread.thread.id;
    let settle,fail,turnId,violation;
    const buffered=[];
    const completion=new Promise((resolve,reject)=>{settle=resolve;fail=reject;});completion.catch(()=>{});
    server.onFailure=()=>fail(new Error('Native process retired'));
    server.onEvent=m=>{
      if(m.params?.threadId!==threadId)return;
      if(!turnId){buffered.push(m);return;}
      const p=m.params;
      if((p.turnId ?? p.turn?.id)!==turnId)return;
      if((m.method==='model/rerouted' && (p.fromModel!==c.model || p.toModel!==c.model)) || (m.method==='error' && p.willRetry===true)){
        violation=new Error('Native model reroute or retry rejected');fail(violation);ac.abort(violation);return;
      }
      if(m.method==='turn/completed')settle(p);
    };
    const turn=await rpc('turn/start',{threadId,model:c.model,effort:c.effort,environments:[],approvalPolicy:'never',sandboxPolicy:{type:'readOnly',networkAccess:false},input:[{type:'text',text:args.query,text_elements:[]}]});
    if(!turn.turn?.id)throw new Error('Missing native turn identity');
    turnId=turn.turn.id;
    for(const m of [...buffered,...server.events])server.onEvent(m);
    if(violation)throw violation;
    stage='turn/completed';const done=await bounded(completion);current();
    if(done.turn?.id!==turn.turn.id||done.turn.status!=='completed'||done.turn.error)throw new Error('Native turn failed or correlation mismatch');
    const items=server.events.filter(m=>m.method==='item/completed'&&m.params?.threadId===threadId&&m.params.turnId===turn.turn.id).map(m=>m.params.item);
    if(!items.some(i=>i.type==='webSearch'&&(!i.status||i.status==='completed')&&!i.error))throw new Error('Missing completed native webSearch');
    if(items.some(i=>!['userMessage','webSearch','agentMessage','reasoning'].includes(i.type)))throw new Error('Unexpected native capability executed');
    if(items.some(i=>i.type==='userMessage' && (!Array.isArray(i.content)||i.content.some(x=>x.type!=='text'||x.text!==args.query))))throw new Error('Unexpected native input');
    const text=items.filter(i=>i.type==='agentMessage').map(i=>i.text).join('\n');
    stage='summary/normalize';const output=normalize(text,items,args.query,{...c,count:args.count ?? 5});current();
    stage='cleanup';await retire(); current();
    dependencies.onEvidence?.({provider:'custom-codex-search',model:c.model,effort:c.effort,searchMode:'live',completedSearches:items.filter(i=>i.type==='webSearch').length,successfulTurn:true,elapsedMs:Date.now()-started});
    return output;
  } catch (error) {
    // Only fixed local classifications and allowlisted RPC names; never native/auth messages.
    const cause=stage==='summary/normalize' ? 'invalid-summary-or-source-candidates' : stage==='turn/completed' ? 'native-turn-or-capability-check' : stage==='cleanup' ? 'owned-process-cleanup' : 'native-rpc-or-policy-check';
    throw new Error('Custom Codex search '+(ac.signal.aborted ? 'cancelled or timed out' : 'failed closed')+' [stage='+stage+'; reason='+cause+']');
  }
  finally {
    clearTimeout(total);clearTimeout(startup);context.signal?.removeEventListener('abort',abort);
    try { await retire(); } catch { throw new Error('Custom Codex search failed closed [stage=cleanup; reason=owned-process-cleanup]'); }
  }
}
