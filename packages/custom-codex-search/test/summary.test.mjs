import { test } from 'node:test';
import assert from 'node:assert/strict';
import { normalize } from '../policy.mjs';
const answer='Title — 2026-07-31. Key fact. [issuer](https://example.com/q2)';
test('Cboe-shaped refID search publishes limited summary, not invented citation',()=>{
 const o=normalize(answer,[{type:'webSearch',action:{type:'search'},results:null},{type:'webSearch',action:{type:'other'},results:null},{type:'webSearch',action:{type:'findInPage',url:null},results:null}],'q');
 assert.deepEqual(o.citations,[]); assert.match(o.content,/unverified source candidate/);assert.match(o.content,/Neither page-content-read nor search-snippets only is verified/);assert.match(o.content,/Key fact/);
 const normalized={content:o.content,citations:o.citations};assert.match(normalized.content,/generated answer URL, no native URL provenance/);
});
test('failed native targeting cannot provide citation',()=>{const o=normalize(answer,[{type:'webSearch',action:{type:'search'}},{type:'webSearch',status:'failed',action:{type:'openPage',url:'https://example.com/q2'}}],'q');assert.deepEqual(o.citations,[]);});
test('native action URL still does not prove page content',()=>{const o=normalize(answer,[{type:'webSearch',action:{type:'openPage',url:'https://example.com/q2'}}],'q');assert.match(o.content,/page-content-read not proven/);assert.equal(o.citations.length,1);});
test('opaque generated annotations never verify candidate',()=>{const o=normalize(answer,[{type:'webSearch',action:{type:'search'}},{type:'agentMessage',annotations:[{url:'https://example.com/q2'}]}],'q');assert.deepEqual(o.citations,[]);});
