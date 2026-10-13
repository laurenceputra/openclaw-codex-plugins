import { fetchPage } from './fetch.mjs';
// Strict stable SemVer subset for >=2026.9.9 (prereleases excluded).
// No semver dependency is available; validate before exact integer comparison.
function supportsHost(version) {
  if (typeof version !== 'string') return false;
  const match = /^(0|[1-9][0-9]*)[.](0|[1-9][0-9]*)[.](0|[1-9][0-9]*)(?:[+][0-9A-Za-z-]+(?:[.][0-9A-Za-z-]+)*)?$/.exec(version);
  if (!match || match[0] !== version) return false;
  const parts = match.slice(1).map(Number);
  if (!parts.every(Number.isSafeInteger)) return false;
  const [major, minor, patch] = parts;
  return major > 2026 || (major === 2026 && (minor > 9 || (minor === 9 && patch >= 9)));
}
export function descriptor(resolveConfig) {
  return { id:'custom-codex-fetch',label:'Custom Codex Fetch',hint:'Isolated web-only native Sol extraction worker; existing locked OpenAI subscription profile',requiresCredential:false,
    envVars:[],placeholder:'Uses configured locked profile',signupUrl:'https://chatgpt.com/codex',credentialPath:'',inactiveSecretPaths:[],configPath:[],
    getCredentialValue:()=>undefined,setCredentialValue:()=>{},
    createTool:ctx=>({description:'Model-generated overview with brief quotations based on the requested page; not verbatim or full-body extraction. Origin status unknown.',execute:(args,context)=>fetchPage(resolveConfig(),ctx.config,args,context)}) };
}
export default {id:'custom-codex-fetch',name:'Custom Codex Fetch',register(api){if(!supportsHost(api.runtime?.version)||typeof api.registerWebFetchProvider!=='function')throw new Error('Incompatible OpenClaw web fetch API');api.registerWebFetchProvider(descriptor(()=>api.pluginConfig));}};
