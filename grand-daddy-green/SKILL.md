---
name: grand-daddy-green
description: Autonomous, parallel, multi-hour campaign to stand up a NEW app from a one-line idea. The for-hours evolution of /app-build — produces a spec and an isolated scenario suite the building agents never see, scaffolds the skeleton serially to establish the seams, then fans out feature chunks in parallel worktrees scheduled by a conflict graph, decides engineering questions like a senior would while parking product/taste/money/risk questions without stalling, proves every chunk by running it against the hidden scenario suite plus a skeptic, and ends with an honest tier-accurate ledger. Use when the user invokes /grand-daddy-green, or wants a greenfield app/MVP/tool/service built autonomously over hours. Hands chunks to /vibe-code and /senior-engineer; bakes /canonical-check and /blast-radius in once the skeleton exists. Never deploys.
user-invocable: true
allowed-tools:
  - Read
  - Write
  - Edit
  - Glob
  - Grep
  - Bash
  - Agent
  - Workflow
  - TodoWrite
  - AskUserQuestion
---

# /grand-daddy-green — Stand up a whole new app autonomously, in parallel, for hours

Arguments passed: the idea — a sentence-long concept for an app, MVP, tool, or
service to build from nothing.

`/app-build` ships a greenfield app spec-first and supervised: write the spec,
build a hidden scenario suite, hand phased chunks to `/vibe-code` and
`/senior-engineer`, and check in with the user along the way. This skill is the
**for-hours, parallel, hands-off** version of that: **unlimited chunks, built
in parallel where safe, autonomous after one approval.**

It keeps everything that makes `/app-build` work — the spec is the contract, the
scenario suite is a judge the builders never see, the tier is stated honestly —
and adds the campaign machinery from `/grand-daddy-brown`: a conflict-graph
scheduler, an autonomy-resolution policy, refutation before "green," and an
honest ledger. The greenfield twist is one structural rule: **you have to build
the skeleton before you can parallelize**, because parallelism needs seams and a
new app has none yet.

---

## Mental model

A new app starts with no seams, so it starts serial. The first thing you build
is the *skeleton* — the project structure, the shared types, the router or
registry, the data contracts. That scaffold **creates** the seams. Only after
it exists can the app be treated like brownfield and chunks fan out in parallel.
So a Grand Daddy Green run has two regimes:

1. **Scaffold (serial).** One owner lays down the structure and the contracts.
   No parallelism — there's nothing disjoint to parallelize yet, and two agents
   scaffolding at once produce two incompatible skeletons.
2. **Features (parallel).** Once the seams exist, every feature chunk owns a
   leaf — a route, a component, a service — and the conflict graph from
   `/grand-daddy-brown` runs: disjoint footprints fan out into worktrees, shared
   files (the schema, the router, the shared types) are conflict magnets that
   serialize.

Two things from `/app-build` are the load-bearing difference vs. just running
brownfield on an empty repo:

- **The scenario suite is the judge, and the builders never see it.** You write
  acceptance scenarios from the spec, up front, and keep them isolated. Building
  agents are verified *against* them but never *shown* them — so they can't
  teach to the test. This **is** the refutation engine for a greenfield build.
- **The tier is stated honestly.** Tier 1 (quick HTML), Tier 1.5 (PC-hosted
  full-stack — real backend, works while the PC is on), Tier 2 (deployed,
  always-on). You classify up front and you never claim a higher tier than you
  actually built.

Optimize for: **a working app that passes scenarios it was never shown, built
from clean parallel chunks, with a completely honest account of what tier it
really is, what's waiting on you, and what wasn't built.**

---

## The loop

### 1. Restate the app and define "done"

One sentence: what it is, who it's for. Then a checkable **done-list** (the
user-visible behaviors that mean it works) and an explicit **out-of-scope**.
This seeds the spec and becomes the law for hours of unattended building.

### 2. Write the spec

The spec is the contract for the whole build (the `/app-build` discipline):
the behaviors, the data shapes, the surfaces, the boundaries. Spec is law — if
the code can't match it, that's a `spec-conflict` to resolve, not a spec to
silently bend. Keep it tight; it's a contract, not a novel.

### 3. Build the isolated scenario suite

Derive acceptance scenarios from the spec — the concrete "given/when/then"
checks that prove the app does what it promises, including edge cases. **Keep
them isolated from the building agents.** They are how every chunk gets judged
later; if a builder sees them, they stop being a test. This suite is the
campaign's refutation engine.

