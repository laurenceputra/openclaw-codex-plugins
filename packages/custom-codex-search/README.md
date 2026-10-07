# Custom Codex Search

Experimental standalone OpenClaw web-search provider, ID `custom-codex-search`. Local release candidate 0.2.0, not a published or production-proven release. Original Node standard-library implementation, MIT licensed; no copied upstream runtime. No build framework or runtime dependencies beyond the host SDK and operator-selected native binary.

## Compatibility

Tested integration baseline: Node 24, OpenClaw **2026.9.8**, native Codex **0.158.0**. Host peer dependency is pinned; other versions are not supported by this release candidate. Registration and runtime protocol/auth shape checks fail closed. Native authenticated catalog must expose the exact configured model ID/model, text modality and effort. Thread acknowledgement must preserve model/provider; correlated reroutes fail closed. Thread configuration explicitly requests effort and its reasoningEffort acknowledgement must match; effort is also sent explicitly on every turn. Higher reasoning is not a research mode.

The sole authorized private API is provider-auth-runtime.resolveApiKeyForProvider. The public wrapper in the tested host drops exact-profile, cancellation and refresh controls. This exception is experimental and may break on host updates; provider-auth identity parsing is public. No parent-model inheritance, fallback, API-key billing or auth-file access/copying.

## Configuration and migration

Preserve existing agentDir, profileId, binaryPath and timeout settings. Add optional defaults:

    plugins.entries.custom-codex-search.config = {
      agentDir: "/absolute/auth-owning-agent-directory",
      profileId: "openai:existing-subscription-profile",
      binaryPath: "/absolute/operator-selected/codex",
      timeoutMs: 90000, startupMs: 15000, cleanupMs: 5000,
      model: "gpt-6-sol", effort: "low",
      snippetChars: 1500, summaryChars: 24000
    }

Select tools.web.search.provider = "custom-codex-search" after review. Plugin manifest JSON Schema supplies Settings fields; descriptor configPath: [] selects this plugin's config root on Search inline settings (supported host contract). No custom UI. Paths are explicit generic operator inputs, not discovered private directories. Select a trusted directly executable native Codex binary of the tested version; verify its version yourself. The binary is spawned directly with fixed argument arrays, never through a shell.

Count defaults to 5, range 1–10. It limits unique retained source entries and aligned citations, not native operations. Substantive snippets take priority, then metadata URL inventory, then clearly unverified generated candidates. Fewer sources are allowed and no padding is performed. Other literal source URLs in generated summary and snippets are omitted. Native snippets are labeled search-snippets only; metadata Total lines is URL provenance, not facts. Native targeting does not prove page retrieval. Generated claims require source-check. Outputs are untrusted-wrapped.

snippetChars: 100–8000 per snippet; summaryChars: 100–48000 for generated summary. Both payload limits apply after URL scrubbing. Truncation is explicitly labeled; each truncated section’s marker adds 20 characters outside its payload limit. Fixed evidence scaffolding and retained title/URL fields are additional bounded output. Total timeout includes auth through turn: 1–300s; startup 0.1–60s, never above total; cleanup/reap adds 0.1–10s. Defaults remain 90s/15s/5s.

## Isolation and constraints

Each search owns one fresh private HOME/CODEX_HOME/TMPDIR/cwd, process and ephemeral thread. Existing locked OAuth owner/profile is used; native refresh preserves account identity. No credentials or native diagnostics are persisted by this plugin. No application retries, pooling, cache, full-page fetching or research orchestration. Native bounded transport retries remain permitted; unbounded retries and observed willRetry events are rejected.

Shell, MCP, apps/plugins, skills, hooks, delegation and project instructions are disabled and effective policy attested. Empty environments/dynamic tools and read-only sandbox remain required. Unsupported administrator mandates fail closed, never bypassed. Caller cancellation/assertCurrent and cleanup prevent late publication. Reap failure retains the owned directory rather than deleting files under a potentially-live process. Errors expose fixed classifications only.

## Local package and verification

Run npm test; npm pack --ignore-scripts creates the allowlisted local archive. All tests and fixtures are offline/synthetic. No deployment records, config snapshots, live canaries, private profile names or credential material belong in the package. private:true deliberately prevents publication until owner/name/visibility/repository decisions are made. No invented repository or support URL is included.

After independent review, the owner may install the archive using the documented host plugin workflow (openclaw plugins install <archive.tgz> --no-enable), preserving existing configuration. Installation/registration, Settings health, ordinary web_search routing and docs/company/sparse-evidence live checks remain deployment gates; this build does not perform them. Validate parent harness preservation and cancellation. Forced live refresh remains untested.

## Provenance limitation

The tested host's trust resolver reserves trusted-official state for recognized official npm/ClawHub records. Local paths/archives are not official trust, and arbitrary custom records may show provenance-invalid. Package metadata cannot legitimately fix that warning. Supported archive installation records ownership/path/version but does not confer official trust; do not edit trusted registries, invent signatures or relax trust. Main must inspect the actual installed record and distinguish correct custom provenance from official-trust expectations after review. Publication alone is not a promise of official trust.

See SECURITY.md and CHANGELOG.md. Release readiness is provisional until the owner completes the deployment gates.
