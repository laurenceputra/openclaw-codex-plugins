// Sole authorized private-local dependency. Never substitute the public wrapper:
// installed 2026.9.8 drops profile lock, refresh and cancellation controls.
export async function loadAuthAdapter() {
  const [{ resolveApiKeyForProvider }, { resolveOpenAICodexAuthIdentity }] = await Promise.all([
    import('openclaw/plugin-sdk/provider-auth-runtime'),
    import('openclaw/plugin-sdk/provider-auth'),
  ]);
  if (typeof resolveApiKeyForProvider !== 'function' || typeof resolveOpenAICodexAuthIdentity !== 'function') throw new Error('Incompatible auth SDK');
  return createAuthAdapter(resolveApiKeyForProvider, resolveOpenAICodexAuthIdentity);
}
export function createAuthAdapter(resolve, identity) {
  return async ({ cfg, agentDir, profileId, signal, forceRefresh = false, accountId }) => {
    signal.throwIfAborted();
    const auth = await resolve({ provider: 'openai', cfg, agentDir, profileId, lockedProfile: true, signal, forceRefresh });
    signal.throwIfAborted();
    if (auth?.profileId !== profileId || auth.mode !== 'oauth' || (auth.authFlow !== undefined && auth.authFlow !== 'chatgpt-subscription') || typeof auth.apiKey !== 'string') throw new Error('Incompatible locked subscription OAuth');
    const id = identity({ access: auth.apiKey });
    if (!id.accountId || !id.chatgptPlanType || (accountId && id.accountId !== accountId)) throw new Error('Subscription account identity mismatch or missing metadata');
    return { accessToken: auth.apiKey, chatgptAccountId: id.accountId, chatgptPlanType: id.chatgptPlanType };
  };
}
