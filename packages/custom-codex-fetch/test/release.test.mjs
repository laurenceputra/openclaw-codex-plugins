import {test} from 'node:test';
import assert from 'node:assert/strict';
import plugin from '../index.mjs';
test('runtime host version and registration API fail closed',()=>{for(const api of [{},{runtime:{version:'2026.9.8'},registerWebFetchProvider(){}},{runtime:{version:'2026.9.9'}}])assert.throws(()=>plugin.register(api));let registered;plugin.register({runtime:{version:'2026.9.9'},registerWebFetchProvider(p){registered=p;}});assert.equal(registered.id,'custom-codex-fetch');assert.equal(typeof registered.createTool({config:{}}).execute,'function');});
