import {test} from 'node:test';
import assert from 'node:assert/strict';
import plugin from '../index.mjs';
test('stable host range and required registration API',()=>{
 const accepted=['2026.9.9','2026.10.2','2026.12.0','2027.0.0','2026.9.9+build.001','2026.10.2+host-build.0'];
 const rejected=[undefined,null,2026,{},'','2026.9.8','2026.8.99','2025.99.99','2026.9.9-rc.1','2026.10.2-beta','2027.0.0-rc.1','2026.9.9-rc.1+build','2026.09.9','2026.9.09','v2026.9.9',' 2026.9.9','2026.9.9\n','2026.9','2026.9.9.0','2026.9.9+','2026.9.9+a..b','2026.9.9+a_b','9007199254740992.0.0'];
 for(const version of rejected){let called=false;assert.throws(()=>plugin.register({runtime:{version},registerWebFetchProvider(){called=true;}}));assert.equal(called,false);}
 for(const version of accepted){let registered;plugin.register({runtime:{version},registerWebFetchProvider(p){registered=p;}});assert.equal(registered.id,'custom-codex-fetch');assert.equal(typeof registered.createTool({config:{}}).execute,'function');for(const value of [undefined,null,{},true])assert.throws(()=>plugin.register({runtime:{version},registerWebFetchProvider:value}));}
 assert.throws(()=>plugin.register({registerWebFetchProvider(){}}));assert.throws(()=>plugin.register({}));
});
