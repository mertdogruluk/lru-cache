# ADR 0002 — ESM with vitest and tsup, replacing CommonJS with Jest and tsc

- **Status:** Accepted
- **Date:** 2026-08-21
- **Phase:** 0

## Context

The repository was set up as a CommonJS package tested with Jest (via `ts-jest`) and built
with `tsc`. That toolchain works, and its 76 tests pass.

It is, however, incompatible with where the project is going. The embedding layer in Phase
3 depends on `@huggingface/transformers`, which is published **ESM-only**. A CommonJS
package cannot `require` it; the workarounds (dynamic `import()` behind an async boundary,
or a dual build) leak asynchrony into code that has no other reason to be async.

Phase 5 additionally makes measurement the product, not a side activity, so the benchmark
runner stops being a convenience and becomes primary tooling.

## Options considered

**A. Stay on CommonJS, load the embedder through dynamic `import()`.**
No migration work now. But every call path touching the embedder becomes async by
necessity rather than by design, and the friction repeats for every ESM-only dependency
that follows.

**B. Dual build (CJS + ESM).**
Maximum consumer compatibility. Costs a more complex build, two sets of output to verify,
and the well-known dual-package hazard — two copies of the same module in one process. All
of that for consumers who do not exist yet; the package has never been published.

**C. Full ESM, migrating the toolchain with it.**
Migration cost paid once, now, while the codebase is three source files and three test
files. Jest's ESM + TypeScript support requires experimental Node flags and a transform
layer; vitest handles TypeScript and ESM natively and ships `vitest bench` in the same
tool. `tsup` produces the publishable ESM bundle with type declarations.

## Decision

**Option C.** The project is ESM-only (`"type": "module"`, `module: NodeNext`), tested and
benchmarked with vitest, and built with tsup.

## Reasoning

- ESM is not a preference here, it is a hard requirement of the Phase 3 dependency. Paying
  for it now costs three import statements; paying for it in Phase 3 would mean rewriting
  code that already has tests and callers.
- One tool covering both tests and benchmarks matters for a project whose deliverable is a
  measurement: the benchmark harness must not be a bolted-on script.
- Dropping `ts-jest` removes a transform layer between the source and the runner — one
  fewer place for a configuration mismatch to hide.
- Net dependency count went **down**: `jest`, `ts-jest`, `@types/jest` and `rimraf` were
  removed; `vitest`, `@vitest/coverage-v8` and `tsup` were added.

## Consequences

- Relative imports carry a `.js` extension, as Node's ESM resolver requires. This looks odd
  in TypeScript source and is worth knowing before it surprises someone.
- The package publishes an ESM-only build. CommonJS consumers would need dynamic `import()`.
  Acceptable: the target consumer is a modern Node service, and Node 22 is already required.
- Coverage moved from Istanbul to v8, so ignore hints use `/* v8 ignore next N */`.
- `vitest bench` is marked experimental upstream; the vitest version is therefore pinned to
  a single major and treated as a moving target.
- Benchmarks live in `bench/` and never run as part of `vitest run`, so a slow benchmark
  cannot slow the test suite down.
