# PROGRESS

Running log of the project. Updated at the end of **every** working session, newest entry
at the top. Read together with `PROJECT.md` at the start of each session.

Entry format:

```markdown
## YYYY-MM-DD — Phase N

### Done

- What was actually finished and verified this session.

### Decisions

- The decision, and the reasoning behind it. Link the ADR if one was written.

### Known gaps / TODO

- What is missing, deferred, or parked. Ideas outside the current phase land here
  instead of in the code.

### Next concrete step

- The single next action, specific enough to start without re-deciding anything.
```

---

## Current status

|                  |                                        |
| ---------------- | -------------------------------------- |
| **Phase**        | 0 — Skeleton                           |
| **Status**       | Complete, exit criteria met            |
| **Last updated** | 2026-08-21                             |
| **Next**         | Phase 1 — cache core, pending go-ahead |

---

<!-- Session entries go below this line, newest first. -->

## 2026-08-21 — Phase 0

### Done

- Created `PROJECT.md` (definition, constraints, phases, known limits) and this file.
- Migrated the toolchain from CommonJS + Jest + `tsc` to **ESM + vitest + tsup**
  (see [ADR 0002](docs/adr/0002-esm-with-vitest-and-tsup.md)):
  - `"type": "module"`, `module`/`moduleResolution: NodeNext`, `verbatimModuleSyntax`,
    relative imports now carry `.js` extensions.
  - `vitest.config.ts` with 100% coverage thresholds (v8 provider); `tsup.config.ts`
    emitting an ESM bundle plus `.d.ts`.
  - Removed `jest.config.js`, `tsconfig.build.json`, and the `jest` / `ts-jest` /
    `@types/jest` / `rimraf` dependencies.
- **All 76 existing tests ported and passing**, coverage still 100%. Test logic was not
  touched — only the `vitest` imports and `.js` extensions were added, so the suite is
  evidence the migration preserved behaviour.
- `bench/lru.bench.ts`: three benchmark groups on the cache core (evicting writes,
  promoting reads, 80/20 mixed).
- GitHub Actions CI: typecheck + lint + format check + coverage + build, on Node 22 and 24.
- `docs/adr/` opened with ADR 0001 and ADR 0002.
- `.gitignore` extended for model weights (`.cache/`, `models/`, `*.onnx`) and benchmark
  artefacts, ahead of Phase 3 downloading a ~90 MB model.
- Package renamed `lru-cache-ts` → `semantic-cache-ts`, version reset to `0.0.0`.

### Decisions

- **Build inside the existing repository** rather than starting a new one —
  [ADR 0001](docs/adr/0001-build-on-the-existing-lru-cache-repository.md). The LRU is the
  cache core this project needs, not a separate product; duplicating or publishing it
  first would cost a release cycle before the benchmark has a line written.
- **ESM is a requirement, not a preference** — `@huggingface/transformers` is ESM-only, so
  Phase 3 could not have consumed it from a CommonJS package without leaking async
  boundaries into otherwise synchronous code. Migrating now cost three import statements;
  migrating in Phase 3 would have meant rewriting tested code.
- **vitest over Jest** — native TypeScript + ESM with no transform layer, and `vitest bench`
  puts benchmarking in the same tool. For a project whose deliverable is a measurement, the
  benchmark runner should not be a bolted-on script.
- **vitest pinned to v4, with an `esbuild` override to `^0.28.2`** — vitest 2.x pulled a
  vulnerable esbuild (6 advisories, 2 critical). v4 cut that to one low-severity advisory,
  and the override cleared it. `npm audit` now reports **0 vulnerabilities**, so a public
  repository starts without Dependabot noise. The override is a pin to review whenever
  vitest or tsup bumps its esbuild range.
- **Benchmarks isolated in `bench/`** and excluded from `vitest run`, so benchmark runtime
  can never slow the test suite.

### Benchmark baseline (Node 24, local machine, `npm run bench`)

Recorded as the pre-Phase-1 baseline: TTL, byte accounting and single-flight will each add
work per operation, and this is what that cost gets measured against.

| Workload                    | Capacity | ops/sec | p99 (ms) |
| --------------------------- | -------- | ------: | -------: |
| put (every call evicts)     | 1,000    |    8.7M |   0.0002 |
| put (every call evicts)     | 100,000  |    5.1M |   0.0005 |
| get (every call hits)       | 1,000    |   16.0M |   0.0001 |
| get (every call hits)       | 100,000  |   11.9M |   0.0003 |
| mixed (80% read, 20% write) | 10,000   |   10.8M |   0.0003 |

A 100x larger capacity costs ~1.7x on writes and ~1.3x on reads — memory locality, not
algorithmic growth.

### Known gaps / TODO

Parked deliberately; not implemented in this phase.

- **README is stale.** It still describes the project as an LRU cache library. A note at
  the top points at `PROJECT.md`; the full rewrite is Phase 6.
- **npm name `semantic-cache-ts` is unverified.** Check availability before Phase 6.
- **Coverage text table renders empty on Windows** (backslash path separators in vitest's
  text reporter). The numbers and `lcov.info` are correct, and CI on Linux is unaffected.
  Cosmetic; revisit only if it also breaks in CI.
- **ESLint 8 with legacy `.eslintrc.json`** is end-of-life. Migrating to ESLint 9 flat
  config is unrelated to any phase goal — do it only if the current setup actually breaks.
- **Old orphaned commit SHA** from the pre-rename force-push is still reachable on GitHub
  by direct SHA. Invisible in the UI, in history and in the contributor list. Open question
  from the previous session; no action taken.

### Next concrete step

Phase 1 — cache core. Present a 3–5 bullet plan covering TTL, byte-budget accounting and
single-flight, get it approved, then implement test-first. The exit criterion to design
against: **50 concurrent requests for the same key must call the underlying loader exactly
once.**
