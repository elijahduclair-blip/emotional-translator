---
name: read-garden-identity
description: Read Community Garden's public identity, purpose, adaptation model, and non-mutation boundary.
version: 1.0.0
---

# Read Community Garden identity

Use this skill when a person asks what Community Garden is, what ARI's domain is, or which boundaries apply at the public entrance.

## Procedure

1. Send `GET https://acommunitygarden.garden/garden/identity`.
2. Read the returned identity, cultivation cycle, protected roots, adaptation modes, and boundary together.
3. Explain only what the response supports. Preserve `semanticMutationAllowed: false`, `graphMutationAllowed: false`, and `sourceMutationAllowed: false`.

## Boundary

This is a public read. It cannot inspect a personal plot, retrieve a transcript, authenticate a person, invoke private tools, or change any graph.

