# PROJECT

The single source of truth for what this project is, what it refuses to be, and how it
gets built. Read this and `PROGRESS.md` at the start of every working session.

---

## 1. What this is

A TypeScript **semantic cache** library that runs a local embedding model, plus an **open
benchmark that measures how often semantic caching returns the wrong answer**.

Two deliverables, in order of importance:

1. **The benchmark** — a reproducible measurement of the false-positive rate of semantic
   caching, swept across similarity thresholds, embedding models and quantization levels,
   with a separate breakdown for the prompt categories where it fails worst.
2. **The library** — the instrument that makes the measurement possible, and a usable
   cache in its own right.

The contribution is the second number, not the first. Plenty of projects will tell you
their cache hit rate. This one also tells you what those hits cost you in correctness.

## 2. The problem

Semantic caching maps _semantically similar_ prompts to the same cache entry, so a repeated
question does not cost another LLM API call. The standard implementation embeds the prompt
into a vector and returns a cached answer when cosine similarity to a stored prompt exceeds
some threshold.

The flaw sits in what that similarity actually measures:

> **Cosine similarity answers "are these about the same topic?"
> A cache needs to answer "do these share the same answer?"**

Those two questions diverge in three places:

| Divergence         | Example pair                                                            | Similarity | Same answer? |
| ------------------ | ----------------------------------------------------------------------- | ---------- | ------------ |
| **Numbers**        | "how many grams of protein for a 70 kg person" / "…for an 80 kg person" | ~0.97      | ❌ No        |
| **Negation**       | "is X safe during pregnancy" / "is X _not_ safe during pregnancy"       | high       | ❌ No        |
| **Named entities** | "capital of Australia" / "capital of Austria"                           | high       | ❌ No        |

A naive semantic cache does not fail loudly here. It returns a confident, fluent, **wrong**
answer, and nothing in the system logs an error. Measuring that silent failure rate is the
reason this project exists.

## 3. Non-goals

Explicitly out of scope. Each of these is a defensible omission, not an oversight:

- Approximate nearest neighbour search (HNSW), vector databases, distributed mode.
- A web UI or hosted service.
- Long-document or RAG-chunk caching — see the token limits in §7.
- LLM calls anywhere in the benchmark. The benchmark needs embeddings and labelled data
  only. This is where cost would leak in, so it is a hard rule, not a preference.
- Any paid API, cloud service, VPS or domain. **The budget is zero.**

## 4. Technical constraints

| Area                 | Decision                                                                                                                                                         |
| -------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Language             | TypeScript, `strict` mode                                                                                                                                        |
| Runtime              | Node 22+                                                                                                                                                         |
| Modules              | ESM                                                                                                                                                              |
| Embeddings           | `@huggingface/transformers`, model `onnx-community/all-MiniLM-L6-v2-ONNX`, `feature-extraction` pipeline, `{ pooling: 'mean', normalize: true }`, 384 dimensions |
| Vector storage       | `Float32Array` — **never** `number[]`                                                                                                                            |
| Normalization        | Vectors are normalized **at write time**, so search-time cosine similarity reduces to a plain dot product: no square roots, no division                          |
| Vector search        | Brute force in v1                                                                                                                                                |
| Tests                | vitest                                                                                                                                                           |
| Benchmarks           | vitest bench                                                                                                                                                     |
| Build                | tsup                                                                                                                                                             |
| Dependencies         | Kept to a minimum; every new one needs a written justification                                                                                                   |
| Language of the repo | Code, comments, commit messages, docs and README in **English**                                                                                                  |

## 5. Working rules

- **Every session starts** by reading `PROJECT.md` and `PROGRESS.md` and summarising, in
  three bullets: current phase, what was finished last, next concrete step.
- **Every session ends** by updating `PROGRESS.md`: date, work completed, technical
  decisions with their reasoning, known gaps / TODOs, next concrete step.
- **Architectural decisions** are recorded in `docs/adr/NNN-title.md`: context, options
  considered, decision, reasoning, consequences.
- **No code before a plan.** Any implementation is described in 3–5 bullets and approved
  before a file is created or changed.
- **No feature without a test.** Every public function has one.
- **No phase skipping.** A phase's exit criteria must be met before the next one starts.
- **No scope creep.** Ideas outside the phase list go to the TODO section of
  `PROGRESS.md`, not into the code.
- **Commits** are small and conventional: `feat:`, `fix:`, `test:`, `docs:`, `refactor:`,
  `bench:`.

## 6. Phases

Each phase ends when its exit criteria are demonstrably met.

### Phase 0 — Skeleton

**Goal:** `package.json`, `tsconfig` (strict), vitest, tsup, npm scripts, GitHub Actions
CI, `PROJECT.md`, `PROGRESS.md`, `docs/adr/`, LICENSE (MIT), `.gitignore`.
**Exit:** `npm test` and `npm run bench` both run clean.

### Phase 1 — Cache core

**Goal:** Build on the existing LRU implementation and add TTL, memory accounting against
a byte budget, and **single-flight** (deduplication of in-flight requests for the same key:
50 concurrent requests must hit the underlying layer exactly once).
**Exit:** A test proving single-flight behaviour passes; eviction and TTL tests pass;
benchmark numbers recorded in `PROGRESS.md`.

### Phase 2 — Exact-match layer

**Goal:** Prompt normalization (lowercasing, whitespace collapsing, punctuation), hash
based lookup, the public `get`/`set` API surface.
**Exit:** End-to-end test passes; the API surface is frozen.

### Phase 3 — Embedding layer

**Goal:** An `Embedder` interface, a transformers.js implementation, model download and
on-disk caching, warmup, batch embedding, and a `Float32Array` vs `number[]` comparison for
both memory and speed.
**Exit:** An "embed 1000 sentences" benchmark and the two-array-type comparison are
recorded.

### Phase 4 — Semantic search

**Goal:** Similarity via dot product, brute-force scan, threshold logic, and the two-tier
flow wired together: exact match → semantic → miss.
**Exit:** Integration test passes; p50/p99 latency measured; scan time at 10k entries
recorded.

### Phase 5 — Benchmark harness _(the heart of the project)_

**Goal:** Dataset loader (Quora Question Pairs, PAWS); a threshold sweep from 0.80 to 0.99
reporting hit rate **and false-positive rate** at each point; CSV output. Two comparison
axes: **(a)** embedding models (MiniLM-L6, MiniLM-L12, bge-small, e5-small), **(b)** full
precision vs q8 quantization. Plus a separate error-rate report for prompts containing
numbers, negation, or named entities.
**Exit:** Result tables produced and interpreted.

### Phase 6 — Release

**Goal:** README (problem → false-hit example → result table → 30-second setup →
architecture → limits), example code, `npm publish`, `v0.1.0` tag.
**Exit:** Package published on npm, repo public.

## 7. Known limits

Stated in the README, never hidden:

- **all-MiniLM-L6-v2 handles at most 256 tokens, and quality degrades past ~128.** Long
  prompts are not what this library is for.
- **Brute-force search is reasonable up to ~100k entries.** Beyond that, ANN is required.
- **Node is single-threaded**; heavy embedding work blocks the event loop. This must be
  measured and reported, not hand-waved.
