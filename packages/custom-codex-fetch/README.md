# custom-codex-fetch 0.1.2

Experimental independent ordinary web_fetch fallback, tested with OpenClaw 2026.9.8 and Codex 0.158.0. Explicit selection only; no separate custom tool or core changes.

## Routing and recommended operator selection

OpenClaw remains HTTP-first. With readability enabled, successful HTML readability extraction bypasses the native provider. Empty readability extraction or HTTP failures can invoke the selected native fallback; the tested host can use basic HTML cleanup if that fallback fails. JSON, markdown and plain text HTTP responses can bypass the provider. SSRF blocks and caller cancellation must not invoke it.

The recommended reliability-oriented selection below matches the deployment validated on 2026-10-08 (SGT). It is an owner-selected route, not a change to OpenClaw or package defaults, and this repository does not apply it. Merge these fields into existing configuration, preserving unrelated settings:

~~~json
{
  "tools": {
    "web": {
      "fetch": {
        "provider": "custom-codex-fetch",
        "readability": true,
        "cacheTtlMinutes": 0
      }
    }
  }
}
~~~

The previous readability=false selection required native extraction for HTTP HTML. Readability-first improves ordinary retrieval but does not fix hosted native failures. Readability does not execute JavaScript and may omit headings, navigation or other page content. A successful ordinary web_fetch can therefore say nothing about native availability.

Fetch cacheTtlMinutes=0 bypasses local cache reads and writes on both HTTP and native-fallback routes. It does not control upstream caches or alter search caching. Provider resolution can be lazy; a startup status of unloaded alone is not proof that the selected provider is inactive.

## Native configuration and boundaries

Plugin settings require owner agentDir, exact existing OAuth profileId and absolute binaryPath. Resolve these dynamically from the owner's authorized current configuration; no private owner paths or credentials are packaged. No new authentication or API-key fallback occurs. Model and reasoning effort are configurable; defaults remain gpt-6-sol and low. Model must be a nonempty string (trimmed at runtime). Effort must be one of none, minimal, low, medium, high, xhigh, max, ultra (plugin allowlist; the Codex 0.158.0 schema accepts nonempty effort strings, but authenticated catalog compatibility is still required). The authenticated native catalog must explicitly list the selected model with text input and selected effort; exact model, OpenAI provider and effort thread acknowledgments are mandatory. No fallback or inferred support: gpt-6.1 is rejected when absent from that catalog. Alternate-model tests use mocks, not evidence of live availability. Manifest UI hints describe these selectors; rendered UI is not verified. Defaults: timeoutMs 90000 (including authentication), startupMs 15000 within it, cleanupMs 5000 additional. At most two workers run concurrently; excess requests fail without retry.

A successful nonce-backed feasibility probe established the retrieval path, not verification of every future extraction. Results are best-effort native agent text, not raw/complete origin responses. Each text starts with an essential limitation label. Status is always 0 (unknown origin HTTP status), finalUrl is the provider input URL (not a verified redirect destination), rawLength measures extracted characters, and truncated is true because completeness is unknown. MIME/title are omitted. Failed or ambiguous output, missing exact completed native open, empty chunks, model rerouting and native application retries fail closed. Only one final_answer JSON message is parsed; commentary and reasoning never become page text. Both text and markdown request faithful chunks, never summaries.

The native structured outputSchema contract is supported by the pinned binary. The fixed developer instructions contain no fixture answer or nonce. A completed native action proves targeting, not independent body verification. Labels persist in runtime output; host normalization may add untrusted wrappers and spill the bounded available extraction. Character budgets below 1536 fail before authentication or worker startup; undersized extraction budgets fail rather than suppress required labels.

Run npm test and npm run check:pack from the repository root. No additional inference is required for unit/pack verification. Activation/install/publication require separate review and authority.

For installed pinned-host contract checks, run node scripts/check-fetch-host.mjs. Run node scripts/check-fetch-sdk.mjs <schema-directory> against locally generated Codex 0.158.0 app-server JSON schemas. These repository-only test adapters read the pinned host implementation and mock network/spill dependencies; they are not runtime imports and do not edit host code.

Normalization errors retain reason=invalid-native-extraction and add a static local-check subreason. Unexpected exceptions use normalization-internal-error; native messages and payloads are never included.

## Known issues and diagnosis

Observed on 2026-10-08 (SGT), with the selected native worker gpt-6-sol/low:

| Exact requested URL | Native-path outcome |
| --- | --- |
| https://example.com/ | Uncached success at maxChars 3000 and 12000 |
| https://example.com/?fetch-config-check=0.1.1 | native-unable at both output budgets |
| https://example.com/?test=1 | native-unable |
| https://www.iana.org/help/example-domains?test=1 | native-unable |
| https://en.wikipedia.org/w/index.php?title=Singapore&action=view | Uncached custom-provider success |

A bounded diagnostic of the failing exact example query completed one native open and turn, with public result title InternalError, but no origin HTTP status or typed/structured backend error. Backend root cause is unknown. This is not a proven plugin defect or blanket query-string incompatibility: the Wikipedia query succeeded. Exact native-action and final JSON URL gates run before native-unable classification. maxChars bounds local output, not the native retrieval budget; raising it is not a repair.

The readability-first workaround returned correct usable fixture body at all four tested URLs: example root, fetch-config-check query, IANA query and Wikipedia query. All were HTTP 200, cached=false and extractor=readability, bypassing the native provider. Wikipedia output was truncated at the requested 3000-character budget. These results establish the HTTP route only; the hosted native issue remains unresolved.

Interpret native output using extractor and externalContent.provider. Native status=0 means unknown origin status, not failure. Requested-URL fallback finalUrl is not redirect proof; origin MIME, headers, status and redirects are unknown. Best-effort native extraction remains unverified per request and is not a raw complete body.

The safe local diagnostic classification is stage=extraction/normalize, reason=invalid-native-extraction, subreason=native-unable. The subreason covers final JSON status=unable or a nonempty error on otherwise retrieved output; it is not backend-cause evidence. Do not publish raw native errors, credentials, account identifiers or private session metadata.

For a future authorized isolation test, use an independent native Codex session with gpt-6-sol/low if available. Prompt it to open the exact failing URL once, preserve its query, use native web only, visit no other URLs, perform no retries and use no shell/curl. Run a separate paired root-URL control to distinguish plugin-path behavior from hosted retrieval failure. This proposed paired test has not been performed here. Ordinary readability-enabled web_fetch is not a native-path test.

No evidence supports silent retries, query stripping, model/provider fallback or broader permissions. Host DNS preflight cannot pin hosted backend DNS or redirects. Unverified third-party sandbox exclusion remains unchanged; see [SECURITY.md](SECURITY.md). Search 0.2.0 behavior and caching are independent and unchanged.
