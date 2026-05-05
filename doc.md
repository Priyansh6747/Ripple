# Ripple Project Working (Detailed)

Ripple is an intent-to-application pipeline that converts a short natural-language idea into a live, running web app URL. The system is designed as a durable workflow where each phase has a clear input, output, and failure boundary. Instead of treating AI as a single monolithic generator, Ripple separates planning, transformation, execution, and runtime verification into six deterministic stages.

The orchestration layer ensures that if any stage fails, the workflow can surface precise diagnostics and recover cleanly. This makes the project production-oriented, not just demo-oriented.

---

## End-to-End 6-Step Flow

## Step 0 - Problem Analysis

This phase converts vague user intent into a machine-actionable build specification before any file mutation begins.

### What happens

- User prompt is extracted and normalized from the incoming event payload.
- Groq is used first as a high-speed analysis and planning engine to:
  - expand the raw idea into a dense rewrite directive (`rewrite_prompt`),
  - infer domain language and lexical constraints,
  - generate a coherent brand color palette,
  - classify visual intent for selecting the most suitable starting baseline.
- A second Groq pass maps the generated palette to every existing color-bearing key path, so visual theming can be applied globally without structural drift.
- Another Groq routing pass identifies which semantic sections actually need rewriting, reducing unnecessary model calls later.

### Why this step exists

- Prevents direct blind generation from a short prompt.
- Converts ambiguity into explicit content and style constraints.
- Separates planning decisions from execution decisions, improving reproducibility.
- Lowers hallucination risk by deciding edit scope before writing content.

### Output artifacts

- Refined rewrite prompt with domain vocabulary requirements.
- Palette object plus key-level color remapping patch.
- Target section list for selective content transformation.

---

## Step 1 - Runtime Provisioning and Project Scaffolding

This phase initializes an isolated execution environment where all edits and server operations happen safely.

### What happens

- A sandbox instance is created through E2B with bounded timeouts.
- Runtime preflight checks verify Node/npm availability and command health.
- Project scaffold is prepared inside sandbox workspace (`/home/user/app`).
- Dependency installation strategy auto-selects lockfile-aware install mode (`npm ci` when lockfile exists, fallback to `npm install`).

### Reliability controls

- Hard timeout windows are applied to clone/install phases.
- stderr logging and bounded tail capture reduce noisy output while retaining actionable diagnostics.
- Any failure in provisioning aborts early before AI edit costs are incurred.

### Output artifacts

- Stable sandbox ID.
- Fully prepared project workspace with dependencies resolved.

---

## Step 2 - State Synchronization (Inbound)

This phase imports the current project configuration into the AI pipeline as the single source of truth for mutation.

### What happens

- The orchestrator reconnects to sandbox using sandbox ID.
- Canonical configuration file is downloaded from project workspace.
- Content is parsed into JSON object model.
- Retry wrappers ensure transient I/O issues do not immediately fail the flow.

### Why this step matters

- Ensures AI transforms the real current state, not a stale or assumed state.
- Enables deterministic diff-like behavior: mutate known config, then write back.
- Creates a clean read boundary before content generation.

### Output artifacts

- Parsed `originalCustomiseJson` in memory.

---

## Step 3 - Code Generation

This is the intelligence-heavy transformation phase where planning outputs are applied into structured content edits.

### What happens

- Groq outputs from Step 0 are consumed:
  - refined rewrite directive,
  - section selection list,
  - color key mapping patch.
- Gemini performs section-level JSON rewrites with strict constraints:
  - preserve object keys exactly,
  - preserve non-text structural fields,
  - avoid array-length drift,
  - aggressively replace domain-incompatible copy.
- Section rewrites are merged into original JSON using deep merge semantics.
- Color patch is then applied to all mapped key paths for visual consistency.

### Guardrails in generation

- Fence stripping and strict JSON parse flow handle model formatting noise.
- Retry loop on Gemini rewrite prevents single transient failure from collapsing pipeline.
- If a section rewrite repeatedly fails, original section is retained instead of corrupting output.

### Why this architecture works

- Groq is optimized for fast routing/planning decisions.
- Gemini is used where richer semantic rewriting quality matters.
- Combining both avoids paying high semantic-generation cost for steps that are better treated as routing/classification.



---

## Step 4 - State Synchronization (Outbound)

This phase commits generated configuration back into the running project environment.

### What happens

- Workflow reconnects to sandbox.
- Generated JSON is serialized with stable indentation.
- File upload overwrites target config atomically from orchestrator perspective.
- Retry logic handles intermittent write failures.

