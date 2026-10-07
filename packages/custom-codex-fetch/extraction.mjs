export const EXTRACTOR='codex-native-agent-extraction';
export const LABEL='Best-effort native agent extraction; unverified per request, not raw or complete origin response. Origin HTTP status and redirects unknown; completeness unknown.';
export function validateUrl(value){
 if(typeof value!=='string'||value.length>2048)throw new Error('Invalid URL');
 const u=new URL(value);
 if(!['http:','https:'].includes(u.protocol)||u.username||u.password||!u.hostname)throw new Error('Forbidden URL');
 if(/^(localhost|.*\.localhost|0\.|127\.|10\.|192\.168\.|169\.254\.|172\.(1[6-9]|2[0-9]|3[01])\.|\[)/i.test(u.hostname))throw new Error('Private URL');
 return u.href;
}
export function normalizeExtraction(items,url,{maxChars=50000,extractMode='markdown',started=Date.now()}={}){
 const opens=items.filter(i=>i.type==='webSearch');
 if(opens.length!==1||opens[0].action?.type!=='openPage'||opens[0].action.url!==url||(opens[0].status&&opens[0].status!=='completed')||opens[0].error)throw new Error('Missing exact completed native open');
 const finals=items.filter(i=>i.type==='agentMessage'&&i.phase==='final_answer');
 if(finals.length!==1||typeof finals[0].text!=='string'||finals[0].text.length>2000000)throw new Error('Ambiguous final answer');
 const data=JSON.parse(finals[0].text);
 if(!data||Array.isArray(data)||Object.keys(data).sort().join(',')!=='chunks,error,status,url'||data.url!==url||data.status!=='retrieved'||typeof data.error!=='string'||data.error||!Array.isArray(data.chunks)||!data.chunks.length||data.chunks.some(x=>typeof x!=='string'||!x.trim()))throw new Error('Invalid extraction');
 const nl=String.fromCharCode(10);
 const body=data.chunks.join(nl+nl).split('').filter(x=>(x.charCodeAt(0)>=32&&x.charCodeAt(0)!==127)||x===nl||x.charCodeAt(0)===9).join('');
 const prefix='<UNTRUSTED_WEB_CONTENT>'+nl+LABEL+nl;
 const suffix=nl+'</UNTRUSTED_WEB_CONTENT>';
 // Reserve host metadata/wrapper overhead; fail instead of erasing essential labels.
 const available=maxChars-1024-prefix.length-suffix.length;
 if(available<1)throw new Error('Insufficient visible extraction budget');
 let bounded=body.slice(0,available);const last=bounded.charCodeAt(bounded.length-1);if(last>=0xD800&&last<=0xDBFF)bounded=bounded.slice(0,-1);
 if(!bounded.trim())throw new Error('Empty extraction');
 return {url,finalUrl:url,status:0,extractMode,extractor:EXTRACTOR,text:prefix+bounded+suffix,truncated:true,rawLength:body.length,length:prefix.length+bounded.length+suffix.length,fetchedAt:new Date().toISOString(),tookMs:Date.now()-started,warning:LABEL.slice(0,256),externalContent:{source:'web_fetch',provider:'custom-codex-fetch',untrusted:true,wrapped:true}};
}

export const OUTPUT_SCHEMA={type:'object',additionalProperties:false,required:['url','status','chunks','error'],properties:{url:{type:'string'},status:{type:'string',enum:['retrieved','unable']},chunks:{type:'array',items:{type:'string'}},error:{type:'string'}}};
