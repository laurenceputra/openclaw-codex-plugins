# custom-codex-fetch — planning only

Proposed independent plugin name; no implementation, package manifest, registration, or installable artifact exists. This directory is deliberately excluded from npm workspaces.

Next step: a bounded feasibility test of native Codex URL fetching using synthetic/public URLs and the existing native SDK authentication path, without changing production configuration. Establish whether exact requested URLs can be fetched with useful body content and provenance, and whether timeouts, cancellation, errors, and untrusted content can be handled reliably. Compare existing maintained capabilities before implementing a custom plugin.

Return evidence and a build/no-build recommendation before approving an implementation. Do not infer that search functionality already provides a working fetch plugin; do not extract a shared library until an actual shared requirement is demonstrated.
