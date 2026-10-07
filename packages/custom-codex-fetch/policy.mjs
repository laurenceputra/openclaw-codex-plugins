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
  for (const [k,d,min,max] of [['timeoutMs',90000,1000,300000],['startupMs',15000,100,60000],['cleanupMs',5000,100,10000]]) {
    out[k] = c[k] ?? d;
    if (!Number.isInteger(out[k]) || out[k]<min || out[k]>max) throw new Error('Invalid '+k);
  }
  out.model=MODEL; out.effort='low'; if((c.model!==undefined&&c.model!==MODEL)||(c.effort!==undefined&&c.effort!=='low'))throw new Error('Fixed model/effort required');
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
