import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {normalize} from '../policy.mjs';
const fixtures=JSON.parse(await readFile(new URL('./native-summary-fixture.json',import.meta.url)));
const metadata=fixtures.flatMap(c=>c.nativeSearches.flatMap(s=>s.results??[])).filter(r=>/^turn\d+view\d+$/.test(r.ref_id??'')&&/^Total lines: \d+$/.test(r.snippet??''));
test('actual metadata-only native inventories retain URL provenance, not key facts',()=>{
 assert(metadata.length>0);
 for(const r of metadata){
  const o=normalize('Generated claims require source-check',[{type:'webSearch',action:{type:'openPage'},results:[r]}],'q');
  assert.match(o.content,/Neither page-content-read nor search-snippets only is verified/);
  assert.match(o.content,/native result URL provenance only/);
  assert(!o.content.includes(r.snippet));
  assert.doesNotMatch(o.content,/Key facts \(native snippet/);
  assert.deepEqual(o.citations,[{url:new URL(r.url).href}]);
 }
});
test('mixed actual fixtures preserve genuine snippets and exclude metadata facts',()=>{
 for(const c of fixtures){
  const o=normalize(c.generatedSummary,c.nativeSearches.map(s=>({type:'webSearch',...s})),'q');
  const resourceSection=o.content.split('Native resources:\n')[1].split('Native URL inventory')[0];
  assert.match(resourceSection,/Key facts \(native snippet/);
  assert.doesNotMatch(resourceSection,/Total lines: \d+/);
  assert.match(o.content,/Page-content-read is not proven/);
 }
});
test('view refs with substantive text stay snippets; unknown shapes do not become citations',()=>{
 const r={type:'text_result',ref_id:'turn1view0',url:'https://EXAMPLE.com/report',title:'Report',snippet:'Total lines: 836\nRevenue rose on July 31, 2026.'};
 const o=normalize('Summary',[{type:'webSearch',results:[r]}],'q');
 assert.match(o.content,/Key facts \(native snippet; date only if present\): Total lines: 836\nRevenue rose/);
 assert.equal(o.citations[0].url,'https://example.com/report');
 const unknown=normalize('[candidate](https://example.com/report)',[{type:'webSearch',results:[{...r,type:'unknown'}]}],'q');
 assert.deepEqual(unknown.citations,[]);
 assert.match(unknown.content,/unverified source candidate/);
});
