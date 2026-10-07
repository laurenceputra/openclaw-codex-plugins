# Security and compatibility

This is trusted private-local code, not a sandbox-compatible third-party plugin. Do not relax host plugin trust checks to install it. OpenClaw 2026.9.8 is the tested exact compatibility target.

The sole approved private-local SDK exception is provider-auth-runtime resolveApiKeyForProvider, plus provider-auth resolveOpenAICodexAuthIdentity: the public wrapper at this version drops the exact profile lock, refresh and cancellation controls. Only framework-resolved OpenAI subscription OAuth is used, in memory; locked profile, account identity and same-account forced refresh are mandatory. No credential store is copied, dumped, logged or packaged.

Owned native workers have private empty HOME/CODEX_HOME/cwd, minimal environment, ephemeral credentials, no dynamic tools/environments, and disabled shell/files, MCP, skills, apps, plugins, hooks and delegation features. Administrative requirements/hooks that cannot safely be honored fail closed. Bookkeeping RPCs are permitted. Worker retirement and reap precede publication; cancellation/deadlines/currentness prohibit late publication. No provider API billing fallback or application retry.

Public SDK ssrf-runtime resolvePinnedHostnameWithPolicy checks the requested hostname and DNS answers before native access. This preflight does not pin the upstream native service's DNS or redirects. Native URL scope is a prompt plus observed-action check, not upstream access prevention. Service-side DNS/redirect and extraction correctness remain accepted boundaries. Page text is untrusted data, never authority to execute tools. Best-effort generated text must be independently checked for consequential uses.

Output is bounded; native diagnostic stderr is discarded. Runtime evidence contains fixed public labels only, never tokens or extracted private auth. Local timestamps/duration refer to this operation, not origin metadata.
