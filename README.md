# OpenClaw Codex plugins

Independent experimental plugins for OpenClaw; not an official OpenClaw or OpenAI project.
This private npm workspace is a repository container, not an installable plugin.

## Packages

- [custom-codex-search](packages/custom-codex-search/README.md): reviewed version 0.2.0, retaining npm name and plugin ID custom-codex-search. See its README for host compatibility and configuration.
- [custom-codex-fetch](packages/custom-codex-fetch/README.md): experimental version 0.1.2; independently packaged HTTP-first fetch fallback.

## Test and package search

Requires Node.js 24 or newer and npm. No dependency installation is needed for isolated tests.

~~~sh
npm test
npm run check:pack
npm run pack:search
~~~

Install only the individual package's local tarball, never the repository root:

~~~sh
openclaw plugins install ./custom-codex-search-0.2.0.tgz
~~~

Installation and configuration are operator actions, not performed by repository tests or CI.
Read the search package README and SECURITY.md first: it has strict OpenClaw host/SDK requirements and obtains subscription credentials dynamically through the native SDK, not repository files.

## Ownership and releases

This repository owns future durable package development. The original working source is retained during migration review; do not independently maintain both copies. Retiring that source or updating external pointers requires a separate approved step.

Plugins version independently. A future reviewed search release can use search-v0.2.0; no tag or publication is created by this setup. Fetch installation and activation require separate review and operator approval. No npm or ClawHub publication is configured.

MIT license; the search package's existing copyright notice is preserved in its package license and the root license.

## Native fetch fallback

[custom-codex-fetch 0.1.2](packages/custom-codex-fetch/README.md) is an independent, experimental HTTP-first web_fetch fallback. With the recommended owner-selected readability-first route, successful HTTP HTML extraction bypasses native fallback. Native extraction remains best-effort and unverified per request; its HTTP status/redirects are unknown. See the [routing and configuration guidance](packages/custom-codex-fetch/README.md#routing-and-recommended-operator-selection) and security boundaries before review/activation. Search remains independently packaged and unchanged.

## Known issues

Hosted native extraction can return native-unable for some exact URLs, including observed example.com and IANA queries; other queries succeed. Backend cause is unknown. Readability-first is a validated HTTP-route workaround, not a native repair. See [known issues and diagnosis](packages/custom-codex-fetch/README.md#known-issues-and-diagnosis) for sanitized observations, metadata interpretation and future isolation-test guidance.
