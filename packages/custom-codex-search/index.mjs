import { search } from './search.mjs';
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
  return { id:'custom-codex-search',label:'Custom Codex Search',hint:'Isolated search-only native Sol worker; existing locked OpenAI subscription profile',requiresCredential:false,
    envVars:[],placeholder:'Uses configured locked profile',signupUrl:'https://chatgpt.com/codex',credentialPath:'',inactiveSecretPaths:[],configPath:[],
    getCredentialValue:()=>undefined,setCredentialValue:()=>{},
    createTool:ctx=>({description:'Search the live web using an isolated native Sol search-only worker.',parameters:{type:'object',additionalProperties:false,required:['query'],properties:{query:{type:'string'},count:{type:'integer',minimum:1,maximum:10}}},execute:(args,context)=>search(resolveConfig(),ctx.config,args,context)}) };
}
export default {id:'custom-codex-search',name:'Custom Codex Search',register(api){if(!supportsHost(api.runtime?.version)||typeof api.registerWebSearchProvider!=='function')throw new Error('Incompatible OpenClaw web search API');api.registerWebSearchProvider(descriptor(()=>api.pluginConfig));}};