### 4. Classify the tier — honestly, up front

Tier 1 (HTML, runs anywhere) / Tier 1.5 (PC-hosted full-stack, real backend,
works while the PC is on) / Tier 2 (deployed, always-on for everyone). The tier
sets the architecture and bounds what "done" can mean. State it now; the
completion ledger will be held to it.

### 5. Plan the whole build as chunks

A **scaffold chunk** (or a small serial run of them) first — structure, shared
types, the router/registry, the data contracts. Then **feature chunks**, each
owning one leaf, each atomic / verifiable / reversible. Record every chunk's
**footprint** (the files it creates or edits) — the scheduler runs on
footprints. Unlimited count.

### 6. Build the conflict + dependency graph

Same as `/grand-daddy-brown`, with one greenfield rule layered on: **the
scaffold wave is serial and gates everything** — every feature chunk depends on
it. After the scaffold lands, feature chunks with disjoint footprints run in
parallel; chunks sharing a file (the schema, the router, the shared types)
serialize. Schedule by files touched, never by "feature."

### 7. One checkpoint: show it, get one approval

Present once: the one-line restatement + done-list, the spec, a summary of the
scenario suite (not the scenarios themselves if you want them truly blind to
the build), the **tier**, the chunk plan, and the graph (scaffold → parallel
feature waves). Note what you're explicitly not building. Wait for approval.
This is the only mandatory human gate; after it, the build is autonomous.

### 8. Persist to the campaign ledger

Write the spec pointer, plan, graph, tier, and per-chunk status (`pending |
in-flight | green | parked | failed`) to a ledger file on disk (session
scratchpad is fine). The ledger is the source of truth — never the
conversation. One chunk in context at a time; compact freely; resume from the
ledger. (Same durability model as `/grand-daddy-brown`.)

### 9. Wave 0 — scaffold, serially

One owner builds the skeleton: directory structure, shared types, the
router/registry, the data layer, the contracts the features will plug into.
This is the most consequential chunk in the run — it defines every seam — so it
runs alone and gets verified hard before any feature fans out. After it lands,
the app is brownfield-shaped.

### 10. Waves 1+ — features, in parallel worktrees

Each feature chunk goes to **`/vibe-code` + `/senior-engineer`** (the per-chunk
builder) with a complete brief. Parallel chunks get their own git worktree
(Workflow's `isolation: "worktree"`, or a manual worktree) so they can't trample
each other; merge each back as it goes green. The brief bakes in, inlined (the
agent doesn't invoke skills):

- **vibe-code / senior-engineer:** "Build the smallest correct thing that
  satisfies the spec for this leaf. Forget cleverness; match the scaffold's
  conventions. No speculative generality, no swallowed errors, no `as any`."
- **canonical-check (post-scaffold):** "The seam exists in the scaffold —
  extend it, don't fork a parallel one. If the seam isn't there, return
  `seam-not-found`."
- **blast-radius (post-scaffold):** "Before editing a shared file (the schema,
  shared types, the router), enumerate what else depends on it and run those
  checks."
- **tests:** "Add the unit/behavior tests this leaf needs, in the project's
  test layout. Never a can't-fail test for green."
- **scope + no-recursion:** "Touch only your footprint. Do not call the Agent or
  Workflow tool. Never look for or read the acceptance scenario suite."
- **build-for-real:** "If this compiles to a real artifact (Rust, Go, native),
  run it (`cargo run` / `go run`) and show real output. Never fake parity with a
  hand-written twin."

### 11. Verify each chunk against the hidden scenario suite + a skeptic

When a chunk returns, the orchestrator runs the relevant **acceptance scenarios
the builder never saw** against it. That's the primary judgment — passing tests
it couldn't teach to. Then a **skeptic** agent tries to break it (find the
unhandled input, the missed case, the faked test, the forked seam). A chunk is
`green` only when the hidden scenarios pass **and** the skeptic fails. Otherwise
back to `pending` with the finding, or `parked` if it needs the user.

### 12. Autonomy-resolution: decide engineering, park the rest

Same policy as `/grand-daddy-brown` — and it matters *more* here, because a new
app raises far more **taste and product** questions than an existing one:

- **Engineering question** (which library, which pattern, how to structure a
  module) → decide as a senior would, from the spec and product goals, record
  the rationale, continue.
