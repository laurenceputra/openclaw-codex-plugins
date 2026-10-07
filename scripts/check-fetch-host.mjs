// Test-only source adapter for the exact installed 2026.9.8 host. No core edits.
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {normalizeExtraction,LABEL} from '../packages/custom-codex-fetch/extraction.mjs';
const dist=process.env.OPENCLAW_HOST_DIST ?? '/app/dist';
assert.equal(JSON.parse(await readFile(dist+'/../package.json')).version,'2026.9.8');
const source=await readFile(dist+'/openclaw-tools-S8b3Hz6z.mjs','utf8');
const nl=String.fromCharCode(10);
function fn(name){let i=source.indexOf('function '+name+'(');assert(i>=0);if(source.slice(i-6,i)==='async ')i-=6;const j=source.indexOf(nl+'}',i);assert(j>i);return source.slice(i,j+2);}
const {a:wrapExternalContent,i:truncateSanitizedExternalContent,o:wrapWebContent}=await import(dist+'/external-content-CmQTCbqd.mjs');
const {truncateText:truncateWebFetchText,markdownToText}=await import(dist+'/plugin-sdk/provider-web-fetch.js');
const deps={normalizeOptionalString:x=>typeof x==='string'?x.trim()||undefined:undefined,wrapExternalContent,truncateSanitizedExternalContent,wrapWebContent,truncateWebFetchText,markdownToText,isRecord:x=>x!==null&&typeof x==='object',WEB_FETCH_METADATA_MAX_CHARS:512,WEB_FETCH_FIELD_MAX_CHARS:256,WEB_FETCH_RESULT_URL_MAX_CHARS:2048,WEB_FETCH_WRAPPER_NO_WARNING_OVERHEAD:wrapExternalContent('',{source:'web_fetch',includeWarning:false}).length,WEB_FETCH_WRAPPER_WITH_WARNING_OVERHEAD:wrapWebContent('','web_fetch').length,WEB_FETCH_SPILL_MAX_CHARS:2000000,truncateUtf16Safe:(x,n)=>x.slice(0,n),writePrivateTempFile:async()=>'/tmp/offline-spill',formatFullOutputFooter:x=>'Full output: '+x};
const helpers=['normalizeContentType','normalizeProviderFinalUrl','wrapWebFetchContent','spillWebFetchContent','buildWebFetchPayload','throwIfFetchAborted'];
const build=new Function(...Object.keys(deps),helpers.map(fn).join(nl)+nl+'return buildWebFetchPayload;')(...Object.values(deps));
const url='https://example.com/page';
const items=[{type:'webSearch',action:{type:'openPage',url}},{type:'agentMessage',phase:'final_answer',text:JSON.stringify({url,status:'retrieved',chunks:['Sample body 😀'.repeat(10000)],error:''})}];
for(const maxChars of [1536,2048,20000]){
 const payload=normalizeExtraction(items,url,{maxChars});
 const out=await build({payload,requestedUrl:url,extractMode:'text',maxChars,providerId:'custom-codex-fetch',tookMs:1});
 assert.equal(out.status,0);assert.equal(out.finalUrl,url);assert.equal(out.contentType,undefined);assert.equal(out.extractor,'codex-native-agent-extraction');assert(out.text.includes(LABEL));assert(out.text.length+(out.warning?.length??0)<=maxChars);assert.equal(out.truncated,true);
}
class SsrFBlockedError extends Error{}
let calls=0,release=0,scenario;
const routeDeps={...deps,buildWebFetchPayload:build,SsrFBlockedError,readResponseText:async r=>({text:await r.text(),truncated:false}),loadWebGuardedFetch:async()=>({fetchWithWebToolsNetworkGuard:async()=>{if(scenario==='ssrf')throw new SsrFBlockedError();if(scenario==='network')throw Error('network');return {response:new Response(scenario==='json'?'{}':'sample',{status:scenario==='nonok'?404:200,headers:{'content-type':scenario==='html'?'text/html':scenario==='json'?'application/json':scenario==='markdown'?'text/markdown':'text/plain'}}),finalUrl:url,release:async()=>{release++;}};}}),logDebug:()=>{},extractReadableContent:async()=>{throw Error('Readability must remain disabled');}};
const route=new Function(...Object.keys(routeDeps),fn('throwIfFetchAborted')+nl+fn('normalizeContentType')+nl+fn('fetchWebPayload')+nl+'return fetchWebPayload;')(...Object.values(routeDeps));
for(scenario of ['html','nonok','network','json','markdown','plain','ssrf','cancel']){
 calls=0;const ac=new AbortController();if(scenario==='cancel')ac.abort();
 const params={url,extractMode:'markdown',maxChars:20000,readabilityEnabled:false,signal:ac.signal,resolveProviderFallback:async()=>({provider:{id:'custom-codex-fetch'},definition:{execute:async()=>{calls++;return normalizeExtraction(items,url,{maxChars:20000});}}})};
 if(['ssrf','cancel'].includes(scenario))await assert.rejects(route(params));else await route(params);
 assert.equal(calls,['html','nonok','network'].includes(scenario)?1:0,scenario);
}
console.log('PASS pinned host: 3 normalization budgets, 8 HTTP-first routing scenarios; actual source, mocked network, no inference.');

const {resolvePinnedHostnameWithPolicy}=await import(dist+'/plugin-sdk/ssrf-runtime.js');
await assert.rejects(resolvePinnedHostnameWithPolicy('example.com',{lookupFn:async()=>[{address:'127.0.0.1',family:4}]}));
await assert.rejects(resolvePinnedHostnameWithPolicy('example.com',{lookupFn:async()=>[{address:'169.254.169.254',family:4}]}));
const preflight=await resolvePinnedHostnameWithPolicy('example.com',{lookupFn:async()=>[{address:'93.184.216.34',family:4}]});assert.equal(preflight.hostname,'example.com');
console.log('PASS public SDK DNS preflight: 2 private-answer blocks, 1 public answer; no network requests.');
