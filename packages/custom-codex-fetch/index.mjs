import { fetchPage } from './fetch.mjs';
export function descriptor(resolveConfig) {
  return { id:'custom-codex-fetch',label:'Custom Codex Fetch',hint:'Isolated web-only native Sol extraction worker; existing locked OpenAI subscription profile',requiresCredential:false,
    envVars:[],placeholder:'Uses configured locked profile',signupUrl:'https://chatgpt.com/codex',credentialPath:'',inactiveSecretPaths:[],configPath:[],
    getCredentialValue:()=>undefined,setCredentialValue:()=>{},
    createTool:ctx=>({description:'Best-effort native extraction of requested public page; origin status unknown.',execute:(args,context)=>fetchPage(resolveConfig(),ctx.config,args,context)}) };
}
export default {id:'custom-codex-fetch',name:'Custom Codex Fetch',register(api){if(api.runtime?.version!=='2026.9.8'||typeof api.registerWebFetchProvider!=='function')throw new Error('Incompatible OpenClaw web fetch API');api.registerWebFetchProvider(descriptor(()=>api.pluginConfig));}};
