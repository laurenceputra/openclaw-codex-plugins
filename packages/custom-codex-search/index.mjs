import { search } from './search.mjs';
export function descriptor(resolveConfig) {
  return { id:'custom-codex-search',label:'Custom Codex Search',hint:'Isolated search-only native Sol worker; existing locked OpenAI subscription profile',requiresCredential:false,
    envVars:[],placeholder:'Uses configured locked profile',signupUrl:'https://chatgpt.com/codex',credentialPath:'',inactiveSecretPaths:[],configPath:[],
    getCredentialValue:()=>undefined,setCredentialValue:()=>{},
    createTool:ctx=>({description:'Search the live web using an isolated native Sol search-only worker.',parameters:{type:'object',additionalProperties:false,required:['query'],properties:{query:{type:'string'},count:{type:'integer',minimum:1,maximum:10}}},execute:(args,context)=>search(resolveConfig(),ctx.config,args,context)}) };
}
export default {id:'custom-codex-search',name:'Custom Codex Search',register(api){if(api.runtime?.version!=='2026.9.8'||typeof api.registerWebSearchProvider!=='function')throw new Error('Incompatible OpenClaw web search API');api.registerWebSearchProvider(descriptor(()=>api.pluginConfig));}};