### Why this step exists

- Separates generation from commit, making failures easier to isolate.
- Guarantees that only validated, fully merged output is written.
- Keeps file mutation path explicit and observable.

### Output artifacts

- Updated configuration file inside sandbox project workspace.

---

## Step 5 - Runtime Finalization and Live Preview Publication

This phase turns updated source into a reachable preview URL and proves service readiness.

### What happens

- Dev server is launched in background with controlled environment flags.
- Readiness loop polls both:
  - log-based startup signals (e.g., "ready", "listening"),
  - network-level health probe (`localhost:3000` response checks).
- If startup does not converge, diagnostics are collected:
  - recent logs,
  - node process snapshot,
  - port binding state.
- On successful readiness, public host URL is derived and returned.
- Build status is persisted (`ready` or `error`) for API/UI retrieval.

### Why this is critical

- Generation success is meaningless without runtime success.
- Dual-signal readiness (logs + HTTP) reduces false positives.
- Diagnostics-first failure handling makes debugging practical in distributed async workflows.

### Output artifacts

- Live preview URL.
- Build record with sandbox ID and terminal status.

---

## Prompt Refining via Groq (Detailed)

Groq is used as a prompt intelligence layer before semantic rewriting begins.

### Responsibilities handled by Groq

- Idea expansion: converts short prompt into detailed domain rewrite brief.
- Vocabulary anchoring: injects domain-native terms to suppress generic SaaS carryover.
- Tone and framing control: aligns copy style to product category.
- Palette synthesis: creates coherent visual identity bundle.
- Color remapping planning: maps palette onto existing nested key paths.
- Rewrite routing: identifies which sections actually require mutation.

### Why Groq is ideal here

- Very low latency for orchestration-style subtasks.
- Strong structured JSON compliance with response constraints.
- Cost-efficient for repeated small planning calls in multi-step workflows.

In Ripple, this means Groq handles "what to change, where to change, and how broad the rewrite should be" before expensive semantic transformation begins.

---

## How Groq + Gemini Work Together to Boost Efficiency

Ripple uses a division-of-labor model:

- Groq = planner/router/normalizer.
- Gemini = deep semantic transformer.

### Efficiency gains from this split

- **Lower token waste:** Gemini is called only for selected sections, not entire payload.
- **Higher rewrite quality:** Gemini receives richer, constrained, context-aware instructions generated by Groq.
- **Better determinism:** Groq pre-structures decisions (sections, palette mapping), reducing free-form drift.
- **Faster end-to-end latency:** quick routing decisions are offloaded to Groq, shortening total wall-clock time.
- **Safer outputs:** structural edits are constrained by deterministic merge + patch operations outside model text generation.

### Practical outcome

Without this dual-model design, one model would have to do planning, routing, style definition, color logic, and rewriting in one pass, which increases latency and failure modes. Ripple instead stages cognition:

- Stage A (Groq): understand and decompose the problem.
- Stage B (Gemini): execute targeted semantic rewriting.
- Stage C (system logic): merge, validate, apply, run, verify.

This is the key reason the pipeline remains both fast and reliable under varied prompts.

---

## Tech Used (and Evidence for Docker + DB)

Ripple is engineered as a full-stack, AI-native software generation platform where every layer is tuned for speed, reliability, and production realism. This is not a loose collection of tools; it is a tightly composed execution architecture where each technology owns a critical responsibility in the idea-to-live-app journey.

### Core application stack

- **Next.js + React**: the presentation and interaction engine that turns generated logic into polished, responsive product experiences.
- **Node.js runtime**: the operational backbone running API contracts, workflow entry points, and automation control paths.
- **Tailwind/UI ecosystem**: a high-velocity design layer enabling consistent, production-grade interfaces without slowing build throughput.

### AI and orchestration stack

- **Inngest**: the workflow command center that gives Ripple durable, restart-safe execution across every generation stage.
- **Groq API**: the rapid cognition layer used for intent expansion, routing, and structural planning with low-latency precision.
- **Gemini API**: the semantic craftsmanship layer responsible for rich, context-aware rewriting under strict structural safeguards.
- **Agent-kit (`@inngest/agent-kit`)**: the coordination fabric that binds tools, models, and state into controlled, repeatable generation behavior.

### Sandbox and execution stack

- **E2B sandbox**: an isolated cloud execution environment where Ripple performs real file edits, command execution, and live runtime boot exactly as a real project would.
- **Custom E2B template image**: a Docker-defined sandbox foundation that standardizes runtime dependencies and ensures consistent execution across generations.


