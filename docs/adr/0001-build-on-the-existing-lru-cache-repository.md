# ADR 0001 — Build the semantic cache on top of the existing LRU cache repository

- **Status:** Accepted
- **Date:** 2026-08-21
- **Phase:** 0

## Context

The semantic cache needs a bounded key/value store underneath it: something that evicts on
a capacity limit and, later, on a TTL and a byte budget. That component already exists — a
published repository containing an O(1) LRU cache (Map + doubly linked list) with 76 tests
and full coverage.

The question was where the new project should live: a fresh repository that depends on or
copies the LRU code, or the existing repository, extended in place.

## Options considered

**A. A new repository (`semantic-cache`), LRU copied in.**
Two clean portfolio artefacts, each with its own README and its own story. Costs: the LRU
code exists in two places from day one, and any fix has to be applied twice — or the LRU
has to be published to npm first and consumed as a dependency, which adds a release cycle
before the real work starts.

**B. A new repository depending on the published LRU package.**
Cleanest separation, but the LRU package is not published, and publishing it means
maintaining two packages, two versioning streams and two CI setups for a project whose
actual contribution is a benchmark.

**C. Extend the existing repository.**
One repository, one CI, one dependency tree. The LRU becomes the cache core rather than a
separate product. Cost: the repository's public identity changes — its name, README and
description currently describe an LRU cache.

## Decision

**Option C.** The semantic cache is built inside the existing repository, with the LRU
implementation becoming its cache core.

## Reasoning

- The LRU was never the destination; it was the foundation the semantic cache needs. Phase
  1 grows it with TTL, byte accounting and single-flight — changes that belong to _this_
  project, not to a standalone LRU library.
- Duplicating the code would mean maintaining two copies of a component that only one
  project uses. Publishing it separately would mean a release cycle and a second package
  to maintain before the benchmark — the actual contribution — has a single line written.
- The identity cost is real but cheap to pay: a repository rename keeps GitHub redirects
  intact, and the README is rewritten in Phase 6 anyway.
- The LRU work is not lost. Its history, tests and documentation stay in the repository,
  and the layered structure (`DoublyLinkedList` knows nothing about caching) means the
  core remains readable and defensible on its own.

## Consequences

- The repository is renamed; the package is renamed to `semantic-cache-ts`.
- The current README describes the LRU cache and is now stale. It is rewritten in Phase 6;
  until then the mismatch is a known, recorded gap rather than an accident.
- Phase 1 is a restructuring exercise rather than a migration: the code is already here.
- The published git history keeps the original LRU commit, which is accurate — that is how
  the project actually started.
