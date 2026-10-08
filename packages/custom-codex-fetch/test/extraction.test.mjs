import {test} from 'node:test';
import assert from 'node:assert/strict';
import {normalizeExtraction,normalizationFailureReason,validateUrl,LABEL} from '../extraction.mjs';
import {validateConfig} from '../policy.mjs';
import plugin,{descriptor} from '../index.mjs';
const url='https://example.com/page';
function items(data={url,status:'retrieved',chunks:['Faithful body 😀'],error:''}){return [{type:'webSearch',action:{type:'openPage',url}},{type:'agentMessage',phase:'commentary',text:'DO NOT INCLUDE'},{type:'reasoning',text:'DO NOT INCLUDE'},{type:'agentMessage',phase:'final_answer',text:JSON.stringify(data)}];}
for(const mode of ['text','markdown'])test('truthful '+mode,()=>{const o=normalizeExtraction(items(),url,{extractMode:mode});assert.equal(o.status,0);assert.equal(o.finalUrl,url);assert.equal(o.contentType,undefined);assert.equal(o.title,undefined);assert.equal(o.truncated,true);assert(o.text.includes(LABEL));assert(!o.text.includes('DO NOT INCLUDE'));assert.equal(o.rawLength,'Faithful body 😀'.length);});
for(const [name,mutate] of [
 ['no open',x=>x.splice(0,1)],['wrong URL',x=>x[0].action.url='https://example.com/other'],['failed open',x=>x[0].status='failed'],['search not open',x=>x[0].action.type='search'],['multiple opens',x=>x.push(x[0])],['missing final',x=>x.pop()],['ambiguous finals',x=>x.push(x.at(-1))],['invalid JSON',x=>x.at(-1).text='not JSON'],['wrong phase',x=>x.at(-1).phase='commentary']
])test('reject '+name,()=>{const x=items();mutate(x);assert.throws(()=>normalizeExtraction(x,url));});
for(const data of [{url,status:'unable',chunks:[],error:'404'},{url,status:404,chunks:['body'],error:''},{url,status:'retrieved',chunks:[],error:''},{url,status:'retrieved',chunks:[1],error:''},{url,status:'retrieved',chunks:['body'],error:'error'},{url,status:'retrieved',chunks:['body'],error:'',extra:true}])test('reject schema '+JSON.stringify(data),()=>assert.throws(()=>normalizeExtraction(items(data),url)));
for(const value of ['file:///etc/passwd','http://user:pass@example.com','http://localhost/','http://127.1/','http://10.1.2.3/','http://192.168.1.1/','http://169.254.169.254/','http://[::1]/','http://2130706433/'])test('block '+value,()=>assert.throws(()=>validateUrl(value)));
test('Unicode post-scrub bounded output',()=>{const o=normalizeExtraction(items({url,status:'retrieved',chunks:['😀'.repeat(10000)],error:''}),url,{maxChars:2048});assert(o.text.length<2048);assert(o.text.includes(LABEL));});
test('tiny budget fails',()=>assert.throws(()=>normalizeExtraction(items(),url,{maxChars:100})));
test('configurable model effort',()=>{const c={profileId:'p',agentDir:'/a',binaryPath:'/b'};assert.equal(validateConfig({...c,model:'other'}).model,'other');assert.equal(validateConfig({...c,effort:'high'}).effort,'high');});
test('register ordinary provider',()=>{let registered;plugin.register({runtime:{version:'2026.9.8'},registerWebFetchProvider:p=>registered=p});assert.equal(registered.id,'custom-codex-fetch');assert.equal(registered.requiresCredential,false);assert.equal(descriptor(()=>({})).createTool({}).execute.constructor.name,'Function');});

const diagnosticCases=[
 ['missing-native-open',x=>x.splice(0,1)],
 ['missing-native-open',x=>x.push(x[0])],
 ['missing-native-open',x=>x[0].action.type='search'],
 ['url-mismatch',x=>x[0].action.url+='?secret=offline-canary'],
 ['native-open-failed',x=>x[0].status='failed'],
 ['native-open-failed',x=>x[0].error={message:'offline-canary',code:'injected'}],
 ['final-phase-missing',x=>x.pop()],
 ['final-phase-missing',x=>x.push(x.at(-1))],
 ['final-phase-missing',x=>x.at(-1).text=42],
 ['final-phase-missing',x=>x.at(-1).text='x'.repeat(2000001)],
 ['invalid-json',x=>x.at(-1).text='offline-canary'],
 ...[null,[],{},'offline-canary',{url,status:'retrieved',chunks:['a'],error:'',extra:'offline-canary'},
 {url,status:42,chunks:['a'],error:''},{url,status:'retrieved',chunks:['a'],error:42},
 {url,status:'retrieved',chunks:42,error:''},{url,status:'retrieved',chunks:[42],error:''},
 {url,status:'retrieved',chunks:[' '],error:''}].map(data=>['schema-invalid',x=>x.at(-1).text=JSON.stringify(data)]),
 ['url-mismatch',x=>x.at(-1).text=JSON.stringify({url:url+'?offline-canary',status:'retrieved',chunks:['a'],error:''})],
 ['native-unable',x=>x.at(-1).text=JSON.stringify({url,status:'unable',chunks:[],error:'offline-canary'})],
 ['native-unable',x=>x.at(-1).text=JSON.stringify({url,status:'retrieved',chunks:['a'],error:'offline-canary'})],
 ['empty-chunks',x=>x.at(-1).text=JSON.stringify({url,status:'retrieved',chunks:[],error:''})],
 ['empty-extraction',x=>x.at(-1).text=JSON.stringify({url,status:'retrieved',chunks:['\u0001'],error:''})],
 ['insufficient-extraction-budget',()=>{}, {maxChars:100}],
 ['normalization-internal-error',x=>Object.defineProperty(x[0],'type',{get(){throw Object.assign(Error('offline-canary'),{code:'native-unable',cause:{code:'invalid-json'}});}})]
];
for(const [n,[reason,mutate,options]] of diagnosticCases.entries())test('safe normalization reason '+n+' '+reason,()=>{
 const x=items();mutate(x);let error;try{normalizeExtraction(x,url,options);}catch(e){error=e;}
 assert(error);assert.equal(normalizationFailureReason(error),reason);
 if(reason!=='normalization-internal-error')assert.equal(error.message,'Native extraction rejected');
});
test('diagnostic identity ignores forged codes prototypes and nested causes',()=>{
 for(const error of [Object.assign(Error('offline-canary'),{code:'native-unable'}),{cause:{code:'invalid-json'}},Object.create({code:'url-mismatch'}),null,'offline-canary'])assert.equal(normalizationFailureReason(error),'normalization-internal-error');
});
