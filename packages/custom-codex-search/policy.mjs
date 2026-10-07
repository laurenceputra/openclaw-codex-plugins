export const MODEL = 'gpt-6-sol';
export const deniedFeatures = 'apps artifact browser_use browser_use_external browser_use_full_cdp_access chronicle code_mode code_mode_only computer_use context_management current_time_reminder default_mode_request_user_input deferred_executor goals hooks image_generation memories multi_agent multi_agent_v2 plugins request_permissions_tool skill_search shell_tool standalone_web_search token_budget unbounded_connection_retries unified_exec view_image web_search_cached web_search_request workspace_dependencies'.split(' ');
export const searchPolicy = {
  ...Object.fromEntries(deniedFeatures.map(x => ['features.' + x, false])),
  'agents.enabled': false, 'orchestrator.mcp.enabled': false, 'orchestrator.skills.enabled': false,
  'skills.bundled.enabled': false, 'skills.include_instructions': false,
  'tools.experimental_request_user_input.enabled': false, 'tools.update_plan.enabled': false,
  project_doc_max_bytes: 0, project_root_markers: [], include_environment_context: false,
  notify: [], hooks: Object.fromEntries('PreToolUse PermissionRequest PostToolUse PreCompact PostCompact SessionStart UserPromptSubmit SubagentStart SubagentStop Stop'.split(' ').map(x=>[x,[]])),
  web_search: 'live', cli_auth_credentials_store: 'ephemeral',
};
export function validateConfig(c) {
  if (!c || typeof c.profileId !== 'string' || !c.profileId.trim() || typeof c.agentDir !== 'string' || !c.agentDir.startsWith('/') || typeof c.binaryPath !== 'string' || !c.binaryPath.startsWith('/')) throw new Error('Exact profileId, absolute agentDir and binaryPath required');
  const out = { ...c };
  for (const [k,d,min,max] of [['timeoutMs',90000,1000,300000],['startupMs',15000,100,60000],['cleanupMs',5000,100,10000],['snippetChars',1500,100,8000],['summaryChars',24000,100,48000]]) {
    out[k] = c[k] ?? d;
    if (!Number.isInteger(out[k]) || out[k]<min || out[k]>max) throw new Error('Invalid '+k);
  }
  out.model=c.model ?? MODEL; out.effort=c.effort ?? 'low';
  if(typeof out.model!=='string'||!/^[-a-zA-Z0-9._]{1,100}$/.test(out.model))throw new Error('Invalid model');
  if(!['none','minimal','low','medium','high','xhigh'].includes(out.effort))throw new Error('Invalid effort');
  if (out.startupMs > out.timeoutMs) throw new Error('startupMs exceeds total budget');
  return out;
}
export function attestConfig(response) {
  if (!response || !Array.isArray(response.layers) || !response.config) throw new Error('Missing effective configuration');
  const allowed = new Set(['packagedDefaults','mdm','system','enterpriseManaged','user','project','sessionFlags']);
  for (const layer of response.layers) {
    if (!allowed.has(layer?.name?.type)) throw new Error('Incompatible administrator configuration layer');
    if (['mdm','system','enterpriseManaged'].includes(layer.name.type) && Object.values(layer.config?.hooks ?? {}).some(v=>Array.isArray(v) ? v.length : Boolean(v))) throw new Error('Administrative hooks cannot be suppressed');
  }
  const c = response.config;
  for (const x of deniedFeatures) if (c.features?.[x] !== false) throw new Error('Restricted feature not disabled: '+x);
  if (c.web_search !== 'live' || Object.values(c.mcp_servers ?? {}).some(s=>s.enabled !== false)) throw new Error('Search/MCP policy not attested');
  if (Object.values(c.hooks ?? {}).some(v=>Array.isArray(v) ? v.length : Boolean(v))) throw new Error('Hooks not disabled');
}
export function normalize(text, items, query, options={}) {
  const count=options.count ?? 5, snippetChars=options.snippetChars ?? 1500, summaryChars=options.summaryChars ?? 24000;
  if(!Number.isInteger(count)||count<1||count>10)throw new Error('Invalid count');
  if (typeof text !== 'string' || !text.trim()) throw new Error('Missing answer');
  const searches=items.filter(i=>i.type==='webSearch' && (!i.status || i.status==='completed') && !i.error);
  if(!searches.length)throw new Error('Missing completed native webSearch');
  const resources=[], inventories=[];
  for(const search of searches)for(const r of (Array.isArray(search.results)?search.results:[])){
    if(resources.length>=10)break;
    if(r?.type!=='text_result'||typeof r.url!=='string'||r.url.length>2048||typeof r.snippet!=='string'||!r.snippet.trim())continue;
    let u;try{u=new URL(r.url);}catch{continue;}
    if(!['http:','https:'].includes(u.protocol)||u.username||u.password||/^(localhost|127\.|0\.|\[?::1)/i.test(u.hostname))continue;
    // Practical minimum: native view/open ref category plus line-count-only structure.
    // Genuine text in these categories remains a snippet, not page-read proof.
    const metadataOnly = /^turn\d+(?:view|open)\d+$/.test(r.ref_id ?? '') && /^\s*Total lines:\s*\d+\s*$/i.test(r.snippet);
    if(metadataOnly){
      if(inventories.length<10&&!inventories.some(x=>x.url===u.href))inventories.push({url:u.href,title:typeof r.title==='string'?r.title.slice(0,300)+(r.title.length>300 ? ' [TRUNCATED title]' : ''):'Untitled source'});
      continue;
    }
    if(resources.some(x=>x.url===u.href))continue;
    resources.push({url:u.href,title:typeof r.title==='string'?r.title.slice(0,300):'Untitled source',snippet:r.snippet});
  }
  const urls = new Set();
  const evidence = new Set(searches.filter(i=>['openPage','findInPage'].includes(i.action?.type)).map(i=>i.action.url));
  // Native v2 agentMessage has no citation annotations; candidate URLs are not citations.
  for (const m of text.slice(0,summaryChars).matchAll(/\[[^\]\n]*\]\(((?:https?:)?\/\/[^\s)]+)\)/gi)) { if(urls.size>=10)break; if(m[1].length>2048)throw new Error('Invalid citation URL');urls.add(m[1]); }
  const citations = [...urls].map(value => {
    // An action URL proves native targeting, not successful page-content retrieval.
    // Unsupported/opaque ref IDs must never be promoted to verified URLs.
    let u; try { u = new URL(value, 'https://source.invalid'); } catch { throw new Error('Invalid citation URL'); }
    if (!['https:','http:'].includes(u.protocol) || u.username || u.password || !u.hostname || /^(localhost|127\.|0\.|\[?::1)/i.test(u.hostname)) throw new Error('Invalid citation URL');
    return { url: u.href, nativeTarget: evidence.has(value) };
  });
  if (!citations.length && !resources.length && !inventories.length) throw new Error('Missing source candidates');
  const retained=new Set();
  for(const r of [...resources,...inventories,...citations])if(retained.size<count)retained.add(r.url);
  resources.splice(0,resources.length,...resources.filter(r=>retained.has(r.url)));
  inventories.splice(0,inventories.length,...inventories.filter(r=>retained.has(r.url)));
  citations.splice(0,citations.length,...citations.filter(r=>retained.has(r.url)));
  const scrub=value=>value.replace(/(?:https?:)?\/\/[^\s<>\)\]"']+/gi,value=>{
    try{return retained.has(new URL(value, 'https://source.invalid').href)?value:'[source omitted: count budget]';}catch{return '[invalid source omitted]';}
  });
  const bounded=(value,max,section)=>value.slice(0,max)+(value.length>max ? ' [TRUNCATED '+section+']' : '');
  for(const r of resources){r.title=scrub(r.title);r.snippet=bounded(scrub(r.snippet),snippetChars,'snippet');}
  for(const r of inventories)r.title=scrub(r.title);
  const labels=citations.map(c=>'- '+c.url+': '+(resources.some(r=>r.url===c.url) ? 'search-snippets only; native result URL' : inventories.some(r=>r.url===c.url) ? 'native result URL provenance only; metadata inventory, no substantive snippet or proven page-content-read' : c.nativeTarget ? 'native source-target only; page-content-read not proven' : 'unverified source candidate; generated answer URL, no native URL provenance')).join('\n');
  const limitation=resources.length ? 'Evidence: search-snippets only. Native result titles, URLs and bounded snippets follow. Page-content-read is not proven; even a view ref or Total lines metadata is not page content. Generated summary claims beyond these snippets require source-check.' : 'Evidence: limited native-search summary. Completed live native search is proven, but no native source snippets or page contents were available. Neither page-content-read nor search-snippets only is verified. Treat key facts, titles and dates below as generated claims requiring source-check, not verified resource facts.';
  const snippets=resources.map(r=>'Title: '+r.title+'\nURL: '+r.url+'\nEvidence: search-snippets only\nKey facts (native snippet; date only if present): '+r.snippet).join('\n\n');
  const inventory=inventories.filter(r=>!resources.some(x=>x.url===r.url)).map(r=>'Title: '+r.title+'\nURL: '+r.url+'\nEvidence: native result URL provenance only; metadata inventory, no substantive snippet or proven page-content-read').join('\n\n');
  return { query, provider: 'custom-codex-search', content: '<UNTRUSTED_WEB_SEARCH_CONTENT>\n'+limitation+'\nNative resources:\n'+snippets+'\nNative URL inventory (not resource facts):\n'+inventory+'\nSource evidence:\n'+labels+'\nLimited summary (unverified claims):\n'+bounded(scrub(text),summaryChars,'summary')+'\n</UNTRUSTED_WEB_SEARCH_CONTENT>', citations:[...new Set([...resources.map(r=>r.url),...inventories.map(r=>r.url),...citations.filter(c=>c.nativeTarget).map(c=>c.url)])].map(url=>({url})),
    externalContent: { untrusted: true, source: 'web_search', provider: 'custom-codex-search', wrapped: true } };
}
