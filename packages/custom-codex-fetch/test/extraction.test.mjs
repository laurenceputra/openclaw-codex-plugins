import {test} from 'node:test';
import assert from 'node:assert/strict';
import {normalizeExtraction,validateUrl,LABEL} from '../extraction.mjs';
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
test('fixed model effort',()=>{const c={profileId:'p',agentDir:'/a',binaryPath:'/b'};assert.throws(()=>validateConfig({...c,model:'other'}));assert.throws(()=>validateConfig({...c,effort:'high'}));});
test('register ordinary provider',()=>{let registered;plugin.register({runtime:{version:'2026.9.8'},registerWebFetchProvider:p=>registered=p});assert.equal(registered.id,'custom-codex-fetch');assert.equal(registered.requiresCredential,false);assert.equal(descriptor(()=>({})).createTool({}).execute.constructor.name,'Function');});