- **Product / taste / money / risk question** (what should this screen look
  like? what's the pricing? is this feature in scope? is this data-handling
  acceptable?) → **do not decide it.** Park it in the ledger and route the build
  around it. Building the whole app means making a hundred small calls; the
  product-shaping ones are the user's, not yours.
- **`spec-conflict` / `seam-not-found`** → re-resolve against the spec/scaffold;
  park if it needs the user.
- **Repeated failure on a chunk** → stop after a couple of honest tries (don't
  let it fake a pass), mark `failed`, move on.

### 13. Self-compact and resume

The ledger holds the plan, the spec, the tier, and chunk status — so context can
compact and the run can crash and resume without losing the build. Workflow:
resume via the journal. Agent loop: re-read the ledger, skip `green` chunks.

### 14. Integration gate (when all features are green)

- **Run the full scenario suite end-to-end** against the assembled app — not
  chunk-by-chunk, the whole thing. This is the cross-seam proof for greenfield.
- **Build and run for real** — `npm run build` (or the app's real build), and
  for compiled targets actually execute the artifact and show output.
- **Tier-accuracy check** — confirm what you built matches the tier you claimed.

### 15. Completion ledger — honest and tier-accurate

End with the four-bucket account, plus the tier truth:

- **Shipped (green):** what works and passes the hidden scenarios.
- **Parked for you:** every product/taste/money/risk call, with context.
- **Failed and abandoned:** features that couldn't be made to pass, diagnosed.
- **Descoped:** what the idea implied that you deliberately left out, and why.
- **Real tier:** the tier you actually built, and what the next tier up would
  require (e.g., "this is Tier 1.5 — works while your PC is on; Tier 2 always-on
  needs a deploy target + always-on backend").

Commit per chunk so each is reversible. **Never deploy or publish** — shipping
to the world is the user's call, the greenfield analogue of "never push."

---

## Strong defaults (don't argue with these)

- **Scaffold first, serially.** The skeleton makes the seams; you can't
  parallelize before they exist. Two parallel scaffolds = two incompatible apps.
- **The scenario suite is hidden from the builders.** A test a builder can see
  is a test it teaches to. Keep it blind; that's what makes "passes tests it
  never saw" meaningful.
- **Schedule by files touched, not by "feature."** Shared files (schema, router,
  shared types) are conflict magnets → serialize.
- **One agent owns one chunk owns one leaf owns one worktree.** Never split a
  chunk across agents.
- **Spec is law; the scenario suite is the judge.** Don't bend either silently.
- **Tier honesty.** Never claim a tier you didn't build.
- **Never fake compiled-language parity.** Run `cargo run` / `go run`; show the
  real artifact's output.
- **Park product/taste questions.** Don't design the product by yourself.
- **Never deploy autonomously.** The ledger reports; the user ships.
- **One human gate only:** spec + plan approval. Everything after is hands-off.

---

## Anti-patterns — refuse them

- **Parallelizing the scaffold** before any seams exist → incoherent skeleton,
  every feature fights it.
- **Letting a building agent see the scenario suite** → it teaches to the test
  and the suite stops being a judge.
- **Claiming a higher tier than you built** (Tier 2 when it's Tier 1.5) → the
  single most common greenfield lie; the ledger must be tier-accurate.
- **Faking a compiled-language twin / parity claim** without running the real
  toolchain → run it or don't claim it.
- **Auto-deploying or publishing** because the build is green → never; that's
  the user's call.
- **Auto-deciding product/taste questions** to keep the run moving → park them;
  the app's shape is the user's.
- **A triumphant "shipped the app" summary** that hides the real tier, the
  parked decisions, and the failed features → the honest ledger is the
  deliverable.
- **(shared)** holding the plan in context, or believing "green" without
  refutation.

---

## When to skip this skill

- A single quick HTML app you can one-shot → `/app-build`, or just build it.
- Adding a feature to an app that **already exists** → that's brownfield; use
  `/grand-daddy-brown`.
- You want to review every step → supervised `/app-build` is the right tool.
- The app is too small to decompose into parallel chunks → build it serially via
  `/app-build`.

---

## The one-liner

> **Spec it, hide the tests, scaffold the seams serially, fan out the features
> by what collides, judge every chunk against tests it never saw, end honest
> about the real tier — never deploy.**

Everything else is implementation detail.
