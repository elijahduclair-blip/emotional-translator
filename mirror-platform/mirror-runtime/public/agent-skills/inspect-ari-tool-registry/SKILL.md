---
name: inspect-ari-tool-registry
description: Inspect ARI team roles, tool status, declared scopes, and immutable public safety boundaries.
version: 1.0.0
---

# Inspect ARI tool registry

Use this skill to learn which support role owns a tool, whether the tool is available, and which read or write scopes it declares.

## Procedure

1. Send `GET https://acommunitygarden.garden/api/v1/ari/tools`.
2. Read each tool's owner, execution location, status, permissions, and confirmation requirements.
3. Treat the registry as a description—not as permission to invoke the listed tools.
4. Report unavailable, authenticated-only, or owner-confirmed tools exactly as declared.

## Boundary

The public registry does not expose an invocation endpoint. It grants no personal access, tool authority, administrator authority, or graph-mutation permission.

